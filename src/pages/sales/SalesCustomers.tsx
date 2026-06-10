import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomersTable, CustomerRow } from '@/components/customers/CustomersTable';
import { GlobalActivitySheet, type GlobalActivityContext } from '@/components/global/GlobalActivitySheet';
import { DataTableToolbar, ColumnDef, FilterColumnDef, SmartFilterRule, SortOption } from '@/components/shared/DataTableToolbar';
import { Plus, Building2, Users, TrendingUp, UserCheck, UserX } from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

const CUSTOMER_COLUMNS: ColumnDef[] = [
  { id: 'code', label: 'Code', defaultVisible: true, sortable: true },
  { id: 'name', label: 'Name', defaultVisible: true, sortable: true },
  { id: 'type', label: 'Type', defaultVisible: true, sortable: true },
  { id: 'contact', label: 'Contact', defaultVisible: true, sortable: true },
  { id: 'location', label: 'Location', defaultVisible: true, sortable: true },
  { id: 'stage', label: 'Stage', defaultVisible: true, sortable: true },
  { id: 'sales_volume', label: 'Sales Volume', defaultVisible: true, sortable: true },
  { id: 'tasks', label: 'Open Tasks', defaultVisible: false, sortable: true },
  { id: 'last_activity', label: 'Last Activity', defaultVisible: true, sortable: true },
  { id: 'pricing_tier', label: 'Pricing Tier', defaultVisible: false, sortable: true },
  { id: 'credit_limit', label: 'Credit Limit', defaultVisible: false, sortable: true },
  { id: 'payment_terms', label: 'Payment Terms', defaultVisible: false, sortable: true },
];

// Updated lifecycle stages to match auto-trigger logic
const LIFECYCLE_STAGES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'lead', label: 'Lead' },
  { value: 'active', label: 'Active' },
  { value: 'churned', label: 'Churned' },
];

const CUSTOMER_TYPES = [
  { value: 'SME', label: 'SME' },
  { value: 'RED', label: 'RED' },
  { value: 'Large Contractor', label: 'Large Contractor' },
  { value: 'Individual', label: 'Individual' },
  { value: 'Other', label: 'Other' },
];

const FILTER_COLUMNS: FilterColumnDef[] = [
  { id: 'computed_stage', label: 'Stage', type: 'select', options: LIFECYCLE_STAGES },
  { id: 'customer_type', label: 'Type', type: 'select', options: CUSTOMER_TYPES },
  { id: 'needs_review', label: 'Review', type: 'select', options: [
    { value: 'flagged', label: 'Needs Review' },
  ]},
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'location', label: 'Location', type: 'text' },
  { id: 'pricing_tier', label: 'Pricing Tier', type: 'select', options: [
    { value: 'standard', label: 'Standard' },
    { value: 'premium', label: 'Premium' },
    { value: 'vip', label: 'VIP' },
  ]},
];

const SORT_OPTIONS = [
  { value: 'code', label: 'Code' },
  { value: 'display_name', label: 'Name' },
  { value: 'created_at', label: 'Date Added' },
  { value: 'last_activity', label: 'Last Activity' },
  { value: 'sales_volume', label: 'Sales Volume' },
  { value: 'customer_type', label: 'Type' },
];

const STORAGE_KEY = 'customers_visible_columns';
const FILTERS_STORAGE_KEY = 'customers_filters_v1';

interface CustomerFilterState {
  searchQuery: string;
  filters: Record<string, string>;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
}

/** Convert Record<string,string> to SmartFilterRule[] */
function filtersToRules(filters: Record<string, string>): SmartFilterRule[] {
  return Object.entries(filters)
    .filter(([, v]) => v && v !== 'all')
    .map(([col, val], i) => ({ id: `r_${i}`, column: col, value: val }));
}

/** Convert SmartFilterRule[] back to Record<string,string> */
function rulesToFilters(rules: SmartFilterRule[]): Record<string, string> {
  const f: Record<string, string> = {};
  rules.forEach((r) => { f[r.column] = r.value; });
  return f;
}

function readStoredFilters(): Partial<CustomerFilterState> {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<CustomerFilterState>;
  } catch { return {}; }
}

function getStoredColumns(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return CUSTOMER_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id);
}

function storeColumns(columns: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
}

/** Compute lifecycle stage from actual data */
function computeStage(hasOpportunities: boolean, hasOrders: boolean): string {
  if (hasOrders) return 'active';
  if (hasOpportunities) return 'lead';
  return 'prospect';
}

function SalesCustomersContent() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const stored = useRef(readStoredFilters()).current;

  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("q") ?? stored.searchQuery ?? ''
  );
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(() => {
    const stage = searchParams.get("stage") ?? stored.filters?.computed_stage;
    const type = searchParams.get("type") ?? stored.filters?.customer_type;
    const filters: Record<string, string> = {};
    if (stage) filters.computed_stage = stage;
    if (type) filters.customer_type = type;
    return filters;
  });
  const [activeSort, setActiveSort] = useState<SortOption | null>(() => {
    const col = searchParams.get("sortCol") ?? stored.sortColumn;
    const dir = (searchParams.get("sortDir") ?? stored.sortDirection) as "asc" | "desc" | null;
    return col ? { column: col, direction: dir || "desc" } : { column: 'last_activity', direction: 'desc' };
  });
  const [visibleColumns, setVisibleColumns] = useState<string[]>(getStoredColumns);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityContext, setActivityContext] = useState<GlobalActivityContext | undefined>();

  // Sync state to URL
  const syncParams = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (activeFilters.computed_stage) params.set("stage", activeFilters.computed_stage);
    if (activeFilters.customer_type) params.set("type", activeFilters.customer_type);
    if (activeSort && activeSort.column !== "last_activity") params.set("sortCol", activeSort.column);
    if (activeSort && activeSort.direction !== "desc") params.set("sortDir", activeSort.direction);

    // Persist to localStorage
    const filterState: CustomerFilterState = {
      searchQuery,
      filters: activeFilters,
      sortColumn: activeSort?.column || 'last_activity',
      sortDirection: activeSort?.direction || 'desc',
    };
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filterState));

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [searchQuery, activeFilters, activeSort, setSearchParams]);

  useEffect(() => { syncParams(); }, [syncParams]);

  const handleEdit = (customer: CustomerRow) => {
    setActivityContext({
      action: 'edit',
      entityType: 'customer',
      customerId: customer.account_id,
      customerName: customer.account?.display_name || '',
      customerCode: customer.account_code || undefined,
    });
    setActivityOpen(true);
  };

  const handleAdd = () => {
    setActivityContext({ action: 'create', entityType: 'customer' });
    setActivityOpen(true);
  };

  const toggleColumn = (columnId: string) => {
    setVisibleColumns((prev) => {
      const newColumns = prev.includes(columnId)
        ? prev.filter((c) => c !== columnId)
        : [...prev, columnId];
      storeColumns(newColumns);
      return newColumns;
    });
  };

  const handleFilterChange = (filterId: string, value: string) => {
    setActiveFilters((prev) => ({ ...prev, [filterId]: value }));
  };

  // Fetch customers from view
  const { data: rawCustomers, isLoading, error } = useQuery({
    queryKey: ['sales-customers', searchQuery, activeSort],
    refetchInterval: 60_000,
    queryFn: async () => {
      let query = supabase
        .from('customer_list_v1')
        .select('*')

      query = query.neq('account_status', 'deleted');

      if (searchQuery) {
        query = query.or(`display_name.ilike.%${searchQuery}%,legal_name.ilike.%${searchQuery}%`);
      }

      // Sort - handle code sort via accounts join isn't possible on view, so we handle it
      if (activeSort && activeSort.column !== 'code') {
        const nullsFirst = activeSort.direction === 'desc' ? false : true;
        query = query.order(activeSort.column, { ascending: activeSort.direction === 'asc', nullsFirst });
      } else if (!activeSort) {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      if (!data) return [];

      const accountIds = data.map((c) => c.account_id).filter(Boolean) as string[];
      
      // Fetch contacts, account codes, opportunity counts, and order counts in parallel
      const [{ data: contacts }, { data: accountCodes }, { data: oppCounts }, { data: orderCounts }, { data: accountMetadata }] = await Promise.all([
        supabase
          .from('contacts')
          .select('account_id, id, full_name, phone, email, role_title, is_primary, prefers_whatsapp, notes')
          .in('account_id', accountIds),
        supabase
          .from('accounts')
          .select('id, code, metadata')
          .in('id', accountIds).is('deleted_at', null),
        supabase
          .from('opportunities')
          .select('customer_account_id')
          .in('customer_account_id', accountIds)
          .eq('status', 'active'),
        supabase
          .from('orders')
          .select('customer_account_id')
          .in('customer_account_id', accountIds),
        Promise.resolve({ data: null }), // metadata already in accountCodes
      ]);

      const codeMap = new Map(accountCodes?.map(a => [a.id, a.code]) || []);
      const metadataMap = new Map(accountCodes?.map(a => [a.id, a.metadata]) || []);
      
      // Build sets of accounts with opportunities and orders
      const accountsWithOpps = new Set(oppCounts?.map(o => o.customer_account_id) || []);
      const accountsWithOrders = new Set(orderCounts?.map(o => o.customer_account_id) || []);

      return data.map((row): CustomerRow => {
        const customerContacts = contacts?.filter((c) => c.account_id === row.account_id) || [];
        const hasOpps = accountsWithOpps.has(row.account_id!);
        const hasOrders = accountsWithOrders.has(row.account_id!);
        const computed_stage = computeStage(hasOpps, hasOrders);
        
        const meta = metadataMap.get(row.account_id!) as any;
        const needsReview = meta?.needs_review || null;
        
        return {
          account_id: row.account_id!,
          account_code: codeMap.get(row.account_id!) || null,
          lifecycle_stage: computed_stage,
          customer_type: row.customer_type!,
          pricing_tier: row.pricing_tier,
          payment_terms_days: row.payment_terms_days,
          credit_limit: row.credit_limit,
          notes: (row as any).account_notes || null,
          created_at: (row as any).account_created_at || '',
          needs_review: needsReview,
          account: {
            id: row.account_id!,
            display_name: row.display_name,
            legal_name: row.legal_name,
            status: row.account_status!,
            tax_number: null,
            website: null,
            notes: null,
          },
          primary_contact: row.primary_contact_id ? {
            id: row.primary_contact_id,
            full_name: (row as any).primary_contact_name || '',
            phone: row.primary_contact_phone,
            email: row.primary_contact_email,
          } : null,
          location: row.city ? {
            city: row.city,
            country: (row as any).country || 'SA',
          } : null,
          open_tasks_count: (row as any).open_tasks_count || 0,
          last_activity: (row as any).last_activity || null,
          contacts: customerContacts,
          full_location: row.location_id ? {
            address_text: row.address_text,
            city: row.city,
            country: (row as any).country || 'SA',
            address_link: (row as any).address_link || null,
            place_name: null,
            place_id: null,
            lat: row.lat ? Number(row.lat) : null,
            lng: row.lng ? Number(row.lng) : null,
            zone_id: null,
          } : null,
        };
      });
    },
  });

  // Apply client-side filtering for computed_stage and customer_type, and code sort
  const customers = useMemo(() => {
    if (!rawCustomers) return [];
    let filtered = rawCustomers;

    if (activeFilters.computed_stage && activeFilters.computed_stage !== 'all') {
      filtered = filtered.filter(c => c.lifecycle_stage === activeFilters.computed_stage);
    }
    if (activeFilters.customer_type && activeFilters.customer_type !== 'all') {
      filtered = filtered.filter(c => c.customer_type === activeFilters.customer_type);
    }
    if (activeFilters.needs_review && activeFilters.needs_review !== 'all') {
      filtered = filtered.filter(c => !!c.needs_review);
    }

    // Handle code sort client-side
    if (activeSort?.column === 'code') {
      filtered = [...filtered].sort((a, b) => {
        const aCode = a.account_code || '';
        const bCode = b.account_code || '';
        return activeSort.direction === 'asc' 
          ? aCode.localeCompare(bCode) 
          : bCode.localeCompare(aCode);
      });
    }

    return filtered;
  }, [rawCustomers, activeFilters, activeSort]);

  // Summary stats
  const stats = useMemo(() => {
    if (!rawCustomers) return { total: 0, prospects: 0, leads: 0, active: 0 };
    return {
      total: rawCustomers.length,
      prospects: rawCustomers.filter(c => c.lifecycle_stage === 'prospect').length,
      leads: rawCustomers.filter(c => c.lifecycle_stage === 'lead').length,
      active: rawCustomers.filter(c => c.lifecycle_stage === 'active').length,
    };
  }, [rawCustomers]);



  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
          <p className="text-muted-foreground text-sm">
            {customers?.length || 0} customers
          </p>
        </div>
        <TooltipProvider>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={() => {
                  setActivityContext({ action: "update", entityType: "customer" });
                  setActivityOpen(true);
                }}>
                  Add Update
                </Button>
              </TooltipTrigger>
              <TooltipContent>Log an update on an existing customer</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create a new customer account</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveFilters({})}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-purple-500/50 transition-colors" onClick={() => setActiveFilters({ computed_stage: 'prospect' })}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center">
                <UserX className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.prospects}</p>
                <p className="text-xs text-muted-foreground">Prospects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => setActiveFilters({ computed_stage: 'lead' })}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.leads}</p>
                <p className="text-xs text-muted-foreground">Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-green-500/50 transition-colors" onClick={() => setActiveFilters({ computed_stage: 'active' })}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <DataTableToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search customers..."
        columns={CUSTOMER_COLUMNS}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
        filterColumns={FILTER_COLUMNS}
        activeSmartFilters={filtersToRules(activeFilters)}
        onSmartFiltersChange={(rules) => setActiveFilters(rulesToFilters(rules))}
        sortOptions={SORT_OPTIONS}
        activeSort={activeSort}
        defaultSort={{ column: 'last_activity', direction: 'desc' }}
        onSortChange={(sort) => setActiveSort(sort ?? { column: 'last_activity', direction: 'desc' })}
        onClear={() => {
          setSearchQuery('');
          setActiveFilters({});
          setActiveSort({ column: 'last_activity', direction: 'desc' });
        }}
      />

      {/* Customer List */}
      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center text-destructive">
              Failed to load customers. Please try again.
            </div>
          ) : customers?.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No customers found</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {searchQuery ? 'Try a different search' : 'Add your first customer to get started'}
              </p>
              {!searchQuery && (
                <Button onClick={handleAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              )}
            </div>
          ) : (
            <CustomersTable 
              customers={customers || []} 
              onEdit={handleEdit} 
              visibleColumns={visibleColumns}
            />
          )}
        </CardContent>
      </Card>

      <GlobalActivitySheet
        open={activityOpen}
        onOpenChange={setActivityOpen}
        context={activityContext}
      />
    </div>
  );
}

const SalesCustomers = () => (
  <ProtectedRoute>
    <AppLayout title="Customers">
      <SalesCustomersContent />
    </AppLayout>
  </ProtectedRoute>
);

export default SalesCustomers;

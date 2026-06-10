import { useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Building2, User, Phone, MapPin, MoreHorizontal, ExternalLink, Pencil,
  ListTodo, Clock, Mail, ChevronRight, FolderKanban, Plus, DollarSign, Trash2, Target, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PhaseIndicator } from '@/components/shared/PhaseIndicator';
import { StageBadge, InterestBadge, ActivityIndicator, CodeCell } from '@/components/shared/TableCellRenderers';
import { GlobalActivitySheet, type GlobalActivityContext } from '@/components/global/GlobalActivitySheet';

export interface CustomerRow {
  account_id: string;
  account_code?: string | null;
  lifecycle_stage: string;
  customer_type: string;
  pricing_tier: string | null;
  payment_terms_days: number | null;
  credit_limit: number | null;
  notes: string | null;
  created_at: string;
  needs_review: string | null;
  account: {
    id: string;
    display_name: string | null;
    legal_name: string | null;
    status: string;
    tax_number: string | null;
    website: string | null;
    notes: string | null;
  } | null;
  primary_contact: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
  } | null;
  location: {
    city: string | null;
    country: string;
  } | null;
  open_tasks_count: number;
  last_activity: string | null;
  contacts: Array<{
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    role_title: string | null;
    is_primary: boolean;
    prefers_whatsapp: boolean;
    notes: string | null;
  }>;
  full_location: {
    address_text: string | null;
    city: string | null;
    country: string;
    address_link: string | null;
    place_name: string | null;
    place_id: string | null;
    lat: number | null;
    lng: number | null;
    zone_id: string | null;
  } | null;
}

interface ColumnDef {
  id: string;
  label: string;
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { id: 'code', label: 'Code', defaultVisible: true },
  { id: 'name', label: 'Name', defaultVisible: true },
  { id: 'type', label: 'Type', defaultVisible: true },
  { id: 'contact', label: 'Contact', defaultVisible: true },
  { id: 'location', label: 'Location', defaultVisible: true },
  { id: 'stage', label: 'Stage', defaultVisible: true },
  { id: 'sales_volume', label: 'Sales Volume', defaultVisible: true },
  { id: 'tasks', label: 'Open Tasks', defaultVisible: false },
  { id: 'last_activity', label: 'Last Activity', defaultVisible: false },
  { id: 'pricing_tier', label: 'Pricing Tier', defaultVisible: false },
  { id: 'credit_limit', label: 'Credit Limit', defaultVisible: false },
  { id: 'payment_terms', label: 'Payment Terms', defaultVisible: false },
];

const STORAGE_KEY = 'customers_visible_columns';

const lifecycleStageColors: Record<string, string> = {
  prospect: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  lead: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  blacklisted: 'bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-200',
  churned: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  qualified: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  customer: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

const typeColors: Record<string, string> = {
  'SME': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  'RED': 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
  'Large Contractor': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  'Individual': 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300',
  'Other': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

interface CustomersTableProps {
  customers: CustomerRow[];
  onEdit: (customer: CustomerRow) => void;
  visibleColumns?: string[];
}

function getStoredColumns(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id);
}

export function CustomersTable({ customers, onEdit, visibleColumns: externalVisibleColumns }: CustomersTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const visibleColumns = externalVisibleColumns || getStoredColumns();
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showActivity, setShowActivity] = useState(false);
  const [activityCtx, setActivityCtx] = useState<GlobalActivityContext | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const softDeleteMutation = useMutation({
    mutationFn: async ({ accountId, reason }: { accountId: string; reason: string }) => {
      const { error } = await supabase
        .from('accounts')
        // .update({ deleted_at: new Date().toISOString(), deleted_reason: reason, status: 'deleted' } as any)
        .update({deleted_at: new Date().toISOString(),deleted_reason: reason, status: 'deleted'})
        .eq('id', accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Customer deleted');
      queryClient.invalidateQueries({ queryKey: ['sales-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-list'] });
      setDeleteDialog(null);
      setDeleteReason('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete customer');
    },
  });

  const customerIds = customers.map(c => c.account_id);

  // Fetch projects for all customers
  const { data: projectsData } = useQuery({
    queryKey: ['customer-projects-list', customerIds],
    queryFn: async () => {
      if (customerIds.length === 0) return {};
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, project_type, current_phase, customer_account_id, created_at, metadata, location:locations(city, address_link, lat, lng)')
        .in('customer_account_id', customerIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const grouped: Record<string, typeof data> = {};
      data?.forEach(project => {
        if (!grouped[project.customer_account_id]) grouped[project.customer_account_id] = [];
        grouped[project.customer_account_id].push(project);
      });
      return grouped;
    },
    enabled: customerIds.length > 0,
  });

  // Fetch opportunities grouped by project for expanded customers
  const expandedCustomerIds = Array.from(expandedCustomers);
  const { data: opportunitiesData } = useQuery({
    queryKey: ['customer-opportunities-list', expandedCustomerIds],
    queryFn: async () => {
      if (expandedCustomerIds.length === 0) return {};
      const { data, error } = await supabase
        .from('opportunities')
        .select('id, title, code, stage, interest_level, expected_close_date, project_id, customer_account_id')
        .in('customer_account_id', expandedCustomerIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Group by project_id
      const grouped: Record<string, typeof data> = {};
      data?.forEach(opp => {
        const key = opp.project_id || `loose_${opp.customer_account_id}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(opp);
      });
      return grouped;
    },
    enabled: expandedCustomerIds.length > 0,
  });

  // Fetch last activity for visible opportunities
  const allOppIds = Object.values(opportunitiesData || {}).flat().map((o: any) => o.id);
  const { data: oppActivities } = useQuery({
    queryKey: ['customer-opp-activities', allOppIds],
    queryFn: async () => {
      if (allOppIds.length === 0) return {};
      const { data, error } = await supabase
        .from('communications')
        .select('opportunity_id, occurred_at')
        .in('opportunity_id', allOppIds)
        .order('occurred_at', { ascending: false });
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach(c => { if (c.opportunity_id && !map[c.opportunity_id]) map[c.opportunity_id] = c.occurred_at; });
      return map;
    },
    enabled: allOppIds.length > 0,
  });

  // Fetch total sales volume per customer
  const { data: salesVolumeData } = useQuery({
    queryKey: ['customer-sales-volume', customerIds],
    queryFn: async () => {
      if (customerIds.length === 0) return {};
      const { data, error } = await supabase
        .from('orders')
        .select('customer_account_id, total')
        .in('customer_account_id', customerIds);
      if (error) throw error;

      const totals: Record<string, number> = {};
      data?.forEach(order => {
        if (!totals[order.customer_account_id]) totals[order.customer_account_id] = 0;
        totals[order.customer_account_id] += order.total || 0;
      });
      return totals;
    },
    enabled: customerIds.length > 0,
  });

  const toggleExpanded = (customerId: string) => {
    setExpandedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) newSet.delete(customerId); else newSet.add(customerId);
      return newSet;
    });
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) newSet.delete(projectId); else newSet.add(projectId);
      return newSet;
    });
  };

  const isVisible = (columnId: string) => visibleColumns.includes(columnId);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === 0) return '-';
    return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(value);
  };

  const visibleColumnCount = visibleColumns.length + 2;

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] sticky left-0 bg-background z-10"></TableHead>
                {isVisible('code') && <TableHead className="w-[100px]">Code</TableHead>}
                {isVisible('name') && <TableHead>Name</TableHead>}
                {isVisible('type') && <TableHead>Type</TableHead>}
                {isVisible('contact') && <TableHead>Contact</TableHead>}
                {isVisible('location') && <TableHead>Location</TableHead>}
                {isVisible('stage') && <TableHead>Stage</TableHead>}
                {isVisible('sales_volume') && <TableHead className="text-right">Sales Volume</TableHead>}
                {isVisible('tasks') && <TableHead className="text-center">Tasks</TableHead>}
                {isVisible('last_activity') && <TableHead>Last Activity</TableHead>}
                {isVisible('pricing_tier') && <TableHead>Pricing Tier</TableHead>}
                {isVisible('credit_limit') && <TableHead className="text-right">Credit Limit</TableHead>}
                {isVisible('payment_terms') && <TableHead className="text-center">Payment Terms</TableHead>}
                <TableHead className="w-[50px] sticky right-0 bg-background z-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => {
                const projects = projectsData?.[customer.account_id] || [];
                const isExpanded = expandedCustomers.has(customer.account_id);
                const customerName = customer.account?.display_name || 'Unnamed';
                const salesVolume = salesVolumeData?.[customer.account_id] || 0;
                const flaggedProjectsCount = projects.filter((p: any) => (p.metadata as any)?.needs_review).length;

                return (
                  <Fragment key={customer.account_id}>
                    {/* ── Customer Row ── */}
                    <TableRow className="cursor-pointer">
                      <TableCell className="p-2 sticky left-0 bg-background z-10">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); toggleExpanded(customer.account_id); }}>
                          <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                        </Button>
                      </TableCell>

                      {isVisible('code') && (
                        <TableCell onClick={() => navigate(`/sales/customers/${customer.account_id}`)}>
                          <span className="text-xs font-mono text-muted-foreground">{customer.account_code || '—'}</span>
                        </TableCell>
                      )}

                      {isVisible('name') && (
                        <TableCell onClick={() => navigate(`/sales/customers/${customer.account_id}`)}>
                          <div className="flex items-center gap-3">
                            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", customer.needs_review ? "bg-destructive/10" : "bg-primary/10")}>
                              {customer.needs_review ? <AlertTriangle className="h-4 w-4 text-destructive" /> : customer.customer_type === 'Individual' ? <User className="h-4 w-4 text-primary" /> : <Building2 className="h-4 w-4 text-primary" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{customerName}</p>
                                {customer.needs_review && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 shrink-0">Needs Review</Badge>
                                )}
                              </div>
                              {customer.account?.legal_name && <p className="text-xs text-muted-foreground truncate">{customer.account.legal_name}</p>}
                              {customer.needs_review && <p className="text-xs text-destructive/80 truncate">{customer.needs_review}</p>}
                              {projects.length > 0 && <p className="text-xs text-muted-foreground">{projects.length} project{projects.length !== 1 ? 's' : ''}{flaggedProjectsCount > 0 && <span className="text-destructive ml-1">({flaggedProjectsCount} need{flaggedProjectsCount !== 1 ? '' : 's'} review)</span>}</p>}
                            </div>
                          </div>
                        </TableCell>
                      )}

                      {isVisible('type') && (
                        <TableCell onClick={() => navigate(`/sales/customers/${customer.account_id}`)}>
                          <Badge variant="secondary" className={cn("text-xs", typeColors[customer.customer_type] || '')}>{customer.customer_type}</Badge>
                        </TableCell>
                      )}

                      {isVisible('contact') && (
                        <TableCell onClick={() => navigate(`/sales/customers/${customer.account_id}`)}>
                          {customer.primary_contact ? (
                            <div className="space-y-3 flex flex-col items-center">
                              <div className="text-sm font-medium">{customer.primary_contact.full_name}</div>
                              <div className="flex items-center justify-center mt-10 gap-2 text-xs text-muted-foreground">
                                {customer.primary_contact.phone && (
                                      <a
                                      href={`tel:${customer.primary_contact.phone}`}
                                      className="text-xs text-primary flex items-center gap-1.5  no-underline"
                                      onClick={(e) => {
                                        e.preventDefault(); // لمنع فتح رابط tel
                                        let cleanNumber = customer.primary_contact.phone;
                                        if (cleanNumber.startsWith("0")) {
                                          cleanNumber = `${cleanNumber.substring(1)}`;
                                        }
                                        window.open(`https://wa.me/${cleanNumber}`, "_blank");
                                      }}
                                    >
                                      <Phone className="h-3 w-3" />{customer.primary_contact.phone}
                                    </a>
                                  
                                )}
                                {customer.primary_contact.email && (
                                  <button type="button" className="flex items-center gap-1  hover:text-primary" onClick={(e) => { e.stopPropagation(); window.open(`mailto:${customer.primary_contact?.email}`); }}>
                                    <Mail className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      )}

                      {isVisible('location') && (
                        <TableCell>
                          {customer.full_location ? (
                            <a
                              href={customer.full_location.address_link || (customer.full_location.lat && customer.full_location.lng ? `https://www.google.com/maps?q=${customer.full_location.lat},${customer.full_location.lng}` : undefined)}
                              target="_blank" rel="noopener noreferrer"
                              className="text-sm flex items-center gap-1 hover:text-primary"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {[customer.full_location.city, customer.full_location.country].filter(Boolean).join(', ')}
                            </a>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      )}

                      {isVisible('stage') && (
                        <TableCell onClick={() => navigate(`/sales/customers/${customer.account_id}`)}>
                          <Badge variant="secondary" className={cn("text-xs", lifecycleStageColors[customer.lifecycle_stage] || '')}>{customer.lifecycle_stage}</Badge>
                        </TableCell>
                      )}

                      {isVisible('sales_volume') && (
                        <TableCell className="text-right" onClick={() => navigate(`/sales/customers/${customer.account_id}`)}>
                          {salesVolume > 0 ? (
                            <span className="text-sm font-medium flex items-center justify-end gap-1">
                              <DollarSign className="h-3 w-3 text-muted-foreground" />{formatCurrency(salesVolume)}
                            </span>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      )}

                      {isVisible('tasks') && (
                        <TableCell className="text-center" onClick={() => navigate(`/sales/customers/${customer.account_id}`)}>
                          {customer.open_tasks_count > 0 ? (
                            <Badge variant="secondary" className="text-xs"><ListTodo className="h-3 w-3 mr-1" />{customer.open_tasks_count}</Badge>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      )}

                      {isVisible('last_activity') && (
                        <TableCell onClick={() => navigate(`/sales/customers/${customer.account_id}`)}>
                          {customer.last_activity ? (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />{formatDistanceToNow(new Date(customer.last_activity), { addSuffix: true })}
                            </span>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      )}

                      {isVisible('pricing_tier') && (
                        <TableCell onClick={() => navigate(`/sales/customers/${customer.account_id}`)}>
                          <span className="text-sm">{customer.pricing_tier || '-'}</span>
                        </TableCell>
                      )}

                      {isVisible('credit_limit') && (
                        <TableCell className="text-right" onClick={() => navigate(`/sales/customers/${customer.account_id}`)}>
                          <span className="text-sm">{formatCurrency(customer.credit_limit)}</span>
                        </TableCell>
                      )}

                      {isVisible('payment_terms') && (
                        <TableCell className="text-center" onClick={() => navigate(`/sales/customers/${customer.account_id}`)}>
                          <span className="text-sm">{customer.payment_terms_days ? `${customer.payment_terms_days} days` : '-'}</span>
                        </TableCell>
                      )}

                      {/* Actions - sticky right */}
                      <TableCell className="sticky right-0 bg-background z-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/sales/customers/${customer.account_id}`); }}>
                              <ExternalLink className="h-4 w-4 mr-2" />View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(customer); }}>
                              <Pencil className="h-4 w-4 mr-2" />Edit Customer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setActivityCtx({ action: 'create', entityType: 'project', customerId: customer.account_id, customerName }); setShowActivity(true); }}>
                              <Plus className="h-4 w-4 mr-2" />Add Project
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setActivityCtx({ action: 'create', entityType: 'opportunity', customerId: customer.account_id, customerName }); setShowActivity(true); }}>
                              <Target className="h-4 w-4 mr-2" />Add Opportunity
                            </DropdownMenuItem>
                            {customer.primary_contact?.phone && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(`tel:${customer.primary_contact?.phone}`); }}>
                                <Phone className="h-4 w-4 mr-2" />Call
                              </DropdownMenuItem>
                            )}
                            {customer.full_location && (customer.full_location.address_link || (customer.full_location.lat && customer.full_location.lng)) && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(customer.full_location?.address_link || `https://www.google.com/maps?q=${customer.full_location?.lat},${customer.full_location?.lng}`, '_blank'); }}>
                                <MapPin className="h-4 w-4 mr-2" />Open in Maps
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteDialog({ id: customer.account_id, name: customerName }); }}>
                              <Trash2 className="h-4 w-4 mr-2" />Delete Customer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>

                    {/* ── Expanded: Projects + Opportunities ── */}
                    {isExpanded && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={visibleColumnCount} className="p-0">
                          <div className="py-2 px-8">
                            {projects.length === 0 ? (
                              <div className="flex items-center justify-between py-1 text-muted-foreground text-sm">
                                <span>No projects yet</span>
                                <Button variant="ghost" size="sm" onClick={() => { setActivityCtx({ action: 'create', entityType: 'project', customerId: customer.account_id, customerName }); setShowActivity(true); }}>
                                  <Plus className="h-4 w-4 mr-1" />Add Project
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                {projects.map((project, index) => {
                                  const projectOpps = opportunitiesData?.[project.id] || [];
                                  const isProjectExpanded = expandedProjects.has(project.id);
                                  return (
                                    <Fragment key={project.id}>
                                      {/* Project Row */}
                                      <div className={cn(
                                        "flex items-center justify-between py-1.5 px-2 text-sm hover:bg-muted/50 rounded",
                                        index !== projects.length - 1 && !isProjectExpanded && "border-b border-border/50"
                                      )}>
                                        <div className="flex items-center gap-2 min-w-0">
                                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleProject(project.id)}>
                                            <ChevronRight className={cn("h-3 w-3 transition-transform", isProjectExpanded && "rotate-90")} />
                                          </Button>
                                          <FolderKanban className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                          <button className="font-medium truncate hover:text-primary hover:underline text-left" onClick={() => navigate(`/sales/projects/${project.id}`)}>
                                            {project.name}
                                          </button>
                                          {(project as any).metadata?.needs_review && (
                                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 shrink-0 flex items-center gap-1" title={String((project as any).metadata.needs_review)}>
                                              <AlertTriangle className="h-3 w-3" />
                                              Review
                                            </Badge>
                                          )}
                                          {project.project_type && <Badge variant="outline" className="text-xs">{project.project_type}</Badge>}
                                          {project.current_phase && <span className="hidden md:inline"><PhaseIndicator phase={project.current_phase} variant="dot" /></span>}
                                          {projectOpps.length > 0 && <Badge variant="secondary" className="text-xs">{projectOpps.length} opp{projectOpps.length !== 1 ? 's' : ''}</Badge>}
                                          {project.location?.city && (
                                            <a href={project.location.address_link || (project.location.lat && project.location.lng ? `https://www.google.com/maps?q=${project.location.lat},${project.location.lng}` : undefined)}
                                              target="_blank" rel="noopener noreferrer"
                                              className="text-xs text-muted-foreground hidden lg:flex items-center gap-1 hover:text-primary"
                                              onClick={(e) => e.stopPropagation()}>
                                              <MapPin className="h-3 w-3" />{project.location.city}
                                            </a>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setActivityCtx({ action: 'create', entityType: 'opportunity', customerId: customer.account_id, customerName, projectId: project.id, projectName: project.name }); setShowActivity(true); }}>
                                            <Plus className="h-3 w-3 mr-1" /><Target className="h-3 w-3" />
                                          </Button>
                                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setActivityCtx({ action: 'edit', entityType: 'project', customerId: customer.account_id, customerName, projectId: project.id, projectName: project.name }); setShowActivity(true); }}>
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Opportunities under project */}
                                      {isProjectExpanded && projectOpps.length > 0 && (
                                        <div className="ml-10 mb-2 space-y-0.5">
                                          {projectOpps.map((opp: any) => (
                                            <div key={opp.id}
                                              className="flex items-center justify-between py-1.5 px-3 text-sm hover:bg-accent/50 rounded cursor-pointer border-l-2 border-primary/20"
                                              onClick={() => navigate(`/sales/opportunities/${opp.id}`)}
                                            >
                                              <div className="flex items-center gap-3 min-w-0">
                                                <Target className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                                <span className="font-medium truncate">{opp.title}</span>
                                                <CodeCell code={opp.code} />
                                                <StageBadge stage={opp.stage} />
                                                <InterestBadge level={opp.interest_level} />
                                              </div>
                                              <div className="flex items-center gap-3 shrink-0">
                                                <ActivityIndicator date={oppActivities?.[opp.id] || null} />
                                                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={(e) => { e.stopPropagation(); setActivityCtx({ action: 'update', entityType: 'opportunity', customerId: customer.account_id, customerName, projectId: project.id, projectName: project.name, opportunityId: opp.id, opportunityName: opp.title, opportunityCode: opp.code }); setShowActivity(true); }}>
                                                  <Plus className="h-3 w-3 mr-0.5" />Update
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {isProjectExpanded && projectOpps.length === 0 && (
                                        <div className="ml-10 mb-2 py-2 px-3 text-xs text-muted-foreground italic">
                                          No opportunities for this project
                                        </div>
                                      )}
                                    </Fragment>
                                  );
                                })}
                                <div className="pt-1">
                                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setActivityCtx({ action: 'create', entityType: 'project', customerId: customer.account_id, customerName }); setShowActivity(true); }}>
                                    <Plus className="h-3 w-3 mr-1" />Add Project
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <GlobalActivitySheet
        open={showActivity}
        onOpenChange={setShowActivity}
        context={activityCtx || undefined}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteDialog?.name}?</DialogTitle>
            <DialogDescription>This will mark the customer as deleted. They won't appear in lists but data will be preserved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason for deletion *</Label>
            <Textarea placeholder="Why is this customer being deleted?" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!deleteReason.trim() || softDeleteMutation.isPending} onClick={() => { if (deleteDialog) softDeleteMutation.mutate({ accountId: deleteDialog.id, reason: deleteReason }); }}>
              {softDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

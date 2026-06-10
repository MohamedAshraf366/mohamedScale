import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Loader2, Upload, ChevronDown, XCircle, BarChart3, ChevronRight, Clock, Edit2, Trash2, Filter, Calendar, X, AlertCircle } from 'lucide-react';
import { PageGuidance } from '@/components/supply/PageGuidance';
import { SUPPLIER_MATERIALS_GUIDANCE } from '@/components/supply/guidance-content';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layout';
import { AddQuoteSheet, type EditQuoteData } from '@/components/suppliers/AddQuoteSheet';
import { SupplierComparisonTab } from '@/components/suppliers/SupplierComparisonTab';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import {
  useSupplierQuotes,
  type SupplierQuoteStatus,
} from '@/hooks/useSupplierQuotes';
import { type SupplierMaterialStatus } from '@/hooks/useSupplierMaterials';
import {
  useSupplierQuoteValidity,
  deriveValidityLabel,
  type DerivedValidityLabel,
} from '@/hooks/useSupplierQuoteValidity';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS_TABS: Array<{ value: SupplierQuoteStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

// Date filter options
const DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' },
];

export default function SupplierMaterials() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'quotes' | 'compare'>('quotes');
  const [activeTab, setActiveTab] = useState<SupplierQuoteStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [addSheetMode, setAddSheetMode] = useState<'manual' | 'ai-upload'>('manual');
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set());
  
  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectLoading, setBulkRejectLoading] = useState(false);
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkApproveLoading, setBulkApproveLoading] = useState(false);

  // Edit/Delete quote state
  const [editingQuote, setEditingQuote] = useState<EditQuoteData | null>(null);
  const [deleteQuoteDialogOpen, setDeleteQuoteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);
  
  const { data: quotes = [], isLoading } = useSupplierQuotes(activeTab);
  const { data: validityRecords = [] } = useSupplierQuoteValidity();

  // Get unique suppliers for filter
  const suppliers = useMemo(() => {
    const supplierMap = new Map<string, string>();
    quotes.forEach(q => {
      if (q.supplier_account_id && q.supplier_name) {
        supplierMap.set(q.supplier_account_id, q.supplier_name);
      }
    });
    return Array.from(supplierMap.entries()).map(([id, name]) => ({ id, name }));
  }, [quotes]);

  // Build validity map
  const validityMap = new Map<string, typeof validityRecords[0]>();
  for (const rec of validityRecords) {
    const existing = validityMap.get(rec.supplier_quote_id);
    if (!existing || new Date(rec.created_at) > new Date(existing.created_at)) {
      validityMap.set(rec.supplier_quote_id, rec);
    }
  }

  const VALIDITY_BADGE_COLORS: Record<DerivedValidityLabel, string> = {
    active: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
    expiring_soon: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
    awaiting_supplier: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
    supplier_changed: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
    awaiting_management: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30',
    expired: 'bg-destructive/10 text-destructive border-destructive/30',
  };

  const VALIDITY_LABELS: Record<DerivedValidityLabel, string> = {
    active: 'Active',
    expiring_soon: 'Expiring Soon',
    awaiting_supplier: 'Awaiting Supplier',
    supplier_changed: 'Supplier Changed',
    awaiting_management: 'Awaiting Mgmt',
    expired: 'Expired',
  };

  // Helper function for date range
  const getDateRange = (): { from: Date | null; to: Date | null } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateFilter) {
      case 'today':
        return { from: today, to: today };
      case 'week': {
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay());
        return { from: start, to: today };
      }
      case 'month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: start, to: today };
      }
      case 'custom':
        return {
          from: customStartDate ? new Date(customStartDate) : null,
          to: customEndDate ? new Date(customEndDate) : null,
        };
      default:
        return { from: null, to: null };
    }
  };

  // Apply filters
  const filteredQuotes = useMemo(() => {
    let filtered = quotes;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(q =>
        q.supplier_name?.toLowerCase().includes(query) ||
        q.items.some(i =>
          i.material_name?.toLowerCase().includes(query) ||
          i.material_code?.toLowerCase().includes(query)
        )
      );
    }
    
    // Supplier filter
    if (selectedSupplier) {
      filtered = filtered.filter(q => q.supplier_account_id === selectedSupplier);
    }
    
    // Date filter
    const { from, to } = getDateRange();
    if (from) {
      filtered = filtered.filter(q => {
        const submitDate = new Date(q.submitted_at);
        if (submitDate < from) return false;
        if (to && submitDate > to) return false;
        return true;
      });
    }
    
    return filtered;
  }, [quotes, searchQuery, selectedSupplier, dateFilter, customStartDate, customEndDate]);

  // Count quotes by status for tabs
  const getStatusCount = (status: SupplierQuoteStatus | 'all') => {
    if (status === 'all') return quotes.length;
    return quotes.filter(q => q.status === status).length;
  };

  const toggleExpand = (quoteId: string) => {
    setExpandedQuotes(prev => {
      const next = new Set(prev);
      if (next.has(quoteId)) next.delete(quoteId);
      else next.add(quoteId);
      return next;
    });
  };

  const handleQuoteStatusChange = async (quoteId: string, status: SupplierQuoteStatus) => {
    try {
      const { error: qErr } = await supabase
        .from('supplier_quotes')
        .update({ status, updated_by: user?.id || null })
        .eq('id', quoteId);
      if (qErr) throw qErr;

      const itemStatus = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : status;
      const { error: iErr } = await supabase
        .from('supplier_materials')
        .update({ status: itemStatus, updated_by: user?.id || null })
        .eq('supplier_quote_id', quoteId);
      if (iErr) throw iErr;

      toast.success(`Quote ${status === 'approved' ? 'approved' : 'rejected'}`);
      queryClient.invalidateQueries({ queryKey: ['supplier-quotes'] });
    } catch {
      toast.error('Failed to update quote status');
    }
  };

  const handleBulkReject = async () => {
    setBulkRejectLoading(true);
    try {
      const visibleQuoteIds = filteredQuotes
        .filter(q => q.status !== 'rejected')
        .map(q => q.id);

      if (visibleQuoteIds.length === 0) return;

      const { error: qErr } = await supabase
        .from('supplier_quotes')
        .update({ status: 'rejected', updated_by: user?.id || null })
        .in('id', visibleQuoteIds);
      if (qErr) throw qErr;

      await supabase
        .from('supplier_materials')
        .update({ status: 'rejected', updated_by: user?.id || null })
        .in('supplier_quote_id', visibleQuoteIds);

      toast.success(`${visibleQuoteIds.length} quote(s) rejected`);
      queryClient.invalidateQueries({ queryKey: ['supplier-quotes'] });
    } catch {
      toast.error('Failed to bulk reject');
    } finally {
      setBulkRejectLoading(false);
      setBulkRejectOpen(false);
    }
  };

  const handleBulkApprove = async () => {
    setBulkApproveLoading(true);
    try {
      const visibleQuoteIds = filteredQuotes
        .filter(q => q.status !== 'approved' && q.status !== 'rejected')
        .map(q => q.id);

      if (visibleQuoteIds.length === 0) return;

      for (const quoteId of visibleQuoteIds) {
        await handleQuoteStatusChange(quoteId, 'approved');
      }

      toast.success(`${visibleQuoteIds.length} quote(s) approved`);
    } catch {
      toast.error('Failed to bulk approve');
    } finally {
      setBulkApproveLoading(false);
      setBulkApproveOpen(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSupplier('');
    setDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setShowCustomDatePicker(false);
  };

  const handleEditQuote = async (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) return;

    const { data: dlData } = await supabase
      .from('supplier_quote_delivery_lines')
      .select('*')
      .eq('supplier_quote_id', quoteId);

    const editLines = quote.items.map(item => ({
      id: crypto.randomUUID(),
      material: {
        id: item.material_id,
        name: item.material_name || 'Unknown',
        code: item.material_code || null,
        uom: item.material_uom || 'unit',
      },
      unit_price: item.unit_price,
      notes: item.notes || '',
      uom: item.material_uom || 'unit',
    }));

    const editDeliveryLines = (dlData || []).map((dl: any) => ({
      id: crypto.randomUUID(),
      zoneCodes: dl.zone_codes || [],
      pricePerMoq: Number(dl.price_per_moq),
      notes: dl.notes || '',
      isDefault: true,
      materialIds: dl.material_ids || [],
    }));

    setEditingQuote({
      id: quoteId,
      supplier_account_id: quote.supplier_account_id,
      supplier_name: quote.supplier_name,
      notes: quote.notes,
      lines: editLines,
      deliveryLines: editDeliveryLines,
    });
    setAddSheetOpen(true);
  };

  const handleDeleteQuoteClick = (quoteId: string) => {
    setQuoteToDelete(quoteId);
    setDeleteQuoteDialogOpen(true);
  };

  const handleDeleteQuoteConfirm = async () => {
    if (!quoteToDelete) return;
    setDeleteQuoteDialogOpen(false);
    try {
      await supabase.from('supplier_quote_delivery_allocations').delete().eq('supplier_quote_id', quoteToDelete);
      await supabase.from('supplier_quote_delivery_lines').delete().eq('supplier_quote_id', quoteToDelete);
      await supabase.from('supplier_materials').delete().eq('supplier_quote_id', quoteToDelete);
      const { error } = await supabase.from('supplier_quotes').delete().eq('id', quoteToDelete);
      if (error) throw error;
      toast.success('Quote deleted');
      queryClient.invalidateQueries({ queryKey: ['supplier-quotes'] });
    } catch {
      toast.error('Failed to delete quote');
    } finally {
      setQuoteToDelete(null);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30';
      case 'rejected': return 'bg-muted text-muted-foreground';
      case 'negotiating': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
      case 'under_review': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30';
      default: return 'bg-primary/10 text-primary border-primary/30';
    }
  };

  const hasActiveFilters = searchQuery || selectedSupplier || dateFilter !== 'all';
  const nonRejectedCount = filteredQuotes.filter(q => q.status !== 'rejected').length;
  const nonApprovedCount = filteredQuotes.filter(q => q.status !== 'approved' && q.status !== 'rejected').length;

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Supplier Quotes</h1>
            <p className="text-sm text-muted-foreground">
              Manage supplier quotations — each quote groups materials from a single supplier
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Quote
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-background">
                <DropdownMenuItem onClick={() => { setAddSheetMode('manual'); setAddSheetOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Manually
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setAddSheetMode('ai-upload'); setAddSheetOpen(true); }}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Quote File
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <PageGuidance {...SUPPLIER_MATERIALS_GUIDANCE} />

        {/* Compare view moved to Supply → Domains. Status workflow is paused — this page is input-only. */}
        <>
            {/* Filters Bar */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by supplier or material..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="min-w-[180px]">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[160px]">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setShowCustomDatePicker(e.target.value === 'custom');
                  }}
                >
                  {DATE_FILTER_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {showCustomDatePicker && (
                <div className="flex gap-2 items-center">
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-36 h-10"
                    placeholder="Start"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-36 h-10"
                    placeholder="End"
                  />
                </div>
              )}

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-10">
                  <X className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Quote count */}
            {filteredQuotes.length > 0 && (
              <div className="flex items-center justify-end border-b pb-3">
                <span className="text-sm text-muted-foreground">
                  {filteredQuotes.length} quote(s) visible
                </span>
              </div>
            )}

            <div className="mt-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredQuotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground">No supplier quotes found</p>
                    {hasActiveFilters && (
                      <Button variant="link" onClick={handleClearFilters} className="mt-2">
                        Clear filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredQuotes.map(quote => (
                      <Collapsible
                        key={quote.id}
                        open={expandedQuotes.has(quote.id)}
                        onOpenChange={() => toggleExpand(quote.id)}
                      >
                        <div className="rounded-lg border bg-card">
                          <CollapsibleTrigger asChild>
                            <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors rounded-t-lg">
                              <ChevronRight className={cn(
                                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                expandedQuotes.has(quote.id) && 'rotate-90'
                              )} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm">
                                    {quote.supplier_name || 'Unknown Supplier'}
                                  </span>
                                  
                                  <Badge variant="secondary" className="text-[10px]">
                                    {quote.items.length} item{quote.items.length !== 1 ? 's' : ''}
                                  </Badge>
                                  {quote.status === 'approved' && quote.valid_until && (() => {
                                    const vLabel = deriveValidityLabel(quote.valid_until, validityMap.get(quote.id) || null);
                                    return (
                                      <Badge variant="outline" className={cn('text-[10px] gap-1', VALIDITY_BADGE_COLORS[vLabel])}>
                                        <Clock className="h-3 w-3" />
                                        {VALIDITY_LABELS[vLabel]}
                                      </Badge>
                                    );
                                  })()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Submitted {new Date(quote.submitted_at).toLocaleDateString()}
                                  {quote.valid_until && ` · Valid until ${new Date(quote.valid_until).toLocaleDateString()}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8"
                                  onClick={(e) => { e.stopPropagation(); handleEditQuote(quote.id); }}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteQuoteClick(quote.id); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                
                              </div>
                            </button>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <div className="border-t">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Material</TableHead>
                                    <TableHead className="text-right">Unit Price</TableHead>
                                    <TableHead className="text-right">MOQ</TableHead>
                                    <TableHead className="text-right">Lead Time</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {quote.items.map(item => {
                                    const isMaterialDeleted = item.status === 'deleted';
                                    return (
                                      <TableRow key={item.id} className={cn(isMaterialDeleted && "bg-red-50/50")}>
                                        <TableCell>
                                          <div>
                                            <div className={cn("flex items-center gap-2 flex-wrap", isMaterialDeleted && "text-muted-foreground")}>
                                              <span className={cn("text-sm", isMaterialDeleted && "line-through")}>
                                                {item.material_name || 'Unknown'}
                                              </span>
                                              {isMaterialDeleted && (
                                                <Badge variant="destructive" className="text-[10px] gap-1">
                                                  <AlertCircle className="h-3 w-3" />
                                                  Deleted
                                                </Badge>
                                              )}
                                              {item.material_code && (
                                                <span className="text-xs text-muted-foreground font-mono">
                                                  {item.material_code}
                                                </span>
                                              )}
                                            </div>
                                            {isMaterialDeleted && (
                                              <p className="text-xs text-red-600 mt-1">
                                                This material has been deleted from the registry
                                              </p>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {item.unit_price != null ? `${item.unit_price.toFixed(2)} SAR` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {item.moq ?? '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {item.lead_time_days != null ? `${item.lead_time_days}d` : '-'}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </div>
          </>
      </div>

      <AddQuoteSheet
        open={addSheetOpen}
        onOpenChange={(open) => {
          setAddSheetOpen(open);
          if (!open) { setEditingQuote(null); setAddSheetMode('manual'); }
        }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['supplier-quotes'] })}
        mode={addSheetMode}
        editData={editingQuote}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={async () => {
          if (itemToDelete) {
            await supabase.from('supplier_materials').delete().eq('id', itemToDelete);
            queryClient.invalidateQueries({ queryKey: ['supplier-quotes'] });
            setItemToDelete(null);
          }
          setDeleteDialogOpen(false);
        }}
        title="Delete Quote Item"
        description="Are you sure you want to delete this item?"
      />

      <DeleteConfirmDialog
        open={deleteQuoteDialogOpen}
        onOpenChange={setDeleteQuoteDialogOpen}
        onConfirm={handleDeleteQuoteConfirm}
        title="Delete Quotation"
        description="This will permanently remove the quote and all its items."
      />
    </AppLayout>
  );
}
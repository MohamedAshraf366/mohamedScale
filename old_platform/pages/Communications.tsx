import { Fragment, useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Pencil, Trash2, ArrowUpDown, MessageSquarePlus, ChevronDown, ChevronRight, SlidersHorizontal, ArrowUp, X, Target, Package, Building2, ListTodo, Calendar as CalendarIcon, Zap, TrendingUp, Lightbulb, Clock, AlertCircle, BarChart3, ChevronRightIcon, RefreshCw, History, MoreHorizontal, UserPlus } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useReturningClients } from '@/hooks/useReturningClients';
import { ReturningClientBadge } from '@/components/ReturningClientBadge';
import { PreviousInteractionsSection } from '@/components/PreviousInteractionsSection';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ResizableTableHead } from '@/components/ui/resizable-table-head';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CommunicationDetailsModal from '@/components/CommunicationDetailsModal';
import { format } from 'date-fns';
import CommunicationDialog from '@/components/CommunicationDialog';
import FollowUpDialog from '@/components/FollowUpDialog';
import FollowUpTimeline from '@/components/FollowUpTimeline';
import CommunicationsHeatmap from '@/components/CommunicationsHeatmap';
import ClientHistoryPanel from '@/components/ClientHistoryPanel';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { logAudit } from '@/lib/auditLogger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { StatusEditCell, InterestLevelEditCell, AssignedToEditCell } from '@/components/InlineEditCell';

// Column configuration for visibility toggle and default widths
const COLUMN_CONFIG = [
  { key: 'date', label: 'Date', defaultVisible: true, defaultWidth: 120 },
  { key: 'company', label: 'Company', defaultVisible: true, defaultWidth: 150 },
  { key: 'category', label: 'Category', defaultVisible: true, defaultWidth: 120 },
  { key: 'person', label: 'Person', defaultVisible: true, defaultWidth: 120 },
  { key: 'contact', label: 'Contact', defaultVisible: true, defaultWidth: 140 },
  { key: 'channels', label: 'Comm. Channels', defaultVisible: true, defaultWidth: 130 },
  { key: 'topic', label: 'Topic', defaultVisible: true, defaultWidth: 180 },
  { key: 'quotation', label: 'Quotation Required', defaultVisible: true, defaultWidth: 100 },
  { key: 'action', label: 'Action Required', defaultVisible: true, defaultWidth: 150 },
  { key: 'followUpDate', label: 'Follow-up Date', defaultVisible: true, defaultWidth: 120 },
  { key: 'status', label: 'Status', defaultVisible: true, defaultWidth: 100 },
  { key: 'interestLevel', label: 'Interest Level', defaultVisible: true, defaultWidth: 120 },
  { key: 'notes', label: 'Notes', defaultVisible: false, defaultWidth: 180 },
  { key: 'assignedTo', label: 'Assigned To', defaultVisible: true, defaultWidth: 120 },
  { key: 'followUps', label: 'Follow-ups', defaultVisible: true, defaultWidth: 100 },
] as const;

type ColumnKey = typeof COLUMN_CONFIG[number]['key'];
interface Communication {
  id: string;
  company_name: string | null;
  person_name: string | null;
  category: string | null;
  contact_info: string | null;
  communication_channels: string | null;
  summary: string | null;
  quotation_required: boolean | null;
  action: string | null;
  follow_up_date: string | null;
  status: string;
  communication_date: string;
  notes: string | null;
  assigned_to: string | null;
  current_phase: string | null;
  // Structured summary fields
  outcome_notes: string | null;
  interest_level: string | null;
  other_projects: string | null;
}

interface MaterialPrice {
  id: string;
  material_id: string;
  material_name: string;
  current_purchase_price: number | null;
}

interface MaterialNeed {
  id: string;
  material_id: string;
  material_name: string;
  notes: string | null;
}

interface FollowUpHistoryEntry {
  id: string;
  follow_up_date: string;
  status_after: string | null;
  notes: string | null;
  action: string | null;
  created_at: string;
  user_id: string;
  communication_log_id: string;
  creator_name?: string;
}

const Communications = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const { getCompanyCount, refresh: refreshCompanyCounts } = useReturningClients();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [quotationFilter, setQuotationFilter] = useState<string>('all');
  const [interestLevelFilter, setInterestLevelFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [returningClientFilter, setReturningClientFilter] = useState<boolean>(false);
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || categoryFilter !== 'all' || quotationFilter !== 'all' || interestLevelFilter !== 'all' || timeFilter !== 'all' || returningClientFilter;

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setQuotationFilter('all');
    setInterestLevelFilter('all');
    setTimeFilter('all');
    setReturningClientFilter(false);
    setCustomDateRange({ from: undefined, to: undefined });
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState<Communication | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: keyof Communication | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [followUpCommunication, setFollowUpCommunication] = useState<Communication | null>(null);
  const [followUpHistory, setFollowUpHistory] = useState<{[key: string]: FollowUpHistoryEntry[]}>({});
  const [followUpHistoryLoading, setFollowUpHistoryLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUpHistoryEntry | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(
    () => COLUMN_CONFIG.reduce((acc, col) => ({ ...acc, [col.key]: col.defaultVisible }), {} as Record<ColumnKey, boolean>)
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    () => COLUMN_CONFIG.reduce((acc, col) => ({ ...acc, [col.key]: col.defaultWidth }), {} as Record<string, number>)
  );
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [filterBarSticky, setFilterBarSticky] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  
  // Details drawer state
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [viewingCommunication, setViewingCommunication] = useState<Communication | null>(null);
  const [viewingMaterialPrices, setViewingMaterialPrices] = useState<MaterialPrice[]>([]);
  const [viewingMaterialNeeds, setViewingMaterialNeeds] = useState<MaterialNeed[]>([]);
  
  // Client history panel state
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyCompanyName, setHistoryCompanyName] = useState<string | null>(null);
  
  // Initial client data for new communication from existing client
  const [initialClientData, setInitialClientData] = useState<{
    company_name: string;
    person_name: string;
    contact_info: string;
    category?: string;
  } | null>(null);

  const handleColumnResize = useCallback((key: string, width: number) => {
    setColumnWidths(prev => ({ ...prev, [key]: width }));
  }, []);

  const toggleColumnVisibility = (key: ColumnKey) => {
    setColumnVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isColumnVisible = (key: ColumnKey) => columnVisibility[key];

  // Calculate visible column count for colspan
  const visibleColumnCount = Object.values(columnVisibility).filter(Boolean).length + 3; // +3 for checkbox, #, actions

  useEffect(() => {
    fetchCommunications();
  }, []);

  // Scroll detection for scroll-to-top button and sticky filter bar
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
      // Detect if filter bar is sticky
      if (filterBarRef.current) {
        const rect = filterBarRef.current.getBoundingClientRect();
        setFilterBarSticky(rect.top <= 0);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchCommunications = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_log')
        .select('*')
        .order('communication_date', { ascending: false });

      if (error) throw error;
      setCommunications(data || []);
      
      // Fetch follow-up history for all communications
      if (data && data.length > 0) {
        setFollowUpHistoryLoading(true);
        const { data: historyData, error: historyError } = await supabase
          .from('follow_up_history')
          .select('*')
          .in('communication_log_id', data.map(c => c.id))
          .order('created_at', { ascending: false });
        
        if (historyError) {
          console.error('Error fetching follow-up history:', historyError);
        }
        
        if (historyData && historyData.length > 0) {
          // Fetch profiles for creator names
          const userIds = [...new Set(historyData.map(h => h.user_id).filter(Boolean))];
          let profilesMap: Record<string, string> = {};
          
          if (userIds.length > 0) {
            const { data: profilesData } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', userIds);
            
            if (profilesData) {
              profilesMap = profilesData.reduce((acc, p) => {
                acc[p.id] = p.full_name || '';
                return acc;
              }, {} as Record<string, string>);
            }
          }
          
          const historyMap: {[key: string]: FollowUpHistoryEntry[]} = {};
          historyData.forEach((entry: any) => {
            if (!historyMap[entry.communication_log_id]) {
              historyMap[entry.communication_log_id] = [];
            }
            historyMap[entry.communication_log_id].push({
              ...entry,
              creator_name: profilesMap[entry.user_id] || null,
            });
          });
          setFollowUpHistory(historyMap);
        } else {
          setFollowUpHistory({});
        }
        setFollowUpHistoryLoading(false);
      } else {
        setFollowUpHistoryLoading(false);
      }
    } catch (error) {
      console.error('Error fetching communications:', error);
    } finally {
      setLoading(false);
      setFollowUpHistoryLoading(false);
    }
  };

  const fetchMaterialData = async (communicationId: string) => {
    try {
      // Fetch material prices
      const { data: pricesData } = await supabase
        .from('communication_material_prices')
        .select('id, material_id, current_purchase_price, materials(name)')
        .eq('communication_id', communicationId);

      setViewingMaterialPrices(
        (pricesData || []).map((p: any) => ({
          id: p.id,
          material_id: p.material_id,
          material_name: p.materials?.name || 'Unknown',
          current_purchase_price: p.current_purchase_price,
        }))
      );

      // Fetch material needs
      const { data: needsData } = await supabase
        .from('communication_material_needs')
        .select('id, material_id, notes, materials(name)')
        .eq('communication_id', communicationId);

      setViewingMaterialNeeds(
        (needsData || []).map((n: any) => ({
          id: n.id,
          material_id: n.material_id,
          material_name: n.materials?.name || 'Unknown',
          notes: n.notes,
        }))
      );
    } catch (error) {
      console.error('Error fetching material data:', error);
    }
  };

  // Inline update handler for quick edits
  const handleInlineUpdate = async (id: string, field: string, newValue: string) => {
    const comm = communications.find(c => c.id === id);
    if (!comm) return;

    const oldValue = (comm as any)[field];
    if (oldValue === newValue) return;

    try {
      const { error } = await supabase
        .from('communication_log')
        .update({ [field]: newValue, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      // Update local state immediately
      setCommunications(prev => 
        prev.map(c => c.id === id ? { ...c, [field]: newValue } : c)
      );

      // Log audit
      await logAudit({
        action: 'updated',
        module: 'Communications',
        recordId: id,
        recordName: comm.company_name || 'Communication',
        oldValues: { [field]: oldValue },
        newValues: { [field]: newValue },
      });

      toast.success('Updated successfully');
    } catch (error) {
      console.error('Error updating:', error);
      toast.error('Failed to update');
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this communication?')) return;
    
    try {
      // Find the communication to log before deleting
      const commToDelete = communications.find(c => c.id === id);
      
      const { error } = await supabase
        .from('communication_log')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Log audit for delete
      if (commToDelete) {
        await logAudit({
          action: 'deleted',
          module: 'Communications',
          recordId: id,
          recordName: commToDelete.company_name || 'Communication',
          oldValues: commToDelete,
        });
      }
      
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      await fetchCommunications();
    } catch (error) {
      console.error('Error deleting communication:', error);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} communication(s)?`)) return;
    
    try {
      // Get communications to delete for logging
      const idsToDelete = Array.from(selectedIds);
      const commsToDelete = communications.filter(c => idsToDelete.includes(c.id));
      
      const { error } = await supabase
        .from('communication_log')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;
      
      // Log audit for each deleted communication
      for (const comm of commsToDelete) {
        await logAudit({
          action: 'deleted',
          module: 'Communications',
          recordId: comm.id,
          recordName: comm.company_name || 'Communication',
          oldValues: comm,
        });
      }
      
      setSelectedIds(new Set());
      await fetchCommunications();
    } catch (error) {
      console.error('Error deleting communications:', error);
    }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedIds.size === 0) return;
    
    try {
      const idsToUpdate = Array.from(selectedIds);
      const commsToUpdate = communications.filter(c => idsToUpdate.includes(c.id));
      
      const { error } = await supabase
        .from('communication_log')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .in('id', idsToUpdate);

      if (error) throw error;
      
      // Log audit for each updated communication
      for (const comm of commsToUpdate) {
        await logAudit({
          action: 'updated',
          module: 'Communications',
          recordId: comm.id,
          recordName: comm.company_name || 'Communication',
          oldValues: { status: comm.status },
          newValues: { status: newStatus },
        });
      }
      
      // Update local state
      setCommunications(prev => 
        prev.map(c => idsToUpdate.includes(c.id) ? { ...c, status: newStatus } : c)
      );
      
      setSelectedIds(new Set());
      toast.success(`Updated ${idsToUpdate.length} communication(s) to ${newStatus}`);
    } catch (error) {
      console.error('Error updating communications:', error);
      toast.error('Failed to update communications');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCommunications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCommunications.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSort = (key: keyof Communication) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getDateRange = () => {
    const today = new Date();
    switch (timeFilter) {
      case 'today':
        return { start: startOfDay(today), end: endOfDay(today) };
      case 'week':
        return { start: startOfWeek(today, { weekStartsOn: 0 }), end: endOfWeek(today, { weekStartsOn: 0 }) };
      case 'month':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'custom':
        if (customDateRange.from && customDateRange.to) {
          return { start: startOfDay(customDateRange.from), end: endOfDay(customDateRange.to) };
        }
        return null;
      default:
        return null;
    }
  };

  const filteredCommunications = communications.filter((comm) => {
    const matchesSearch =
      comm.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comm.person_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comm.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comm.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || comm.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || comm.category === categoryFilter;
    const matchesQuotation = quotationFilter === 'all' || 
      (quotationFilter === 'required' && comm.quotation_required) ||
      (quotationFilter === 'not-required' && !comm.quotation_required);
    const matchesInterestLevel = interestLevelFilter === 'all' || 
      (interestLevelFilter === 'none' && !comm.interest_level) ||
      comm.interest_level === interestLevelFilter;
    
    // Time filter
    let matchesTime = true;
    const dateRange = getDateRange();
    if (dateRange && comm.communication_date) {
      const commDate = new Date(comm.communication_date);
      matchesTime = isWithinInterval(commDate, { start: dateRange.start, end: dateRange.end });
    }
    
    // Returning client filter
    const matchesReturning = !returningClientFilter || getCompanyCount(comm.company_name) > 1;
    
    return matchesSearch && matchesStatus && matchesCategory && matchesQuotation && matchesInterestLevel && matchesTime && matchesReturning;
  });

  const sortedCommunications = [...filteredCommunications].sort((a, b) => {
    // Default sort by communication_date descending when no manual sort is applied
    if (!sortConfig.key) {
      const aDate = new Date(a.communication_date).getTime();
      const bDate = new Date(b.communication_date).getTime();
      return bDate - aDate; // Descending order (newest first)
    }
    
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const categories = Array.from(new Set(communications.map(c => c.category).filter(Boolean)));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-status-open/15 text-status-open border-status-open/30';
      case 'In Follow-up':
        return 'bg-status-quotation/15 text-status-quotation border-status-quotation/30';
      case 'Closed':
        return 'bg-status-closed/15 text-status-closed border-status-closed/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-lg text-muted-foreground">
            {t('communications.loading')}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between animate-slide-up">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t('communications.title')}</h1>
            <p className="text-muted-foreground">
              Track all supplier communications and follow-ups
            </p>
          </div>
          <Button className="gap-2" onClick={() => { setSelectedCommunication(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            {t('communications.addNew')}
          </Button>
        </div>

        {/* Sticky filter bar */}
        <div 
          ref={filterBarRef}
          className={`sticky top-0 z-30 bg-background pt-2 pb-4 -mx-8 px-8 transition-all duration-200 ${
            filterBarSticky ? 'shadow-md border-b border-border/50' : 'border-b border-transparent'
          }`}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('communications.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-[180px] justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {timeFilter === 'all' && 'All Time'}
                    {timeFilter === 'today' && 'Today'}
                    {timeFilter === 'week' && 'This Week'}
                    {timeFilter === 'month' && 'This Month'}
                    {timeFilter === 'custom' && customDateRange.from && customDateRange.to 
                      ? `${format(customDateRange.from, 'MMM d')} - ${format(customDateRange.to, 'MMM d')}`
                      : timeFilter === 'custom' && 'Custom Range'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-2 space-y-2">
                    <div className="grid gap-1">
                      <Button 
                        variant={timeFilter === 'all' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="justify-start"
                        onClick={() => { setTimeFilter('all'); setCustomDateRange({ from: undefined, to: undefined }); }}
                      >
                        All Time
                      </Button>
                      <Button 
                        variant={timeFilter === 'today' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="justify-start"
                        onClick={() => setTimeFilter('today')}
                      >
                        Today
                      </Button>
                      <Button 
                        variant={timeFilter === 'week' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="justify-start"
                        onClick={() => setTimeFilter('week')}
                      >
                        This Week
                      </Button>
                      <Button 
                        variant={timeFilter === 'month' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="justify-start"
                        onClick={() => setTimeFilter('month')}
                      >
                        This Month
                      </Button>
                      <Button 
                        variant={timeFilter === 'custom' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="justify-start"
                        onClick={() => setTimeFilter('custom')}
                      >
                        Custom Range
                      </Button>
                    </div>
                    {timeFilter === 'custom' && (
                      <div className="pt-2 border-t">
                        <Calendar
                          mode="range"
                          selected={{ from: customDateRange.from, to: customDateRange.to }}
                          onSelect={(range) => setCustomDateRange({ from: range?.from, to: range?.to })}
                          numberOfMonths={1}
                          className="rounded-md border"
                        />
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('communications.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('communications.allStatuses')}</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Follow-up">In Follow-up</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('communications.category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('communications.allCategories')}</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat as string}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={quotationFilter} onValueChange={setQuotationFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('communications.quotation')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('communications.all')}</SelectItem>
                  <SelectItem value="required">{t('communications.required')}</SelectItem>
                  <SelectItem value="not-required">{t('communications.notRequired')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={interestLevelFilter} onValueChange={setInterestLevelFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Interest Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Interest Levels</SelectItem>
                  <SelectItem value="High">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      High
                    </span>
                  </SelectItem>
                  <SelectItem value="Medium">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                      Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="Low">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      Low
                    </span>
                  </SelectItem>
                  <SelectItem value="Not interested">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      Not interested
                    </span>
                  </SelectItem>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Not set</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={returningClientFilter ? "default" : "outline"}
                size="sm"
                onClick={() => setReturningClientFilter(!returningClientFilter)}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Returning Only
              </Button>
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                  Clear Filters
                </Button>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Columns
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 bg-popover border shadow-lg z-50">
                  <div className="space-y-2">
                    <p className="text-sm font-medium mb-3">Toggle columns</p>
                    {COLUMN_CONFIG.map((col) => (
                      <div key={col.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={`col-${col.key}`}
                          checked={columnVisibility[col.key]}
                          onCheckedChange={() => toggleColumnVisibility(col.key)}
                        />
                        <Label htmlFor={`col-${col.key}`} className="text-sm cursor-pointer">
                          {col.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 bg-muted/50 px-3 py-2 rounded-lg border border-border/50">
                <span className="text-sm font-medium">
                  {selectedIds.size} selected
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => setSelectedIds(new Set())}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
                <Separator orientation="vertical" className="h-5" />
                <Select onValueChange={handleBulkStatusUpdate}>
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder="Update Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Follow-up">In Follow-up</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="destructive" size="sm" className="h-8" onClick={handleDeleteSelected}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Action Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Quick Actions Panel */}
          <Card className="bg-card/80 border-border/50 shadow-sm h-[240px]">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start text-xs h-8"
                onClick={() => { setSelectedCommunication(null); setDialogOpen(true); }}
              >
                <Plus className="h-3.5 w-3.5 mr-2 text-primary" />
                Add New Communication
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start text-xs h-8"
                onClick={() => navigate('/tasks')}
              >
                <Clock className="h-3.5 w-3.5 mr-2 text-primary" />
                Today's Follow-ups
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start text-xs h-8"
                onClick={() => navigate('/tasks')}
              >
                <AlertCircle className="h-3.5 w-3.5 mr-2 text-destructive" />
                Overdue Follow-ups
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start text-xs h-8"
                onClick={() => navigate('/dashboard')}
              >
                <BarChart3 className="h-3.5 w-3.5 mr-2 text-primary" />
                Open Dashboard
              </Button>
            </CardContent>
          </Card>

          {/* Daily Snapshot Panel */}
          <Card className="bg-card/80 border-border/50 shadow-sm h-[240px]">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Daily Snapshot
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={isRefreshing}
                  onClick={async () => {
                    setIsRefreshing(true);
                    await fetchCommunications();
                    setIsRefreshing(false);
                  }}
                  title="Refresh metrics"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(() => {
                  const today = new Date();
                  const todayStart = startOfDay(today);
                  const todayEnd = endOfDay(today);
                  
                  const todayCommunications = communications.filter(c => {
                    const commDate = new Date(c.communication_date);
                    return isWithinInterval(commDate, { start: todayStart, end: todayEnd });
                  });
                  
                  const interestedLeadsToday = todayCommunications.filter(c => 
                    c.interest_level && ['High', 'Medium', 'Low'].includes(c.interest_level)
                  ).length;
                  
                  const allFollowUps = Object.values(followUpHistory).flat();
                  const followUpsDueToday = allFollowUps.filter(f => {
                    const fDate = new Date(f.follow_up_date);
                    return isWithinInterval(fDate, { start: todayStart, end: todayEnd }) && f.status_after !== 'Closed';
                  }).length;
                  
                  const overdueFollowUps = allFollowUps.filter(f => {
                    const fDate = new Date(f.follow_up_date);
                    return fDate < todayStart && f.status_after !== 'Closed';
                  }).length;
                  
                  const newPipelineToday = todayCommunications.filter(c => 
                    c.interest_level && ['High', 'Medium', 'Low'].includes(c.interest_level)
                  ).length;

                  return (
                    <>
                      <div className="bg-muted/30 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-primary">{todayCommunications.length}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Communications Today</div>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-green-600">{interestedLeadsToday}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Interested Leads</div>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-yellow-600">{followUpsDueToday}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Follow-ups Due</div>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3 text-center">
                        <div className={`text-2xl font-bold ${overdueFollowUps > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{overdueFollowUps}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Overdue</div>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
                        <div className="text-2xl font-bold text-primary">{newPipelineToday}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">New Pipeline Items</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Activity Heatmap Panel */}
          <Card className="bg-card/80 border-border/50 shadow-sm h-[240px]">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Activity Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 h-[calc(100%-52px)]">
              <CommunicationsHeatmap 
                communications={communications} 
                selectedMonth={(() => {
                  if (timeFilter === 'thisMonth') return new Date();
                  if (timeFilter === 'custom' && customDateRange.from) return customDateRange.from;
                  return new Date();
                })()}
              />
            </CardContent>
          </Card>

          {/* Smart Suggestions Panel */}
          <Card className="bg-card/80 border-border/50 shadow-sm h-[240px]">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Smart Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-2">
              {(() => {
                const today = new Date();
                const allFollowUps = Object.values(followUpHistory).flat();
                const overdueCount = allFollowUps.filter(f => {
                  const fDate = new Date(f.follow_up_date);
                  return fDate < startOfDay(today) && f.status_after !== 'Closed';
                }).length;
                
                const highInterestNoFollowUp = communications.filter(c => 
                  c.interest_level === 'High' && (!followUpHistory[c.id] || followUpHistory[c.id].length === 0)
                ).length;
                
                const staleLeads = communications.filter(c => {
                  const commDate = new Date(c.communication_date);
                  const daysSince = Math.floor((today.getTime() - commDate.getTime()) / (1000 * 60 * 60 * 24));
                  return daysSince > 7 && c.status !== 'Closed' && (!followUpHistory[c.id] || followUpHistory[c.id].length === 0);
                }).length;

                const suggestions = [];
                
                if (highInterestNoFollowUp > 0) {
                  suggestions.push({
                    text: `${highInterestNoFollowUp} high-interest lead${highInterestNoFollowUp > 1 ? 's' : ''} with no follow-up`,
                    action: 'Add follow-up?',
                    urgent: true
                  });
                }
                
                if (overdueCount > 0) {
                  suggestions.push({
                    text: `${overdueCount} overdue follow-up${overdueCount > 1 ? 's' : ''} need attention`,
                    action: 'Review now',
                    urgent: true
                  });
                }
                
                if (staleLeads > 0) {
                  suggestions.push({
                    text: `${staleLeads} lead${staleLeads > 1 ? 's' : ''} inactive for 7+ days`,
                    action: 'Send reminder?',
                    urgent: false
                  });
                }

                if (suggestions.length === 0) {
                  suggestions.push({
                    text: 'All caught up! No urgent actions needed.',
                    action: '',
                    urgent: false
                  });
                }

                return suggestions.slice(0, 3).map((suggestion, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded-md text-xs ${
                      suggestion.urgent ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'
                    }`}
                  >
                    <span className="text-muted-foreground flex-1">{suggestion.text}</span>
                    {suggestion.action && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-primary hover:text-primary">
                        {suggestion.action}
                        <ChevronRightIcon className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </div>
                ));
              })()}
            </CardContent>
          </Card>
        </div>

        <div ref={tableContainerRef} className="rounded-lg border bg-card overflow-x-auto relative">
            <Table className="table-fixed">
              <TableHeader className="sticky top-0 z-20 bg-card">
                <TableRow className="border-b">
                  <TableHead className="w-12 bg-card">
                    <Checkbox
                      checked={selectedIds.size === filteredCommunications.length && filteredCommunications.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-12 bg-card">#</TableHead>
                  {isColumnVisible('date') && (
                    <ResizableTableHead
                      columnKey="date"
                      width={columnWidths.date}
                      onResize={handleColumnResize}
                      className="cursor-pointer bg-card"
                      onClick={() => handleSort('communication_date')}
                    >
                      <div className="flex items-center gap-2">
                        {t('communications.columns.date')}
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </ResizableTableHead>
                  )}
                  {isColumnVisible('company') && (
                    <ResizableTableHead
                      columnKey="company"
                      width={columnWidths.company}
                      onResize={handleColumnResize}
                      className="cursor-pointer bg-card"
                      onClick={() => handleSort('company_name')}
                    >
                      <div className="flex items-center gap-2">
                        {t('communications.columns.company')}
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </ResizableTableHead>
                  )}
                  {isColumnVisible('category') && (
                    <ResizableTableHead
                      columnKey="category"
                      width={columnWidths.category}
                      onResize={handleColumnResize}
                      className="cursor-pointer bg-card"
                      onClick={() => handleSort('category')}
                    >
                      <div className="flex items-center gap-2">
                        {t('communications.columns.category')}
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </ResizableTableHead>
                  )}
                  {isColumnVisible('person') && (
                    <ResizableTableHead
                      columnKey="person"
                      width={columnWidths.person}
                      onResize={handleColumnResize}
                      className="bg-card"
                    >
                      {t('communications.columns.person')}
                    </ResizableTableHead>
                  )}
                  {isColumnVisible('contact') && (
                    <ResizableTableHead
                      columnKey="contact"
                      width={columnWidths.contact}
                      onResize={handleColumnResize}
                      className="bg-card"
                    >
                      {t('communications.columns.contact')}
                    </ResizableTableHead>
                  )}
                  {isColumnVisible('channels') && (
                    <ResizableTableHead
                      columnKey="channels"
                      width={columnWidths.channels}
                      onResize={handleColumnResize}
                      className="bg-card"
                    >
                      Comm. Channels
                    </ResizableTableHead>
                  )}
                  {isColumnVisible('topic') && (
                    <ResizableTableHead
                      columnKey="topic"
                      width={columnWidths.topic}
                      onResize={handleColumnResize}
                      className="bg-card"
                    >
                      {t('communications.columns.topic')}
                    </ResizableTableHead>
                  )}
                  {isColumnVisible('quotation') && (
                    <ResizableTableHead
                      columnKey="quotation"
                      width={columnWidths.quotation}
                      onResize={handleColumnResize}
                      className="bg-card"
                    >
                      {t('communications.columns.quotationRequired')}
                    </ResizableTableHead>
                  )}
                  {isColumnVisible('action') && (
                    <ResizableTableHead
                      columnKey="action"
                      width={columnWidths.action}
                      onResize={handleColumnResize}
                      className="bg-card"
                    >
                      Action Required
                    </ResizableTableHead>
                  )}
                  {isColumnVisible('followUpDate') && (
                    <ResizableTableHead
                      columnKey="followUpDate"
                      width={columnWidths.followUpDate}
                      onResize={handleColumnResize}
                      className="cursor-pointer bg-card"
                      onClick={() => handleSort('follow_up_date')}
                    >
                      <div className="flex items-center gap-2">
                        {t('communications.columns.followUp')}
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </ResizableTableHead>
                  )}
                  {isColumnVisible('status') && (
                    <ResizableTableHead
                      columnKey="status"
                      width={columnWidths.status}
                      onResize={handleColumnResize}
                      className="cursor-pointer bg-card"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        {t('communications.columns.status')}
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </ResizableTableHead>
                  )}
                  {isColumnVisible('interestLevel') && (
                    <ResizableTableHead
                      columnKey="interestLevel"
                      width={columnWidths.interestLevel}
                      onResize={handleColumnResize}
                      className="cursor-pointer bg-card"
                      onClick={() => handleSort('interest_level')}
                    >
                      <div className="flex items-center gap-2">
                        Interest Level
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </ResizableTableHead>
                  )}
                  {isColumnVisible('notes') && (
                    <ResizableTableHead
                      columnKey="notes"
                      width={columnWidths.notes}
                      onResize={handleColumnResize}
                      className="bg-card"
                    >
                      Notes
                    </ResizableTableHead>
                  )}
                  {isColumnVisible('assignedTo') && (
                    <ResizableTableHead
                      columnKey="assignedTo"
                      width={columnWidths.assignedTo}
                      onResize={handleColumnResize}
                      className="bg-card"
                    >
                      Assigned To
                    </ResizableTableHead>
                  )}
                  {isColumnVisible('followUps') && (
                    <ResizableTableHead
                      columnKey="followUps"
                      width={columnWidths.followUps}
                      onResize={handleColumnResize}
                      className="bg-card"
                    >
                      Follow-ups
                    </ResizableTableHead>
                  )}
                  <TableHead className="w-[150px] bg-card">{t('communications.columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCommunications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumnCount} className="text-center py-8">
                      <p className="text-muted-foreground">
                        {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || quotationFilter !== 'all' || timeFilter !== 'all'
                          ? t('communications.noResults')
                          : t('communications.noData')}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCommunications.map((comm, index) => {
                    const isExpanded = expandedRows.has(comm.id);
                    const toggleExpand = () => {
                      setExpandedRows(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(comm.id)) {
                          newSet.delete(comm.id);
                        } else {
                          newSet.add(comm.id);
                        }
                        return newSet;
                      });
                    };
                    const handleEditFollowUp = (followUp: FollowUpHistoryEntry) => {
                      setEditingFollowUp(followUp);
                      setFollowUpCommunication(comm);
                      setFollowUpDialogOpen(true);
                    };

                    return (
                      <Fragment key={comm.id}>
                        <TableRow 
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={(e) => {
                            // Don't open drawer if clicking on checkbox, actions, or follow-ups button
                            const target = e.target as HTMLElement;
                            const isInteractive = target.closest('button') || target.closest('[role="checkbox"]') || target.closest('input');
                            if (!isInteractive) {
                              setViewingCommunication(comm);
                              fetchMaterialData(comm.id);
                              setDetailsDrawerOpen(true);
                            }
                          }}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(comm.id)}
                              onCheckedChange={() => toggleSelect(comm.id)}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground font-medium">
                            {index + 1}
                          </TableCell>
                          {isColumnVisible('date') && (
                            <TableCell className="text-muted-foreground truncate" style={{ width: columnWidths.date }}>
                              {format(new Date(comm.communication_date), 'MMM dd, yyyy')}
                            </TableCell>
                          )}
                          {isColumnVisible('company') && (
                            <TableCell className="font-medium" style={{ width: columnWidths.company }} onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <span 
                                  className="truncate cursor-pointer hover:underline text-primary"
                                  onClick={() => {
                                    if (comm.company_name) {
                                      navigate(`/client-profile/${encodeURIComponent(comm.company_name)}`);
                                    }
                                  }}
                                >
                                  {comm.company_name || '-'}
                                </span>
                                <ReturningClientBadge count={getCompanyCount(comm.company_name)} variant="compact" />
                              </div>
                            </TableCell>
                          )}
                          {isColumnVisible('category') && (
                            <TableCell className="text-muted-foreground truncate" style={{ width: columnWidths.category }}>
                              {comm.category || '-'}
                            </TableCell>
                          )}
                          {isColumnVisible('person') && (
                            <TableCell className="text-muted-foreground truncate" style={{ width: columnWidths.person }}>
                              {comm.person_name || '-'}
                            </TableCell>
                          )}
                          {isColumnVisible('contact') && (
                            <TableCell className="text-muted-foreground truncate" style={{ width: columnWidths.contact }}>
                              {comm.contact_info || '-'}
                            </TableCell>
                          )}
                          {isColumnVisible('channels') && (
                            <TableCell className="text-muted-foreground truncate" style={{ width: columnWidths.channels }}>
                              {comm.communication_channels || '-'}
                            </TableCell>
                          )}
                          {isColumnVisible('topic') && (
                            <TableCell className="text-muted-foreground truncate" style={{ width: columnWidths.topic }}>
                              {comm.summary || '-'}
                            </TableCell>
                          )}
                          {isColumnVisible('quotation') && (
                            <TableCell className="text-center" style={{ width: columnWidths.quotation }}>
                              {comm.quotation_required ? '✓' : '-'}
                            </TableCell>
                          )}
                          {isColumnVisible('action') && (
                            <TableCell className="text-muted-foreground truncate" style={{ width: columnWidths.action }}>
                              {comm.action || '-'}
                            </TableCell>
                          )}
                          {isColumnVisible('followUpDate') && (
                            <TableCell className="text-muted-foreground truncate" style={{ width: columnWidths.followUpDate }}>
                              {comm.follow_up_date
                                ? format(new Date(comm.follow_up_date), 'MMM dd, yyyy')
                                : '-'}
                            </TableCell>
                          )}
                          {isColumnVisible('status') && (
                            <TableCell style={{ width: columnWidths.status }} onClick={(e) => e.stopPropagation()}>
                              <StatusEditCell
                                value={comm.status}
                                onSave={(newValue) => handleInlineUpdate(comm.id, 'status', newValue)}
                              />
                            </TableCell>
                          )}
                          {isColumnVisible('interestLevel') && (
                            <TableCell style={{ width: columnWidths.interestLevel }} onClick={(e) => e.stopPropagation()}>
                              <InterestLevelEditCell
                                value={comm.interest_level}
                                onSave={(newValue) => handleInlineUpdate(comm.id, 'interest_level', newValue)}
                              />
                            </TableCell>
                          )}
                          {isColumnVisible('notes') && (
                            <TableCell className="text-muted-foreground truncate" style={{ width: columnWidths.notes }}>
                              {comm.notes || '-'}
                            </TableCell>
                          )}
                          {isColumnVisible('assignedTo') && (
                            <TableCell style={{ width: columnWidths.assignedTo }} onClick={(e) => e.stopPropagation()}>
                              <AssignedToEditCell
                                value={comm.assigned_to}
                                onSave={(newValue) => handleInlineUpdate(comm.id, 'assigned_to', newValue)}
                              />
                            </TableCell>
                          )}
                          {isColumnVisible('followUps') && (
                            <TableCell style={{ width: columnWidths.followUps }}>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="gap-1.5"
                                onClick={toggleExpand}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                                <span className="text-xs font-medium">
                                  {followUpHistory[comm.id]?.length || 0}
                                </span>
                              </Button>
                            </TableCell>
                          )}
                          <TableCell className="w-[150px]" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 bg-background border shadow-lg z-50">
                              <DropdownMenuItem onClick={() => {
                                    const count = getCompanyCount(comm.company_name);
                                    setSelectedCommunication(null);
                                    setInitialClientData({
                                      company_name: comm.company_name || '',
                                      person_name: comm.person_name || '',
                                      contact_info: comm.contact_info || '',
                                      category: comm.category || '',
                                    });
                                    setDialogOpen(true);
                                    if (count > 1) {
                                      toast.info(`🔁 Returning Client`, {
                                        description: `${comm.company_name} has ${count} previous interaction${count > 1 ? 's' : ''} on record.`,
                                      });
                                    }
                                  }}>
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    New Communication
                                  </DropdownMenuItem>
                                  {comm.company_name && (
                                    <>
                                      <DropdownMenuItem onClick={() => {
                                        if (comm.company_name) {
                                          navigate(`/client-profile/${encodeURIComponent(comm.company_name)}`);
                                        }
                                      }}>
                                        <Building2 className="h-4 w-4 mr-2" />
                                        View Profile
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        setHistoryCompanyName(comm.company_name);
                                        setHistoryPanelOpen(true);
                                      }}>
                                        <History className="h-4 w-4 mr-2" />
                                        View Client History
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuItem onClick={() => {
                                    setEditingFollowUp(null);
                                    setFollowUpCommunication(comm);
                                    setFollowUpDialogOpen(true);
                                  }}>
                                    <MessageSquarePlus className="h-4 w-4 mr-2" />
                                    Add Follow-up
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => {
                                    setInitialClientData(null);
                                    setSelectedCommunication(comm);
                                    setDialogOpen(true);
                                  }}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(comm.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${comm.id}-timeline`}>
                            <TableCell colSpan={visibleColumnCount} className="bg-muted/30 p-0">
                              <div className="px-6 py-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-semibold">Follow-up Timeline</h4>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingFollowUp(null);
                                      setFollowUpCommunication(comm);
                                      setFollowUpDialogOpen(true);
                                    }}
                                  >
                                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                                    Add Follow-up
                                  </Button>
                                </div>
                                <FollowUpTimeline
                                  followUps={followUpHistory[comm.id] || []}
                                  onEdit={handleEditFollowUp}
                                  onRefresh={fetchCommunications}
                                  loading={followUpHistoryLoading}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
        </div>

        {/* Bottom spacing for scroll area */}
        <div className="h-8" />

        <CommunicationDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setInitialClientData(null);
            }
          }}
          communication={selectedCommunication}
          initialClientData={initialClientData}
          onSave={async () => {
            await fetchCommunications();
            setInitialClientData(null);
            // Update viewing communication if it was being edited
            if (viewingCommunication && selectedCommunication?.id === viewingCommunication.id) {
              const { data } = await supabase
                .from('communication_log')
                .select('*')
                .eq('id', viewingCommunication.id)
                .single();
              if (data) {
                setViewingCommunication(data);
              }
            }
          }}
        />

        {followUpCommunication && (
          <FollowUpDialog
            open={followUpDialogOpen}
            onOpenChange={(open) => {
              setFollowUpDialogOpen(open);
              if (!open) {
                setEditingFollowUp(null);
              }
            }}
            communication={followUpCommunication}
            onSaved={fetchCommunications}
            editingFollowUp={editingFollowUp}
          />
        )}

        {/* Communication Details Modal */}
        <CommunicationDetailsModal
          open={detailsDrawerOpen}
          onOpenChange={setDetailsDrawerOpen}
          communication={viewingCommunication}
          materialPrices={viewingMaterialPrices}
          materialNeeds={viewingMaterialNeeds}
          followUps={viewingCommunication ? (followUpHistory[viewingCommunication.id] || []) : []}
          followUpHistoryLoading={followUpHistoryLoading}
          onEdit={() => {
            if (viewingCommunication) {
              setSelectedCommunication(viewingCommunication);
              setDialogOpen(true);
            }
          }}
          onDelete={async () => {
            if (!viewingCommunication) return;
            if (!confirm('Are you sure you want to delete this communication?')) return;
            await handleDelete(viewingCommunication.id);
            setDetailsDrawerOpen(false);
            setViewingCommunication(null);
          }}
          onAddFollowUp={() => {
            if (viewingCommunication) {
              setEditingFollowUp(null);
              setFollowUpCommunication(viewingCommunication);
              setFollowUpDialogOpen(true);
            }
          }}
          onEditFollowUp={(followUp) => {
            if (viewingCommunication) {
              setEditingFollowUp(followUp);
              setFollowUpCommunication(viewingCommunication);
              setFollowUpDialogOpen(true);
            }
          }}
          onRefreshFollowUps={fetchCommunications}
        />

        {/* Floating scroll-to-top button */}
        <Button
          onClick={scrollToTop}
          className={`fixed bottom-6 right-6 z-50 h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:bg-primary/90 transition-all duration-300 ${
            showScrollTop 
              ? 'opacity-100 translate-y-0 scale-100' 
              : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
          }`}
          size="icon"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>

        {/* Client History Panel */}
        <ClientHistoryPanel 
          open={historyPanelOpen} 
          onOpenChange={setHistoryPanelOpen} 
          companyName={historyCompanyName} 
        />
      </div>
    </Layout>
  );
};

export default Communications;

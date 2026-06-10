import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, FileDown, FileSpreadsheet, Eye, GripVertical, History, Plus, CalendarClock, Calendar as CalendarIcon, X, CheckCircle2, MoreHorizontal, ChevronUp, ChevronDown, RefreshCw, UserPlus, Building2, Send, ArrowRight } from 'lucide-react';
import { CloseDealDialog } from '@/components/CloseDealDialog';
import { EditOpportunityDialog } from '@/components/EditOpportunityDialog';
import { ConvertToDealDialog } from '@/components/ConvertToDealDialog';
import { CloseOpportunityDialog } from '@/components/CloseOpportunityDialog';
import { exportQuotationToPDF, exportQuotationToExcel } from '@/lib/exportUtils';
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
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import PipelineDialog from '@/components/PipelineDialog';
import ContactTimeline from '@/components/ContactTimeline';
import FollowUpTimeline from '@/components/FollowUpTimeline';
import FollowUpDialog from '@/components/FollowUpDialog';
import CommunicationDialog from '@/components/CommunicationDialog';
import { toast } from 'sonner';
import { useReturningClients } from '@/hooks/useReturningClients';
import { ReturningClientBadge, ReturningLeadTag } from '@/components/ReturningClientBadge';

interface PipelineItem {
  id: string;
  company_name: string;
  person_name: string;
  contact_info: string;
  topic: string;
  notes: string;
  communication_date: string;
  status: string;
  follow_up_date: string | null;
  related_material_id: string | null;
  related_supplier_id: string | null;
  city: string | null;
  location: string | null;
  district?: string | null;
  quantity: number | null;
  unit_price: number | null;
  assigned_to: string | null;
  deal_completed: boolean | null;
  interest_level: string | null;
  objection_type?: string | null;
  is_soft_quotation?: boolean | null;
  quotation_sent?: boolean | null;
  current_phase?: string | null;
  material_name?: string;
  material_price?: number;
  quotation_total?: number;
  supplier_name?: string;
  created_at?: string | null;
  deal_value_total?: number | null;
  deal_duration_days?: number | null;
  client_overall_satisfaction?: number | null;
}

// Opportunity-based pipeline item (new model)
interface OpportunityPipelineItem {
  id: string;
  name: string;
  client_id: string;
  project_id: string;
  company_name: string;
  project_name: string;
  interest_level: string | null;
  stage: string | null;
  expected_value: number | null;
  expected_close_date: string | null;
  assigned_to: string | null;
  notes: string | null;
  in_pipeline: boolean;
  is_deal: boolean;
  is_closed: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

interface FollowUpEntry {
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

const Pipeline = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pipelineItems, setPipelineItems] = useState<PipelineItem[]>([]);
  const [coldLeads, setColdLeads] = useState<PipelineItem[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { getCompanyCount, isReturningClient } = useReturningClients();
  const [searchQuery, setSearchQuery] = useState('');
  const [coldLeadsExpanded, setColdLeadsExpanded] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [dealFilter, setDealFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [followUpStatusFilter, setFollowUpStatusFilter] = useState<string>('all');
  const [interestLevelFilter, setInterestLevelFilter] = useState<string>('all');
  const [returningClientFilter, setReturningClientFilter] = useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'company' | 'status' | 'follow_up'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [previewData, setPreviewData] = useState<{[key: string]: any[]}>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [columnWidths, setColumnWidths] = useState<{[key: string]: number}>({
    company: 150,
    person: 120,
    contact: 130,
    city: 100,
    interestLevel: 110,
    details: 200,
    total: 120,
    date: 120,
    status: 100,
    followUp: 120,
    actions: 80
  });
  const [resizing, setResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  
  // Follow-up states
  const [followUpsData, setFollowUpsData] = useState<{[key: string]: FollowUpEntry[]}>({});
  const [followUpsLoading, setFollowUpsLoading] = useState<{[key: string]: boolean}>({});
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState<any>(null);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUpEntry | null>(null);
  const [allFollowUps, setAllFollowUps] = useState<{[key: string]: FollowUpEntry[]}>({});
  const [closeDealDialogOpen, setCloseDealDialogOpen] = useState(false);
  const [closeDealItem, setCloseDealItem] = useState<PipelineItem | null>(null);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpModalItem, setFollowUpModalItem] = useState<PipelineItem | null>(null);
  
  // NEW: Opportunity-based pipeline state
  const [opportunityPipeline, setOpportunityPipeline] = useState<OpportunityPipelineItem[]>([]);
  const [opportunityColdLeads, setOpportunityColdLeads] = useState<OpportunityPipelineItem[]>([]);
  const [oppSearchQuery, setOppSearchQuery] = useState('');
  const [oppInterestFilter, setOppInterestFilter] = useState<string>('all');
  const [oppStageFilter, setOppStageFilter] = useState<string>('all');
  const [oppOwnerFilter, setOppOwnerFilter] = useState<string>('all');
  const [oppTimeFilter, setOppTimeFilter] = useState<string>('all');
  const [oppCustomDateRange, setOppCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  
  // Opportunity action dialogs
  const [editOpportunityDialogOpen, setEditOpportunityDialogOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityPipelineItem | null>(null);
  const [convertToDealDialogOpen, setConvertToDealDialogOpen] = useState(false);
  const [closeOpportunityDialogOpen, setCloseOpportunityDialogOpen] = useState(false);
  const [deleteOpportunityDialogOpen, setDeleteOpportunityDialogOpen] = useState(false);
  const [opportunityToDelete, setOpportunityToDelete] = useState<OpportunityPipelineItem | null>(null);
  
  // New Communication dialog state
  const [newCommDialogOpen, setNewCommDialogOpen] = useState(false);
  const [initialClientData, setInitialClientData] = useState<{
    company_name: string;
    person_name: string;
    contact_info: string;
    category?: string;
  } | null>(null);
  
  // Edit legacy communication dialog state
  const [editCommDialogOpen, setEditCommDialogOpen] = useState(false);
  const [editingCommunication, setEditingCommunication] = useState<any>(null);
  
  // Selection state for bulk actions
  const [selectedOpportunities, setSelectedOpportunities] = useState<Set<string>>(new Set());
  
  // Team members state for Owner dropdowns
  const [teamMembers, setTeamMembers] = useState<{ id: string; full_name: string; email: string }[]>([]);

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || supplierFilter !== 'all' || dealFilter !== 'all' || timeFilter !== 'all' || followUpStatusFilter !== 'all' || interestLevelFilter !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSupplierFilter('all');
    setDealFilter('all');
    setTimeFilter('all');
    setCustomDateRange({ from: undefined, to: undefined });
    setFollowUpStatusFilter('all');
    setInterestLevelFilter('all');
  };

  // Fetch follow-ups for a specific communication
  const fetchFollowUps = useCallback(async (communicationId: string) => {
    setFollowUpsLoading(prev => ({ ...prev, [communicationId]: true }));
    try {
      const { data, error } = await supabase
        .from('follow_up_history')
        .select('*')
        .eq('communication_log_id', communicationId)
        .order('follow_up_date', { ascending: false });

      if (error) throw error;

      // Fetch creator names
      const userIds = [...new Set((data || []).map(f => f.user_id))];
      let creatorNames: {[key: string]: string} = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        if (profiles) {
          profiles.forEach(p => {
            creatorNames[p.id] = p.full_name || p.email || 'Unknown';
          });
        }
      }

      const enrichedData = (data || []).map(f => ({
        ...f,
        creator_name: creatorNames[f.user_id] || 'Unknown'
      }));

      setFollowUpsData(prev => ({ ...prev, [communicationId]: enrichedData }));
    } catch (error) {
      console.error('Error fetching follow-ups:', error);
    } finally {
      setFollowUpsLoading(prev => ({ ...prev, [communicationId]: false }));
    }
  }, []);

  // Open follow-up modal
  const openFollowUpModal = useCallback((item: PipelineItem) => {
    setFollowUpModalItem(item);
    setFollowUpModalOpen(true);
    // Fetch follow-ups if not already loaded
    if (!followUpsData[item.id]) {
      fetchFollowUps(item.id);
    }
  }, [followUpsData, fetchFollowUps]);

  // Handle adding new follow-up
  const handleAddFollowUp = (item: PipelineItem) => {
    setSelectedCommunication({
      id: item.id,
      follow_up_date: item.follow_up_date,
      status: item.status,
      action: null,
      notes: item.notes,
      quotation_required: true,
      summary: null,
      current_phase: null,
    });
    setEditingFollowUp(null);
    setFollowUpDialogOpen(true);
  };

  // Handle editing a follow-up
  const handleEditFollowUp = (followUp: FollowUpEntry) => {
    const item = pipelineItems.find(p => p.id === followUp.communication_log_id);
    if (item) {
      setSelectedCommunication({
        id: item.id,
        follow_up_date: item.follow_up_date,
        status: item.status,
        action: null,
        notes: item.notes,
        quotation_required: true,
        summary: null,
        current_phase: null,
      });
      setEditingFollowUp(followUp);
      setFollowUpDialogOpen(true);
    }
  };

  // Handle follow-up saved
  const handleFollowUpSaved = () => {
    if (selectedCommunication) {
      fetchFollowUps(selectedCommunication.id);
    }
    fetchPipeline();
  };

  // Fetch team members from profiles
  const fetchTeamMembers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');
    
    if (!error && data) {
      setTeamMembers(data);
    }
  };

  useEffect(() => {
    fetchPipeline();
    fetchOpportunityPipeline();
    fetchTeamMembers();

    // Set up realtime subscription
    const channel = supabase
      .channel('pipeline-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'communication_log'
        },
        () => {
          fetchPipeline();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'opportunities'
        },
        () => {
          fetchOpportunityPipeline();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotation_items'
        },
        () => {
          console.log('Quotation items changed, refreshing pipeline...');
          fetchPipeline();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follow_up_history'
        },
        (payload: any) => {
          console.log('Follow-up history changed, refreshing...');
          // Refresh follow-ups for the currently open modal
          const commId = payload.new?.communication_log_id || payload.old?.communication_log_id;
          if (commId && followUpModalItem?.id === commId) {
            fetchFollowUps(commId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [followUpModalItem, fetchFollowUps]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizing) {
        const diff = e.clientX - startX;
        const newWidth = Math.max(60, startWidth + diff);
        setColumnWidths(prev => ({
          ...prev,
          [resizing]: newWidth
        }));
      }
    };

    const handleMouseUp = () => {
      if (resizing) {
        setResizing(null);
      }
    };

    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, startX, startWidth]);

  const handleResizeStart = (column: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(column);
    setStartX(e.clientX);
    setStartWidth(columnWidths[column]);
  };

  const fetchPipeline = async () => {
    try {
      // Include communications where interest_level is High/Medium/Low OR quotation_required is true (for legacy records)
      const { data: commData, error: commError } = await supabase
        .from('communication_log')
        .select('*')
        .or('interest_level.in.(High,Medium,Low),quotation_required.eq.true')
        .order('communication_date', { ascending: false });

      if (commError) throw commError;

      // Fetch "Not interested" communications separately for Cold Leads section
      const { data: coldLeadsData, error: coldError } = await supabase
        .from('communication_log')
        .select('*')
        .eq('interest_level', 'Not interested')
        .order('communication_date', { ascending: false });

      if (coldError) throw coldError;

      // Fetch materials to get names and prices
      const { data: materials } = await supabase
        .from('materials')
        .select('id, name, moq');

      // Fetch suppliers to get names
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');
      
      setSuppliers(suppliersData || []);

      // Fetch all quotation items
      const { data: quotationItems } = await supabase
        .from('quotation_items')
        .select('*');

      // Combine all IDs for follow-ups
      const allCommIds = [...(commData || []).map(c => c.id), ...(coldLeadsData || []).map(c => c.id)];
      let followUpsMap: {[key: string]: FollowUpEntry[]} = {};
      
      if (allCommIds.length > 0) {
        const { data: followUpsRaw } = await supabase
          .from('follow_up_history')
          .select('*')
          .in('communication_log_id', allCommIds);
        
        if (followUpsRaw) {
          followUpsRaw.forEach(fu => {
            if (!followUpsMap[fu.communication_log_id]) {
              followUpsMap[fu.communication_log_id] = [];
            }
            followUpsMap[fu.communication_log_id].push(fu);
          });
        }
      }
      
      setAllFollowUps(followUpsMap);

      // Helper function to enrich data
      const enrichData = (items: any[]) => items.map(item => {
        const material = materials?.find(m => m.id === item.related_material_id);
        const supplier = suppliersData?.find(s => s.id === item.related_supplier_id);
        
        const itemQuotations = quotationItems?.filter(qi => qi.communication_log_id === item.id) || [];
        const quotationTotal = itemQuotations.reduce((sum, qi) => {
          const quantity = parseFloat(qi.quantity?.toString() || '0');
          const price = parseFloat(qi.unit_price?.toString() || '0');
          return sum + (quantity * price);
        }, 0);

        return {
          ...item,
          material_name: material?.name,
          material_price: material?.moq ? parseFloat(material.moq) : null,
          quotation_total: quotationTotal,
          supplier_name: supplier?.name,
        };
      });

      setPipelineItems(enrichData(commData || []));
      setColdLeads(enrichData(coldLeadsData || []));
    } catch (error) {
      console.error('Error fetching pipeline:', error);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Fetch opportunities-based pipeline data
  const fetchOpportunityPipeline = async () => {
    try {
      // Fetch opportunities in pipeline (High/Medium/Low interest)
      const { data: oppData, error: oppError } = await supabase
        .from('opportunities')
        .select(`
          id,
          name,
          client_id,
          project_id,
          interest_level,
          stage,
          expected_value,
          expected_close_date,
          assigned_to,
          notes,
          in_pipeline,
          is_deal,
          is_closed,
          created_at,
          updated_at,
          clients!inner(company_name),
          projects!inner(name)
        `)
        .eq('in_pipeline', true)
        .order('created_at', { ascending: false });

      if (oppError) throw oppError;

      // Fetch cold leads (opportunities NOT in pipeline)
      const { data: coldData, error: coldError } = await supabase
        .from('opportunities')
        .select(`
          id,
          name,
          client_id,
          project_id,
          interest_level,
          stage,
          expected_value,
          expected_close_date,
          assigned_to,
          notes,
          in_pipeline,
          is_deal,
          is_closed,
          created_at,
          updated_at,
          clients!inner(company_name),
          projects!inner(name)
        `)
        .eq('in_pipeline', false)
        .order('created_at', { ascending: false });

      if (coldError) throw coldError;

      // Transform data to match OpportunityPipelineItem interface
      const transformOpp = (opp: any): OpportunityPipelineItem => ({
        id: opp.id,
        name: opp.name,
        client_id: opp.client_id,
        project_id: opp.project_id,
        company_name: opp.clients?.company_name || '',
        project_name: opp.projects?.name || '',
        interest_level: opp.interest_level,
        stage: opp.stage,
        expected_value: opp.expected_value,
        expected_close_date: opp.expected_close_date,
        assigned_to: opp.assigned_to,
        notes: opp.notes,
        in_pipeline: opp.in_pipeline,
        is_deal: opp.is_deal || false,
        is_closed: opp.is_closed || false,
        is_locked: opp.is_locked || false,
        created_at: opp.created_at,
        updated_at: opp.updated_at,
      });

      setOpportunityPipeline((oppData || []).map(transformOpp));
      setOpportunityColdLeads((coldData || []).map(transformOpp));
    } catch (error) {
      console.error('Error fetching opportunity pipeline:', error);
    }
  };

  // Handle opportunity actions
  const handleEditOpportunity = (opp: OpportunityPipelineItem) => {
    setSelectedOpportunity(opp);
    setEditOpportunityDialogOpen(true);
  };

  const handleConvertToDeal = (opp: OpportunityPipelineItem) => {
    setSelectedOpportunity(opp);
    setConvertToDealDialogOpen(true);
  };

  const handleCloseOpportunity = (opp: OpportunityPipelineItem) => {
    setSelectedOpportunity(opp);
    setCloseOpportunityDialogOpen(true);
  };

  const handleDeleteOpportunityClick = (opp: OpportunityPipelineItem) => {
    setOpportunityToDelete(opp);
    setDeleteOpportunityDialogOpen(true);
  };

  const handleDeleteOpportunityConfirm = async () => {
    if (!opportunityToDelete) return;
    
    try {
      // Cascade delete related records (following existing deletion logic)
      await supabase
        .from('communication_log')
        .delete()
        .eq('opportunity_id', opportunityToDelete.id);
      
      await supabase
        .from('follow_up_history')
        .delete()
        .eq('opportunity_id', opportunityToDelete.id);
      
      await supabase
        .from('activities')
        .delete()
        .eq('opportunity_id', opportunityToDelete.id);
      
      await supabase
        .from('opportunity_materials')
        .delete()
        .eq('opportunity_id', opportunityToDelete.id);
      
      // Delete the opportunity itself
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', opportunityToDelete.id);
      
      if (error) throw error;
      
      toast.success('Opportunity deleted successfully');
      setDeleteOpportunityDialogOpen(false);
      setOpportunityToDelete(null);
      fetchOpportunityPipeline();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete opportunity');
    }
  };

  const handleCloseOpportunityResult = async (result: 'Won' | 'Lost') => {
    if (!selectedOpportunity) return;
    
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({
          stage: `Closed ${result}`,
          is_closed: true,
          won: result === 'Won',
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedOpportunity.id);
      
      if (error) throw error;
      
      toast.success(`Opportunity marked as ${result}`);
      setCloseOpportunityDialogOpen(false);
      setSelectedOpportunity(null);
      fetchOpportunityPipeline();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update opportunity');
    }
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    
    try {
      const { error } = await supabase
        .from('communication_log')
        .delete()
        .eq('id', itemToDelete);

      if (error) throw error;
      toast.success('Quotation deleted successfully');
      await fetchPipeline();
    } catch (error) {
      console.error('Error deleting pipeline item:', error);
      toast.error('Failed to delete quotation');
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleReopenDeal = async (id: string) => {
    try {
      const { error } = await supabase
        .from('communication_log')
        .update({ 
          deal_completed: false,
          deal_closed_at: null,
          deal_value_total: null,
          deal_duration_days: null,
          deal_supplier_id: null,
          deal_supplier_rating: null,
          deal_delivery_rating: null,
          client_price_satisfaction: null,
          client_delivery_satisfaction: null,
          client_quality_satisfaction: null,
          client_overall_satisfaction: null,
          client_improvements: null,
          client_liked: null,
          deal_supplier_feedback: null,
          deal_delivery_feedback: null,
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Deal reopened successfully');
      await fetchPipeline();
    } catch (error) {
      console.error('Error reopening deal:', error);
      toast.error('Failed to reopen deal');
    }
  };

  const fetchQuotationPreview = async (communicationLogId: string) => {
    // Check if already cached
    if (previewData[communicationLogId]) {
      return;
    }

    try {
      const { data: quotationItems } = await supabase
        .from('quotation_items')
        .select(`
          *,
          materials (name)
        `)
        .eq('communication_log_id', communicationLogId);

      if (quotationItems) {
        setPreviewData(prev => ({
          ...prev,
          [communicationLogId]: quotationItems
        }));
      }
    } catch (error) {
      console.error('Error fetching quotation preview:', error);
    }
  };

  const handleExportPDF = async (item: PipelineItem) => {
    try {
      // Fetch quotation items for this communication
      const { data: quotationItems } = await supabase
        .from('quotation_items')
        .select(`
          *,
          materials (name),
          suppliers (name)
        `)
        .eq('communication_log_id', item.id);

      // Fetch the communication log details
      const { data: commLog } = await supabase
        .from('communication_log')
        .select('*')
        .eq('id', item.id)
        .single();

      const items = (quotationItems || []).map((qi: any) => ({
        material_name: qi.materials?.name,
        quantity: qi.quantity,
        unit_price: qi.unit_price,
        supplier_name: qi.suppliers?.name,
        city: qi.city,
        location: qi.location,
        district: qi.district,
      }));

      const quotationData = {
        company_name: item.company_name,
        person_name: item.person_name,
        contact_info: item.contact_info,
        communication_date: item.communication_date 
          ? format(new Date(item.communication_date), 'MMM dd, yyyy')
          : new Date().toLocaleDateString(),
        city: commLog?.city,
        location: commLog?.location,
        district: commLog?.district,
        project_type: commLog?.project_type,
        project_size: commLog?.project_size,
        current_phase: commLog?.current_phase,
        items,
        total: item.quotation_total || 0,
        is_soft_quotation: commLog?.is_soft_quotation || false,
      };

      exportQuotationToPDF(quotationData);
      toast.success('Quotation exported to PDF');
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast.error('Failed to export quotation to PDF');
    }
  };

  const handleExportExcel = async (item: PipelineItem) => {
    try {
      // Fetch quotation items for this communication
      const { data: quotationItems } = await supabase
        .from('quotation_items')
        .select(`
          *,
          materials (name),
          suppliers (name)
        `)
        .eq('communication_log_id', item.id);

      // Fetch the communication log details
      const { data: commLog } = await supabase
        .from('communication_log')
        .select('*')
        .eq('id', item.id)
        .single();

      const items = (quotationItems || []).map((qi: any) => ({
        material_name: qi.materials?.name,
        quantity: qi.quantity,
        unit_price: qi.unit_price,
        supplier_name: qi.suppliers?.name,
        city: qi.city,
        location: qi.location,
        district: qi.district,
      }));

      const quotationData = {
        company_name: item.company_name,
        person_name: item.person_name,
        contact_info: item.contact_info,
        communication_date: item.communication_date 
          ? format(new Date(item.communication_date), 'MMM dd, yyyy')
          : new Date().toLocaleDateString(),
        city: commLog?.city,
        location: commLog?.location,
        district: commLog?.district,
        project_type: commLog?.project_type,
        project_size: commLog?.project_size,
        current_phase: commLog?.current_phase,
        items,
        total: item.quotation_total || 0,
        is_soft_quotation: commLog?.is_soft_quotation || false,
      };

      exportQuotationToExcel(quotationData);
      toast.success('Quotation exported to Excel');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export quotation to Excel');
    }
  };

  const toggleSort = (field: 'date' | 'company' | 'status' | 'follow_up') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Helper function to determine follow-up status for an item
  const getFollowUpStatus = (itemId: string): 'none' | 'pending' | 'overdue' => {
    const followUps = allFollowUps[itemId] || [];
    if (followUps.length === 0) return 'none';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check for overdue (past date + status Open)
    const hasOverdue = followUps.some(fu => {
      const fuDate = new Date(fu.follow_up_date);
      fuDate.setHours(0, 0, 0, 0);
      return fuDate < today && fu.status_after === 'Open';
    });
    
    if (hasOverdue) return 'overdue';
    
    // Check for pending (future date or today + status Open)
    const hasPending = followUps.some(fu => {
      const fuDate = new Date(fu.follow_up_date);
      fuDate.setHours(0, 0, 0, 0);
      return fuDate >= today && fu.status_after === 'Open';
    });
    
    if (hasPending) return 'pending';
    
    return 'none';
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

  const filteredAndSortedItems = pipelineItems
    .filter((item) => {
      const matchesSearch =
        item.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.person_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesSupplier = supplierFilter === 'all' || item.related_supplier_id === supplierFilter;
      const matchesDeal = dealFilter === 'all' || 
        (dealFilter === 'completed' && item.deal_completed) ||
        (dealFilter === 'pending' && !item.deal_completed);
      
      // Follow-up status filter
      let matchesFollowUp = true;
      if (followUpStatusFilter !== 'all') {
        const fuStatus = getFollowUpStatus(item.id);
        matchesFollowUp = fuStatus === followUpStatusFilter;
      }
      
      // Interest level filter
      const matchesInterestLevel = interestLevelFilter === 'all' || item.interest_level === interestLevelFilter;
      
      // Time filter
      let matchesTime = true;
      const dateRange = getDateRange();
      if (dateRange && item.communication_date) {
        const commDate = new Date(item.communication_date);
        matchesTime = isWithinInterval(commDate, { start: dateRange.start, end: dateRange.end });
      }
      
      // Returning client filter
      const matchesReturning = !returningClientFilter || getCompanyCount(item.company_name) > 1;
      
      return matchesSearch && matchesStatus && matchesSupplier && matchesDeal && matchesFollowUp && matchesInterestLevel && matchesTime && matchesReturning;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.communication_date).getTime() - new Date(b.communication_date).getTime();
          break;
        case 'company':
          comparison = (a.company_name || '').localeCompare(b.company_name || '');
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'follow_up':
          const dateA = a.follow_up_date ? new Date(a.follow_up_date).getTime() : 0;
          const dateB = b.follow_up_date ? new Date(b.follow_up_date).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-status-open/15 text-status-open border-status-open/30';
      case 'In Progress':
        return 'bg-status-quotation/15 text-status-quotation border-status-quotation/30';
      case 'Completed':
        return 'bg-status-closed/15 text-status-closed border-status-closed/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getInterestLevelColor = (level: string | null) => {
    switch (level) {
      case 'High':
        return 'bg-green-500/15 text-green-600 border-green-500/30';
      case 'Medium':
        return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30';
      case 'Low':
        return 'bg-orange-500/15 text-orange-600 border-orange-500/30';
      case 'Not interested':
        return 'bg-red-500/15 text-red-600 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStageColor = (stage: string | null) => {
    switch (stage) {
      case 'Discovery':
        return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
      case 'Proposal':
        return 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30';
      case 'Negotiation':
        return 'bg-purple-500/15 text-purple-600 border-purple-500/30';
      case 'Closed Won':
        return 'bg-green-500/15 text-green-600 border-green-500/30';
      case 'Closed Lost':
        return 'bg-red-500/15 text-red-600 border-red-500/30';
      case 'Order Confirmed':
        return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // Inline update handler for opportunities
  const handleInlineOpportunityUpdate = async (opportunityId: string, field: string, value: string) => {
    try {
      // Determine if in_pipeline should change based on interest_level update
      const isInPipeline = (interestLevel: string | null) => 
        ['High', 'Medium', 'Low'].includes(interestLevel || '');
      
      const updateData: Record<string, any> = { [field]: value, updated_at: new Date().toISOString() };
      
      // If updating interest_level, also update in_pipeline
      if (field === 'interest_level') {
        updateData.in_pipeline = isInPipeline(value);
      }
      
      const { error } = await supabase
        .from('opportunities')
        .update(updateData)
        .eq('id', opportunityId);
      
      if (error) throw error;
      
      // When interest_level changes, move opportunity between pipeline and cold leads
      if (field === 'interest_level') {
        const newInPipeline = isInPipeline(value);
        
        // Find the opportunity in either array
        const oppInPipeline = opportunityPipeline.find(o => o.id === opportunityId);
        const oppInColdLeads = opportunityColdLeads.find(o => o.id === opportunityId);
        const opp = oppInPipeline || oppInColdLeads;
        
        if (opp) {
          const updatedOpp = { ...opp, [field]: value, in_pipeline: newInPipeline };
          
          if (newInPipeline) {
            // Move to pipeline
            setOpportunityColdLeads(prev => prev.filter(o => o.id !== opportunityId));
            setOpportunityPipeline(prev => {
              // Only add if not already there
              if (prev.find(o => o.id === opportunityId)) {
                return prev.map(o => o.id === opportunityId ? updatedOpp : o);
              }
              return [...prev, updatedOpp];
            });
          } else {
            // Move to cold leads
            setOpportunityPipeline(prev => prev.filter(o => o.id !== opportunityId));
            setOpportunityColdLeads(prev => {
              // Only add if not already there
              if (prev.find(o => o.id === opportunityId)) {
                return prev.map(o => o.id === opportunityId ? updatedOpp : o);
              }
              return [...prev, updatedOpp];
            });
          }
        }
      } else {
        // For other fields, just update in place
        setOpportunityPipeline(prev => prev.map(opp => 
          opp.id === opportunityId ? { ...opp, [field]: value } : opp
        ));
        setOpportunityColdLeads(prev => prev.map(opp => 
          opp.id === opportunityId ? { ...opp, [field]: value } : opp
        ));
      }
      
      toast.success(`Updated ${field.replace('_', ' ')} successfully`);
    } catch (error) {
      console.error('Error updating opportunity:', error);
      toast.error('Failed to update opportunity');
    }
  };

  // Get unique owners from opportunities
  const uniqueOppOwners = [...new Set([...opportunityPipeline, ...opportunityColdLeads].map(o => o.assigned_to).filter(Boolean))] as string[];

  // Get date range for opportunity filtering
  const getOppDateRange = () => {
    const now = new Date();
    switch (oppTimeFilter) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom':
        return oppCustomDateRange.from && oppCustomDateRange.to 
          ? { start: startOfDay(oppCustomDateRange.from), end: endOfDay(oppCustomDateRange.to) }
          : null;
      default:
        return null;
    }
  };

  // Filter opportunity pipeline
  const filteredOpportunityPipeline = opportunityPipeline.filter((opp) => {
    const matchesSearch = 
      opp.name?.toLowerCase().includes(oppSearchQuery.toLowerCase()) ||
      opp.company_name?.toLowerCase().includes(oppSearchQuery.toLowerCase()) ||
      opp.project_name?.toLowerCase().includes(oppSearchQuery.toLowerCase());
    const matchesInterest = oppInterestFilter === 'all' || opp.interest_level === oppInterestFilter;
    const matchesStage = oppStageFilter === 'all' || opp.stage === oppStageFilter;
    const matchesOwner = oppOwnerFilter === 'all' || opp.assigned_to === oppOwnerFilter;
    
    // Time filter
    let matchesTime = true;
    const dateRange = getOppDateRange();
    if (dateRange && opp.created_at) {
      const oppDate = new Date(opp.created_at);
      matchesTime = isWithinInterval(oppDate, { start: dateRange.start, end: dateRange.end });
    }
    
    return matchesSearch && matchesInterest && matchesStage && matchesOwner && matchesTime;
  });

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t('pipeline.title')}</h1>
          <p className="text-muted-foreground">
            Opportunities and communications in the sales pipeline
          </p>
        </div>

        {/* OPPORTUNITIES PIPELINE SECTION (New Model) */}
        <Card className="border-primary/20">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                  Opportunities Pipeline
                </CardTitle>
                <CardDescription>
                  Opportunities with High, Medium, or Low interest level
                </CardDescription>
              </div>
              <Badge variant="default" className="text-lg px-3 py-1">
                {opportunityPipeline.length} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Summary Cards for Opportunities */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <Card 
                className={`bg-card/50 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${oppInterestFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setOppInterestFilter('all')}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">{opportunityPipeline.length}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-semibold">{opportunityPipeline.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card 
                className={`bg-card/50 border-green-500/30 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${oppInterestFilter === 'High' ? 'ring-2 ring-green-500' : ''}`}
                onClick={() => setOppInterestFilter(oppInterestFilter === 'High' ? 'all' : 'High')}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">High</p>
                      <p className="text-2xl font-bold text-green-600">{opportunityPipeline.filter(o => o.interest_level === 'High').length}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-green-500/15 flex items-center justify-center">
                      <span className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card 
                className={`bg-card/50 border-yellow-500/30 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${oppInterestFilter === 'Medium' ? 'ring-2 ring-yellow-500' : ''}`}
                onClick={() => setOppInterestFilter(oppInterestFilter === 'Medium' ? 'all' : 'Medium')}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Medium</p>
                      <p className="text-2xl font-bold text-yellow-600">{opportunityPipeline.filter(o => o.interest_level === 'Medium').length}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-yellow-500/15 flex items-center justify-center">
                      <span className="w-3 h-3 rounded-full bg-yellow-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card 
                className={`bg-card/50 border-orange-500/30 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${oppInterestFilter === 'Low' ? 'ring-2 ring-orange-500' : ''}`}
                onClick={() => setOppInterestFilter(oppInterestFilter === 'Low' ? 'all' : 'Low')}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Low</p>
                      <p className="text-2xl font-bold text-orange-600">{opportunityPipeline.filter(o => o.interest_level === 'Low').length}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-orange-500/15 flex items-center justify-center">
                      <span className="w-3 h-3 rounded-full bg-orange-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search opportunities..."
                  value={oppSearchQuery}
                  onChange={(e) => setOppSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={oppStageFilter} onValueChange={setOppStageFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">All Stages</SelectItem>
                  <SelectItem value="Discovery">Discovery</SelectItem>
                  <SelectItem value="RFP">RFP</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={oppOwnerFilter} onValueChange={setOppOwnerFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">All Owners</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.full_name || member.email || member.id}>
                      {member.full_name || member.email || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[150px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {oppTimeFilter === 'all' ? 'All Time' : 
                     oppTimeFilter === 'today' ? 'Today' :
                     oppTimeFilter === 'week' ? 'This Week' :
                     oppTimeFilter === 'month' ? 'This Month' :
                     oppTimeFilter === 'custom' && oppCustomDateRange.from && oppCustomDateRange.to ?
                       `${format(oppCustomDateRange.from, 'MMM d')} - ${format(oppCustomDateRange.to, 'MMM d')}` :
                       'Custom'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <div className="p-2 space-y-1">
                    <Button 
                      variant={oppTimeFilter === 'all' ? 'secondary' : 'ghost'} 
                      className="w-full justify-start" 
                      size="sm"
                      onClick={() => setOppTimeFilter('all')}
                    >
                      All Time
                    </Button>
                    <Button 
                      variant={oppTimeFilter === 'today' ? 'secondary' : 'ghost'} 
                      className="w-full justify-start" 
                      size="sm"
                      onClick={() => setOppTimeFilter('today')}
                    >
                      Today
                    </Button>
                    <Button 
                      variant={oppTimeFilter === 'week' ? 'secondary' : 'ghost'} 
                      className="w-full justify-start" 
                      size="sm"
                      onClick={() => setOppTimeFilter('week')}
                    >
                      This Week
                    </Button>
                    <Button 
                      variant={oppTimeFilter === 'month' ? 'secondary' : 'ghost'} 
                      className="w-full justify-start" 
                      size="sm"
                      onClick={() => setOppTimeFilter('month')}
                    >
                      This Month
                    </Button>
                    <Button 
                      variant={oppTimeFilter === 'custom' ? 'secondary' : 'ghost'} 
                      className="w-full justify-start" 
                      size="sm"
                      onClick={() => setOppTimeFilter('custom')}
                    >
                      Custom Range
                    </Button>
                  </div>
                  {oppTimeFilter === 'custom' && (
                    <div className="p-2 border-t">
                      <Calendar
                        mode="range"
                        selected={{ from: oppCustomDateRange.from, to: oppCustomDateRange.to }}
                        onSelect={(range) => setOppCustomDateRange({ from: range?.from, to: range?.to })}
                        numberOfMonths={1}
                      />
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {(oppSearchQuery || oppInterestFilter !== 'all' || oppStageFilter !== 'all' || oppOwnerFilter !== 'all' || oppTimeFilter !== 'all') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setOppSearchQuery('');
                    setOppInterestFilter('all');
                    setOppStageFilter('all');
                    setOppOwnerFilter('all');
                    setOppTimeFilter('all');
                    setOppCustomDateRange({ from: undefined, to: undefined });
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Opportunities Table */}
            {filteredOpportunityPipeline.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg">No opportunities in pipeline</p>
                <p className="text-sm">Create opportunities with High, Medium, or Low interest to see them here</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={filteredOpportunityPipeline.length > 0 && filteredOpportunityPipeline.every(opp => selectedOpportunities.has(opp.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedOpportunities(new Set(filteredOpportunityPipeline.map(opp => opp.id)));
                            } else {
                              setSelectedOpportunities(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Opportunity</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Interest</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOpportunityPipeline.map((opp) => (
                      <TableRow key={opp.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Checkbox
                            checked={selectedOpportunities.has(opp.id)}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedOpportunities);
                              if (checked) {
                                newSelected.add(opp.id);
                              } else {
                                newSelected.delete(opp.id);
                              }
                              setSelectedOpportunities(newSelected);
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {opp.name}
                            {opp.is_deal && (
                              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                Deal
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto font-normal text-foreground hover:text-primary"
                            onClick={() => navigate(`/client-profile/${opp.client_id}`)}
                          >
                            {opp.company_name}
                          </Button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{opp.project_name}</TableCell>
                        <TableCell>
                          <Select
                            value={opp.interest_level || 'Not set'}
                            onValueChange={(value) => handleInlineOpportunityUpdate(opp.id, 'interest_level', value)}
                            disabled={opp.is_deal || opp.is_locked}
                          >
                            <SelectTrigger className="h-7 w-[110px] border-none bg-transparent p-0 focus:ring-0">
                              <Badge className={getInterestLevelColor(opp.interest_level)}>
                                {opp.interest_level || 'Not set'}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              <SelectItem value="High">High</SelectItem>
                              <SelectItem value="Medium">Medium</SelectItem>
                              <SelectItem value="Low">Low</SelectItem>
                              <SelectItem value="Not interested">Not interested</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={opp.stage || 'Discovery'}
                            onValueChange={(value) => handleInlineOpportunityUpdate(opp.id, 'stage', value)}
                            disabled={opp.is_deal || opp.interest_level === 'Not interested'}
                          >
                            <SelectTrigger className="h-7 w-[100px] border-none bg-transparent p-0 focus:ring-0">
                              <Badge className={getStageColor(opp.stage)}>
                                {opp.stage || 'Discovery'}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              <SelectItem value="Discovery">Discovery</SelectItem>
                              <SelectItem value="RFP">RFP</SelectItem>
                              <SelectItem value="Closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={opp.assigned_to || 'unassigned'}
                            onValueChange={(value) => handleInlineOpportunityUpdate(opp.id, 'assigned_to', value === 'unassigned' ? '' : value)}
                            disabled={opp.is_deal || opp.is_locked}
                          >
                            <SelectTrigger className="h-7 w-[100px] border-none bg-transparent p-0 focus:ring-0 text-muted-foreground">
                              <SelectValue>{opp.assigned_to || '-'}</SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {teamMembers.map((member) => (
                                <SelectItem key={member.id} value={member.full_name || member.email || member.id}>
                                  {member.full_name || member.email || 'Unknown'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(opp.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={() => navigate(`/client-profile/${opp.client_id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditOpportunity(opp)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {!opp.is_deal && !opp.is_closed && (
                                <>
                                  <DropdownMenuItem onClick={() => handleConvertToDeal(opp)}>
                                    <ArrowRight className="h-4 w-4 mr-2" />
                                    Convert to Deal
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleCloseOpportunity(opp)}>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Close (Won/Lost)
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem 
                                onClick={() => handleDeleteOpportunityClick(opp)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Cold Leads Section */}
            {opportunityColdLeads.length > 0 && (
              <div className="mt-6">
                <div 
                  className="flex items-center gap-2 cursor-pointer mb-3"
                  onClick={() => setColdLeadsExpanded(!coldLeadsExpanded)}
                >
                  {coldLeadsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                  <h3 className="font-semibold text-muted-foreground">
                    Cold Leads ({opportunityColdLeads.length})
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    Not in Pipeline
                  </Badge>
                </div>
                {coldLeadsExpanded && (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={opportunityColdLeads.length > 0 && opportunityColdLeads.slice(0, 10).every(opp => selectedOpportunities.has(opp.id))}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedOpportunities);
                                opportunityColdLeads.slice(0, 10).forEach(opp => {
                                  if (checked) {
                                    newSelected.add(opp.id);
                                  } else {
                                    newSelected.delete(opp.id);
                                  }
                                });
                                setSelectedOpportunities(newSelected);
                              }}
                            />
                          </TableHead>
                          <TableHead>Opportunity</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Interest</TableHead>
                          <TableHead>Stage</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {opportunityColdLeads.slice(0, 10).map((opp) => (
                          <TableRow key={opp.id} className="hover:bg-muted/30">
                            <TableCell>
                              <Checkbox
                                checked={selectedOpportunities.has(opp.id)}
                                onCheckedChange={(checked) => {
                                  const newSelected = new Set(selectedOpportunities);
                                  if (checked) {
                                    newSelected.add(opp.id);
                                  } else {
                                    newSelected.delete(opp.id);
                                  }
                                  setSelectedOpportunities(newSelected);
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{opp.name}</TableCell>
                            <TableCell>
                              <Button
                                variant="link"
                                className="p-0 h-auto font-normal text-foreground hover:text-primary"
                                onClick={() => navigate(`/client-profile/${opp.client_id}`)}
                              >
                                {opp.company_name}
                              </Button>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{opp.project_name}</TableCell>
                            <TableCell>
                              <Select
                                value={opp.interest_level || 'Not set'}
                                onValueChange={(value) => handleInlineOpportunityUpdate(opp.id, 'interest_level', value)}
                              >
                                <SelectTrigger className="h-7 w-[110px] border-none bg-transparent p-0 focus:ring-0">
                                  <Badge className={getInterestLevelColor(opp.interest_level)}>
                                    {opp.interest_level || 'Not set'}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-50">
                                  <SelectItem value="High">High</SelectItem>
                                  <SelectItem value="Medium">Medium</SelectItem>
                                  <SelectItem value="Low">Low</SelectItem>
                                  <SelectItem value="Not interested">Not interested</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={opp.stage || 'Discovery'}
                                onValueChange={(value) => handleInlineOpportunityUpdate(opp.id, 'stage', value)}
                                disabled={opp.is_deal || opp.interest_level === 'Not interested'}
                              >
                                <SelectTrigger className="h-7 w-[100px] border-none bg-transparent p-0 focus:ring-0">
                                  <Badge variant="outline">{opp.stage || 'Discovery'}</Badge>
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-50">
                                  <SelectItem value="Discovery">Discovery</SelectItem>
                                  <SelectItem value="RFP">RFP</SelectItem>
                                  <SelectItem value="Closed">Closed</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(opp.created_at), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-popover">
                                  <DropdownMenuItem onClick={() => navigate(`/client-profile/${opp.client_id}`)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditOpportunity(opp)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {!opp.is_deal && !opp.is_closed && (
                                    <>
                                      <DropdownMenuItem onClick={() => handleConvertToDeal(opp)}>
                                        <ArrowRight className="h-4 w-4 mr-2" />
                                        Convert to Deal
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleCloseOpportunity(opp)}>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Close (Won/Lost)
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteOpportunityClick(opp)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* LEGACY SECTION: Communications Pipeline */}
        <Card className="border-muted/50 mt-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-muted-foreground">Legacy Communications Pipeline</CardTitle>
            <CardDescription>Historical communications data (for backward compatibility)</CardDescription>
          </CardHeader>
          <CardContent>

        {/* Interest Level Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card 
            className={`bg-card/50 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${interestLevelFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setInterestLevelFilter('all')}
          >
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pipeline</p>
                  <p className="text-2xl font-bold">{pipelineItems.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold">{pipelineItems.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`bg-card/50 border-green-500/30 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${interestLevelFilter === 'High' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => setInterestLevelFilter(interestLevelFilter === 'High' ? 'all' : 'High')}
          >
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">High Interest</p>
                  <p className="text-2xl font-bold text-green-600">{pipelineItems.filter(i => i.interest_level === 'High').length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500/15 flex items-center justify-center">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`bg-card/50 border-yellow-500/30 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${interestLevelFilter === 'Medium' ? 'ring-2 ring-yellow-500' : ''}`}
            onClick={() => setInterestLevelFilter(interestLevelFilter === 'Medium' ? 'all' : 'Medium')}
          >
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Medium Interest</p>
                  <p className="text-2xl font-bold text-yellow-600">{pipelineItems.filter(i => i.interest_level === 'Medium').length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-yellow-500/15 flex items-center justify-center">
                  <span className="w-3 h-3 rounded-full bg-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`bg-card/50 border-orange-500/30 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${interestLevelFilter === 'Low' ? 'ring-2 ring-orange-500' : ''}`}
            onClick={() => setInterestLevelFilter(interestLevelFilter === 'Low' ? 'all' : 'Low')}
          >
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Low Interest</p>
                  <p className="text-2xl font-bold text-orange-600">{pipelineItems.filter(i => i.interest_level === 'Low').length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-orange-500/15 flex items-center justify-center">
                  <span className="w-3 h-3 rounded-full bg-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Stage Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card className="bg-card/50 border-blue-500/30">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Qualified Leads</p>
                  <p className="text-2xl font-bold text-blue-600">{pipelineItems.filter(i => !i.quotation_sent && !i.deal_completed).length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500/15 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-indigo-500/30">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Proposals Sent</p>
                  <p className="text-2xl font-bold text-indigo-600">{pipelineItems.filter(i => i.quotation_sent && !i.deal_completed).length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-indigo-500/15 flex items-center justify-center">
                  <Send className="h-5 w-5 text-indigo-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-green-500/30">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Closed Deals</p>
                  <p className="text-2xl font-bold text-green-600">{pipelineItems.filter(i => i.deal_completed).length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500/15 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('pipeline.search')}
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
            <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
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
                      className="rounded-md border pointer-events-auto"
                    />
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('pipeline.status')} />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">{t('pipeline.allStatuses')}</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="In Follow-up">In Follow-up</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={interestLevelFilter} onValueChange={setInterestLevelFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Interest Level" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">All Interest Levels</SelectItem>
              <SelectItem value="High">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  High
                </span>
              </SelectItem>
              <SelectItem value="Medium">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  Medium
                </span>
              </SelectItem>
              <SelectItem value="Low">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Low
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('pipeline.supplier')} />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">{t('pipeline.allSuppliers')}</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dealFilter} onValueChange={setDealFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('pipeline.dealCompleted')} />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">{t('pipeline.all')}</SelectItem>
              <SelectItem value="completed">{t('pipeline.completed')}</SelectItem>
              <SelectItem value="pending">{t('pipeline.pending')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={followUpStatusFilter} onValueChange={setFollowUpStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Follow-up Status" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">All Follow-ups</SelectItem>
              <SelectItem value="pending">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Pending
                </span>
              </SelectItem>
              <SelectItem value="overdue">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-destructive" />
                  Overdue
                </span>
              </SelectItem>
              <SelectItem value="none">No Follow-ups</SelectItem>
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
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="company">Company</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="follow_up">Follow-up</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending Quotations</CardTitle>
            <CardDescription>All communications marked for quotation</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{t('pipeline.loading')}</div>
            ) : filteredAndSortedItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery || statusFilter !== 'all' || supplierFilter !== 'all' || dealFilter !== 'all' || followUpStatusFilter !== 'all' || timeFilter !== 'all'
                  ? t('pipeline.noResults')
                  : t('pipeline.noData')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: columnWidths.company, position: 'relative' }}>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort('company')}>
                        {t('pipeline.columns.company')} {sortBy === 'company' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                      </Button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 flex items-center justify-center group"
                        onMouseDown={(e) => handleResizeStart('company', e)}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </TableHead>
                    <TableHead style={{ width: columnWidths.person, position: 'relative' }}>
                      {t('pipeline.columns.person')}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 flex items-center justify-center group"
                        onMouseDown={(e) => handleResizeStart('person', e)}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </TableHead>
                    <TableHead style={{ width: columnWidths.contact, position: 'relative' }}>
                      {t('pipeline.columns.contact')}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 flex items-center justify-center group"
                        onMouseDown={(e) => handleResizeStart('contact', e)}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </TableHead>
                    <TableHead style={{ width: columnWidths.city, position: 'relative' }}>
                      City
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 flex items-center justify-center group"
                        onMouseDown={(e) => handleResizeStart('city', e)}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </TableHead>
                    <TableHead style={{ width: columnWidths.interestLevel, position: 'relative' }}>
                      Interest Level
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 flex items-center justify-center group"
                        onMouseDown={(e) => handleResizeStart('interestLevel', e)}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </TableHead>
                    <TableHead style={{ width: columnWidths.details, position: 'relative' }}>
                      Details
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 flex items-center justify-center group"
                        onMouseDown={(e) => handleResizeStart('details', e)}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </TableHead>
                    <TableHead style={{ width: columnWidths.total, position: 'relative' }}>
                      {t('pipeline.columns.total')}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 flex items-center justify-center group"
                        onMouseDown={(e) => handleResizeStart('total', e)}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </TableHead>
                    <TableHead style={{ width: columnWidths.date, position: 'relative' }}>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort('date')}>
                        {t('pipeline.columns.date')} {sortBy === 'date' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                      </Button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 flex items-center justify-center group"
                        onMouseDown={(e) => handleResizeStart('date', e)}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </TableHead>
                    <TableHead style={{ width: columnWidths.status, position: 'relative' }}>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort('status')}>
                        {t('pipeline.columns.status')} {sortBy === 'status' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                      </Button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 flex items-center justify-center group"
                        onMouseDown={(e) => handleResizeStart('status', e)}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </TableHead>
                    <TableHead style={{ width: columnWidths.followUp, position: 'relative' }}>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort('follow_up')}>
                        {t('pipeline.columns.followUp')} {sortBy === 'follow_up' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                      </Button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 flex items-center justify-center group"
                        onMouseDown={(e) => handleResizeStart('followUp', e)}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </TableHead>
                    <TableHead style={{ width: columnWidths.actions, position: 'relative' }} className="text-center">
                      {t('pipeline.columns.actions')}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 flex items-center justify-center group"
                        onMouseDown={(e) => handleResizeStart('actions', e)}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedItems.map((item) => (
                    <React.Fragment key={item.id}>
                      <TableRow 
                        className={item.deal_completed ? 'bg-green-500/10 hover:bg-green-500/20' : ''}
                      >
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-1">
                            <HoverCard openDelay={300}>
                              <HoverCardTrigger 
                                asChild
                                onMouseEnter={() => fetchQuotationPreview(item.id)}
                              >
                                <span 
                                  className="cursor-pointer hover:underline flex items-center gap-1 text-primary"
                                  onClick={() => {
                                    if (item.company_name) {
                                      navigate(`/client-profile/${encodeURIComponent(item.company_name)}`);
                                    }
                                  }}
                                >
                                  {item.company_name || '-'}
                                  <ReturningClientBadge count={getCompanyCount(item.company_name)} variant="compact" />
                                </span>
                              </HoverCardTrigger>
                            <HoverCardContent className="w-96" align="start">
                              <div className="space-y-3">
                                <div>
                                  <h4 className="text-sm font-semibold mb-2">Quotation Details</h4>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">Person:</span>
                                      <p className="font-medium">{item.person_name || '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Contact:</span>
                                      <p className="font-medium">{item.contact_info || '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">City:</span>
                                      <p className="font-medium">{item.city || '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Location:</span>
                                      <p className="font-medium">{item.location || '-'}</p>
                                    </div>
                                  </div>
                                </div>
                                
                                {previewData[item.id] && previewData[item.id].length > 0 && (
                                  <div>
                                    <h5 className="text-xs font-semibold mb-2">Items ({previewData[item.id].length})</h5>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                      {previewData[item.id].map((quotItem: any, idx: number) => (
                                        <div key={idx} className="text-xs border-l-2 border-primary/20 pl-2 py-1">
                                          <div className="font-medium">{quotItem.materials?.name || 'N/A'}</div>
                                          <div className="text-muted-foreground">
                                            Qty: {quotItem.quantity || 0} × {quotItem.unit_price?.toLocaleString() || '0'} SAR
                                            {quotItem.quantity && quotItem.unit_price && (
                                              <span className="ml-2 font-semibold text-foreground">
                                                = {(quotItem.quantity * quotItem.unit_price).toLocaleString()} SAR
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="mt-2 pt-2 border-t text-xs font-semibold">
                                      Total: {item.quotation_total?.toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      }) || '0.00'} SAR
                                    </div>
                                  </div>
                                )}
                                
                                {item.notes && (
                                  <div>
                                    <span className="text-xs text-muted-foreground">Notes:</span>
                                    <p className="text-xs mt-1 line-clamp-3">{item.notes}</p>
                                  </div>
                                )}
                              </div>
                            </HoverCardContent>
                            </HoverCard>
                            <div className="flex items-center gap-1 flex-wrap">
                              {isReturningClient(item.company_name) && (
                                <ReturningLeadTag />
                              )}
                              {item.quotation_sent && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs font-medium gap-1 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700">
                                      <Send className="h-3 w-3" />
                                      Sent
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Quotation sent – Pipeline stage: Proposals Sent</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{item.person_name || '-'}</TableCell>
                        <TableCell>{item.contact_info || '-'}</TableCell>
                        <TableCell>{item.city || '-'}</TableCell>
                        <TableCell>
                          {item.interest_level ? (
                            <Badge className={getInterestLevelColor(item.interest_level)}>
                              {item.interest_level}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{item.notes || '-'}</TableCell>
                        <TableCell className="font-semibold">
                          {item.is_soft_quotation ? (
                            <div className="flex items-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs font-semibold">
                                    SQ
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Soft Quotation – price shared without confirmed quantities</p>
                                </TooltipContent>
                              </Tooltip>
                              <span className="text-xs text-muted-foreground">N/A</span>
                            </div>
                          ) : item.quotation_total && item.quotation_total > 0
                            ? `${item.quotation_total.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })} SAR`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {item.communication_date 
                            ? format(new Date(item.communication_date), 'MMM dd, yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(item.status)}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.follow_up_date 
                            ? format(new Date(item.follow_up_date), 'MMM dd, yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-background border shadow-lg z-50">
                              <DropdownMenuItem onClick={() => {
                                const count = getCompanyCount(item.company_name);
                                setInitialClientData({
                                  company_name: item.company_name || '',
                                  person_name: item.person_name || '',
                                  contact_info: item.contact_info || '',
                                });
                                setNewCommDialogOpen(true);
                                if (count > 1) {
                                  toast.info(`🔁 Returning Client`, {
                                    description: `${item.company_name} has ${count} previous interaction${count > 1 ? 's' : ''} on record.`,
                                  });
                                }
                              }}>
                                <UserPlus className="h-4 w-4 mr-2" />
                                New Communication
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                if (item.company_name) {
                                  navigate(`/client-profile/${encodeURIComponent(item.company_name)}`);
                                }
                              }}>
                                <Building2 className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                setEditingCommunication(item);
                                setEditCommDialogOpen(true);
                              }}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Record
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedItem(item);
                                setDialogOpen(true);
                              }}>
                                <Eye className="h-4 w-4 mr-2" />
                                View/Edit Quotation
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openFollowUpModal(item)}>
                                <CalendarClock className="h-4 w-4 mr-2" />
                                Follow-ups ({allFollowUps[item.id]?.length || 0})
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleExportPDF(item)}>
                                <FileDown className="h-4 w-4 mr-2" />
                                Export PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportExcel(item)}>
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                Export Excel
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {item.deal_completed ? (
                                <DropdownMenuItem 
                                  onClick={() => handleReopenDeal(item.id)}
                                  className="text-amber-600"
                                >
                                  <History className="h-4 w-4 mr-2" />
                                  Reopen Deal
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setCloseDealItem(item);
                                    setCloseDealDialogOpen(true);
                                  }}
                                  className="text-green-600"
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Close Deal
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteClick(item.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Cold Leads Follow-Up Section */}
        {coldLeads.length > 0 && (
          <Card className="bg-card/50 border-red-500/30">
            <CardHeader className="cursor-pointer" onClick={() => setColdLeadsExpanded(!coldLeadsExpanded)}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-red-600 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                    Cold Leads Follow-Up
                  </CardTitle>
                  <CardDescription>
                    "Not interested" clients with objection-based follow-up sequences
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-500/15 text-red-600 border-red-500/30">
                    {coldLeads.length} leads
                  </Badge>
                  {coldLeadsExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
              </div>
            </CardHeader>
            {coldLeadsExpanded && (
              <CardContent>
                <div className="space-y-3">
                  {coldLeads.map((lead) => (
                    <div key={lead.id} className="p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{lead.company_name}</span>
                            {lead.objection_type && (
                              <Badge variant="outline" className="text-xs">
                                {lead.objection_type}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {lead.person_name} • {lead.contact_info}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lead.communication_date ? format(new Date(lead.communication_date), 'MMM dd, yyyy') : 'No date'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingCommunication(lead);
                              setEditCommDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openFollowUpModal(lead as PipelineItem)}
                          >
                            <History className="h-4 w-4 mr-1" />
                            Follow-ups ({allFollowUps[lead.id]?.length || 0})
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddFollowUp(lead)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        <PipelineDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          pipelineItem={selectedItem}
          onSave={fetchPipeline}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Quotation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this quotation? This action cannot be undone and will permanently remove the quotation and all associated items.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ContactTimeline 
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
          companyName={selectedCompany}
        />

        {selectedCommunication && (
          <FollowUpDialog
            open={followUpDialogOpen}
            onOpenChange={setFollowUpDialogOpen}
            communication={selectedCommunication}
            onSaved={handleFollowUpSaved}
            editingFollowUp={editingFollowUp}
          />
        )}

        <CloseDealDialog
          open={closeDealDialogOpen}
          onOpenChange={setCloseDealDialogOpen}
          pipelineItem={closeDealItem ? {
            id: closeDealItem.id,
            company_name: closeDealItem.company_name,
            created_at: closeDealItem.created_at || closeDealItem.communication_date,
            city: closeDealItem.city,
            district: closeDealItem.district,
            location: closeDealItem.location,
            related_supplier_id: closeDealItem.related_supplier_id,
          } : null}
          onSuccess={() => {
            fetchPipeline();
          }}
        />

        {/* Follow-up Modal */}
        <Dialog open={followUpModalOpen} onOpenChange={setFollowUpModalOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                Follow-ups — {followUpModalItem?.company_name || 'Unknown'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    if (followUpModalItem) {
                      handleAddFollowUp(followUpModalItem);
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Follow-up
                </Button>
              </div>
              {followUpModalItem && (
                <FollowUpTimeline
                  followUps={followUpsData[followUpModalItem.id] || []}
                  onEdit={handleEditFollowUp}
                  onRefresh={() => fetchFollowUps(followUpModalItem.id)}
                  loading={followUpsLoading[followUpModalItem.id] || false}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* New Communication Dialog */}
        <CommunicationDialog
          open={newCommDialogOpen}
          onOpenChange={(open) => {
            setNewCommDialogOpen(open);
            if (!open) {
              setInitialClientData(null);
            }
          }}
          communication={null}
          initialClientData={initialClientData}
          onSave={async () => {
            await fetchPipeline();
            setInitialClientData(null);
          }}
        />

        {/* Edit Legacy Communication Dialog */}
        <CommunicationDialog
          open={editCommDialogOpen}
          onOpenChange={(open) => {
            setEditCommDialogOpen(open);
            if (!open) setEditingCommunication(null);
          }}
          communication={editingCommunication}
          onSave={async () => {
            await fetchPipeline();
            setEditingCommunication(null);
          }}
        />

        <EditOpportunityDialog
          open={editOpportunityDialogOpen}
          onOpenChange={(open) => {
            setEditOpportunityDialogOpen(open);
            if (!open) setSelectedOpportunity(null);
          }}
          opportunity={selectedOpportunity ? {
            id: selectedOpportunity.id,
            name: selectedOpportunity.name,
            stage: selectedOpportunity.stage || 'Discovery',
            interest_level: selectedOpportunity.interest_level,
            expected_value: selectedOpportunity.expected_value,
            expected_close_date: selectedOpportunity.expected_close_date,
            notes: selectedOpportunity.notes,
            is_closed: selectedOpportunity.is_closed,
            won: selectedOpportunity.stage?.includes('Won') || false,
          } : null}
          onSuccess={fetchOpportunityPipeline}
        />

        {/* Convert to Deal Dialog */}
        {selectedOpportunity && (
          <ConvertToDealDialog
            open={convertToDealDialogOpen}
            onOpenChange={(open) => {
              setConvertToDealDialogOpen(open);
              if (!open) setSelectedOpportunity(null);
            }}
            opportunity={{
              id: selectedOpportunity.id,
              name: selectedOpportunity.name,
              client_id: selectedOpportunity.client_id,
              project_id: selectedOpportunity.project_id,
              expected_value: selectedOpportunity.expected_value,
              notes: selectedOpportunity.notes,
              interest_level: selectedOpportunity.interest_level,
            }}
            onSuccess={fetchOpportunityPipeline}
          />
        )}

        {/* Close Opportunity Dialog */}
        <CloseOpportunityDialog
          open={closeOpportunityDialogOpen}
          onOpenChange={(open) => {
            setCloseOpportunityDialogOpen(open);
            if (!open) setSelectedOpportunity(null);
          }}
          opportunityName={selectedOpportunity?.name || ''}
          onClose={handleCloseOpportunityResult}
        />

        {/* Delete Opportunity Confirmation Dialog */}
        <AlertDialog open={deleteOpportunityDialogOpen} onOpenChange={setDeleteOpportunityDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Opportunity</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{opportunityToDelete?.name}"? This will also remove all related communications, follow-ups, and materials. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setOpportunityToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteOpportunityConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Pipeline;

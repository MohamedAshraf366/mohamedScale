import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Calendar, User, Building2, MessageSquare, DollarSign, Clock, FileText, TrendingUp, Pencil, Trash2, History } from 'lucide-react';
import AddFollowUpForm from './AddFollowUpForm';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface StageDrillDownDialogProps {
  open: boolean;
  onClose: () => void;
  stage: string;
  startDate: Date;
  endDate: Date;
  teamMember?: string;
}

interface DealRecord {
  id: string;
  company_name: string | null;
  person_name: string | null;
  communication_date: string | null;
  status: string | null;
  assigned_to: string | null;
  summary: string | null;
  notes: string | null;
  follow_up_date: string | null;
  quotation_required: boolean | null;
  is_general_quotation: boolean | null;
  deal_completed: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  quotation_items?: Array<{
    quantity: number | null;
    unit_price: number | null;
    material_id: string | null;
  }>;
}

interface FollowUpHistory {
  id: string;
  follow_up_date: string;
  action: string | null;
  notes: string | null;
  status_after: string | null;
  created_at: string;
  user_id: string;
  communication_log_id: string;
}

interface AuditLogEntry {
  id: string;
  follow_up_id: string;
  action: 'created' | 'updated' | 'deleted';
  changed_by: string;
  changed_at: string;
  old_values: any;
  new_values: any;
}

interface TimelineEvent {
  date: string;
  type: 'created' | 'communication' | 'follow_up' | 'status_change' | 'quotation' | 'updated';
  title: string;
  description?: string;
  status?: string;
  user?: string;
  followUpId?: string;
}

const StageDrillDownDialog = ({
  open,
  onClose,
  stage,
  startDate,
  endDate,
  teamMember,
}: StageDrillDownDialogProps) => {
  const { userRole, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [followUpHistory, setFollowUpHistory] = useState<Record<string, FollowUpHistory[]>>({});
  const [auditLogs, setAuditLogs] = useState<Record<string, AuditLogEntry[]>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [followUpToDelete, setFollowUpToDelete] = useState<string | null>(null);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUpHistory | null>(null);
  const [editFormData, setEditFormData] = useState({
    action: '',
    notes: '',
    followUpDate: new Date(),
    statusAfter: 'Open' as 'Open' | 'Closed',
  });

  const canEditDelete = userRole === 'admin' || userRole === 'procurement_officer';

  useEffect(() => {
    if (open) {
      fetchDeals();
    }
  }, [open, stage, startDate, endDate, teamMember]);

  const fetchDeals = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('communication_log')
        .select('*, quotation_items(*)')
        .gte('communication_date', startDate.toISOString())
        .lte('communication_date', endDate.toISOString())
        .order('communication_date', { ascending: false });

      if (teamMember) {
        query = query.eq('assigned_to', teamMember);
      }

      // Apply stage-specific filters
      switch (stage) {
        case 'Raw Outreach':
          // All communication records
          break;
        case 'Qualified Leads':
          // Pipeline entries: interest_level is High/Medium/Low OR quotation_required (for legacy records)
          query = query.or('interest_level.in.(High,Medium,Low),quotation_required.eq.true');
          break;
        case 'Proposals Sent':
          query = query.eq('is_general_quotation', true);
          break;
        case 'Closed Deals':
          query = query.eq('deal_completed', true).eq('status', 'Closed');
          break;
      }

      const { data, error } = await query;

      if (error) throw error;
      setDeals(data || []);

      // Fetch follow-up history for each deal
      if (data && data.length > 0) {
        const dealIds = data.map(d => d.id);
        const { data: historyData } = await supabase
          .from('follow_up_history')
          .select('*')
          .in('communication_log_id', dealIds)
          .order('follow_up_date', { ascending: true });

        if (historyData) {
          const historyByDeal: Record<string, FollowUpHistory[]> = {};
          historyData.forEach((history: any) => {
            if (!historyByDeal[history.communication_log_id]) {
              historyByDeal[history.communication_log_id] = [];
            }
            historyByDeal[history.communication_log_id].push(history);
          });
          setFollowUpHistory(historyByDeal);

          // Fetch audit logs for all follow-ups
          const followUpIds = historyData.map((h: any) => h.id);
          const { data: auditData } = await supabase
            .from('follow_up_audit_log')
            .select('*')
            .in('follow_up_id', followUpIds)
            .order('changed_at', { ascending: false });

          if (auditData) {
            const auditByFollowUp: Record<string, AuditLogEntry[]> = {};
            auditData.forEach((audit: any) => {
              if (!auditByFollowUp[audit.follow_up_id]) {
                auditByFollowUp[audit.follow_up_id] = [];
              }
              auditByFollowUp[audit.follow_up_id].push(audit);
            });
            setAuditLogs(auditByFollowUp);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildTimeline = (deal: DealRecord): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    // Created event
    if (deal.created_at) {
      events.push({
        date: deal.created_at,
        type: 'created',
        title: 'Deal Created',
        description: `Initial contact with ${deal.company_name || 'company'}`,
        user: deal.assigned_to || undefined,
      });
    }

    // Communication event
    if (deal.communication_date) {
      events.push({
        date: deal.communication_date,
        type: 'communication',
        title: 'Communication',
        description: deal.summary || 'Communication logged',
        user: deal.assigned_to || undefined,
      });
    }

    // Quotation events
    if (deal.quotation_required) {
      events.push({
        date: deal.communication_date || deal.created_at || new Date().toISOString(),
        type: 'quotation',
        title: 'Quotation Required',
        description: 'Deal marked as requiring quotation',
      });
    }

    if (deal.is_general_quotation) {
      events.push({
        date: deal.communication_date || deal.created_at || new Date().toISOString(),
        type: 'quotation',
        title: 'Proposal Sent',
        description: 'General quotation sent to client',
      });
    }

    // Follow-up history
    const history = followUpHistory[deal.id] || [];
    history.forEach(followUp => {
      events.push({
        date: followUp.follow_up_date,
        type: 'follow_up',
        title: followUp.action || 'Follow-up',
        description: followUp.notes || undefined,
        status: followUp.status_after || undefined,
        followUpId: followUp.id,
      });
    });

    // Status change to Closed
    if (deal.status === 'Closed') {
      events.push({
        date: deal.updated_at || deal.communication_date || new Date().toISOString(),
        type: 'status_change',
        title: deal.deal_completed ? 'Deal Won' : 'Deal Lost',
        description: deal.deal_completed 
          ? `Successfully closed deal with value $${calculateDealValue(deal).toLocaleString()}`
          : 'Deal closed without completion',
        status: deal.status,
      });
    }

    // Sort events by date
    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'created':
        return <Building2 className="h-4 w-4" />;
      case 'communication':
        return <MessageSquare className="h-4 w-4" />;
      case 'follow_up':
        return <Calendar className="h-4 w-4" />;
      case 'status_change':
        return <TrendingUp className="h-4 w-4" />;
      case 'quotation':
        return <FileText className="h-4 w-4" />;
      case 'updated':
        return <Clock className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'created':
        return 'text-blue-600';
      case 'communication':
        return 'text-purple-600';
      case 'follow_up':
        return 'text-orange-600';
      case 'status_change':
        return 'text-green-600';
      case 'quotation':
        return 'text-accent';
      case 'updated':
        return 'text-muted-foreground';
      default:
        return 'text-primary';
    }
  };

  const calculateDealValue = (deal: DealRecord) => {
    if (!deal.quotation_items || deal.quotation_items.length === 0) return 0;
    return deal.quotation_items.reduce((sum, item) => {
      return sum + ((item.quantity || 0) * (item.unit_price || 0));
    }, 0);
  };

  const handleDeleteFollowUp = async () => {
    if (!followUpToDelete || !user) return;

    try {
      // Get the follow-up data before deletion for audit log
      const history = Object.values(followUpHistory).flat();
      const followUpToDeleteData = history.find(f => f.id === followUpToDelete);

      if (!followUpToDeleteData) {
        toast.error('Follow-up not found');
        return;
      }

      // Log the deletion in audit trail
      await supabase.from('follow_up_audit_log').insert({
        follow_up_id: followUpToDelete,
        communication_log_id: followUpToDeleteData.communication_log_id,
        action: 'deleted',
        changed_by: user.id,
        old_values: {
          action: followUpToDeleteData.action,
          notes: followUpToDeleteData.notes,
          follow_up_date: followUpToDeleteData.follow_up_date,
          status_after: followUpToDeleteData.status_after,
        },
        new_values: null,
      });

      // Delete the follow-up
      const { error } = await supabase
        .from('follow_up_history')
        .delete()
        .eq('id', followUpToDelete);

      if (error) throw error;

      toast.success('Follow-up deleted successfully');
      setDeleteDialogOpen(false);
      setFollowUpToDelete(null);
      fetchDeals();
    } catch (error) {
      console.error('Error deleting follow-up:', error);
      toast.error('Failed to delete follow-up');
    }
  };

  const startEdit = (followUpId: string, dealId: string) => {
    const history = followUpHistory[dealId] || [];
    const followUp = history.find(f => f.id === followUpId);
    if (followUp) {
      setEditingFollowUp(followUp);
      setEditFormData({
        action: followUp.action || '',
        notes: followUp.notes || '',
        followUpDate: new Date(followUp.follow_up_date),
        statusAfter: (followUp.status_after as 'Open' | 'Closed') || 'Open',
      });
    }
  };

  const handleUpdateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFollowUp || !user) return;

    try {
      const newValues = {
        action: editFormData.action,
        notes: editFormData.notes,
        follow_up_date: editFormData.followUpDate.toISOString(),
        status_after: editFormData.statusAfter,
      };

      // Log the update in audit trail
      await supabase.from('follow_up_audit_log').insert({
        follow_up_id: editingFollowUp.id,
        communication_log_id: editingFollowUp.communication_log_id,
        action: 'updated',
        changed_by: user.id,
        old_values: {
          action: editingFollowUp.action,
          notes: editingFollowUp.notes,
          follow_up_date: editingFollowUp.follow_up_date,
          status_after: editingFollowUp.status_after,
        },
        new_values: newValues,
      });

      // Update the follow-up
      const { error } = await supabase
        .from('follow_up_history')
        .update(newValues)
        .eq('id', editingFollowUp.id);

      if (error) throw error;

      toast.success('Follow-up updated successfully');
      setEditingFollowUp(null);
      fetchDeals();
    } catch (error) {
      console.error('Error updating follow-up:', error);
      toast.error('Failed to update follow-up');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {stage} - Detailed View
          </DialogTitle>
          <DialogDescription>
            {deals.length} {deals.length === 1 ? 'deal' : 'deals'} in this stage
            {teamMember && ` (${teamMember})`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading deals...</div>
            </div>
          ) : deals.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">No deals found in this stage</div>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {deals.map((deal, idx) => (
                <AccordionItem key={deal.id} value={deal.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-muted-foreground">
                          #{idx + 1}
                        </span>
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-semibold">
                            {deal.company_name || 'Unknown Company'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {deal.person_name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {stage === 'Closed Deals' && (
                          <div className="flex items-center gap-1 text-green-600">
                            <DollarSign className="h-4 w-4" />
                            <span className="font-semibold">
                              {calculateDealValue(deal).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <Badge variant={deal.status === 'Closed' ? 'default' : 'secondary'}>
                          {deal.status || 'Open'}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Tabs defaultValue="details" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="details">Details</TabsTrigger>
                        <TabsTrigger value="timeline">Timeline</TabsTrigger>
                      </TabsList>

                      <TabsContent value="details" className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Communication Date:</span>
                            <span>
                              {deal.communication_date
                                ? format(new Date(deal.communication_date), 'MMM dd, yyyy')
                                : 'N/A'}
                            </span>
                          </div>
                          {deal.follow_up_date && (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Follow-up Date:</span>
                              <span>
                                {format(new Date(deal.follow_up_date), 'MMM dd, yyyy')}
                              </span>
                            </div>
                          )}
                          {deal.assigned_to && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Owner:</span>
                              <span>{deal.assigned_to}</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          {deal.company_name && (
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Company:</span>
                              <span>{deal.company_name}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">Quotation Required:</span>
                            <Badge variant={deal.quotation_required ? 'default' : 'outline'}>
                              {deal.quotation_required ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                          {deal.is_general_quotation && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">General Quotation:</span>
                              <Badge>Yes</Badge>
                            </div>
                          )}
                        </div>
                      </div>

                      {deal.summary && (
                        <div className="space-y-1">
                          <span className="text-sm font-medium">Summary:</span>
                          <p className="text-sm text-muted-foreground">{deal.summary}</p>
                        </div>
                      )}

                      {deal.notes && (
                        <div className="space-y-1">
                          <span className="text-sm font-medium">Notes:</span>
                          <p className="text-sm text-muted-foreground">{deal.notes}</p>
                        </div>
                      )}

                        {deal.quotation_items && deal.quotation_items.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-sm font-medium">Quotation Items:</span>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Quantity</TableHead>
                                  <TableHead>Unit Price</TableHead>
                                  <TableHead>Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {deal.quotation_items.map((item, itemIdx) => (
                                  <TableRow key={itemIdx}>
                                    <TableCell>{item.quantity || 0}</TableCell>
                                    <TableCell>${(item.unit_price || 0).toLocaleString()}</TableCell>
                                    <TableCell className="font-semibold">
                                      ${((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow>
                                  <TableCell colSpan={2} className="font-semibold">
                                    Total Deal Value:
                                  </TableCell>
                                  <TableCell className="font-bold text-lg">
                                    ${calculateDealValue(deal).toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="timeline" className="space-y-4 pt-4">
                        <div className="space-y-6">
                          {/* Add Follow-up Form */}
                          <AddFollowUpForm
                            communicationLogId={deal.id}
                            onSuccess={() => fetchDeals()}
                          />

                          {/* Timeline */}
                          <div className="relative">
                            {buildTimeline(deal).length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                No timeline events available
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {buildTimeline(deal).map((event, eventIdx) => {
                                  const isFollowUp = event.type === 'follow_up' && event.followUpId;
                                  const isEditing = editingFollowUp?.id === event.followUpId;
                                  
                                  return (
                                    <div key={eventIdx} className="flex gap-4 relative">
                                      {/* Timeline line */}
                                      {eventIdx < buildTimeline(deal).length - 1 && (
                                        <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
                                      )}
                                      
                                      {/* Icon */}
                                      <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-background border-2 border-border ${getEventColor(event.type)}`}>
                                        {getEventIcon(event.type)}
                                      </div>

                                      {/* Content */}
                                      <div className="flex-1 pb-6">
                                        {isEditing ? (
                                          <form onSubmit={handleUpdateFollowUp} className="space-y-3 p-3 border rounded-lg bg-muted/50">
                                            <div className="flex items-center justify-between">
                                              <h5 className="font-semibold text-sm">Edit Follow-up</h5>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setEditingFollowUp(null)}
                                              >
                                                Cancel
                                              </Button>
                                            </div>
                                            
                                            <div className="space-y-2">
                                              <Label htmlFor={`edit-action-${event.followUpId}`}>Action/Title</Label>
                                              <Input
                                                id={`edit-action-${event.followUpId}`}
                                                value={editFormData.action}
                                                onChange={(e) => setEditFormData({ ...editFormData, action: e.target.value })}
                                                required
                                              />
                                            </div>

                                            <div className="space-y-2">
                                              <Label htmlFor={`edit-notes-${event.followUpId}`}>Notes</Label>
                                              <Textarea
                                                id={`edit-notes-${event.followUpId}`}
                                                value={editFormData.notes}
                                                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                                                rows={2}
                                              />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                              <div className="space-y-2">
                                                <Label>Follow-up Date</Label>
                                                <Popover>
                                                  <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className="w-full justify-start">
                                                      <Calendar className="mr-2 h-4 w-4" />
                                                      {format(editFormData.followUpDate, 'MMM dd, yyyy')}
                                                    </Button>
                                                  </PopoverTrigger>
                                                  <PopoverContent className="w-auto p-0" align="start">
                                                    <CalendarComponent
                                                      mode="single"
                                                      selected={editFormData.followUpDate}
                                                      onSelect={(date) => date && setEditFormData({ ...editFormData, followUpDate: date })}
                                                      initialFocus
                                                    />
                                                  </PopoverContent>
                                                </Popover>
                                              </div>

                                              <div className="space-y-2">
                                                <Label htmlFor={`edit-status-${event.followUpId}`}>Status After</Label>
                                                <Select
                                                  value={editFormData.statusAfter}
                                                  onValueChange={(value: 'Open' | 'Closed') =>
                                                    setEditFormData({ ...editFormData, statusAfter: value })
                                                  }
                                                >
                                                  <SelectTrigger id={`edit-status-${event.followUpId}`}>
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="Open">Open</SelectItem>
                                                    <SelectItem value="Closed">Closed</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                            </div>

                                            <Button type="submit" size="sm" className="w-full">
                                              Update Follow-up
                                            </Button>
                                          </form>
                                        ) : (
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-1 flex-1">
                                              <p className="font-semibold text-sm">{event.title}</p>
                                              {event.description && (
                                                <p className="text-sm text-muted-foreground">
                                                  {event.description}
                                                </p>
                                              )}
                                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                {format(new Date(event.date), 'MMM dd, yyyy HH:mm')}
                                                {event.user && (
                                                  <>
                                                    <span>•</span>
                                                    <User className="h-3 w-3" />
                                                    {event.user}
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {event.status && (
                                                <Badge variant={event.status === 'Closed' ? 'default' : 'secondary'}>
                                                  {event.status}
                                                </Badge>
                                              )}
                                              {isFollowUp && canEditDelete && (
                                                <div className="flex gap-1">
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => startEdit(event.followUpId!, deal.id)}
                                                  >
                                                    <Pencil className="h-3 w-3" />
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                      setFollowUpToDelete(event.followUpId!);
                                                      setDeleteDialogOpen(true);
                                                    }}
                                                  >
                                                    <Trash2 className="h-3 w-3 text-destructive" />
                                                  </Button>
                                                </div>
                                              )}
                                            </div>
                                            
                                            {/* Audit Trail for Follow-ups */}
                                            {isFollowUp && event.followUpId && auditLogs[event.followUpId] && auditLogs[event.followUpId].length > 0 && (
                                              <Collapsible className="mt-2">
                                                <CollapsibleTrigger asChild>
                                                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground">
                                                    <History className="h-3 w-3 mr-2" />
                                                    View Edit History ({auditLogs[event.followUpId].length})
                                                  </Button>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="mt-2 space-y-2">
                                                  {auditLogs[event.followUpId].map((audit) => (
                                                    <div key={audit.id} className="pl-4 border-l-2 border-muted py-2 text-xs">
                                                      <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Badge variant="outline" className="text-xs">
                                                          {audit.action}
                                                        </Badge>
                                                        <Clock className="h-3 w-3" />
                                                        <span>{format(new Date(audit.changed_at), 'MMM dd, yyyy HH:mm')}</span>
                                                      </div>
                                                      {audit.action === 'updated' && audit.old_values && audit.new_values && (
                                                        <div className="mt-1 space-y-1 text-muted-foreground">
                                                          {audit.old_values.action !== audit.new_values.action && (
                                                            <div>
                                                              <span className="font-medium">Action: </span>
                                                              <span className="line-through">{audit.old_values.action}</span>
                                                              {' → '}
                                                              <span>{audit.new_values.action}</span>
                                                            </div>
                                                          )}
                                                          {audit.old_values.status_after !== audit.new_values.status_after && (
                                                            <div>
                                                              <span className="font-medium">Status: </span>
                                                              <span className="line-through">{audit.old_values.status_after}</span>
                                                              {' → '}
                                                              <span>{audit.new_values.status_after}</span>
                                                            </div>
                                                          )}
                                                        </div>
                                                      )}
                                                      {audit.action === 'deleted' && audit.old_values && (
                                                        <div className="mt-1 text-destructive">
                                                          Deleted: {audit.old_values.action}
                                                        </div>
                                                      )}
                                                    </div>
                                                  ))}
                                                </CollapsibleContent>
                                              </Collapsible>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </ScrollArea>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Follow-up</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this follow-up entry? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteFollowUp}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};

export default StageDrillDownDialog;

import { useState } from 'react';
import { format, formatDistanceToNow, startOfDay, startOfWeek, startOfMonth, isAfter, isBefore, isEqual } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import { 
  MessageSquare, Phone, Mail, Users, CalendarCheck, 
  TrendingUp, TrendingDown, CheckCircle2, XCircle, 
  Clock, ArrowRight, Star, FileText, RefreshCw, ChevronDown, ChevronUp,
  Pencil, Trash2, CalendarIcon, User, Briefcase
} from 'lucide-react';

type ActivityFilter = 'all' | 'follow_ups' | 'opportunities';
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom';

import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { logAudit } from '@/lib/auditLogger';

export interface ActivityEvent {
  id: string;
  type: 'communication' | 'follow_up' | 'status_change' | 'deal_closed' | 'interest_change' | 'stage_change';
  date: string;
  title: string;
  description?: string;
  channel?: string;
  status?: string;
  interestLevel?: string;
  metadata?: Record<string, any>;
  notes?: string;
  assignedTo?: string;
  projectName?: string;
  opportunityName?: string;
  // For follow-up events - the actual follow-up ID for edit/delete
  followUpId?: string;
  communicationLogId?: string;
  // For initial conversation events
  isInitialConversation?: boolean;
  // Additional follow-up fields
  clientResponse?: string;
  action?: string;
  outcome?: string;
}

interface ClientActivityFeedProps {
  events: ActivityEvent[];
  loading?: boolean;
  onEditFollowUp?: (followUpId: string, communicationLogId: string) => void;
  onEditInitialConversation?: (communicationLogId: string) => void;
  onRefresh?: () => void;
}

const getEventIcon = (type: string, channel?: string) => {
  switch (type) {
    case 'communication':
      if (channel?.toLowerCase().includes('phone')) return Phone;
      if (channel?.toLowerCase().includes('email')) return Mail;
      if (channel?.toLowerCase().includes('meeting') || channel?.toLowerCase().includes('person')) return Users;
      return MessageSquare;
    case 'follow_up':
      return CalendarCheck;
    case 'status_change':
      return ArrowRight;
    case 'stage_change':
      return RefreshCw;
    case 'deal_closed':
      return CheckCircle2;
    case 'interest_change':
      return Star;
    default:
      return Clock;
  }
};

const getEventColor = (type: string, status?: string) => {
  switch (type) {
    case 'communication':
      return 'bg-blue-500';
    case 'follow_up':
      if (status === 'Done' || status === 'Completed') return 'bg-green-500';
      if (status === 'Cancelled') return 'bg-red-500';
      return 'bg-amber-500';
    case 'status_change':
      return 'bg-purple-500';
    case 'stage_change':
      return 'bg-indigo-500';
    case 'deal_closed':
      return 'bg-green-600';
    case 'interest_change':
      return 'bg-primary';
    default:
      return 'bg-muted-foreground';
  }
};

const getInterestBadge = (level?: string) => {
  switch (level) {
    case 'High':
      return <Badge className="bg-green-500/15 text-green-600 border-green-500/25 text-xs">High</Badge>;
    case 'Medium':
      return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/25 text-xs">Medium</Badge>;
    case 'Low':
      return <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/25 text-xs">Low</Badge>;
    case 'Not interested':
      return <Badge className="bg-red-500/15 text-red-600 border-red-500/25 text-xs">Not interested</Badge>;
    default:
      return null;
  }
};

const getStatusBadge = (status?: string) => {
  switch (status) {
    case 'Open':
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs">Open</Badge>;
    case 'Closed':
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">Closed</Badge>;
    case 'In Follow-up':
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">In Follow-up</Badge>;
    case 'Done':
    case 'Completed':
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">Done</Badge>;
    case 'Cancelled':
      return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 text-xs">Cancelled</Badge>;
    default:
      return null;
  }
};

// Individual expandable event item
function ActivityEventItem({ 
  event, 
  onEditFollowUp, 
  onDeleteFollowUp,
  onEditInitialConversation,
  onDeleteInitialConversation,
  onViewFollowUp
}: { 
  event: ActivityEvent; 
  onEditFollowUp?: (followUpId: string, communicationLogId: string) => void;
  onDeleteFollowUp?: (followUpId: string, communicationLogId: string) => void;
  onEditInitialConversation?: (communicationLogId: string) => void;
  onDeleteInitialConversation?: (communicationLogId: string) => void;
  onViewFollowUp?: (event: ActivityEvent) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = getEventIcon(event.type, event.channel);
  const dotColor = getEventColor(event.type, event.status);
  
  const isFollowUp = event.type === 'follow_up' && event.followUpId && event.communicationLogId;
  const isInitialConversation = event.type === 'communication' && event.isInitialConversation && event.communicationLogId;
  const hasDetails = event.notes || event.assignedTo || event.projectName || event.opportunityName || 
    (event.metadata && Object.keys(event.metadata).length > 0);

  const handleCardClick = () => {
    if (isFollowUp && onViewFollowUp) {
      onViewFollowUp(event);
    } else if (hasDetails) {
      setIsOpen(!isOpen);
    }
  };
  
  return (
    <div className="relative group">
      {/* Event dot */}
      <div className={cn(
        "absolute -left-8 top-2 h-3 w-3 rounded-full ring-4 ring-background z-10 transition-transform group-hover:scale-125",
        dotColor
      )} />
      
      {/* Event card */}
      <Collapsible open={isOpen} onOpenChange={isFollowUp ? undefined : setIsOpen}>
        <Card className={cn(
          "transition-colors cursor-pointer hover:bg-muted/30"
        )} onClick={handleCardClick}>
          <CollapsibleTrigger asChild disabled={!!(isFollowUp || !hasDetails)}>
            <div className="p-3">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                  event.type === 'communication' && "bg-blue-500/10 text-blue-600",
                  event.type === 'follow_up' && "bg-amber-500/10 text-amber-600",
                  event.type === 'status_change' && "bg-purple-500/10 text-purple-600",
                  event.type === 'stage_change' && "bg-indigo-500/10 text-indigo-600",
                  event.type === 'deal_closed' && "bg-green-500/10 text-green-600",
                  event.type === 'interest_change' && "bg-primary/10 text-primary"
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{event.title}</p>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(event.date), 'h:mm a')}
                      </span>
                      {/* Edit/Delete buttons for follow-ups */}
                      {isFollowUp && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditFollowUp?.(event.followUpId!, event.communicationLogId!);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteFollowUp?.(event.followUpId!, event.communicationLogId!);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {/* Edit/Delete buttons for initial conversations */}
                      {isInitialConversation && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditInitialConversation?.(event.communicationLogId!);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteInitialConversation?.(event.communicationLogId!);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {hasDetails && (
                        isOpen ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )
                      )}
                    </div>
                  </div>
                  
                  {/* Tags */}
                  <div className="flex items-center flex-wrap gap-1.5 mt-2">
                    {event.channel && (
                      <Badge variant="outline" className="text-xs font-normal">
                        {event.channel}
                      </Badge>
                    )}
                    {getStatusBadge(event.status)}
                    {getInterestBadge(event.interestLevel)}
                    {event.type === 'deal_closed' && event.metadata?.value && (
                      <Badge className="bg-green-500/15 text-green-600 border-green-500/25 text-xs">
                        SAR {event.metadata.value.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="px-3 pb-3 pt-0">
              <div className="border-t border-border pt-3 space-y-2">
                {event.projectName && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Project:</span>
                    <span className="font-medium">{event.projectName}</span>
                  </div>
                )}
                {event.opportunityName && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Opportunity:</span>
                    <span className="font-medium">{event.opportunityName}</span>
                  </div>
                )}
                {event.assignedTo && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Assigned to:</span>
                    <span className="font-medium">{event.assignedTo}</span>
                  </div>
                )}
                {event.notes && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Notes: </span>
                    <span>{event.notes}</span>
                  </div>
                )}
                {event.metadata && Object.entries(event.metadata).filter(([key]) => key !== 'value').map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                    <span className="font-medium">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

export default function ClientActivityFeed({ events, loading, onEditFollowUp, onEditInitialConversation, onRefresh }: ClientActivityFeedProps) {
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customDateRange, setCustomDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingFollowUp, setDeletingFollowUp] = useState<{ id: string; communicationLogId: string } | null>(null);
  const [deletingConversation, setDeletingConversation] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<ActivityEvent | null>(null);

  const handleViewFollowUp = (event: ActivityEvent) => {
    setPreviewEvent(event);
  };

  // Get date range based on filter
  const getDateRange = (): { start: Date | null; end: Date | null } => {
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        return { start: startOfDay(now), end: now };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 0 }), end: now };
      case 'month':
        return { start: startOfMonth(now), end: now };
      case 'custom':
        return { 
          start: customDateRange.from || null, 
          end: customDateRange.to || null 
        };
      default:
        return { start: null, end: null };
    }
  };

  // Filter events based on selected filters
  const filteredEvents = events.filter(event => {
    // Activity type filter
    let passesTypeFilter = true;
    switch (activityFilter) {
      case 'follow_ups':
        passesTypeFilter = event.type === 'follow_up' || event.type === 'communication';
        break;
      case 'opportunities':
        passesTypeFilter = event.type === 'interest_change' || event.metadata?.stage;
        break;
    }
    if (!passesTypeFilter) return false;

    // Date filter
    const { start, end } = getDateRange();
    if (start || end) {
      const eventDate = startOfDay(new Date(event.date));
      if (start && isBefore(eventDate, startOfDay(start))) return false;
      if (end && isAfter(eventDate, startOfDay(end))) return false;
    }

    return true;
  });

  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case 'today': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'custom': 
        if (customDateRange.from && customDateRange.to) {
          return `${format(customDateRange.from, 'MMM d')} - ${format(customDateRange.to, 'MMM d')}`;
        }
        return 'Custom Range';
      default: return 'All Time';
    }
  };

  const handleDeleteFollowUp = (followUpId: string, communicationLogId: string) => {
    setDeletingFollowUp({ id: followUpId, communicationLogId });
    setDeletingConversation(null);
    setDeleteDialogOpen(true);
  };

  const handleDeleteInitialConversation = (communicationLogId: string) => {
    setDeletingConversation(communicationLogId);
    setDeletingFollowUp(null);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingFollowUp && !deletingConversation) return;

    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (deletingFollowUp) {
        // Delete follow-up
        const { data: followUpData } = await supabase
          .from('follow_up_history')
          .select('*')
          .eq('id', deletingFollowUp.id)
          .single();

        if (user && followUpData) {
          await supabase.from('follow_up_audit_log').insert({
            follow_up_id: deletingFollowUp.id,
            communication_log_id: deletingFollowUp.communicationLogId,
            changed_by: user.id,
            action: 'deleted',
            old_values: followUpData,
            new_values: null,
          });

          await logAudit({
            action: 'deleted',
            module: 'Follow-ups',
            recordId: deletingFollowUp.id,
            recordName: followUpData.action || 'Follow-up',
            oldValues: followUpData,
          });
        }

        const { error } = await supabase
          .from('follow_up_history')
          .delete()
          .eq('id', deletingFollowUp.id);

        if (error) throw error;
        toast.success('Follow-up deleted successfully');
      } else if (deletingConversation) {
        // Delete initial conversation (communication_log entry)
        const { data: commData } = await supabase
          .from('communication_log')
          .select('*')
          .eq('id', deletingConversation)
          .single();

        if (user && commData) {
          await logAudit({
            action: 'deleted',
            module: 'Initial Conversations',
            recordId: deletingConversation,
            recordName: commData.summary || 'Initial Conversation',
            oldValues: commData,
          });
        }

        // Delete related follow-ups first
        await supabase
          .from('follow_up_history')
          .delete()
          .eq('communication_log_id', deletingConversation);

        // Delete related activities
        await supabase
          .from('activities')
          .delete()
          .eq('legacy_communication_id', deletingConversation);

        // Delete the communication log entry
        const { error } = await supabase
          .from('communication_log')
          .delete()
          .eq('id', deletingConversation);

        if (error) throw error;
        toast.success('Initial conversation deleted successfully');
      }

      onRefresh?.();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingFollowUp(null);
      setDeletingConversation(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Clock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="font-medium mb-1">No activity yet</h3>
        <p className="text-sm text-muted-foreground">All interactions and updates will appear here.</p>
      </div>
    );
  }

  // Group events by date
  const groupedEvents: Record<string, ActivityEvent[]> = {};
  filteredEvents.forEach(event => {
    const dateKey = format(new Date(event.date), 'yyyy-MM-dd');
    if (!groupedEvents[dateKey]) {
      groupedEvents[dateKey] = [];
    }
    groupedEvents[dateKey].push(event);
  });

  const sortedDates = Object.keys(groupedEvents).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <>
      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Activity Type Tabs */}
        <Tabs value={activityFilter} onValueChange={(v) => setActivityFilter(v as ActivityFilter)}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
            <TabsTrigger value="follow_ups" className="text-xs px-3">Follow-ups</TabsTrigger>
            <TabsTrigger value="opportunities" className="text-xs px-3">Opportunities</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Date Filter */}
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span className="text-xs">{getDateFilterLabel()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-2 space-y-1 border-b">
              <Button
                variant={dateFilter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => { setDateFilter('all'); setDatePopoverOpen(false); }}
              >
                All Time
              </Button>
              <Button
                variant={dateFilter === 'today' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => { setDateFilter('today'); setDatePopoverOpen(false); }}
              >
                Today
              </Button>
              <Button
                variant={dateFilter === 'week' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => { setDateFilter('week'); setDatePopoverOpen(false); }}
              >
                This Week
              </Button>
              <Button
                variant={dateFilter === 'month' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => { setDateFilter('month'); setDatePopoverOpen(false); }}
              >
                This Month
              </Button>
              <Button
                variant={dateFilter === 'custom' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => setDateFilter('custom')}
              >
                Custom Range
              </Button>
            </div>
            {dateFilter === 'custom' && (
              <div className="p-2">
                <Calendar
                  mode="range"
                  selected={{ from: customDateRange.from, to: customDateRange.to }}
                  onSelect={(range) => {
                    setCustomDateRange({ from: range?.from, to: range?.to });
                    if (range?.from && range?.to) {
                      setDatePopoverOpen(false);
                    }
                  }}
                  numberOfMonths={1}
                  className="pointer-events-auto"
                />
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
        
        <div className="space-y-6">
          {sortedDates.map((dateKey) => (
            <div key={dateKey} className="space-y-4">
              {/* Date header */}
              <div className="flex items-center gap-3 relative">
                <div className="h-10 w-10 rounded-full bg-background border-2 border-border flex items-center justify-center z-10 shrink-0">
                  <span className="text-xs font-medium text-muted-foreground">
                    {format(new Date(dateKey), 'dd')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {format(new Date(dateKey), 'EEEE, MMM d, yyyy')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({formatDistanceToNow(new Date(dateKey), { addSuffix: true })})
                  </span>
                </div>
              </div>

              {/* Events for this date */}
              <div className="ml-5 pl-8 space-y-3">
                {groupedEvents[dateKey].map((event) => (
                  <ActivityEventItem 
                    key={event.id} 
                    event={event} 
                    onEditFollowUp={onEditFollowUp}
                    onDeleteFollowUp={handleDeleteFollowUp}
                    onEditInitialConversation={onEditInitialConversation}
                    onDeleteInitialConversation={handleDeleteInitialConversation}
                    onViewFollowUp={handleViewFollowUp}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Follow-up Preview Dialog */}
      <Dialog open={!!previewEvent} onOpenChange={(open) => !open && setPreviewEvent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-amber-500" />
              Follow-up Details
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {previewEvent && (
              <div className="space-y-4 py-2">
                {/* Action/Title */}
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Action</label>
                  <p className="font-medium">{previewEvent.title || previewEvent.action || 'Follow-up'}</p>
                </div>

                {/* Date */}
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Date</label>
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {format(new Date(previewEvent.date), 'EEEE, MMM d, yyyy • h:mm a')}
                  </p>
                </div>

                {/* Status */}
                {previewEvent.status && (
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">Status</label>
                    <div className="mt-1">{getStatusBadge(previewEvent.status)}</div>
                  </div>
                )}

                {/* Channel */}
                {previewEvent.channel && (
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">Channel</label>
                    <p>{previewEvent.channel}</p>
                  </div>
                )}

                {/* Opportunity */}
                {previewEvent.opportunityName && (
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">Opportunity</label>
                    <p className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      {previewEvent.opportunityName}
                    </p>
                  </div>
                )}

                {/* Project */}
                {previewEvent.projectName && (
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">Project</label>
                    <p>{previewEvent.projectName}</p>
                  </div>
                )}

                {/* Assigned To */}
                {previewEvent.assignedTo && (
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">Assigned To</label>
                    <p className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {previewEvent.assignedTo}
                    </p>
                  </div>
                )}

                {/* Notes */}
                {previewEvent.notes && (
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">Notes</label>
                    <p className="text-sm bg-muted/50 rounded p-2 mt-1 whitespace-pre-wrap">{previewEvent.notes}</p>
                  </div>
                )}

                {/* Client Response */}
                {previewEvent.clientResponse && (
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Client Response
                    </label>
                    <p className="text-sm bg-primary/5 border border-primary/20 rounded p-2 mt-1 whitespace-pre-wrap">
                      {previewEvent.clientResponse}
                    </p>
                  </div>
                )}

                {/* Outcome */}
                {previewEvent.outcome && (
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">Outcome</label>
                    <p className="text-sm">{previewEvent.outcome}</p>
                  </div>
                )}
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletingConversation ? 'Delete Initial Conversation' : 'Delete Follow-up'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingConversation 
                ? 'Are you sure you want to delete this initial conversation? This will also delete all related follow-ups. This action cannot be undone.'
                : 'Are you sure you want to delete this follow-up? This action cannot be undone.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

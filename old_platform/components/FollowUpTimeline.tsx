import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { format, isBefore, startOfDay, isAfter, isSameDay } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Clock, User, FileText, AlertCircle, Loader2, Bell, Paperclip, AlertTriangle, Zap, ChevronDown, CheckCircle2, XCircle, MinusCircle, PhoneOff, CalendarX } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { COMMUNICATION_CHANNELS, getChannelInfo } from '@/constants/communicationChannels';
import { logAudit } from '@/lib/auditLogger';

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
  priority?: string | null;
  follow_up_type?: string | null;
  outcome?: string | null;
  reminder_enabled?: boolean;
  attachments?: string[];
  follow_up_channel?: string | null;
  client_response?: string | null;
}

interface FollowUpTimelineProps {
  followUps: FollowUpEntry[];
  onEdit: (followUp: FollowUpEntry) => void;
  onRefresh: () => void;
  loading?: boolean;
  autoFocusActive?: boolean;
  showInitialHighlight?: boolean;
}

export interface FollowUpTimelineRef {
  scrollToActive: () => void;
}

const FOLLOW_UP_TYPE_LABELS: Record<string, string> = {
  send_quotation: 'Send Quotation',
  update_prices: 'Update Prices',
  visit_site: 'Visit Site',
  collect_boq: 'Collect BOQ',
  follow_up_after_offer: 'Follow-up After Offer',
  closing_attempt: 'Closing Attempt',
  general: 'General',
  other: 'Other',
};

const OUTCOME_LABELS: Record<string, string> = {
  // Original values
  reached_positive: 'Reached – Positive',
  reached_neutral: 'Reached – Neutral',
  reached_negative: 'Reached – Negative',
  not_reached: 'Not Reached',
  postponed: 'Postponed',
  // New values from Complete Follow-up modal
  'Answered': 'Answered',
  'Interested': 'Interested',
  'Not Interested': 'Not Interested',
  'Requested Quotation': 'Requested Quotation',
  'No Answer': 'No Answer',
  'Call Back Later': 'Call Back Later',
  'Wrong Number': 'Wrong Number',
  'Other': 'Other',
};

const FollowUpTimeline = forwardRef<FollowUpTimelineRef, FollowUpTimelineProps>(
  ({ followUps, onEdit, onRefresh, loading = false, autoFocusActive = false, showInitialHighlight = false }, ref) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingOutcome, setUpdatingOutcome] = useState<string | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const activeFollowUpRef = useRef<HTMLDivElement>(null);

  const OUTCOME_OPTIONS = [
    // Original options
    { value: 'reached_positive', label: 'Reached – Positive', icon: CheckCircle2, color: 'text-green-600' },
    { value: 'reached_neutral', label: 'Reached – Neutral', icon: MinusCircle, color: 'text-amber-600' },
    { value: 'reached_negative', label: 'Reached – Negative', icon: XCircle, color: 'text-red-600' },
    { value: 'not_reached', label: 'Not Reached', icon: PhoneOff, color: 'text-gray-500' },
    { value: 'postponed', label: 'Postponed', icon: CalendarX, color: 'text-blue-600' },
    // New options from Complete Follow-up modal
    { value: 'Answered', label: 'Answered', icon: CheckCircle2, color: 'text-green-600' },
    { value: 'Interested', label: 'Interested', icon: CheckCircle2, color: 'text-green-600' },
    { value: 'Not Interested', label: 'Not Interested', icon: XCircle, color: 'text-red-600' },
    { value: 'Requested Quotation', label: 'Requested Quotation', icon: CheckCircle2, color: 'text-blue-600' },
    { value: 'No Answer', label: 'No Answer', icon: PhoneOff, color: 'text-gray-500' },
    { value: 'Call Back Later', label: 'Call Back Later', icon: CalendarX, color: 'text-amber-600' },
    { value: 'Wrong Number', label: 'Wrong Number', icon: XCircle, color: 'text-red-600' },
    { value: 'Other', label: 'Other', icon: MinusCircle, color: 'text-gray-500' },
  ];

  const handleQuickOutcomeUpdate = async (followUp: FollowUpEntry, newOutcome: string) => {
    setUpdatingOutcome(followUp.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const oldValues = { outcome: followUp.outcome };
      const newValues = { outcome: newOutcome };
      
      const { error } = await supabase
        .from('follow_up_history')
        .update({ outcome: newOutcome })
        .eq('id', followUp.id);

      if (error) throw error;

      if (user) {
        await supabase.from('follow_up_audit_log').insert({
          follow_up_id: followUp.id,
          communication_log_id: followUp.communication_log_id,
          changed_by: user.id,
          action: 'updated',
          old_values: oldValues,
          new_values: newValues,
        });

        await logAudit({
          action: 'updated',
          module: 'Follow-ups',
          recordId: followUp.id,
          recordName: followUp.action || 'Follow-up',
          oldValues,
          newValues,
        });
      }

      toast.success('Outcome updated');
      onRefresh();
    } catch (error) {
      console.error('Error updating outcome:', error);
      toast.error('Failed to update outcome');
    } finally {
      setUpdatingOutcome(null);
    }
  };

  // Helper to determine follow-up state
  const getFollowUpState = (status: string | null, followUpDate: string) => {
    const today = startOfDay(new Date());
    const date = new Date(followUpDate);
    const isDone = status === 'Done' || status === 'Closed' || status === 'Cancelled';
    const isPast = isBefore(date, today);
    const isFutureOrToday = isAfter(date, today) || isSameDay(date, today);
    
    if (isDone) return 'done';
    if (isPast && !isDone) return 'overdue';
    if (isFutureOrToday && !isDone) return 'active';
    return 'open';
  };

  // Sort by follow_up_date descending (newest first)
  const sortedFollowUps = [...followUps].sort(
    (a, b) => new Date(b.follow_up_date).getTime() - new Date(a.follow_up_date).getTime()
  );

  // Find nearest active follow-up index for auto-focus
  // Priority: 1) Active with nearest upcoming date, 2) Latest open follow-up
  const findNearestActiveIndex = () => {
    const today = new Date();
    let nearestActiveIndex = -1;
    let nearestActiveDiff = Infinity;
    let latestOpenIndex = -1;
    let latestOpenDate = -Infinity;
    
    sortedFollowUps.forEach((fu, index) => {
      const state = getFollowUpState(fu.status_after, fu.follow_up_date);
      const fuDate = new Date(fu.follow_up_date);
      
      // For active (future or today) follow-ups, find nearest upcoming
      if (state === 'active') {
        const diff = fuDate.getTime() - today.getTime();
        if (diff >= 0 && diff < nearestActiveDiff) {
          nearestActiveDiff = diff;
          nearestActiveIndex = index;
        }
      }
      
      // Track latest open (including overdue) as fallback
      if (state === 'active' || state === 'overdue' || state === 'open') {
        const dateTime = fuDate.getTime();
        if (dateTime > latestOpenDate) {
          latestOpenDate = dateTime;
          latestOpenIndex = index;
        }
      }
    });
    
    // Return active if found, otherwise latest open
    return nearestActiveIndex !== -1 ? nearestActiveIndex : latestOpenIndex;
  };

  useImperativeHandle(ref, () => ({
    scrollToActive: () => {
      if (activeFollowUpRef.current) {
        activeFollowUpRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }));

  // One-time auto-scroll on first open only
  useEffect(() => {
    if (autoFocusActive && !hasScrolled && activeFollowUpRef.current) {
      const timer = setTimeout(() => {
        activeFollowUpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHasScrolled(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoFocusActive, hasScrolled]);

  // Reset hasScrolled when autoFocusActive becomes false (modal closes)
  useEffect(() => {
    if (!autoFocusActive) {
      setHasScrolled(false);
    }
  }, [autoFocusActive]);

  if (loading) {
    return (
      <div className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading follow-ups...
      </div>
    );
  }

  const getStatusBadgeStyle = (state: string) => {
    switch (state) {
      case 'active':
        return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700';
      case 'overdue':
        return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700';
      case 'done':
        return 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getDotStyle = (state: string) => {
    switch (state) {
      case 'active':
        return 'bg-orange-500 border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.5)]';
      case 'overdue':
        return 'bg-red-500 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
      case 'done':
        return 'bg-gray-300 border-gray-200 dark:bg-gray-600 dark:border-gray-500';
      default:
        return 'bg-gray-400 border-gray-300';
    }
  };

  const getCardStyle = (state: string) => {
    switch (state) {
      case 'active':
        return 'bg-orange-50/70 dark:bg-orange-900/10 border-orange-200/60 dark:border-orange-800/40';
      case 'overdue':
        return 'bg-red-50/50 dark:bg-red-900/10 border-red-200/60 dark:border-red-800/40';
      case 'done':
        return 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-200/40 dark:border-gray-700/40 opacity-75';
      default:
        return 'bg-white/70 dark:bg-card/70 border-white/40 dark:border-white/10';
    }
  };

  const getDisplayStatus = (status: string | null, state: string) => {
    if (state === 'overdue') return 'Overdue';
    return status || 'Open';
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Medium':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Low':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      default:
        return '';
    }
  };

  const getOutcomeColor = (outcome: string | null) => {
    switch (outcome) {
      // Original values
      case 'reached_positive':
      case 'Answered':
      case 'Interested':
      case 'Requested Quotation':
        return 'text-green-600';
      case 'reached_neutral':
      case 'Call Back Later':
        return 'text-amber-600';
      case 'reached_negative':
      case 'Not Interested':
      case 'Wrong Number':
        return 'text-red-600';
      case 'not_reached':
      case 'No Answer':
      case 'Other':
        return 'text-gray-500';
      case 'postponed':
        return 'text-blue-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const handleDeleteClick = (followUp: FollowUpEntry) => {
    setSelectedFollowUp(followUp);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedFollowUp) return;

    try {
      setDeleting(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const oldValues = {
        follow_up_date: selectedFollowUp.follow_up_date,
        status_after: selectedFollowUp.status_after,
        action: selectedFollowUp.action,
        notes: selectedFollowUp.notes,
        priority: selectedFollowUp.priority,
        follow_up_type: selectedFollowUp.follow_up_type,
        outcome: selectedFollowUp.outcome,
        follow_up_channel: selectedFollowUp.follow_up_channel,
      };
      
      if (user) {
        await supabase.from('follow_up_audit_log').insert({
          follow_up_id: selectedFollowUp.id,
          communication_log_id: selectedFollowUp.communication_log_id,
          changed_by: user.id,
          action: 'deleted',
          old_values: oldValues,
          new_values: null,
        });

        await logAudit({
          action: 'deleted',
          module: 'Follow-ups',
          recordId: selectedFollowUp.id,
          recordName: selectedFollowUp.action || 'Follow-up',
          oldValues,
        });
      }

      const { error } = await supabase
        .from('follow_up_history')
        .delete()
        .eq('id', selectedFollowUp.id);

      if (error) throw error;

      toast.success('Follow-up deleted successfully');
      onRefresh();
    } catch (error) {
      console.error('Error deleting follow-up:', error);
      toast.error('Failed to delete follow-up');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setSelectedFollowUp(null);
    }
  };

  const nearestActiveIndex = findNearestActiveIndex();

  if (sortedFollowUps.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No follow-ups recorded yet
      </div>
    );
  }

  return (
    <>
      <div className="relative pl-6 py-2">
        {/* Continuous timeline line - centered with dots */}
        <div 
          className={cn(
            "absolute left-[7px] top-4 bottom-4 w-[2px] bg-gray-200/80 dark:bg-gray-700/60",
            showInitialHighlight && "animate-timeline-draw"
          )}
        />

        <div className="space-y-4">
          {sortedFollowUps.map((followUp, index) => {
            const state = getFollowUpState(followUp.status_after, followUp.follow_up_date);
            const displayStatus = getDisplayStatus(followUp.status_after, state);
            const isActive = state === 'active';
            const isOverdue = state === 'overdue';
            const isDone = state === 'done';
            const isNearestActive = index === nearestActiveIndex;
            const shouldHighlight = isNearestActive && showInitialHighlight;
            
            return (
              <div 
                key={followUp.id} 
                ref={isNearestActive ? activeFollowUpRef : null}
                className={cn(
                  "relative",
                  showInitialHighlight && "opacity-0 animate-timeline-slide-up"
                )}
                style={{ 
                  animationDelay: showInitialHighlight ? `${80 + index * 60}ms` : undefined,
                  animationFillMode: 'forwards'
                }}
              >
                {/* Dashed line overlay for done items */}
                {isDone && (
                  <div 
                    className="absolute left-[7px] top-0 bottom-0 w-[2px] border-l-2 border-dashed border-gray-300 dark:border-gray-600"
                    style={{ marginLeft: '-1px' }}
                  />
                )}
                
                {/* Timeline dot - centered on line */}
                <div 
                  className={cn(
                    "absolute left-0 top-4 w-4 h-4 rounded-full border-2 transition-all z-10",
                    getDotStyle(state),
                    isActive && !isDone && "animate-dot-pulse",
                    shouldHighlight && "ring-4 ring-orange-300/50 dark:ring-orange-700/40"
                  )}
                />

                {/* Timeline card */}
                <div className={cn(
                  "ml-6 rounded-xl backdrop-blur-sm border shadow-sm transition-all duration-200 hover:shadow-md",
                  getCardStyle(state),
                  followUp.priority === 'High' && 'border-l-4 border-l-red-400',
                  shouldHighlight && 'ring-2 ring-orange-400/30 dark:ring-orange-600/30'
                )}>
                  {/* Card Header: Date + Status + Actions */}
                  <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/30">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(followUp.follow_up_date), 'MMM dd, yyyy')}
                      </div>
                      <Badge className={cn("text-xs", getStatusBadgeStyle(state))} variant="outline">
                        {displayStatus}
                      </Badge>
                      {isActive && (
                        <Badge className="bg-orange-500 text-white border-orange-500 text-[10px] px-1.5 py-0 h-5">
                          <Zap className="h-3 w-3 mr-0.5" />
                          ACTIVE
                        </Badge>
                      )}
                      {isOverdue && (
                        <Badge className="bg-red-500 text-white border-red-500 text-[10px] px-1.5 py-0 h-5">
                          <AlertTriangle className="h-3 w-3 mr-0.5" />
                          OVERDUE
                        </Badge>
                      )}
                      {followUp.priority && followUp.priority !== 'Medium' && (
                        <Badge className={cn("text-[10px]", getPriorityColor(followUp.priority))} variant="outline">
                          {followUp.priority === 'High' && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                          {followUp.priority}
                        </Badge>
                      )}
                      {followUp.reminder_enabled && (
                        <span title="Reminder enabled"><Bell className="h-3.5 w-3.5 text-primary" /></span>
                      )}
                    </div>
                    
                    {/* Edit/Delete buttons */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(followUp)}
                        title="Edit follow-up"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(followUp)}
                        title="Delete follow-up"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="px-4 py-3 space-y-2.5">
                    {/* Meta row: Type + Channel */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {followUp.follow_up_type && (
                        <span>Type: {FOLLOW_UP_TYPE_LABELS[followUp.follow_up_type] || followUp.follow_up_type}</span>
                      )}
                      {followUp.follow_up_channel && (() => {
                        const channelInfo = getChannelInfo(followUp.follow_up_channel);
                        if (!channelInfo) return null;
                        const Icon = channelInfo.icon;
                        return (
                          <span className="flex items-center gap-1">
                            <Icon className="h-3 w-3" />
                            via {channelInfo.label}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Main action/message emphasized */}
                    {followUp.action && (
                      <div className={cn(
                        "flex items-start gap-2 p-2.5 rounded-lg",
                        isActive ? "bg-orange-100/50 dark:bg-orange-900/20" : "bg-muted/50"
                      )}>
                        <AlertCircle className={cn(
                          "h-4 w-4 mt-0.5 shrink-0",
                          isActive ? "text-orange-600" : "text-amber-500"
                        )} />
                        <span className={cn(
                          "text-sm font-medium",
                          isDone && "line-through opacity-60"
                        )}>
                          {followUp.action}
                        </span>
                      </div>
                    )}

                    {/* Notes */}
                    {followUp.notes && (
                      <div className="flex items-start gap-2 text-sm">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span className={cn("text-muted-foreground", isDone && "opacity-60")}>
                          {followUp.notes}
                        </span>
                      </div>
                    )}

                    {/* Client Response */}
                    {followUp.client_response && (
                      <div className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded-md">
                        <span className="text-xs font-medium text-muted-foreground shrink-0">Client Response:</span>
                        <span className="text-foreground">{followUp.client_response}</span>
                      </div>
                    )}

                    {/* Outcome with Quick Update */}
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-7 px-2.5 text-xs gap-1.5 font-medium",
                              followUp.outcome ? getOutcomeColor(followUp.outcome) : "text-muted-foreground",
                              updatingOutcome === followUp.id && "opacity-50 pointer-events-none"
                            )}
                            disabled={updatingOutcome === followUp.id}
                          >
                            {updatingOutcome === followUp.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : followUp.outcome ? (
                              <>
                                {(() => {
                                  const outcomeOption = OUTCOME_OPTIONS.find(o => o.value === followUp.outcome);
                                  if (outcomeOption) {
                                    const Icon = outcomeOption.icon;
                                    return <Icon className="h-3 w-3" />;
                                  }
                                  return null;
                                })()}
                                {OUTCOME_LABELS[followUp.outcome] || followUp.outcome}
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                Set Outcome
                              </>
                            )}
                            <ChevronDown className="h-3 w-3 ml-0.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          <DropdownMenuLabel className="text-xs">Quick Update Outcome</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {OUTCOME_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            const isSelected = followUp.outcome === option.value;
                            return (
                              <DropdownMenuItem
                                key={option.value}
                                onClick={() => handleQuickOutcomeUpdate(followUp, option.value)}
                                className={cn(
                                  "flex items-center gap-2 cursor-pointer",
                                  isSelected && "bg-muted"
                                )}
                              >
                                <Icon className={cn("h-4 w-4", option.color)} />
                                <span className={cn("text-sm", isSelected && "font-medium")}>
                                  {option.label}
                                </span>
                                {isSelected && <CheckCircle2 className="h-3 w-3 ml-auto text-primary" />}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Attachments */}
                    {followUp.attachments && followUp.attachments.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Paperclip className="h-3 w-3" />
                        {followUp.attachments.length} attachment{followUp.attachments.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Created by + timestamp */}
                  <div className="px-4 py-2 border-t border-border/20 bg-muted/20">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>
                        {followUp.creator_name ? `By ${followUp.creator_name}` : 'Created'} • {format(new Date(followUp.created_at), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Follow-up</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this follow-up? This action cannot be undone.
              This will only delete the follow-up record, not the main communication.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

FollowUpTimeline.displayName = 'FollowUpTimeline';

export default FollowUpTimeline;
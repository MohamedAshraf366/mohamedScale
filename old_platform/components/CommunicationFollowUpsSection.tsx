import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarIcon, Plus, Bell, CheckCircle2, Trash2, Edit2, X, CalendarPlus, MessageSquare, Lightbulb, Clock } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { COMMUNICATION_CHANNELS } from '@/constants/communicationChannels';
import FollowUpTimeline from '@/components/FollowUpTimeline';
import { toast } from '@/hooks/use-toast';

import { isBefore, startOfDay } from 'date-fns';

export interface PendingFollowUp {
  id: string;
  action: string;
  notes: string;
  clientResponse: string;
  followUpDate: Date;
  statusAfter: 'Open' | 'Done' | 'Cancelled';
  priority: 'High' | 'Medium' | 'Low';
  followUpType: string;
  reminderEnabled: boolean;
  followUpChannel: string;
}

export interface ExistingFollowUp {
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

interface SuggestedFollowUp {
  id: string;
  title: string;
  action: string;
  notes: string;
  daysFromNow: number;
  priority: 'High' | 'Medium' | 'Low';
}

interface CommunicationFollowUpsSectionProps {
  interestLevel: string;
  objectionType: string;
  pendingFollowUps: PendingFollowUp[];
  onAddFollowUp: (followUp: PendingFollowUp) => void;
  onUpdateFollowUp: (id: string, followUp: PendingFollowUp) => void;
  onRemoveFollowUp: (id: string) => void;
  // Optional props for existing communications
  existingFollowUps?: ExistingFollowUp[];
  loadingFollowUps?: boolean;
  onEditExistingFollowUp?: (followUp: ExistingFollowUp) => void;
  onRefreshFollowUps?: () => void;
  isEditMode?: boolean;
}

const FOLLOW_UP_TYPES = [
  { value: 'send_quotation', label: 'Send Quotation' },
  { value: 'update_prices', label: 'Update Prices' },
  { value: 'visit_site', label: 'Visit Site' },
  { value: 'collect_boq', label: 'Collect BOQ' },
  { value: 'follow_up_after_offer', label: 'Follow-up After Offer' },
  { value: 'closing_attempt', label: 'Closing Attempt' },
  { value: 'general', label: 'General Follow-up' },
  { value: 'other', label: 'Other' },
];

const getSuggestedFollowUps = (interestLevel: string, objectionType: string): SuggestedFollowUp[] => {
  const suggestions: SuggestedFollowUp[] = [];
  
  // Standard thank you follow-up for all interested leads
  if (['High', 'Medium', 'Low'].includes(interestLevel)) {
    suggestions.push({
      id: 'thank-you',
      title: 'Standard thank you follow-up',
      action: 'Send thank you message and company profile',
      notes: 'Thank you for your time today. Please find attached our company profile. If you need anything or would like support with your upcoming requirements, I\'m here to help anytime.',
      daysFromNow: 1,
      priority: 'Medium',
    });
  }
  
  // Objection-based follow-ups for "Not interested"
  if (interestLevel === 'Not interested') {
    // Always show thank you first
    suggestions.push({
      id: 'thank-you-not-interested',
      title: 'Thank you message',
      action: 'Send thank you message',
      notes: 'Thank you for your time today. I appreciate you considering us.',
      daysFromNow: 1,
      priority: 'Low',
    });

    switch (objectionType) {
      case 'Not Interested':
        suggestions.push({
          id: 'obj-not-interested',
          title: 'Check again later',
          action: 'Check again and share updates or new offers',
          notes: 'Thank you for your time today. I understand that the timing is not suitable right now. I will reach out again later in case your needs change or if we have new offers that might be relevant to you.',
          daysFromNow: 14,
          priority: 'Low',
        });
        break;
      case 'Price Too High':
        suggestions.push({
          id: 'obj-price',
          title: 'Follow up on pricing',
          action: 'Follow up on pricing objection',
          notes: 'Thank you for your feedback regarding the price. If you\'d like, we can explain more about the value we provide, and explore flexible options that might work better for your budget.',
          daysFromNow: 4,
          priority: 'Medium',
        });
        break;
      case 'Specific Requirements Needed':
        suggestions.push({
          id: 'obj-specs',
          title: 'Follow up on technical requirements',
          action: 'Follow up on technical/approval requirements',
          notes: 'Thank you for sharing your technical requirements. We can provide full documentation and certificates, and coordinate with your technical team if needed.',
          daysFromNow: 4,
          priority: 'Medium',
        });
        break;
      case 'Payment Terms Issue':
        suggestions.push({
          id: 'obj-payment',
          title: 'Follow up on payment terms',
          action: 'Follow up on payment terms',
          notes: 'Thank you for your feedback regarding the payment terms. We are happy to discuss how we usually work with clients and explore options that might make the process easier for you.',
          daysFromNow: 4,
          priority: 'Medium',
        });
        break;
    }
  }
  
  return suggestions;
};

const CommunicationFollowUpsSection = ({
  interestLevel,
  objectionType,
  pendingFollowUps,
  onAddFollowUp,
  onUpdateFollowUp,
  onRemoveFollowUp,
  existingFollowUps = [],
  loadingFollowUps = false,
  onEditExistingFollowUp,
  onRefreshFollowUps,
  isEditMode = false,
}: CommunicationFollowUpsSectionProps) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [channelError, setChannelError] = useState(false);
  const [formData, setFormData] = useState<Omit<PendingFollowUp, 'id'>>({
    action: '',
    notes: '',
    clientResponse: '',
    followUpDate: addDays(new Date(), 1),
    statusAfter: 'Open',
    priority: 'Medium',
    followUpType: 'general',
    reminderEnabled: true,
    followUpChannel: '',
  });

  const suggestions = getSuggestedFollowUps(interestLevel, objectionType);

  const resetForm = () => {
    setFormData({
      action: '',
      notes: '',
      clientResponse: '',
      followUpDate: addDays(new Date(), 1),
      statusAfter: 'Open',
      priority: 'Medium',
      followUpType: 'general',
      reminderEnabled: true,
      followUpChannel: '',
    });
    setChannelError(false);
    setEditingId(null);
  };

  const handleSuggestionClick = (suggestion: SuggestedFollowUp) => {
    setFormData({
      action: suggestion.action,
      notes: suggestion.notes,
      clientResponse: '',
      followUpDate: addDays(new Date(), suggestion.daysFromNow),
      statusAfter: 'Open',
      priority: suggestion.priority,
      followUpType: 'general',
      reminderEnabled: true,
      followUpChannel: '',
    });
    setShowForm(true);
    setEditingId(null);
  };

  const handleCustomFollowUp = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEditFollowUp = (followUp: PendingFollowUp) => {
    setFormData({
      action: followUp.action,
      notes: followUp.notes,
      clientResponse: followUp.clientResponse,
      followUpDate: followUp.followUpDate,
      statusAfter: followUp.statusAfter,
      priority: followUp.priority,
      followUpType: followUp.followUpType,
      reminderEnabled: followUp.reminderEnabled,
      followUpChannel: followUp.followUpChannel,
    });
    setEditingId(followUp.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formData.followUpChannel) {
      setChannelError(true);
      return;
    }
    
    if (!formData.action.trim()) {
      return;
    }

    const followUp: PendingFollowUp = {
      id: editingId || `temp-${Date.now()}`,
      ...formData,
    };

    if (editingId) {
      onUpdateFollowUp(editingId, followUp);
      toast({
        title: "Follow-up updated",
        description: "Your follow-up has been updated successfully.",
      });
    } else {
      onAddFollowUp(followUp);
      toast({
        title: "Follow-up added",
        description: `"${formData.action}" scheduled for ${format(formData.followUpDate, 'MMM d, yyyy')}`,
      });
    }

    resetForm();
    setShowForm(false);
  };

  const handleCancel = () => {
    resetForm();
    setShowForm(false);
  };

  const getChannelIcon = (channelValue: string) => {
    const channel = COMMUNICATION_CHANNELS.find(c => c.value === channelValue);
    return channel?.icon;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'Medium':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'Low':
        return 'text-muted-foreground bg-muted border-border';
      default:
        return '';
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CalendarPlus className="h-4 w-4 text-primary" />
        Follow-ups
      </div>

      {/* Suggested Follow-ups */}
      {suggestions.length > 0 && !showForm && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" />
            Suggested follow-ups
          </div>
          <div className="grid gap-2">
            {suggestions.map((suggestion) => (
              <Card 
                key={suggestion.id} 
                className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm group"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{suggestion.title}</span>
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded border',
                          getPriorityColor(suggestion.priority)
                        )}>
                          {suggestion.priority}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {suggestion.notes}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <CalendarIcon className="h-3 w-3 inline mr-1" />
                        {suggestion.daysFromNow === 1 ? 'Tomorrow' : `In ${suggestion.daysFromNow} days`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors animate-pulse">Click to add</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Custom Follow-up Button */}
      {!showForm && (
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={handleCustomFollowUp}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Custom Follow-up
        </Button>
      )}

      {/* Follow-up Form */}
      {showForm && (
        <div className="space-y-4 p-4 border rounded-lg bg-background">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">
              {editingId ? 'Edit Follow-up' : 'New Follow-up'}
            </h4>
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Priority and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: 'High' | 'Medium' | 'Low') =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger className={cn(getPriorityColor(formData.priority))}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      High
                    </span>
                  </SelectItem>
                  <SelectItem value="Medium">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="Low">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-400" />
                      Low
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.statusAfter}
                onValueChange={(value: 'Open' | 'Done' | 'Cancelled') =>
                  setFormData({ ...formData, statusAfter: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Done">Done</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Follow-up Type */}
          <div className="space-y-2">
            <Label>Follow-up Type</Label>
            <Select
              value={formData.followUpType}
              onValueChange={(value) => setFormData({ ...formData, followUpType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {FOLLOW_UP_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Follow-up Channel (Required) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Follow-up Channel <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.followUpChannel}
              onValueChange={(value) => {
                setFormData({ ...formData, followUpChannel: value });
                setChannelError(false);
              }}
            >
              <SelectTrigger className={cn(channelError && 'border-destructive')}>
                <SelectValue placeholder="Select channel..." />
              </SelectTrigger>
              <SelectContent>
                {COMMUNICATION_CHANNELS.map((channel) => {
                  const Icon = channel.icon;
                  return (
                    <SelectItem key={channel.value} value={channel.value}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {channel.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {channelError && (
              <p className="text-xs text-destructive">Please select a channel</p>
            )}
          </div>

          {/* Action/Title */}
          <div className="space-y-2">
            <Label>Action/Title <span className="text-destructive">*</span></Label>
            <Input
              value={formData.action}
              onChange={(e) => setFormData({ ...formData, action: e.target.value })}
              placeholder="e.g., Send thank you message, Schedule call..."
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Message / Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="What you want to communicate..."
              rows={3}
            />
          </div>

          {/* Follow-up Date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Follow-up Date
              {isBefore(formData.followUpDate, startOfDay(new Date())) && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <Clock className="h-3 w-3" />
                  Logged late
                </span>
              )}
            </Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="flex-1 justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.followUpDate, 'MMM dd, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.followUpDate}
                    onSelect={(date) => date && setFormData({ ...formData, followUpDate: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <div className="flex gap-1">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="text-xs px-2" 
                  onClick={() => setFormData({ ...formData, followUpDate: new Date() })}
                >
                  Today
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="text-xs px-2" 
                  onClick={() => setFormData({ ...formData, followUpDate: addDays(new Date(), 2) })}
                >
                  +2d
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="text-xs px-2" 
                  onClick={() => setFormData({ ...formData, followUpDate: addDays(new Date(), 7) })}
                >
                  +1w
                </Button>
              </div>
            </div>
          </div>

          {/* Reminder Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm cursor-pointer">Enable reminder</Label>
                <p className="text-xs text-muted-foreground">Include in Today's Follow-ups</p>
              </div>
            </div>
            <Switch
              checked={formData.reminderEnabled}
              onCheckedChange={(checked) => setFormData({ ...formData, reminderEnabled: checked })}
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleSubmit} 
              className="flex-1"
              disabled={!formData.action.trim()}
            >
              {editingId ? 'Update' : 'Add'} Follow-up
            </Button>
          </div>
        </div>
      )}

      {/* List of Pending Follow-ups */}
      {pendingFollowUps.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Follow-ups to be created ({pendingFollowUps.length})
          </div>
          <div className="space-y-2">
            {pendingFollowUps.map((followUp, index) => {
              const ChannelIcon = getChannelIcon(followUp.followUpChannel);
              return (
                <div 
                  key={followUp.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-background"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="font-medium text-sm truncate">{followUp.action}</span>
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded border',
                        getPriorityColor(followUp.priority)
                      )}>
                        {followUp.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {format(followUp.followUpDate, 'MMM dd, yyyy')}
                      </span>
                      {ChannelIcon && (
                        <span className="flex items-center gap-1">
                          <ChannelIcon className="h-3 w-3" />
                          {followUp.followUpChannel}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={() => handleEditFollowUp(followUp)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onRemoveFollowUp(followUp.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Existing Follow-ups Timeline (for edit mode) */}
      {isEditMode && (existingFollowUps.length > 0 || loadingFollowUps) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Existing follow-ups ({existingFollowUps.length})
          </div>
          <FollowUpTimeline
            followUps={existingFollowUps}
            onEdit={(followUp) => onEditExistingFollowUp?.(followUp)}
            onRefresh={() => onRefreshFollowUps?.()}
            loading={loadingFollowUps}
          />
        </div>
      )}

      {/* Empty state when no interest level selected */}
      {!interestLevel && !showForm && pendingFollowUps.length === 0 && existingFollowUps.length === 0 && !isEditMode && (
        <p className="text-xs text-muted-foreground text-center py-2">
          <MessageSquare className="h-4 w-4 inline mr-1" />
          Select an Interest Level above to see suggested follow-ups
        </p>
      )}
    </div>
  );
};

export default CommunicationFollowUpsSection;

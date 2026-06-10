import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, Plus, AlertTriangle, Bell, Clock } from 'lucide-react';
import { format, addDays, nextSunday, isBefore, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { COMMUNICATION_CHANNELS } from '@/constants/communicationChannels';
import { logAudit } from '@/lib/auditLogger';

interface AddFollowUpFormProps {
  communicationLogId: string;
  onSuccess: () => void;
}

const FOLLOW_UP_TYPES = [
  { value: 'send_quotation', label: 'Send Quotation', suggestion: 'Send updated quotation to the client.' },
  { value: 'update_prices', label: 'Update Prices', suggestion: 'Update and share the latest pricing information.' },
  { value: 'visit_site', label: 'Visit Site', suggestion: 'Schedule and conduct a site visit.' },
  { value: 'collect_boq', label: 'Collect BOQ', suggestion: 'Collect Bill of Quantities from the client.' },
  { value: 'follow_up_after_offer', label: 'Follow-up After Offer', suggestion: 'Follow up on the submitted offer/proposal.' },
  { value: 'closing_attempt', label: 'Closing Attempt', suggestion: 'Attempt to close the deal with final terms.' },
  { value: 'general', label: 'General Follow-up', suggestion: 'General follow-up to maintain relationship.' },
  { value: 'other', label: 'Other', suggestion: '' },
];

const AddFollowUpForm = ({ communicationLogId, onSuccess }: AddFollowUpFormProps) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [channelError, setChannelError] = useState(false);
  const [formData, setFormData] = useState({
    action: '',
    notes: '',
    clientResponse: '',
    followUpDate: new Date(),
    statusAfter: 'Open' as 'Open' | 'Done' | 'Cancelled',
    priority: 'Medium' as 'High' | 'Medium' | 'Low',
    followUpType: '',
    reminderEnabled: false,
    followUpChannel: '',
  });

  const handleFollowUpTypeChange = (value: string) => {
    const typeConfig = FOLLOW_UP_TYPES.find(t => t.value === value);
    setFormData(prev => ({
      ...prev,
      followUpType: value,
      action: !prev.action && typeConfig?.suggestion ? typeConfig.suggestion : prev.action,
    }));
  };

  const handleQuickDate = (option: 'today' | '+2days' | '+1week' | 'nextSunday') => {
    let date: Date;
    const today = new Date();
    
    switch (option) {
      case 'today':
        date = today;
        break;
      case '+2days':
        date = addDays(today, 2);
        break;
      case '+1week':
        date = addDays(today, 7);
        break;
      case 'nextSunday':
        date = nextSunday(today);
        break;
    }
    
    setFormData(prev => ({ ...prev, followUpDate: date }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('You must be logged in to add follow-ups');
      return;
    }

    // Validate channel
    if (!formData.followUpChannel) {
      setChannelError(true);
      toast.error('Please select a follow-up channel');
      return;
    }
    setChannelError(false);

    setLoading(true);
    
    // Map UI status to database enum values
    const mapStatusToDb = (status: string): 'Open' | 'Closed' | 'In Follow-up' => {
      switch (status) {
        case 'Done':
          return 'Closed';
        case 'Cancelled':
          return 'Closed';
        default:
          return 'Open';
      }
    };
    
    try {
      const newFollowUpData = {
        communication_log_id: communicationLogId,
        action: formData.action,
        notes: formData.notes,
        client_response: formData.clientResponse || null,
        follow_up_date: formData.followUpDate.toISOString(),
        status_after: mapStatusToDb(formData.statusAfter),
        priority: formData.priority,
        follow_up_type: formData.followUpType || null,
        reminder_enabled: formData.reminderEnabled,
        user_id: user.id,
        follow_up_channel: formData.followUpChannel || null,
      };

      const { data: insertedData, error } = await supabase
        .from('follow_up_history')
        .insert(newFollowUpData)
        .select()
        .single();

      if (error) throw error;

      // Log the creation in audit trail
      if (insertedData) {
        // Log to follow_up_audit_log for detailed follow-up tracking
        await supabase.from('follow_up_audit_log').insert({
          follow_up_id: insertedData.id,
          communication_log_id: communicationLogId,
          action: 'created',
          changed_by: user.id,
          old_values: null,
          new_values: {
            action: formData.action,
            notes: formData.notes,
            follow_up_date: formData.followUpDate.toISOString(),
            status_after: formData.statusAfter,
            priority: formData.priority,
            follow_up_type: formData.followUpType,
            reminder_enabled: formData.reminderEnabled,
            follow_up_channel: formData.followUpChannel,
          },
        });

        // Log to main audit_log for platform-wide tracking
        await logAudit({
          action: 'created',
          module: 'Follow-ups',
          recordId: insertedData.id,
          recordName: formData.action || 'New Follow-up',
          newValues: {
            action: formData.action,
            notes: formData.notes,
            follow_up_date: formData.followUpDate.toISOString(),
            status_after: formData.statusAfter,
            priority: formData.priority,
            follow_up_type: formData.followUpType,
            reminder_enabled: formData.reminderEnabled,
            follow_up_channel: formData.followUpChannel,
          },
        });
      }

      // Automatically set communication status to "In Follow-up" when adding a follow-up
      await supabase
        .from('communication_log')
        .update({ status: 'In Follow-up' })
        .eq('id', communicationLogId);

      toast.success('Follow-up added successfully');
      setFormData({
        action: '',
        notes: '',
        clientResponse: '',
        followUpDate: new Date(),
        statusAfter: 'Open',
        priority: 'Medium',
        followUpType: '',
        reminderEnabled: false,
        followUpChannel: '',
      });
      setIsOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Error adding follow-up:', error);
      toast.error('Failed to add follow-up');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'Medium':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'Low':
        return 'text-gray-500 bg-gray-50 border-gray-200';
      default:
        return '';
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Follow-up
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">New Follow-up</h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
        >
          Cancel
        </Button>
      </div>

      {/* Priority and Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            Priority
            {formData.priority === 'High' && (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            )}
          </Label>
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
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.statusAfter}
            onValueChange={(value: 'Open' | 'Done' | 'Cancelled') =>
              setFormData({ ...formData, statusAfter: value })
            }
          >
            <SelectTrigger id="status">
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
          onValueChange={handleFollowUpTypeChange}
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
      </div>

      {/* Action/Title */}
      <div className="space-y-2">
        <Label htmlFor="action">Action/Title</Label>
        <Input
          id="action"
          value={formData.action}
          onChange={(e) => setFormData({ ...formData, action: e.target.value })}
          placeholder="e.g., Called client, Sent proposal, Meeting scheduled"
          required
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Add details about this follow-up..."
          rows={2}
        />
      </div>

      {/* Client Response */}
      <div className="space-y-2">
        <Label htmlFor="clientResponse">Client Response</Label>
        <Textarea
          id="clientResponse"
          value={formData.clientResponse}
          onChange={(e) => setFormData({ ...formData, clientResponse: e.target.value })}
          placeholder="What did the client say? (optional)"
          rows={2}
        />
      </div>

      {/* Date with Quick Buttons */}
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
              <Button variant="outline" className="flex-1 justify-start">
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
            <Button type="button" variant="outline" size="sm" className="text-xs px-2" onClick={() => handleQuickDate('today')}>
              Today
            </Button>
            <Button type="button" variant="outline" size="sm" className="text-xs px-2" onClick={() => handleQuickDate('+2days')}>
              +2d
            </Button>
            <Button type="button" variant="outline" size="sm" className="text-xs px-2" onClick={() => handleQuickDate('+1week')}>
              +1w
            </Button>
          </div>
        </div>
      </div>

      {/* Reminder Toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
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

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Adding...' : 'Add Follow-up'}
      </Button>
    </form>
  );
};

export default AddFollowUpForm;
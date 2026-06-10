import { useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { CalendarIcon, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { COMMUNICATION_CHANNELS } from '@/constants/communicationChannels';
import { logAudit } from '@/lib/auditLogger';

interface CompleteFollowUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followUp: {
    id: string;
    action: string;
    follow_up_date: string;
    communication_log_id: string;
    status_after: string | null;
    notes: string | null;
  } | null;
  onCompleted: () => void;
}

// Removed OUTCOME_OPTIONS - simplified to just client response

export function CompleteFollowUpModal({
  open,
  onOpenChange,
  followUp,
  onCompleted,
}: CompleteFollowUpModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [clientResponse, setClientResponse] = useState<string>('');
  const [createNextFollowUp, setCreateNextFollowUp] = useState(false);
  const [nextFollowUpDate, setNextFollowUpDate] = useState<Date | undefined>(undefined);
  const [nextFollowUpChannel, setNextFollowUpChannel] = useState<string>('');
  const [nextFollowUpAction, setNextFollowUpAction] = useState<string>('');
  const [nextFollowUpAssignedTo, setNextFollowUpAssignedTo] = useState<string>('');
  
  // Team members for assignment
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  
  // Fetch team members on mount
  useState(() => {
    const fetchTeamMembers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .not('full_name', 'is', null);
      if (data) {
        setTeamMembers(data.map(p => p.full_name!).filter(Boolean));
      }
    };
    fetchTeamMembers();
  });
  
  const resetForm = () => {
    setClientResponse('');
    setCreateNextFollowUp(false);
    setNextFollowUpDate(undefined);
    setNextFollowUpChannel('');
    setNextFollowUpAction('');
    setNextFollowUpAssignedTo('');
  };
  
  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!followUp) return;
    
    if (createNextFollowUp) {
      if (!nextFollowUpDate) {
        toast({
          title: 'Next follow-up date required',
          description: 'Please select a date for the next follow-up.',
          variant: 'destructive',
        });
        return;
      }
      if (!nextFollowUpChannel) {
        toast({
          title: 'Channel required',
          description: 'Please select a channel for the next follow-up.',
          variant: 'destructive',
        });
        return;
      }
      if (!nextFollowUpAction.trim()) {
        toast({
          title: 'Action required',
          description: 'Please enter an action for the next follow-up.',
          variant: 'destructive',
        });
        return;
      }
    }
    
    setSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Update the current follow-up with outcome, notes, and mark as Done
      const oldValues = {
        status_after: followUp.status_after,
        client_response: followUp.notes,
      };
      
      const newValues = {
        status_after: 'Done' as const,
        client_response: clientResponse || null,
      };
      
      const { error: updateError } = await supabase
        .from('follow_up_history')
        .update({
          status_after: 'Done',
          client_response: clientResponse || null,
        })
        .eq('id', followUp.id);
      
      if (updateError) throw updateError;
      
      // Log audit for the follow-up completion
      await supabase.from('follow_up_audit_log').insert({
        follow_up_id: followUp.id,
        communication_log_id: followUp.communication_log_id,
        changed_by: user.id,
        action: 'completed',
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
      
      // Create next follow-up if requested
      if (createNextFollowUp && nextFollowUpDate) {
        const { error: createError } = await supabase
          .from('follow_up_history')
          .insert({
            communication_log_id: followUp.communication_log_id,
            follow_up_date: nextFollowUpDate.toISOString(),
            follow_up_channel: nextFollowUpChannel,
            action: nextFollowUpAction,
            status_after: 'Open',
            user_id: user.id,
          });
        
        if (createError) throw createError;
        
        // Update communication's assigned_to if specified
        if (nextFollowUpAssignedTo) {
          await supabase
            .from('communication_log')
            .update({ assigned_to: nextFollowUpAssignedTo })
            .eq('id', followUp.communication_log_id);
        }
      }
      
      toast({
        title: 'Follow-up completed',
        description: 'Follow-up completed and outcome saved.',
      });
      
      resetForm();
      onCompleted();
      onOpenChange(false);
    } catch (error) {
      console.error('Error completing follow-up:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete follow-up. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!followUp) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Complete Follow-up
          </DialogTitle>
          <DialogDescription>
            Record the outcome of this follow-up before marking it as done.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-5 py-4 overflow-y-auto flex-1">
          {/* Follow-up info summary */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="font-medium">{followUp.action || 'Follow-up'}</div>
            <div className="text-muted-foreground">
              Scheduled for {format(new Date(followUp.follow_up_date), 'MMM dd, yyyy')}
            </div>
          </div>
          
          {/* Client Response textarea */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Client Response
            </Label>
            <Textarea
              value={clientResponse}
              onChange={(e) => setClientResponse(e.target.value)}
              placeholder="Enter the client's response (optional)..."
              rows={3}
            />
          </div>
          
          {/* Create next follow-up checkbox */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="createNext"
                checked={createNextFollowUp}
                onCheckedChange={(checked) => setCreateNextFollowUp(checked === true)}
              />
              <Label htmlFor="createNext" className="text-sm font-medium cursor-pointer">
                Create next follow-up
              </Label>
            </div>
            
            {createNextFollowUp && (
              <div className="ml-6 space-y-4 border-l-2 border-primary/20 pl-4">
                {/* Next follow-up date */}
                <div className="space-y-2">
                  <Label className="text-sm">
                    Follow-up Date <span className="text-destructive">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !nextFollowUpDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {nextFollowUpDate ? format(nextFollowUpDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={nextFollowUpDate}
                        onSelect={setNextFollowUpDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                {/* Channel */}
                <div className="space-y-2">
                  <Label className="text-sm">
                    Channel <span className="text-destructive">*</span>
                  </Label>
                  <Select value={nextFollowUpChannel} onValueChange={setNextFollowUpChannel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMUNICATION_CHANNELS.map((channel) => (
                        <SelectItem key={channel.value} value={channel.value}>
                          <div className="flex items-center gap-2">
                            <channel.icon className="h-4 w-4" />
                            {channel.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Action required */}
                <div className="space-y-2">
                  <Label className="text-sm">
                    Action Required <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={nextFollowUpAction}
                    onChange={(e) => setNextFollowUpAction(e.target.value)}
                    placeholder="e.g., Follow up on quotation"
                  />
                </div>
                
                {/* Assigned To */}
                <div className="space-y-2">
                  <Label className="text-sm">Assigned To</Label>
                  <Select value={nextFollowUpAssignedTo} onValueChange={setNextFollowUpAssignedTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((member) => (
                        <SelectItem key={member} value={member}>
                          {member}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Complete Follow-up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CompleteFollowUpModal;

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  MessageSquare, 
  Phone,
  Mail,
  Video,
  Users,
  Building2,
  MoreHorizontal,
  Calendar,
  CalendarClock,
  User,
} from 'lucide-react';
import { addDays, nextSunday } from 'date-fns';
import { COMMUNICATION_CHANNELS } from '@/constants/communicationChannels';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface StartOpportunityConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onSuccess: () => void;
  // Optional: pre-select an opportunity
  preSelectedOpportunityId?: string;
  preSelectedProjectId?: string;
  // Optional: edit mode
  editingConversation?: any;
}

interface Project {
  id: string;
  name: string;
  status?: string;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
}

interface Opportunity {
  id: string;
  name: string;
  project_id: string;
  assigned_to: string | null;
}

const CHANNELS = [
  { value: 'phone', label: 'Phone Call', icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'video', label: 'Video Call', icon: Video },
  { value: 'meeting', label: 'In-Person Meeting', icon: Users },
  { value: 'site_visit', label: 'Site Visit', icon: Building2 },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
];

const PRIORITY_OPTIONS = [
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

export const StartOpportunityConversationDialog = ({
  open,
  onOpenChange,
  clientId,
  clientName,
  onSuccess,
  preSelectedOpportunityId,
  preSelectedProjectId,
  editingConversation,
}: StartOpportunityConversationDialogProps) => {
  const isEditMode = !!editingConversation;
  const [loading, setLoading] = useState(false);
  
  // Data loading state
  const [projects, setProjects] = useState<Project[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Opportunity selection
  const [selectedOpportunityId, setSelectedOpportunityId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [createNewOpportunity, setCreateNewOpportunity] = useState(false);
  
  // First Interaction (mandatory)
  const [channel, setChannel] = useState('');
  const [summary, setSummary] = useState('');
  const [interactionDate, setInteractionDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [owner, setOwner] = useState('');
  const [interestLevel, setInterestLevel] = useState('Medium');
  
  // Follow-up (optional)
  const [createFollowUp, setCreateFollowUp] = useState(false);
  const [followUpOpportunityId, setFollowUpOpportunityId] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState('Open');
  const [followUpChannel, setFollowUpChannel] = useState('');
  const [followUpDueDate, setFollowUpDueDate] = useState('');
  const [followUpAction, setFollowUpAction] = useState('');

  useEffect(() => {
    if (open && clientId) {
      fetchData();
      if (!editingConversation) {
        resetForm();
      }
    }
  }, [open, clientId]);

  // Pre-fill form when editing
  useEffect(() => {
    if (open && editingConversation) {
      setChannel(editingConversation.communication_channels || '');
      setSummary(editingConversation.summary || '');
      setInteractionDate(editingConversation.communication_date 
        ? format(new Date(editingConversation.communication_date), "yyyy-MM-dd'T'HH:mm")
        : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setOwner(editingConversation.owner_id || editingConversation.assigned_to || '');
      setInterestLevel(editingConversation.interest_level || 'Medium');
      setSelectedProjectId(editingConversation.project_id || '');
      setCreateFollowUp(false);
    }
  }, [open, editingConversation]);

  // Set pre-selected values when data is loaded
  useEffect(() => {
    if (preSelectedOpportunityId && opportunities.length > 0) {
      setSelectedOpportunityId(preSelectedOpportunityId);
      const opp = opportunities.find(o => o.id === preSelectedOpportunityId);
      if (opp) {
        setSelectedProjectId(opp.project_id);
        setOwner(opp.assigned_to || '');
      }
    } else if (preSelectedProjectId && projects.length > 0) {
      setSelectedProjectId(preSelectedProjectId);
      setCreateNewOpportunity(true);
    }
  }, [preSelectedOpportunityId, preSelectedProjectId, opportunities, projects]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      // Fetch projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, status')
        .eq('client_id', clientId)
        .neq('status', 'Completed')
        .order('created_at', { ascending: false });
      
      setProjects(projectsData || []);

      // Fetch opportunities for this client
      const { data: oppsData } = await supabase
        .from('opportunities')
        .select('id, name, project_id, assigned_to')
        .eq('client_id', clientId)
        .eq('is_closed', false)
        .order('created_at', { ascending: false });
      
      setOpportunities(oppsData || []);

      // Fetch team members
      const { data: teamData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true });
      
      setTeamMembers(teamData || []);

      // Get current user for default owner
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setOwner(user.id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const resetForm = () => {
    setSelectedOpportunityId('');
    setSelectedProjectId('');
    setCreateNewOpportunity(false);
    setChannel('');
    setSummary('');
    setInteractionDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setOwner('');
    setInterestLevel('Medium');
    setCreateFollowUp(false);
    setFollowUpOpportunityId('');
    setFollowUpStatus('Open');
    setFollowUpChannel('');
    setFollowUpDueDate('');
    setFollowUpAction('');
  };

  const handleOpportunityChange = (oppId: string) => {
    if (oppId === 'new') {
      setCreateNewOpportunity(true);
      setSelectedOpportunityId('');
    } else {
      setCreateNewOpportunity(false);
      setSelectedOpportunityId(oppId);
      // Auto-set project and owner from opportunity
      const opp = opportunities.find(o => o.id === oppId);
      if (opp) {
        setSelectedProjectId(opp.project_id);
        if (opp.assigned_to) setOwner(opp.assigned_to);
      }
    }
  };

  const canSubmit = () => {
    const hasChannel = !!channel;
    const hasSummary = !!summary.trim();
    
    if (createFollowUp) {
      return hasChannel && hasSummary && followUpOpportunityId && followUpChannel && followUpDueDate;
    }
    return hasChannel && hasSummary;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get client details
      const { data: clientData } = await supabase
        .from('clients')
        .select('company_name, primary_contact_name, primary_contact_phone, city, district')
        .eq('id', clientId)
        .single();

      if (isEditMode && editingConversation) {
        // Update existing communication_log entry
        const updatePayload: any = {
          communication_channels: channel,
          summary: summary,
          communication_date: new Date(interactionDate).toISOString(),
          owner_id: owner || user?.id || null,
          assigned_to: owner || null,
        };

        if (selectedProjectId) {
          updatePayload.project_id = selectedProjectId;
        }

        const { error: updateError } = await supabase
          .from('communication_log')
          .update(updatePayload)
          .eq('id', editingConversation.id);

        if (updateError) throw updateError;

        // Also update activity record if exists
        await supabase
          .from('activities')
          .update({
            channel: channel,
            summary: summary,
            activity_date: new Date(interactionDate).toISOString(),
            assigned_to: owner || null,
            ...(selectedProjectId && { project_id: selectedProjectId }),
          })
          .eq('legacy_communication_id', editingConversation.id);

        toast.success('Initial conversation updated');
      } else {
        // Create new communication_log entry at CLIENT level
        const commLogPayload: any = {
          client_id: clientId,
          company_name: clientData?.company_name || clientName,
          person_name: clientData?.primary_contact_name || null,
          contact_info: clientData?.primary_contact_phone || null,
          city: clientData?.city || null,
          district: clientData?.district || null,
          communication_channels: channel,
          summary: summary,
          topic: 'Initial Contact',
          communication_date: new Date(interactionDate).toISOString(),
          status: 'Open',
          owner_id: owner || user?.id || null,
          assigned_to: owner || null,
        };

        // Add project_id if follow-up is linked to a project
        if (createFollowUp && selectedProjectId) {
          commLogPayload.project_id = selectedProjectId;
        }

        const { data: commLog, error: commError } = await supabase
          .from('communication_log')
          .insert(commLogPayload)
          .select()
          .single();

        if (commError) throw commError;

        // Also create activity record at client level
        const activityPayload: any = {
          client_id: clientId,
          activity_type: 'initial_conversation',
          channel: channel,
          summary: summary,
          activity_date: new Date(interactionDate).toISOString(),
          created_by: user?.id || null,
          assigned_to: owner || null,
          legacy_communication_id: commLog.id,
        };

        // Add project_id if follow-up is linked to a project
        if (createFollowUp && selectedProjectId) {
          activityPayload.project_id = selectedProjectId;
        }

        await supabase
          .from('activities')
          .insert(activityPayload);

        // Create follow-up if requested
        if (createFollowUp && commLog && followUpOpportunityId) {
          // Get the project_id from the selected opportunity
          const selectedOpp = opportunities.find(o => o.id === followUpOpportunityId);
          
          const { error: fuError } = await supabase
            .from('follow_up_history')
            .insert({
              communication_log_id: commLog.id,
              opportunity_id: followUpOpportunityId,
              project_id: selectedOpp?.project_id || null,
              follow_up_date: new Date(followUpDueDate).toISOString(),
              follow_up_type: 'general',
              action: followUpAction || 'Follow-up',
              notes: null,
              status_after: followUpStatus as 'Open' | 'Closed',
              follow_up_channel: followUpChannel || null,
              user_id: user?.id || '',
            });

          if (fuError) {
            console.error('Error creating follow-up:', fuError);
            toast.error('Activity created but follow-up failed');
          }
        }

        toast.success(createFollowUp ? 'Initial contact and follow-up created' : 'Initial contact recorded');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Failed to save', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredOpportunities = selectedProjectId 
    ? opportunities.filter(o => o.project_id === selectedProjectId)
    : opportunities;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            {isEditMode ? 'Edit Initial Conversation' : 'Initial Conversation'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? `Update the interaction details with ${clientName}.`
              : `Record the first interaction with ${clientName}. This creates an activity in the timeline.`
            }
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6 py-4">

            {/* First Interaction Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                First Interaction
              </h4>

              {/* Channel */}
              <div className="space-y-2">
                <Label className="text-sm">Channel *</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger>
                    <SelectValue placeholder="How did you communicate?" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((ch) => (
                      <SelectItem key={ch.value} value={ch.value}>
                        <span className="flex items-center gap-2">
                          <ch.icon className="h-4 w-4" />
                          {ch.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Summary */}
              <div className="space-y-2">
                <Label className="text-sm">Summary / Notes *</Label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="What was discussed? Key points, client needs, requirements..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Date & Time */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Date & Time
                  </Label>
                  <Input
                    type="datetime-local"
                    value={interactionDate}
                    onChange={(e) => setInteractionDate(e.target.value)}
                  />
                </div>

                {/* Owner */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    Owner
                  </Label>
                  <Select value={owner} onValueChange={setOwner}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.full_name || member.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {!isEditMode && (
              <>
                <Separator />

                {/* Next Step Section (Optional) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Next Step (Optional)</h4>
                  </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createFollowUp"
                  checked={createFollowUp}
                  onCheckedChange={(checked) => setCreateFollowUp(checked as boolean)}
                />
                <Label htmlFor="createFollowUp" className="text-sm cursor-pointer">
                  Create a follow-up task
                </Label>
              </div>

              {createFollowUp && (
                <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                  {/* Opportunity Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1">
                      Link to Opportunity <span className="text-destructive">*</span>
                    </Label>
                    <Select value={followUpOpportunityId} onValueChange={setFollowUpOpportunityId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select opportunity..." />
                      </SelectTrigger>
                      <SelectContent>
                        {opportunities.length === 0 ? (
                          <SelectItem value="none" disabled>No opportunities available</SelectItem>
                        ) : (
                          opportunities.map((opp) => (
                            <SelectItem key={opp.id} value={opp.id}>
                              {opp.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label className="text-sm">Status</Label>
                    <Select value={followUpStatus} onValueChange={setFollowUpStatus}>
                      <SelectTrigger className={cn(
                        "h-10",
                        followUpStatus === 'Open' && "text-primary bg-primary/10 border-primary/20",
                        followUpStatus === 'Done' && "text-green-600 bg-green-50 border-green-200",
                        followUpStatus === 'Cancelled' && "text-muted-foreground bg-muted border-border"
                      )}>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="Done">Done</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Follow-up Channel */}
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1">
                      Follow-up Channel <span className="text-destructive">*</span>
                    </Label>
                    <Select value={followUpChannel} onValueChange={setFollowUpChannel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select channel..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMUNICATION_CHANNELS.map((ch) => {
                          const Icon = ch.icon;
                          return (
                            <SelectItem key={ch.value} value={ch.value}>
                              <span className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                {ch.label}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Follow-up Date */}
                  <div className="space-y-2">
                    <Label className="text-sm">Follow-up Date</Label>
                    <Input
                      type="date"
                      value={followUpDueDate}
                      onChange={(e) => setFollowUpDueDate(e.target.value)}
                    />
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => setFollowUpDueDate(format(new Date(), 'yyyy-MM-dd'))}
                      >
                        Today
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => setFollowUpDueDate(format(addDays(new Date(), 2), 'yyyy-MM-dd'))}
                      >
                        +2 Days
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => setFollowUpDueDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'))}
                      >
                        +1 Week
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => setFollowUpDueDate(format(nextSunday(new Date()), 'yyyy-MM-dd'))}
                      >
                        Next Sunday
                      </Button>
                    </div>
                  </div>

                  {/* Action Required */}
                  <div className="space-y-2">
                    <Label className="text-sm">Action Required</Label>
                    <Textarea
                      value={followUpAction}
                      onChange={(e) => setFollowUpAction(e.target.value)}
                      placeholder="What needs to be done?"
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>
              </>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !canSubmit()}
          >
            {loading ? 'Saving...' : (isEditMode ? 'Update' : 'Save Contact')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StartOpportunityConversationDialog;

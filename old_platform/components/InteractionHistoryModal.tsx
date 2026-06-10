import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { 
  Phone, User, Building2, Calendar, 
  ChevronDown, ChevronUp, ExternalLink, Plus, CalendarPlus, Pencil
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getChannelInfo } from '@/constants/communicationChannels';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import FollowUpDialog from '@/components/FollowUpDialog';
import CommunicationDialog from '@/components/CommunicationDialog';

interface InteractionHistoryModalProps {
  open: boolean;
  onClose: () => void;
  communicationId: string;
}

interface Communication {
  id: string;
  company_name: string | null;
  person_name: string | null;
  contact_info: string | null;
  communication_date: string | null;
  communication_channels: string | null;
  topic: string | null;
  notes: string | null;
  outcome_notes: string | null;
  status: string | null;
  interest_level: string | null;
  summary: string | null;
}

interface FollowUp {
  id: string;
  follow_up_date: string;
  follow_up_type: string | null;
  follow_up_channel: string | null;
  action: string | null;
  notes: string | null;
  status_after: string | null;
  priority: string | null;
  outcome: string | null;
  client_response: string | null;
  created_at: string;
}

const InteractionHistoryModal = ({ open, onClose, communicationId }: InteractionHistoryModalProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clientInfo, setClientInfo] = useState<{ company_name: string; person_name: string; contact_info: string } | null>(null);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [followUpsMap, setFollowUpsMap] = useState<Record<string, FollowUp[]>>({});
  const [expandedComms, setExpandedComms] = useState<Set<string>>(new Set());
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [showCommunicationDialog, setShowCommunicationDialog] = useState(false);
  const [editingCommunication, setEditingCommunication] = useState<Communication | null>(null);

  useEffect(() => {
    if (open && communicationId) {
      fetchInteractionHistory();
    }
  }, [open, communicationId]);

  const fetchInteractionHistory = async () => {
    setLoading(true);
    try {
      // First get the communication to find the company name
      const { data: mainComm, error: mainError } = await supabase
        .from('communication_log')
        .select('company_name, person_name, contact_info')
        .eq('id', communicationId)
        .single();

      if (mainError) throw mainError;
      if (!mainComm?.company_name) {
        setLoading(false);
        return;
      }

      setClientInfo({
        company_name: mainComm.company_name,
        person_name: mainComm.person_name || '',
        contact_info: mainComm.contact_info || '',
      });

      // Fetch all communications for this client (by company name)
      const { data: allComms, error: commsError } = await supabase
        .from('communication_log')
        .select('id, company_name, person_name, contact_info, communication_date, communication_channels, topic, notes, outcome_notes, status, interest_level, summary')
        .eq('company_name', mainComm.company_name)
        .order('communication_date', { ascending: false });

      if (commsError) throw commsError;
      setCommunications(allComms || []);

      // Fetch all follow-ups for these communications
      const commIds = (allComms || []).map(c => c.id);
      if (commIds.length > 0) {
        const { data: followUps, error: fuError } = await supabase
          .from('follow_up_history')
          .select('id, communication_log_id, follow_up_date, follow_up_type, follow_up_channel, action, notes, status_after, priority, outcome, client_response, created_at')
          .in('communication_log_id', commIds)
          .order('follow_up_date', { ascending: false });

        if (fuError) throw fuError;

        // Group follow-ups by communication
        const fuMap: Record<string, FollowUp[]> = {};
        (followUps || []).forEach(fu => {
          const commId = (fu as any).communication_log_id;
          if (!fuMap[commId]) fuMap[commId] = [];
          fuMap[commId].push(fu as FollowUp);
        });
        setFollowUpsMap(fuMap);
      }
    } catch (error) {
      console.error('Error fetching interaction history:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCommExpanded = (commId: string) => {
    setExpandedComms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commId)) {
        newSet.delete(commId);
      } else {
        newSet.add(commId);
      }
      return newSet;
    });
  };

  const getInterestLevelColor = (level: string | null) => {
    switch (level) {
      case 'High': return 'bg-green-500/15 text-green-600 border-green-500/30';
      case 'Medium': return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30';
      case 'Low': return 'bg-orange-500/15 text-orange-600 border-orange-500/30';
      case 'Not interested': return 'bg-red-500/15 text-red-600 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'Open': return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
      case 'In Follow-up': return 'bg-primary/15 text-primary border-primary/30';
      case 'Closed': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'High': return 'text-red-600';
      case 'Medium': return 'text-yellow-600';
      case 'Low': return 'text-green-600';
      default: return 'text-muted-foreground';
    }
  };

  const handleGoToProfile = () => {
    if (clientInfo?.company_name) {
      onClose();
      navigate(`/client-profile/${encodeURIComponent(clientInfo.company_name)}`);
    }
  };

  const handleAddFollowUp = () => {
    setShowFollowUpDialog(true);
  };

  const handleNewCommunication = () => {
    setEditingCommunication(null);
    setShowCommunicationDialog(true);
  };

  const handleEditCommunication = (comm: Communication) => {
    setEditingCommunication(comm);
    setShowCommunicationDialog(true);
  };

  const handleFollowUpSuccess = () => {
    setShowFollowUpDialog(false);
    fetchInteractionHistory();
  };

  const handleCommunicationSuccess = () => {
    setShowCommunicationDialog(false);
    setEditingCommunication(null);
    fetchInteractionHistory();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Interaction History
              </DialogTitle>
              {clientInfo && (
                <div className="mt-3 space-y-1">
                  <p className="font-semibold text-lg">{clientInfo.company_name}</p>
                  {clientInfo.person_name && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {clientInfo.person_name}
                    </p>
                  )}
                  {clientInfo.contact_info && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {clientInfo.contact_info}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 px-6 py-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : communications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No interactions found</div>
          ) : (
            <div className="space-y-4">
              {communications.map((comm, index) => {
                const followUps = followUpsMap[comm.id] || [];
                const hasFollowUps = followUps.length > 0;
                const isExpanded = expandedComms.has(comm.id);
                const channelInfo = getChannelInfo(comm.communication_channels);

                return (
                  <div key={comm.id} className="relative">
                    {/* Timeline connector */}
                    {index < communications.length - 1 && (
                      <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
                    )}
                    
                    <div className="flex gap-4">
                      {/* Timeline dot */}
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                        comm.status === 'Closed' ? 'bg-muted' : 'bg-primary/20'
                      )}>
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full",
                          comm.status === 'Closed' ? 'bg-muted-foreground' : 'bg-primary'
                        )} />
                      </div>

                      {/* Communication card */}
                      <div className="flex-1 pb-4">
                        <div className="bg-card border rounded-lg p-4">
                          {/* Date & Channel & Edit */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {comm.communication_date 
                                  ? format(new Date(comm.communication_date), 'MMM d, yyyy • h:mm a')
                                  : 'No date'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {channelInfo && (
                                <Badge variant="outline" className="text-xs">
                                  <channelInfo.icon className="h-3 w-3 mr-1" />
                                  {channelInfo.label}
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEditCommunication(comm)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Topic / Notes */}
                          {(comm.topic || comm.notes || comm.outcome_notes) && (
                            <div className="mb-3">
                              {comm.topic && (
                                <p className="font-medium text-sm">{comm.topic}</p>
                              )}
                              {comm.outcome_notes && (
                                <p className="text-sm text-muted-foreground mt-1">{comm.outcome_notes}</p>
                              )}
                              {!comm.outcome_notes && comm.notes && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{comm.notes}</p>
                              )}
                            </div>
                          )}

                          {/* Status & Interest Level */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={getStatusColor(comm.status)}>
                              {comm.status || 'Open'}
                            </Badge>
                            {comm.interest_level && (
                              <Badge variant="outline" className={getInterestLevelColor(comm.interest_level)}>
                                {comm.interest_level}
                              </Badge>
                            )}
                          </div>

                          {/* Follow-ups section */}
                          {hasFollowUps && (
                            <Collapsible open={isExpanded} onOpenChange={() => toggleCommExpanded(comm.id)}>
                              <CollapsibleTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="mt-3 h-7 text-xs w-full justify-between"
                                >
                                  <span>{followUps.length} Follow-up{followUps.length > 1 ? 's' : ''}</span>
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2 space-y-2">
                                {followUps.map(fu => {
                                  const fuChannelInfo = getChannelInfo(fu.follow_up_channel);
                                  return (
                                    <div 
                                      key={fu.id} 
                                      className="bg-muted/50 rounded-md p-3 text-sm border-l-2 border-primary/30"
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                          {fu.follow_up_type && (
                                            <Badge variant="secondary" className="text-[10px]">
                                              {fu.follow_up_type}
                                            </Badge>
                                          )}
                                          {fuChannelInfo && (
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                              <fuChannelInfo.icon className="h-3 w-3" />
                                              {fuChannelInfo.label}
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                          {format(new Date(fu.follow_up_date), 'MMM d, yyyy')}
                                        </span>
                                      </div>
                                      
                                      {fu.action && (
                                        <p className="font-medium text-sm">{fu.action}</p>
                                      )}
                                      {fu.notes && (
                                        <p className="text-xs text-muted-foreground mt-1">{fu.notes}</p>
                                      )}
                                      
                                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <Badge 
                                          variant="outline" 
                                          className={cn(
                                            "text-[10px]",
                                            fu.status_after === 'Closed' ? 'bg-muted' : 
                                            fu.status_after === 'Open' ? 'bg-blue-500/10 text-blue-600' : ''
                                          )}
                                        >
                                          {fu.status_after || 'Open'}
                                        </Badge>
                                        {fu.priority && (
                                          <span className={cn("text-[10px]", getPriorityColor(fu.priority))}>
                                            {fu.priority} priority
                                          </span>
                                        )}
                                        {fu.outcome && (
                                          <Badge variant="secondary" className="text-[10px]">
                                            {fu.outcome}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleGoToProfile} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Go to Full Profile
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleAddFollowUp} className="gap-2">
              <CalendarPlus className="h-4 w-4" />
              Add Follow-up
            </Button>
            <Button variant="outline" onClick={handleNewCommunication} className="gap-2">
              <Plus className="h-4 w-4" />
              New Communication
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>

      {/* Follow-up Dialog */}
      {communications.length > 0 && (
        <FollowUpDialog
          open={showFollowUpDialog}
          onOpenChange={setShowFollowUpDialog}
          communication={{
            id: communications[0]?.id || communicationId,
            follow_up_date: communications[0]?.communication_date || null,
            status: communications[0]?.status || 'Open',
            action: null,
            notes: communications[0]?.notes || null,
            company_name: clientInfo?.company_name || null,
            interest_level: communications[0]?.interest_level || null,
          }}
          onSaved={handleFollowUpSuccess}
        />
      )}

      {/* Communication Dialog */}
      <CommunicationDialog
        open={showCommunicationDialog}
        onOpenChange={(open) => {
          setShowCommunicationDialog(open);
          if (!open) setEditingCommunication(null);
        }}
        communication={editingCommunication}
        onSave={handleCommunicationSuccess}
        initialClientData={!editingCommunication && clientInfo ? {
          company_name: clientInfo.company_name,
          person_name: clientInfo.person_name,
          contact_info: clientInfo.contact_info,
        } : null}
      />
    </Dialog>
  );
};

export default InteractionHistoryModal;

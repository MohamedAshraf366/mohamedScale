import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { 
  Building2, User, Phone, MapPin, Calendar, Tag, 
  MessageSquare, TrendingUp, FileText, Plus, CalendarClock,
  CheckCircle2, XCircle, Clock, RefreshCw, Eye, Pencil,
  ArrowLeft, Users, Sparkles, Mail, Globe, Activity,
  Briefcase, Target, ListTodo, ChevronRight, PlayCircle, ShoppingCart,
  Handshake, MoreHorizontal, Trash2, LayoutGrid, List
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InlineEditCell, InterestLevelEditCell } from '@/components/InlineEditCell';
import { format, formatDistanceToNow } from 'date-fns';
import { useClientProfile } from '@/hooks/useClientProfile';
import { useClientProjects, useClientOpportunities, useClientProjectsWithOpportunities } from '@/hooks/useClients';
import { useClientActivities } from '@/hooks/useActivities';
import { useNeedsInitialConversation, useOpportunitiesWithConversation } from '@/hooks/useOpportunityConversation';
import CommunicationDialog from '@/components/CommunicationDialog';
import FollowUpDialog from '@/components/FollowUpDialog';
import ProjectDialog from '@/components/ProjectDialog';
import OpportunityDialog from '@/components/OpportunityDialog';
import { EditOpportunityDialog } from '@/components/EditOpportunityDialog';
import { RFPDetailsDialog } from '@/components/RFPDetailsDialog';
import { CloseOpportunityDialog } from '@/components/CloseOpportunityDialog';
import StartOpportunityConversationDialog from '@/components/StartOpportunityConversationDialog';
import { ProjectDetailsDialog } from '@/components/ProjectDetailsDialog';
import { EditProjectDialog } from '@/components/EditProjectDialog';
import { ProjectOpportunitiesCard } from '@/components/ProjectOpportunitiesCard';
import { CreateOrderDialog } from '@/components/CreateOrderDialog';
import ClientActivityFeed, { ActivityEvent } from '@/components/ClientActivityFeed';
import { ClientContactsSection } from '@/components/ClientContactsSection';
import { EditClientDialog } from '@/components/EditClientDialog';
import { OverallInterestBadge } from '@/components/OverallInterestBadge';
import { ClientDealsTab } from '@/components/ClientDealsTab';
import { OpportunityActionsMenu } from '@/components/OpportunityActionsMenu';
import { ConvertToDealDialog } from '@/components/ConvertToDealDialog';
import { FollowUpTableRow } from '@/components/FollowUpTableRow';
import { FollowUpKanban } from '@/components/FollowUpKanban';
import { calculateOverallInterest } from '@/lib/clientInterestUtils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ClientProfile = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const decodedClientId = clientId ? decodeURIComponent(clientId) : null;
  const { profileData, clientId: actualClientId, loading, error, refresh } = useClientProfile(decodedClientId);
  const [activeTab, setActiveTab] = useState('timeline');
  const [tasksViewMode, setTasksViewMode] = useState<'kanban' | 'table'>('kanban');
  
  // Use hooks for projects and opportunities
  const { projects, loading: projectsLoading, refresh: refreshProjects, createProject } = useClientProjects(actualClientId);
  const { projects: projectsWithOpportunities, loading: projectsWithOppsLoading, refresh: refreshProjectsWithOpps } = useClientProjectsWithOpportunities(actualClientId);
  const { opportunities, loading: oppsLoading, refresh: refreshOpportunities, createOpportunity } = useClientOpportunities(actualClientId);
  const { data: clientActivities, refetch: refetchActivities } = useClientActivities(actualClientId);
  
  // Check if client needs initial conversation CTA
  const { needsConversation, opportunitiesWithoutConversation, hasNoOpportunities } = useNeedsInitialConversation(actualClientId);
  const { data: opportunitiesWithConvo } = useOpportunitiesWithConversation(actualClientId);
  
  // Dialog states
  const [commDialogOpen, setCommDialogOpen] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState<any>(null);
  const [initialClientData, setInitialClientData] = useState<any>(null);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [followUpCommunication, setFollowUpCommunication] = useState<any>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [opportunityDialogOpen, setOpportunityDialogOpen] = useState(false);
  const [startConversationDialogOpen, setStartConversationDialogOpen] = useState(false);
  const [projectDetailsOpen, setProjectDetailsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [editClientDialogOpen, setEditClientDialogOpen] = useState(false);
  const [clientData, setClientData] = useState<any>(null);
  const [primaryContact, setPrimaryContact] = useState<{ contact_name: string; phone: string; email?: string | null } | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  
  // New dialog states for Order and specific opportunity actions
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedOpportunityForOrder, setSelectedOpportunityForOrder] = useState<{ id: string; name: string } | null>(null);
  const [selectedProjectForOpportunity, setSelectedProjectForOpportunity] = useState<string | null>(null);
  const [conversationOpportunity, setConversationOpportunity] = useState<{ id: string; name: string } | null>(null);
  const [editOpportunityDialogOpen, setEditOpportunityDialogOpen] = useState(false);
  const [editOpportunityReadOnly, setEditOpportunityReadOnly] = useState(false);
  const [selectedOpportunityForEdit, setSelectedOpportunityForEdit] = useState<any>(null);
  const [convertToDealDialogOpen, setConvertToDealDialogOpen] = useState(false);
  const [selectedOpportunityForConversion, setSelectedOpportunityForConversion] = useState<any>(null);
  const [contactsDialogOpen, setContactsDialogOpen] = useState(false);
  const [rfpDialogOpen, setRfpDialogOpen] = useState(false);
  const [selectedOpportunityForRFP, setSelectedOpportunityForRFP] = useState<any>(null);
  const [closeOpportunityDialogOpen, setCloseOpportunityDialogOpen] = useState(false);
  const [selectedOpportunityForClose, setSelectedOpportunityForClose] = useState<any>(null);
  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<any>(null);
  const [editingInitialConversation, setEditingInitialConversation] = useState<any>(null);
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<any>(null);

  // Fetch client data for editing
  const fetchClientData = async () => {
    if (!actualClientId) return;
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', actualClientId)
      .maybeSingle();
    if (data) setClientData(data);
  };

  // Fetch primary contact from client_contacts
  const fetchPrimaryContact = async () => {
    if (!actualClientId) return;
    const { data } = await supabase
      .from('client_contacts')
      .select('contact_name, phone, email')
      .eq('client_id', actualClientId)
      .eq('is_primary', true)
      .maybeSingle();
    setPrimaryContact(data);
  };

  // Fetch team members for name resolution
  const fetchTeamMembers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name', { ascending: true });
    if (data) setTeamMembers(data);
  };

  useEffect(() => {
    fetchClientData();
    fetchPrimaryContact();
    fetchTeamMembers();
  }, [actualClientId]);

  // Generate avatar initials from company name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Calculate Overall Interest from active opportunities
  const overallInterest = useMemo(() => {
    return calculateOverallInterest(opportunities);
  }, [opportunities]);

  const handleNewCommunication = () => {
    if (profileData) {
      setSelectedCommunication(null);
      setInitialClientData({
        company_name: profileData.companyName,
        person_name: profileData.personNames[0] || '',
        contact_info: profileData.contactInfo[0] || '',
        category: profileData.categories[0] || '',
      });
      setCommDialogOpen(true);
      
      if (profileData.isReturningClient) {
        toast.info(`🔁 Returning Client`, {
          description: `${profileData.companyName} has ${profileData.totalInteractions} previous interactions.`,
        });
      }
    }
  };

  const handleEditCommunication = async (commId: string) => {
    const { data } = await supabase
      .from('communication_log')
      .select('*')
      .eq('id', commId)
      .maybeSingle();
    
    if (data) {
      setInitialClientData(null);
      setSelectedCommunication(data);
      setCommDialogOpen(true);
    }
  };

  const handleAddFollowUp = async (commId: string) => {
    const { data } = await supabase
      .from('communication_log')
      .select('*')
      .eq('id', commId)
      .maybeSingle();
    
    if (data) {
      setFollowUpCommunication(data);
      setFollowUpDialogOpen(true);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'Open':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Open</Badge>;
      case 'Closed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Closed</Badge>;
      case 'In Follow-up':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">In Follow-up</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const getInterestBadge = (level: string | null) => {
    switch (level) {
      case 'High':
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">High</Badge>;
      case 'Medium':
        return <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30">Medium</Badge>;
      case 'Low':
        return <Badge className="bg-orange-500/20 text-orange-700 border-orange-500/30">Low</Badge>;
      case 'Not interested':
        return <Badge className="bg-red-500/20 text-red-700 border-red-500/30">Not interested</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Not set</Badge>;
    }
  };

  // Create lookup map for user names
  const getUserName = (userId: string | undefined) => {
    if (!userId) return undefined;
    const member = teamMembers.find(m => m.id === userId);
    return member?.full_name || member?.email || undefined;
  };

  // Build activity events from communications, follow-ups, and opportunities
  const activityEvents = useMemo<ActivityEvent[]>(() => {
    if (!profileData) return [];
    
    const events: ActivityEvent[] = [];
    
    // Add communications as events
    profileData.communications.forEach(comm => {
      // Check if this is an initial conversation (has activity entry or is first contact)
      const isInitialConv = !comm.deal_completed;
      
      events.push({
        id: `comm-${comm.id}`,
        type: comm.deal_completed ? 'deal_closed' : 'communication',
        date: comm.communication_date,
        title: comm.deal_completed 
          ? `Deal closed${comm.deal_value_total ? ` - SAR ${comm.deal_value_total.toLocaleString()}` : ''}`
          : `Communication with ${comm.person_name || profileData.personNames[0] || 'client'}`,
        description: comm.topic || comm.summary || undefined,
        channel: comm.communication_channels || undefined,
        status: comm.status || undefined,
        interestLevel: comm.interest_level || undefined,
        assignedTo: getUserName(comm.assigned_to || undefined),
        metadata: comm.deal_completed 
          ? { 
              value: comm.deal_value_total,
              ...(comm.deal_project_name && { project: comm.deal_project_name })
            } 
          : {
              ...(comm.city && { city: comm.city }),
              ...(comm.district && { district: comm.district }),
            },
        // Add for edit/delete functionality
        isInitialConversation: isInitialConv,
        communicationLogId: comm.id,
      });
    });
    
    // Add follow-ups as events
    profileData.followUps.forEach(fu => {
      // Find related opportunity and project names
      const opportunity = opportunities.find(o => o.id === fu.opportunity_id);
      const project = projects.find(p => p.id === fu.project_id || p.id === opportunity?.project_id);
      
      events.push({
        id: `fu-${fu.id}`,
        type: 'follow_up',
        date: fu.follow_up_date,
        title: fu.action || 'Follow-up scheduled',
        description: fu.outcome || undefined,
        channel: fu.follow_up_channel || undefined,
        status: fu.status_after || undefined,
        notes: fu.notes || undefined,
        assignedTo: getUserName(fu.user_id || undefined),
        opportunityName: opportunity?.name || undefined,
        projectName: project?.name || undefined,
        clientResponse: fu.client_response || undefined,
        action: fu.action || undefined,
        outcome: fu.outcome || undefined,
        // Add IDs for edit/delete functionality
        followUpId: fu.id,
        communicationLogId: fu.communication_log_id,
      });
    });
    
    // Add opportunities as events
    opportunities.forEach(opp => {
      // Find the project name for this opportunity
      const project = projects.find(p => p.id === opp.project_id);
      
      events.push({
        id: `opp-${opp.id}`,
        type: opp.is_closed ? (opp.won ? 'deal_closed' : 'status_change') : 'interest_change',
        date: opp.created_at,
        title: `Opportunity: ${opp.name}`,
        description: `Stage: ${opp.stage || 'Discovery'}`,
        status: opp.stage || undefined,
        interestLevel: opp.interest_level || undefined,
        notes: opp.notes || undefined,
        assignedTo: getUserName(opp.assigned_to || undefined),
        projectName: project?.name || undefined,
        metadata: {
          ...(opp.expected_value && { expected_value: `SAR ${opp.expected_value.toLocaleString()}` }),
          ...(opp.expected_close_date && { expected_close: opp.expected_close_date }),
        },
      });
    });

    // Add stage change activities
    if (clientActivities) {
      clientActivities
        .filter(activity => activity.activity_type === 'stage_change')
        .forEach(activity => {
          const opportunity = opportunities.find(o => o.id === activity.opportunity_id);
          const project = projects.find(p => p.id === activity.project_id || p.id === opportunity?.project_id);
          
          events.push({
            id: `activity-${activity.id}`,
            type: 'stage_change',
            date: activity.activity_date,
            title: activity.summary || 'Stage changed',
            description: activity.notes || undefined,
            notes: activity.notes || undefined,
            assignedTo: getUserName(activity.assigned_to || activity.created_by || undefined),
            opportunityName: opportunity?.name || undefined,
            projectName: project?.name || undefined,
          });
        });
    }
    
    // Sort by date descending
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [profileData, opportunities, projects, teamMembers, clientActivities]);

  // Handler for adding opportunity (use old dialog only when not starting from conversation)
  const handleAddOpportunity = () => {
    if (!actualClientId) {
      toast.error('Client not loaded yet');
      return;
    }
    if (projects.length === 0) {
      toast.info('Create a project first', {
        description: 'Opportunities must be linked to a project. Please add a project first.',
      });
      setProjectDialogOpen(true);
    } else {
      setOpportunityDialogOpen(true);
    }
  };

  // Handler for starting opportunity conversation (primary CTA)
  const handleStartConversation = () => {
    if (!actualClientId) {
      toast.error('Client not loaded yet');
      return;
    }
    if (projects.length === 0) {
      toast.info('Create a project first', {
        description: 'You need a project before starting an opportunity conversation.',
      });
      setProjectDialogOpen(true);
    } else {
      setStartConversationDialogOpen(true);
    }
  };

  // Handler for adding project
  const handleAddProject = () => {
    if (!actualClientId) {
      toast.error('Client not loaded yet');
      return;
    }
    setProjectDialogOpen(true);
  };

  // Handler for adding opportunity from project card
  const handleAddOpportunityForProject = (projectId: string) => {
    setSelectedProjectForOpportunity(projectId);
    setStartConversationDialogOpen(true);
  };

  // Handler for starting conversation on specific opportunity
  const handleStartConversationForOpportunity = (opportunityId: string, opportunityName: string) => {
    setConversationOpportunity({ id: opportunityId, name: opportunityName });
    setStartConversationDialogOpen(true);
  };

  // Handler for creating order
  const handleCreateOrder = (opportunityId: string) => {
    const opp = opportunities.find(o => o.id === opportunityId);
    if (opp) {
      setSelectedOpportunityForOrder({ id: opp.id, name: opp.name });
      setOrderDialogOpen(true);
    }
  };

  // Handler for viewing opportunity details
  const handleViewOpportunity = (opportunity: any) => {
    // For now, this could open a detail modal - keeping simple for MVP
    toast.info(`Viewing ${opportunity.name}`);
  };

  // Helper to auto-create a communication_log entry if none exists
  const autoCreateCommunicationEntry = async (): Promise<any | null> => {
    if (!actualClientId || !profileData) return null;

    // Get client info
    const { data: clientData } = await supabase
      .from('clients')
      .select('company_name, primary_contact_name, primary_contact_phone, city, district')
      .eq('id', actualClientId)
      .single();

    if (!clientData) return null;

    // Create auto-generated communication_log entry
    const { data: commLog, error } = await supabase
      .from('communication_log')
      .insert({
        client_id: actualClientId,
        company_name: clientData.company_name,
        person_name: clientData.primary_contact_name || null,
        contact_info: clientData.primary_contact_phone || null,
        city: clientData.city || null,
        district: clientData.district || null,
        communication_channels: 'Phone',
        summary: 'Initial Contact (Auto-created)',
        topic: 'Initial Contact',
        notes: 'Auto-created to enable follow-up tracking.',
        communication_date: new Date().toISOString(),
        status: 'Open',
      })
      .select()
      .single();

    if (error) {
      console.error('Error auto-creating communication:', error);
      return null;
    }

    // Refresh profile data to include the new entry
    refresh();
    return commLog;
  };

  // Handler for adding follow-up - check if first contact and show appropriate dialog
  const handleAddQuickFollowUp = async () => {
    if (!actualClientId) {
      toast.error('Client not loaded yet');
      return;
    }
    
    // Check if this is the first contact (no communications exist)
    const isFirstContact = !profileData || profileData.communications.length === 0;
    
    if (isFirstContact) {
      // No communications exist - this is first contact, show Initial Conversation dialog
      setStartConversationDialogOpen(true);
      return;
    }
    
    // Not first contact - show normal follow-up dialog with latest communication
    const latestComm = profileData.communications[0];
    const { data } = await supabase
      .from('communication_log')
      .select('*')
      .eq('id', latestComm.id)
      .maybeSingle();
    
    if (data) {
      setFollowUpCommunication(data);
      setFollowUpDialogOpen(true);
    }
  };

  // Handler for editing follow-up from activity feed
  const handleEditFollowUpFromFeed = async (followUpId: string, communicationLogId: string) => {
    // Fetch the communication for the dialog
    const { data: comm } = await supabase
      .from('communication_log')
      .select('*')
      .eq('id', communicationLogId)
      .maybeSingle();

    // Fetch the follow-up data
    const { data: followUp } = await supabase
      .from('follow_up_history')
      .select('*')
      .eq('id', followUpId)
      .maybeSingle();

    if (comm && followUp) {
      setFollowUpCommunication(comm);
      setEditingFollowUp(followUp);
      setFollowUpDialogOpen(true);
    }
  };

  // Handler for editing initial conversation from activity feed
  const handleEditInitialConversationFromFeed = async (communicationLogId: string) => {
    const { data: comm } = await supabase
      .from('communication_log')
      .select('*')
      .eq('id', communicationLogId)
      .maybeSingle();

    if (comm) {
      setEditingInitialConversation(comm);
      setStartConversationDialogOpen(true);
    }
  };
  const handleAddFollowUpForOpportunity = async (opportunityId: string) => {
    // First, try to find a communication linked to this opportunity
    const { data: oppComm } = await supabase
      .from('communication_log')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('communication_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (oppComm) {
      setFollowUpCommunication(oppComm);
      setFollowUpDialogOpen(true);
      return;
    }

    // If no communication for this opportunity, try latest communication for client
    if (profileData && profileData.communications.length > 0) {
      const latestComm = profileData.communications[0];
      const { data } = await supabase
        .from('communication_log')
        .select('*')
        .eq('id', latestComm.id)
        .maybeSingle();
      
      if (data) {
        setFollowUpCommunication(data);
        setFollowUpDialogOpen(true);
        return;
      }
    }

    // No communications exist - auto-create one
    toast.info('Creating initial contact record...');
    const newComm = await autoCreateCommunicationEntry();
    
    if (newComm) {
      setFollowUpCommunication(newComm);
      setFollowUpDialogOpen(true);
      toast.success('Initial contact record created');
    } else {
      toast.error('Failed to create initial contact record');
    }
  };

  // Follow-ups are always allowed now - auto-create if needed
  const canAddFollowUp = true;

  return (
    <Layout>
      {/* Container with max-width and proper padding */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Back Button - Floating */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/clients')}
          className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {loading ? (
          <div className="space-y-6">
            {/* Header Skeleton */}
            <Card className="overflow-hidden">
              <div className="h-32 bg-gradient-to-r from-primary/20 to-primary/5" />
              <div className="px-6 pb-6">
                <div className="flex items-end gap-4 -mt-10">
                  <Skeleton className="h-24 w-24 rounded-2xl" />
                  <div className="flex-1 pt-4 space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </div>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-64 w-full" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-32" />
              </div>
            </div>
          </div>
        ) : error ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Error Loading Profile</h3>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button variant="outline" onClick={() => {
                if (window.history.length > 1) navigate(-1);
                else navigate('/clients');
              }}>
                Go Back
              </Button>
            </div>
          </Card>
        ) : !profileData ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Client Not Found</h3>
              <p className="text-muted-foreground mb-6">No client data found for "{decodedClientId}"</p>
              <Button variant="outline" onClick={() => {
                if (window.history.length > 1) navigate(-1);
                else navigate('/clients');
              }}>
                Go Back
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Profile Header - Flat Compact Style */}
            <Card className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Avatar */}
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground text-xl sm:text-2xl font-bold shadow-md shrink-0">
                  {getInitials(profileData.companyName)}
                </div>
                
                {/* Name, Tags, and Quick Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h1 className="text-xl sm:text-2xl font-bold truncate">{profileData.companyName}</h1>
                    {profileData.isReturningClient ? (
                      <Badge className="bg-primary/15 text-primary border-primary/25 shrink-0">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Returning
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 shrink-0">
                        <Sparkles className="h-3 w-3 mr-1" />
                        New
                      </Badge>
                    )}
                    {/* Overall Interest Badge - computed from active opportunities */}
                    <OverallInterestBadge level={overallInterest} />
                  </div>
                  
                  {/* Quick Info Row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {/* Primary contact - prefer client_contacts, fallback to legacy */}
                    {(primaryContact || profileData.personNames.length > 0) && (
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {primaryContact?.contact_name || profileData.personNames[0]}
                      </span>
                    )}
                    {(primaryContact || profileData.contactInfo.length > 0) && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {primaryContact?.phone || profileData.contactInfo[0]}
                      </span>
                    )}
                    {(profileData.cities.length > 0 || profileData.districts.length > 0) && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {[...profileData.cities, ...profileData.districts].filter(Boolean).slice(0, 2).join(', ')}
                      </span>
                    )}
                    {profileData.categories.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5" />
                        {profileData.categories[0]}
                      </span>
                    )}
                    {/* Contacts Link */}
                    <button
                      onClick={() => setContactsDialogOpen(true)}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span className="underline underline-offset-2">View Contacts</span>
                    </button>
                  </div>
                </div>
                
                {/* CTA Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Primary CTA: Start Opportunity Conversation - show when needed */}
                  {needsConversation && (
                    <Button onClick={handleStartConversation} size="sm" className="gap-1.5 bg-primary">
                      <PlayCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Add Opportunity</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                  )}
                  
                  {/* Add Project button */}
                  <Button onClick={() => setProjectDialogOpen(true)} variant="outline" size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Project</span>
                    <span className="sm:hidden">Project</span>
                  </Button>
                  
                  {/* Secondary actions - only show Add Follow-up when allowed */}
                  {canAddFollowUp && (
                    <Button onClick={handleAddQuickFollowUp} variant="outline" size="sm" className="gap-1.5">
                      <CalendarClock className="h-4 w-4" />
                      <span className="hidden sm:inline">Add Follow-up</span>
                    </Button>
                  )}
                  
                  {/* Edit Client Button */}
                  {actualClientId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditClientDialogOpen(true)}
                      className="gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Main Feed */}
              <div className="lg:col-span-2 space-y-6">
                {/* Tabs - Timeline Primary */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full grid grid-cols-5 sm:inline-flex sm:w-auto">
                    <TabsTrigger value="timeline" className="gap-1.5">
                      <Activity className="h-4 w-4" />
                      <span className="hidden sm:inline">Timeline</span>
                    </TabsTrigger>
                    <TabsTrigger value="projects" className="gap-1.5">
                      <Briefcase className="h-4 w-4" />
                      <span className="hidden sm:inline">Projects</span>
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs hidden sm:inline-flex">
                        {projects.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="opportunities" className="gap-1.5">
                      <Target className="h-4 w-4" />
                      <span className="hidden sm:inline">Opportunities</span>
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs hidden sm:inline-flex">
                        {opportunities.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="deals" className="gap-1.5">
                      <Handshake className="h-4 w-4" />
                      <span className="hidden sm:inline">Deals</span>
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="gap-1.5">
                      <ListTodo className="h-4 w-4" />
                      <span className="hidden sm:inline">Tasks</span>
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs hidden sm:inline-flex">
                        {profileData.followUpStats.pending}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>

                  {/* Timeline Tab (Primary) */}
                  <TabsContent value="timeline" className="mt-4">
                    <Card>
                      <CardContent className="p-4 sm:p-6">
                        <ClientActivityFeed 
                          events={activityEvents} 
                          onEditFollowUp={handleEditFollowUpFromFeed}
                          onEditInitialConversation={handleEditInitialConversationFromFeed}
                          onRefresh={refresh}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Projects Tab */}
                  <TabsContent value="projects" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-medium">Projects</CardTitle>
                          <Button size="sm" onClick={handleAddProject} className="gap-1.5">
                            <Plus className="h-4 w-4" />
                            Add Projectddddddddddddd
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        {projectsLoading ? (
                          <div className="p-6 space-y-3">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                          </div>
                        ) : projects.length === 0 ? (
                          <div className="p-12 text-center">
                            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                              <Briefcase className="h-7 w-7 text-muted-foreground" />
                            </div>
                            <h3 className="font-medium mb-1">No projects yet</h3>
                            <p className="text-sm text-muted-foreground mb-4">Add a project to start tracking opportunities.</p>
                            <Button size="sm" onClick={handleAddProject}>
                              <Plus className="h-4 w-4 mr-1" />
                              Add Project
                            </Button>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead>Project Name</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Size</TableHead>
                                  <TableHead>Phase</TableHead>
                                  <TableHead>Location</TableHead>
                                  <TableHead className="text-center">Opportunities</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="w-[60px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {projects.map((project) => (
                                  <TableRow 
                                    key={project.id} 
                                    className="group cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => {
                                      setSelectedProject(project);
                                      setProjectDetailsOpen(true);
                                    }}
                                  >
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-2">
                                        {project.name}
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {project.project_type ? (
                                        <Badge variant="outline">{project.project_type}</Badge>
                                      ) : '-'}
                                    </TableCell>
                                    <TableCell>
                                      {project.project_size ? (
                                        <Badge variant="secondary">{project.project_size}</Badge>
                                      ) : '-'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {project.current_phase || '-'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {[project.city, project.district].filter(Boolean).join(', ') || '-'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant={project.opportunities_count > 0 ? 'default' : 'secondary'}>
                                        {project.opportunities_count}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={cn(
                                        project.status === 'Active' && 'text-green-600 border-green-500/30',
                                        project.status === 'Completed' && 'text-blue-600 border-blue-500/30',
                                        project.status === 'On Hold' && 'text-amber-600 border-amber-500/30'
                                      )}>
                                        {project.status || 'Active'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setSelectedProject(project);
                                              setEditProjectDialogOpen(true);
                                            }}
                                            className="gap-2"
                                          >
                                            <Pencil className="h-4 w-4" />
                                            Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={async () => {
                                              const newStatus = project.status === 'Completed' ? 'Active' : 'Completed';
                                              await supabase
                                                .from('projects')
                                                .update({ status: newStatus })
                                                .eq('id', project.id);
                                              refreshProjects();
                                              toast.success(`Project ${newStatus === 'Completed' ? 'closed' : 'reopened'}`);
                                            }}
                                            className="gap-2"
                                          >
                                            {project.status === 'Completed' ? (
                                              <>
                                                <PlayCircle className="h-4 w-4" />
                                                Reopen
                                              </>
                                            ) : (
                                              <>
                                                <CheckCircle2 className="h-4 w-4" />
                                                Close Project
                                              </>
                                            )}
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setProjectToDelete(project);
                                              setDeleteProjectDialogOpen(true);
                                            }}
                                            className="gap-2 text-destructive focus:text-destructive"
                                          >
                                            <Trash2 className="h-4 w-4" />
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
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Opportunities Tab */}
                  <TabsContent value="opportunities" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-medium">Opportunities</CardTitle>
                          <Button size="sm" onClick={handleAddOpportunity} className="gap-1.5">
                            <Plus className="h-4 w-4" />
                            Add Opportunity
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        {oppsLoading ? (
                          <div className="p-6 space-y-3">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                          </div>
                        ) : opportunities.length === 0 ? (
                          <div className="p-12 text-center">
                            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                              <Target className="h-7 w-7 text-muted-foreground" />
                            </div>
                            <h3 className="font-medium mb-1">No opportunities yet</h3>
                            <p className="text-sm text-muted-foreground">Click "Add Opportunity" above to start tracking sales.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead>Opportunity</TableHead>
                                  <TableHead>Project</TableHead>
                                  <TableHead>Pipeline</TableHead>
                                  <TableHead>Interest</TableHead>
                                  <TableHead className="min-w-[200px]">Stage</TableHead>
                                  <TableHead className="w-[60px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {opportunities.map((opp) => {
                                  const stages = ['Discovery', 'RFP', 'Closed'];
                                  const currentStage = opp.stage || 'Discovery';
                                  const isClosed = currentStage.startsWith('Closed') || opp.is_closed;
                                  const displayStage = isClosed ? 'Closed' : currentStage;
                                  // Use opp.won field for determining Won/Lost status
                                  const closedResult = isClosed ? (opp.won === true ? 'Won' : opp.won === false ? 'Lost' : null) : null;
                                  const isLocked = opp.is_deal || opp.is_locked;
                                  const isNotInterested = opp.interest_level === 'Not interested';
                                  const isDisabled = isLocked || isNotInterested;
                                  
                                  const handleStageClick = async (stage: string) => {
                                    // Don't allow stage changes on locked or not interested opportunities
                                    if (isDisabled) {
                                      if (isNotInterested) {
                                        toast.info('Stages disabled', {
                                          description: 'No stages for "Not interested" opportunities.',
                                        });
                                      } else {
                                        toast.info('This opportunity is locked', {
                                          description: 'Converted deals cannot be modified.',
                                        });
                                      }
                                      return;
                                    }
                                    
                                    if (stage === 'Closed') {
                                      // Open simple close dialog for Won/Lost selection
                                      setSelectedOpportunityForClose(opp);
                                      setCloseOpportunityDialogOpen(true);
                                      return;
                                    }
                                    if (stage === 'RFP') {
                                      // Open RFP details dialog
                                      setSelectedOpportunityForRFP(opp);
                                      setRfpDialogOpen(true);
                                      return;
                                    }
                                    await supabase.from('opportunities').update({ 
                                      stage: stage,
                                      is_closed: false,
                                      won: null
                                    }).eq('id', opp.id);
                                    refreshOpportunities();
                                  };
                                  
                                  return (
                                    <TableRow key={opp.id} className="group">
                                      <TableCell className="font-medium">
                                        <span className="font-medium">{opp.name}</span>
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">{opp.project_name || '-'}</TableCell>
                                      <TableCell>
                                        {opp.in_pipeline ? (
                                          <Badge className="bg-primary/10 text-primary border-primary/30">
                                            In Pipeline
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-muted-foreground">
                                            Cold Lead
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <InterestLevelEditCell
                                          value={opp.interest_level || 'Not set'}
                                          onSave={async (newValue) => {
                                            await supabase
                                              .from('opportunities')
                                              .update({ interest_level: newValue })
                                              .eq('id', opp.id);
                                            refreshOpportunities();
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-1">
                                          {stages.map((stage, idx) => {
                                            const isActive = displayStage === stage;
                                            const isPast = stages.indexOf(displayStage) > idx;
                                            
                                            const stageStyles: Record<string, { active: string; inactive: string }> = {
                                              'Discovery': {
                                                active: 'bg-blue-500 text-white border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]',
                                                inactive: 'bg-transparent text-blue-600 border-blue-300 hover:bg-blue-50'
                                              },
                                              'RFP': {
                                                active: 'bg-amber-500 text-white border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]',
                                                inactive: 'bg-transparent text-amber-600 border-amber-300 hover:bg-amber-50'
                                              },
                                              'Closed': {
                                                active: closedResult === 'Won' 
                                                  ? 'bg-green-500 text-white border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]' 
                                                  : 'bg-red-500 text-white border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]',
                                                inactive: 'bg-transparent text-muted-foreground border-border hover:bg-muted'
                                              }
                                            };
                                            
                                            const style = stageStyles[stage];
                                            const displayLabel = stage === 'Closed' && closedResult ? `${closedResult}` : stage;
                                            
                                            return (
                                              <button
                                                key={stage}
                                                onClick={() => handleStageClick(stage)}
                                                disabled={isDisabled}
                                                className={cn(
                                                  "px-3 py-1 text-xs font-medium rounded-full border transition-all",
                                                  isDisabled 
                                                    ? "cursor-not-allowed bg-muted/50 text-muted-foreground border-muted opacity-50" 
                                                    : "cursor-pointer",
                                                  !isDisabled && (isActive ? style.active : style.inactive),
                                                  !isDisabled && isPast && !isActive && "opacity-50"
                                                )}
                                              >
                                                {displayLabel}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <OpportunityActionsMenu
                                          opportunity={{
                                            ...opp,
                                            client_id: actualClientId || '',
                                            project_id: opp.project_id,
                                            has_initial_conversation: true,
                                          }}
                                          onEdit={() => {
                                            setSelectedOpportunityForEdit({
                                              ...opp,
                                              client_id: actualClientId || opp.client_id,
                                            });
                                            setEditOpportunityReadOnly(false);
                                            setEditOpportunityDialogOpen(true);
                                          }}
                                          onConvertToDeal={() => {
                                            setSelectedOpportunityForConversion({
                                              ...opp,
                                              client_id: actualClientId,
                                              project_id: opp.project_id,
                                            });
                                            setConvertToDealDialogOpen(true);
                                          }}
                                          onPreview={() => {
                                            setSelectedOpportunityForEdit({
                                              ...opp,
                                              client_id: actualClientId || opp.client_id,
                                            });
                                            setEditOpportunityReadOnly(true);
                                            setEditOpportunityDialogOpen(true);
                                          }}
                                          onAddFollowUp={async () => {
                                            // Find or create a communication linked to this opportunity
                                            const { data: existingComm } = await supabase
                                              .from('communication_log')
                                              .select('*')
                                              .eq('opportunity_id', opp.id)
                                              .order('created_at', { ascending: false })
                                              .limit(1)
                                              .maybeSingle();
                                            
                                            if (existingComm) {
                                              setFollowUpCommunication(existingComm);
                                              setFollowUpDialogOpen(true);
                                            } else {
                                              // Create a new communication for this opportunity
                                              const { data: newComm, error } = await supabase
                                                .from('communication_log')
                                                .insert({
                                                  client_id: actualClientId,
                                                  opportunity_id: opp.id,
                                                  project_id: opp.project_id,
                                                  company_name: profileData?.companyName,
                                                  summary: `Follow-up for ${opp.name}`,
                                                  status: 'Open',
                                                  communication_date: new Date().toISOString(),
                                                })
                                                .select()
                                                .single();
                                              
                                              if (newComm && !error) {
                                                setFollowUpCommunication(newComm);
                                                setFollowUpDialogOpen(true);
                                              } else {
                                                toast.error('Failed to create follow-up');
                                              }
                                            }
                                          }}
                                          onRefresh={refreshOpportunities}
                                        />
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Deals Tab */}
                  <TabsContent value="deals" className="mt-4">
                    <ClientDealsTab clientId={actualClientId} />
                  </TabsContent>

                  {/* Tasks Tab */}
                  <TabsContent value="tasks" className="mt-4 space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-medium">Follow-ups & Tasks</CardTitle>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center border rounded-lg p-0.5">
                              <Button 
                                size="sm" 
                                variant={tasksViewMode === 'kanban' ? 'default' : 'ghost'}
                                onClick={() => setTasksViewMode('kanban')}
                                className="h-7 px-2.5 gap-1.5"
                              >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                Kanban
                              </Button>
                              <Button 
                                size="sm" 
                                variant={tasksViewMode === 'table' ? 'default' : 'ghost'}
                                onClick={() => setTasksViewMode('table')}
                                className="h-7 px-2.5 gap-1.5"
                              >
                                <List className="h-3.5 w-3.5" />
                                Table
                              </Button>
                            </div>
                            <Button size="sm" variant="outline" onClick={handleAddQuickFollowUp} className="gap-1.5">
                              <Plus className="h-4 w-4" />
                              Add Follow-up
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                    {profileData.followUps.length === 0 ? (
                      <Card>
                        <CardContent className="p-12 text-center">
                          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                            <ListTodo className="h-7 w-7 text-muted-foreground" />
                          </div>
                          <h3 className="font-medium mb-1">No follow-ups yet</h3>
                          <p className="text-sm text-muted-foreground">Follow-ups and tasks will appear here.</p>
                        </CardContent>
                      </Card>
                    ) : tasksViewMode === 'kanban' ? (
                      <FollowUpKanban 
                        followUps={profileData.followUps}
                        onUpdate={refresh}
                      />
                    ) : (
                      <Card>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead>Date</TableHead>
                                  <TableHead>Action</TableHead>
                                  <TableHead>Channel</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Client Response</TableHead>
                                  <TableHead className="w-[80px]">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {profileData.followUps.map((fu) => (
                                  <FollowUpTableRow 
                                    key={fu.id} 
                                    followUp={fu}
                                    onUpdate={refresh}
                                  />
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right Column - Sticky Summary */}
              <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
                {/* Stats Card */}
                <Card className="overflow-hidden border-border/50 shadow-sm">
                  <CardHeader className="pb-2 bg-gradient-to-br from-muted/30 to-transparent">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      </div>
                      Client Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 pb-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="group relative p-3 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10 hover:border-primary/20 transition-colors">
                        <p className="text-2xl font-bold text-primary">{profileData.totalInteractions}</p>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Interactions</p>
                      </div>
                      <div className="group relative p-3 rounded-lg bg-gradient-to-br from-green-500/5 to-green-500/10 border border-green-500/10 hover:border-green-500/20 transition-colors">
                        <p className="text-2xl font-bold text-green-600">{profileData.dealsClosedCount}</p>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Deals Closed</p>
                      </div>
                      <div className="group relative p-3 rounded-lg bg-gradient-to-br from-amber-500/5 to-amber-500/10 border border-amber-500/10 hover:border-amber-500/20 transition-colors">
                        <p className="text-2xl font-bold text-amber-600">
                          {profileData.followUpStats.completed}/{profileData.followUpStats.total}
                        </p>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Follow-ups</p>
                      </div>
                      <div className="group relative p-3 rounded-lg bg-gradient-to-br from-blue-500/5 to-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 transition-colors">
                        <p className="text-2xl font-bold text-blue-600">{profileData.conversionRate}%</p>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Conversion</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline Card */}
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-1 pb-4">
                    {profileData.firstInteractionDate && (
                      <div className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                        <span className="text-xs text-muted-foreground">First Contact</span>
                        <span className="text-xs font-medium">
                          {format(new Date(profileData.firstInteractionDate), 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}
                    {profileData.lastInteractionDate && (
                      <div className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                        <span className="text-xs text-muted-foreground">Last Activity</span>
                        <span className="text-xs font-medium">
                          {formatDistanceToNow(new Date(profileData.lastInteractionDate), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    {profileData.followUpStats.pending > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-amber-500/5">
                          <span className="text-xs text-amber-600 flex items-center gap-1.5 font-medium">
                            <Clock className="h-3 w-3" />
                            Pending Follow-ups
                          </span>
                          <Badge variant="outline" className="h-5 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                            {profileData.followUpStats.pending}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Contact Details Card */}
                {(profileData.personNames.length > 0 || profileData.contactInfo.length > 0) && (
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                          <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          Contacts
                        </CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setActiveTab('contacts')}
                          className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                          Edit
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-1 pb-4">
                      {profileData.personNames.map((name, i) => (
                        <div key={i} className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium">{name}</span>
                        </div>
                      ))}
                      {profileData.contactInfo.map((info, i) => (
                        <div key={i} className="flex items-center gap-2 py-1 px-2 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{info}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}

        {/* Dialogs */}
        <CommunicationDialog
          open={commDialogOpen}
          onOpenChange={(open) => {
            setCommDialogOpen(open);
            if (!open) {
              setInitialClientData(null);
              setSelectedCommunication(null);
            }
          }}
          communication={selectedCommunication}
          initialClientData={initialClientData}
          onSave={() => {
            refresh();
            setInitialClientData(null);
            setSelectedCommunication(null);
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
            clientId={actualClientId}
            onSaved={() => {
              refresh();
              setEditingFollowUp(null);
            }}
            editingFollowUp={editingFollowUp}
          />
        )}

        {actualClientId && (
          <>
            {actualClientId && (
              <ProjectDialog
                open={projectDialogOpen}
                onOpenChange={setProjectDialogOpen}
                clientId={actualClientId}
                clientName={profileData?.companyName || ''}
                onSuccess={() => {
                  refreshProjects();
                  refresh();
                }}
                onCreate={createProject}
              />
            )}

            {actualClientId && (
              <OpportunityDialog
                open={opportunityDialogOpen}
                onOpenChange={setOpportunityDialogOpen}
                clientId={actualClientId}
                clientName={profileData?.companyName || ''}
                onSuccess={() => {
                  refreshOpportunities();
                  refresh();
                }}
                onCreate={createOpportunity}
              />
            )}

            <ProjectDetailsDialog
              open={projectDetailsOpen}
              onOpenChange={setProjectDetailsOpen}
              project={selectedProject}
              onProjectUpdated={(updatedProject) => {
                setSelectedProject(updatedProject);
                refreshProjects();
              }}
            />

            {actualClientId && (
              <StartOpportunityConversationDialog
                open={startConversationDialogOpen}
                onOpenChange={(open) => {
                  setStartConversationDialogOpen(open);
                  if (!open) setEditingInitialConversation(null);
                }}
                clientId={actualClientId}
                clientName={profileData?.companyName || ''}
                onSuccess={() => {
                  refreshOpportunities();
                  refresh();
                  setEditingInitialConversation(null);
                }}
                editingConversation={editingInitialConversation}
              />
            )}

            <EditClientDialog
              open={editClientDialogOpen}
              onOpenChange={setEditClientDialogOpen}
              client={clientData}
              onSuccess={async () => {
                refresh();
                // Refetch client data
                const { data } = await supabase
                  .from('clients')
                  .select('*')
                  .eq('id', actualClientId)
                  .maybeSingle();
                if (data) setClientData(data);
              }}
            />

            {selectedOpportunityForOrder && (
              <CreateOrderDialog
                open={orderDialogOpen}
                onOpenChange={setOrderDialogOpen}
                opportunityId={selectedOpportunityForOrder.id}
                opportunityName={selectedOpportunityForOrder.name}
                onSuccess={() => {
                  refreshOpportunities();
                  refreshProjectsWithOpps();
                  refresh();
                  setSelectedOpportunityForOrder(null);
                }}
              />
            )}

            <EditOpportunityDialog
              open={editOpportunityDialogOpen}
              onOpenChange={(open) => {
                setEditOpportunityDialogOpen(open);
                if (!open) {
                  setSelectedOpportunityForEdit(null);
                  setEditOpportunityReadOnly(false);
                }
              }}
              opportunity={selectedOpportunityForEdit}
              onSuccess={() => {
                refreshOpportunities();
                refetchActivities();
                refresh();
              }}
              readOnly={editOpportunityReadOnly}
            />

            <RFPDetailsDialog
              open={rfpDialogOpen}
              onOpenChange={(open) => {
                setRfpDialogOpen(open);
                if (!open) setSelectedOpportunityForRFP(null);
              }}
              opportunity={selectedOpportunityForRFP}
              onSuccess={() => {
                refreshOpportunities();
                refresh();
              }}
            />
          </>
        )}

        {/* Close Opportunity Dialog */}
        {selectedOpportunityForClose && (
          <CloseOpportunityDialog
            open={closeOpportunityDialogOpen}
            onOpenChange={(open) => {
              setCloseOpportunityDialogOpen(open);
              if (!open) setSelectedOpportunityForClose(null);
            }}
            opportunityName={selectedOpportunityForClose.name}
            onClose={async (result) => {
              await supabase.from('opportunities').update({
                stage: `Closed ${result}`,
                is_closed: true,
                won: result === 'Won',
                closed_at: new Date().toISOString(),
              }).eq('id', selectedOpportunityForClose.id);
              toast.success(`Opportunity marked as ${result}`);
              setCloseOpportunityDialogOpen(false);
              setSelectedOpportunityForClose(null);
              refreshOpportunities();
              refresh();
            }}
          />
        )}

        {/* Convert to Deal Dialog */}
        {selectedOpportunityForConversion && (
          <ConvertToDealDialog
            open={convertToDealDialogOpen}
            onOpenChange={(open) => {
              setConvertToDealDialogOpen(open);
              if (!open) setSelectedOpportunityForConversion(null);
            }}
            opportunity={selectedOpportunityForConversion}
            onSuccess={() => {
              refreshOpportunities();
              refresh();
            }}
          />
        )}

        {/* Contacts Dialog */}
        <Dialog open={contactsDialogOpen} onOpenChange={setContactsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Contacts
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <ClientContactsSection 
                clientId={actualClientId}
                legacyPersonNames={profileData?.personNames || []}
                legacyContactInfo={profileData?.contactInfo || []}
                hideHeader
                initialContactName={clientData?.primary_contact_name}
                initialContactPhone={clientData?.primary_contact_phone}
                onInitialContactMigrated={() => {
                  fetchClientData();
                  fetchPrimaryContact();
                }}
                onContactsChanged={fetchPrimaryContact}
              />
            </DialogBody>
          </DialogContent>
        </Dialog>

        {/* Edit Project Dialog */}
        {selectedProject && (
          <EditProjectDialog
            open={editProjectDialogOpen}
            onOpenChange={setEditProjectDialogOpen}
            project={selectedProject}
            onSuccess={refreshProjects}
          />
        )}

        {/* Edit Client Dialog */}
        {clientData && (
          <EditClientDialog
            open={editClientDialogOpen}
            onOpenChange={setEditClientDialogOpen}
            client={clientData}
            onSuccess={() => {
              fetchClientData();
              refresh();
            }}
          />
        )}

        {/* Delete Project Confirmation Dialog */}
        <AlertDialog open={deleteProjectDialogOpen} onOpenChange={setDeleteProjectDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{projectToDelete?.name}"? This will also delete all associated opportunities. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (projectToDelete) {
                    // First delete related opportunities
                    await supabase.from('opportunities').delete().eq('project_id', projectToDelete.id);
                    // Then delete the project
                    await supabase.from('projects').delete().eq('id', projectToDelete.id);
                    refreshProjects();
                    refreshOpportunities();
                    toast.success('Project deleted');
                    setProjectToDelete(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default ClientProfile;

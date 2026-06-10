import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface OpportunityWithConversation {
  id: string;
  name: string;
  stage: string;
  project_id: string;
  project_name?: string;
  has_initial_conversation: boolean;
}

export interface InitialConversationInput {
  opportunity_id: string;
  client_id: string;
  project_id: string;
  channel: string;
  summary: string;
  materials_requested?: string;
  outcome?: string;
  next_step?: string;
  interest_level?: string;
}

// Fetch opportunities with their initial conversation status
export const useOpportunitiesWithConversation = (clientId: string | null) => {
  return useQuery({
    queryKey: ['opportunities', 'with-conversation', clientId],
    queryFn: async (): Promise<OpportunityWithConversation[]> => {
      if (!clientId) return [];

      // Fetch opportunities
      const { data: opportunities, error: oppError } = await supabase
        .from('opportunities')
        .select(`
          id,
          name,
          stage,
          project_id,
          projects:project_id (name)
        `)
        .eq('client_id', clientId)
        .eq('is_closed', false)
        .order('created_at', { ascending: false });

      if (oppError) throw oppError;

      // Get opportunity IDs
      const oppIds = opportunities?.map(o => o.id) || [];
      
      if (oppIds.length === 0) {
        return [];
      }

      // Fetch activities that are initial conversations
      const { data: initialConversations, error: actError } = await supabase
        .from('activities')
        .select('opportunity_id')
        .in('opportunity_id', oppIds)
        .eq('activity_type', 'initial_conversation');

      if (actError) throw actError;

      const oppsWithConvo = new Set(initialConversations?.map(a => a.opportunity_id) || []);

      return (opportunities || []).map(opp => ({
        id: opp.id,
        name: opp.name,
        stage: opp.stage || 'Discovery',
        project_id: opp.project_id,
        project_name: (opp.projects as any)?.name,
        has_initial_conversation: oppsWithConvo.has(opp.id),
      }));
    },
    enabled: !!clientId,
  });
};

// Check if client needs initial conversation CTA
export const useNeedsInitialConversation = (clientId: string | null) => {
  const { data: opportunities, isLoading } = useOpportunitiesWithConversation(clientId);
  
  // Show CTA if:
  // 1. No opportunities exist
  // 2. OR any opportunity doesn't have an initial conversation
  const needsConversation = !opportunities || opportunities.length === 0 || 
    opportunities.some(opp => !opp.has_initial_conversation);
  
  const opportunitiesWithoutConversation = opportunities?.filter(o => !o.has_initial_conversation) || [];
  
  return {
    needsConversation,
    opportunitiesWithoutConversation,
    hasNoOpportunities: !opportunities || opportunities.length === 0,
    isLoading,
  };
};

// Create initial conversation
export const useCreateInitialConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InitialConversationInput) => {
      const { data: user } = await supabase.auth.getUser();
      
      const activityNotes = [
        input.materials_requested && `Materials Requested: ${input.materials_requested}`,
        input.outcome && `Outcome: ${input.outcome}`,
        input.next_step && `Next Step: ${input.next_step}`,
      ].filter(Boolean).join('\n\n');

      // First, get the client's company name for the communication_log entry
      const { data: clientData } = await supabase
        .from('clients')
        .select('company_name, primary_contact_name, primary_contact_phone, city, district')
        .eq('id', input.client_id)
        .single();

      // Create a communication_log entry so follow-ups can be attached
      const { data: commLog, error: commError } = await supabase
        .from('communication_log')
        .insert({
          client_id: input.client_id,
          opportunity_id: input.opportunity_id,
          project_id: input.project_id,
          company_name: clientData?.company_name || 'Unknown',
          person_name: clientData?.primary_contact_name || null,
          contact_info: clientData?.primary_contact_phone || null,
          city: clientData?.city || null,
          district: clientData?.district || null,
          communication_channels: input.channel,
          summary: input.summary,
          topic: 'Initial Conversation',
          notes: activityNotes || null,
          interest_level: input.interest_level || null,
          communication_date: new Date().toISOString(),
          status: 'Open',
          owner_id: user?.user?.id || null,
          assigned_to: null,
        })
        .select()
        .single();

      if (commError) throw commError;

      // Also create an activity record for the new activities system
      const { data, error } = await supabase
        .from('activities')
        .insert({
          client_id: input.client_id,
          opportunity_id: input.opportunity_id,
          project_id: input.project_id,
          activity_type: 'initial_conversation',
          channel: input.channel,
          summary: input.summary,
          notes: activityNotes || null,
          interest_level: input.interest_level || null,
          activity_date: new Date().toISOString(),
          created_by: user?.user?.id || null,
          legacy_communication_id: commLog.id,
        })
        .select()
        .single();

      if (error) throw error;
      return { activity: data, communicationLog: commLog };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['communication_log'] });
      toast.success('Initial conversation recorded');
    },
    onError: (error: Error) => {
      toast.error('Failed to create conversation', { description: error.message });
    },
  });
};

// Create opportunity with initial conversation (2-step flow)
export const useCreateOpportunityWithConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      clientId: string;
      projectId: string;
      assignedTo?: string;
      channel: string;
      summary: string;
      materials_requested?: string;
      outcome?: string;
      next_step?: string;
      interest_level?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();

      // Get client details for communication_log
      const { data: clientData } = await supabase
        .from('clients')
        .select('company_name, primary_contact_name, primary_contact_phone, city, district')
        .eq('id', input.clientId)
        .single();

      // Step 1: Get existing deals count for this project to generate name
      const { count } = await supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', input.projectId);

      const dealNumber = (count || 0) + 1;
      const dealName = `Deal ${String(dealNumber).padStart(2, '0')}`;

      // Step 2: Create opportunity
      const { data: opportunity, error: oppError } = await supabase
        .from('opportunities')
        .insert({
          client_id: input.clientId,
          project_id: input.projectId,
          name: dealName,
          stage: 'Discovery',
          assigned_to: input.assignedTo || null,
          is_closed: false,
        })
        .select()
        .single();

      if (oppError) throw oppError;

      // Step 3: Create initial conversation activity notes
      const activityNotes = [
        input.materials_requested && `Materials Requested: ${input.materials_requested}`,
        input.outcome && `Outcome: ${input.outcome}`,
        input.next_step && `Next Step: ${input.next_step}`,
      ].filter(Boolean).join('\n\n');

      // Create a communication_log entry so follow-ups can be attached
      const { data: commLog, error: commError } = await supabase
        .from('communication_log')
        .insert({
          client_id: input.clientId,
          opportunity_id: opportunity.id,
          project_id: input.projectId,
          company_name: clientData?.company_name || 'Unknown',
          person_name: clientData?.primary_contact_name || null,
          contact_info: clientData?.primary_contact_phone || null,
          city: clientData?.city || null,
          district: clientData?.district || null,
          communication_channels: input.channel,
          summary: input.summary,
          topic: 'Initial Conversation',
          notes: activityNotes || null,
          interest_level: input.interest_level || null,
          communication_date: new Date().toISOString(),
          status: 'Open',
          owner_id: user?.user?.id || null,
          assigned_to: input.assignedTo || null,
        })
        .select()
        .single();

      if (commError) throw commError;

      // Also create an activity record
      const { data: activity, error: actError } = await supabase
        .from('activities')
        .insert({
          client_id: input.clientId,
          opportunity_id: opportunity.id,
          project_id: input.projectId,
          activity_type: 'initial_conversation',
          channel: input.channel,
          summary: input.summary,
          notes: activityNotes || null,
          interest_level: input.interest_level || null,
          activity_date: new Date().toISOString(),
          created_by: user?.user?.id || null,
          legacy_communication_id: commLog.id,
        })
        .select()
        .single();

      if (actError) throw actError;

      return { opportunity, activity, communicationLog: commLog };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['communication_log'] });
      toast.success('Opportunity created with initial conversation');
    },
    onError: (error: Error) => {
      toast.error('Failed to create opportunity', { description: error.message });
    },
  });
};

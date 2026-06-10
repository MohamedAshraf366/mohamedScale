import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface ClientCommunication {
  id: string;
  communication_date: string;
  communication_channels: string | null;
  topic: string | null;
  summary: string | null;
  interest_level: string | null;
  status: string | null;
  follow_up_date: string | null;
  assigned_to: string | null;
  person_name: string | null;
  contact_info: string | null;
  category: string | null;
  city: string | null;
  district: string | null;
  quotation_required: boolean | null;
  is_soft_quotation: boolean | null;
  deal_completed: boolean | null;
  deal_value_total: number | null;
  deal_closed_at: string | null;
  project_type: string | null;
  project_size: string | null;
  current_phase: string | null;
  deal_project_name: string | null;
  other_projects: string | null;
}

interface ClientQuotation {
  id: string;
  communication_date: string;
  is_soft_quotation: boolean | null;
  deal_value_total: number | null;
  status: string | null;
  deal_completed: boolean | null;
  deal_closed_at: string | null;
  interest_level: string | null;
}

interface FollowUpStats {
  total: number;
  completed: number;
  pending: number;
}

interface FollowUpRecord {
  id: string;
  communication_log_id: string;
  follow_up_date: string;
  action: string | null;
  notes: string | null;
  outcome: string | null;
  follow_up_channel: string | null;
  status_after: string | null;
  client_response: string | null;
  user_id: string | null;
  opportunity_id: string | null;
  project_id: string | null;
  created_at: string;
}

interface ClientProfileData {
  companyName: string;
  personNames: string[];
  contactInfo: string[];
  categories: string[];
  cities: string[];
  districts: string[];
  firstInteractionDate: string | null;
  lastInteractionDate: string | null;
  totalInteractions: number;
  isReturningClient: boolean;
  communications: ClientCommunication[];
  quotations: ClientQuotation[];
  followUps: FollowUpRecord[];
  followUpStats: FollowUpStats;
  dealsClosedCount: number;
  conversionRate: number;
  hasOpenQuotation: boolean;
}

export function useClientProfile(companyNameOrIdOrPhone: string | null) {
  const [profileData, setProfileData] = useState<ClientProfileData | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClientProfile = useCallback(async () => {
    if (!companyNameOrIdOrPhone) {
      setProfileData(null);
      setClientId(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if the input looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyNameOrIdOrPhone);
      
      let clientRecord: any = null;
      let companyName: string | null = null;

      // If it's a UUID, first fetch the client by ID
      if (isUUID) {
        const { data: clientById, error: clientByIdError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', companyNameOrIdOrPhone)
          .maybeSingle();
        
        if (clientByIdError) throw clientByIdError;
        
        if (clientById) {
          clientRecord = clientById;
          companyName = clientById.company_name;
        }
      }

      // Determine the search term - use company name if we found a client by ID
      const searchTerm = companyName || companyNameOrIdOrPhone;

      // Fetch all communications for this client (by company name or contact info)
      const { data: communications, error: commError } = await supabase
        .from('communication_log')
        .select('*')
        .or(`company_name.ilike.%${searchTerm}%,contact_info.ilike.%${searchTerm}%`)
        .order('communication_date', { ascending: false });

      if (commError) throw commError;

      // If no communications found, check the clients table for newly created clients
      if (!communications || communications.length === 0) {
        // If we already found a client by ID, use that data
        if (clientRecord) {
          setClientId(clientRecord.id);
          setProfileData({
            companyName: clientRecord.company_name,
            personNames: clientRecord.primary_contact_name ? [clientRecord.primary_contact_name] : [],
            contactInfo: clientRecord.primary_contact_phone ? [clientRecord.primary_contact_phone] : [],
            categories: [],
            cities: clientRecord.city ? [clientRecord.city] : [],
            districts: clientRecord.district ? [clientRecord.district] : [],
            firstInteractionDate: clientRecord.created_at,
            lastInteractionDate: clientRecord.created_at,
            totalInteractions: 0,
            isReturningClient: false,
            communications: [],
            quotations: [],
            followUps: [],
            followUpStats: { total: 0, completed: 0, pending: 0 },
            dealsClosedCount: 0,
            conversionRate: 0,
            hasOpenQuotation: false,
          });
          setLoading(false);
          return;
        }

        // Try to find by company name
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .ilike('company_name', searchTerm)
          .maybeSingle();

        if (clientError) throw clientError;

        // If we found a client in the clients table, return profile data for that client
        if (clientData) {
          setClientId(clientData.id);
          setProfileData({
            companyName: clientData.company_name,
            personNames: clientData.primary_contact_name ? [clientData.primary_contact_name] : [],
            contactInfo: clientData.primary_contact_phone ? [clientData.primary_contact_phone] : [],
            categories: [],
            cities: clientData.city ? [clientData.city] : [],
            districts: clientData.district ? [clientData.district] : [],
            firstInteractionDate: clientData.created_at,
            lastInteractionDate: clientData.created_at,
            totalInteractions: 0,
            isReturningClient: false,
            communications: [],
            quotations: [],
            followUps: [],
            followUpStats: { total: 0, completed: 0, pending: 0 },
            dealsClosedCount: 0,
            conversionRate: 0,
            hasOpenQuotation: false,
          });
          setLoading(false);
          return;
        }

        setClientId(null);
        setProfileData(null);
        setLoading(false);
        return;
      }

      // If we don't have a client record yet, fetch it by company name
      if (!clientRecord) {
        const { data: fetchedClient } = await supabase
          .from('clients')
          .select('id, city, district, company_name')
          .ilike('company_name', `%${searchTerm}%`)
          .maybeSingle();
        clientRecord = fetchedClient;
        
        // Set clientId immediately when found
        if (fetchedClient?.id) {
          setClientId(fetchedClient.id);
        }
      }

      // Fetch opportunities for this client to calculate deals stats
      let opportunitiesData: { id: string; is_deal: boolean; is_closed: boolean; won: boolean | null }[] = [];
      if (clientRecord?.id) {
        const { data: oppsData } = await supabase
          .from('opportunities')
          .select('id, is_deal, is_closed, won')
          .eq('client_id', clientRecord.id);
        opportunitiesData = oppsData || [];
      }

      // Extract unique values
      const personNames = [...new Set(communications.map(c => c.person_name).filter(Boolean))] as string[];
      const contactInfoList = [...new Set(communications.map(c => c.contact_info).filter(Boolean))] as string[];
      const categories = [...new Set(communications.map(c => c.category).filter(Boolean))] as string[];
      
      // Prioritize client's head office location from clients table
      const cities = clientRecord?.city ? [clientRecord.city] : [];
      const districts = clientRecord?.district ? [clientRecord.district] : [];

      // Get primary company name (most common)
      const companyNameCounts: Record<string, number> = {};
      communications.forEach(c => {
        if (c.company_name) {
          const normalized = c.company_name.trim().toLowerCase();
          companyNameCounts[normalized] = (companyNameCounts[normalized] || 0) + 1;
        }
      });
      const primaryCompanyName = Object.entries(companyNameCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || searchTerm;

      // Get all communication IDs for follow-up stats
      const commIds = communications.map(c => c.id);

      // Fetch follow-ups with full details for activity feed
      const { data: followUpsData, error: fuError } = await supabase
        .from('follow_up_history')
        .select('id, communication_log_id, follow_up_date, action, notes, outcome, follow_up_channel, status_after, client_response, user_id, opportunity_id, project_id, created_at')
        .in('communication_log_id', commIds)
        .order('follow_up_date', { ascending: false });

      if (fuError) throw fuError;

      const followUps: FollowUpRecord[] = (followUpsData || []).map(f => ({
        id: f.id,
        communication_log_id: f.communication_log_id,
        follow_up_date: f.follow_up_date,
        action: f.action,
        notes: f.notes,
        outcome: f.outcome,
        follow_up_channel: f.follow_up_channel,
        status_after: f.status_after,
        client_response: f.client_response,
        user_id: f.user_id,
        opportunity_id: f.opportunity_id,
        project_id: f.project_id,
        created_at: f.created_at,
      }));

      const followUpStats: FollowUpStats = {
        total: followUps.length,
        completed: followUps.filter(f => f.status_after === 'Closed' || f.status_after === 'Done').length,
        pending: followUps.filter(f => f.status_after === 'Open').length,
      };

      // Calculate quotations (communications with interest level or quotation required)
      const quotations = communications
        .filter(c => c.quotation_required || ['High', 'Medium', 'Low'].includes(c.interest_level || ''))
        .map(c => ({
          id: c.id,
          communication_date: c.communication_date,
          is_soft_quotation: c.is_soft_quotation,
          deal_value_total: c.deal_value_total,
          status: c.status,
          deal_completed: c.deal_completed,
          deal_closed_at: c.deal_closed_at,
          interest_level: c.interest_level,
        }));

      // Calculate stats from opportunities (new system)
      const totalOpportunities = opportunitiesData.length;
      const dealsClosedCount = opportunitiesData.filter(o => o.is_deal === true && o.won === true).length;
      const totalInteractions = communications.length;
      const conversionRate = totalOpportunities > 0 
        ? Math.round((dealsClosedCount / totalOpportunities) * 100) 
        : 0;

      // Determine if returning client (more than 1 interaction OR last interaction > 30 days ago)
      const lastInteractionDate = communications[0]?.communication_date;
      const daysSinceLastInteraction = lastInteractionDate 
        ? Math.floor((Date.now() - new Date(lastInteractionDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const isReturningClient = totalInteractions > 1 || daysSinceLastInteraction > 30;

      // Check for open quotations
      const hasOpenQuotation = quotations.some(q => !q.deal_completed && q.status !== 'Closed');

      // Find the actual company name from the first communication
      const actualCompanyName = communications.find(c => c.company_name)?.company_name || searchTerm;

      // Set client ID if we have a record
      if (clientRecord?.id) {
        setClientId(clientRecord.id);
      }

      setProfileData({
        companyName: actualCompanyName,
        personNames,
        contactInfo: contactInfoList,
        categories,
        cities,
        districts,
        firstInteractionDate: communications[communications.length - 1]?.communication_date || null,
        lastInteractionDate: communications[0]?.communication_date || null,
        totalInteractions,
        isReturningClient,
        communications,
        quotations,
        followUps,
        followUpStats,
        dealsClosedCount,
        conversionRate,
        hasOpenQuotation,
      });
    } catch (err) {
      console.error('Error fetching client profile:', err);
      setError('Failed to load client profile');
    } finally {
      setLoading(false);
    }
  }, [companyNameOrIdOrPhone]);

  useEffect(() => {
    fetchClientProfile();
  }, [fetchClientProfile]);

  return {
    profileData,
    clientId,
    loading,
    error,
    refresh: fetchClientProfile,
  };
}

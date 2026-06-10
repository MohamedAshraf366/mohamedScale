import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isInPipeline, isColdLead } from '@/lib/pipelineUtils';
import { calculateOverallInterest } from '@/lib/clientInterestUtils';
import { logAudit } from '@/lib/auditLogger';

export interface ClientSegment {
  id: string;
  name: string;
  color: string | null;
}

export interface ClientData {
  id: string;
  company_name: string;
  segment_id: string | null;
  segment_name: string | null;
  segment_color: string | null;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  city: string | null;
  district: string | null;
  interest_level: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Aggregated data
  active_opportunities: number;
  open_follow_ups: number;
  last_activity_date: string | null;
  last_activity_type: string | null;
  total_communications: number;
  total_projects: number;
  // Flag to track if this is a real client or legacy data
  is_legacy: boolean;
  // Pipeline classification (computed from interest_level)
  is_in_pipeline: boolean;
  is_cold_lead: boolean;
  // Computed: Overall Interest Level based on active opportunities
  overall_interest_level: string;
}

export interface ProjectData {
  id: string;
  client_id: string;
  name: string;
  project_type: string | null;
  project_size: string | null;
  current_phase: string | null;
  city: string | null;
  district: string | null;
  location: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  opportunities_count: number;
}

export interface OpportunityData {
  id: string;
  project_id: string;
  client_id: string;
  project_name: string | null;
  name: string;
  stage: string | null;
  interest_level: string | null;
  expected_value: number | null;
  expected_close_date: string | null;
  is_closed: boolean;
  won: boolean | null;
  closed_at: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  in_pipeline: boolean;
  is_deal: boolean | null;
  is_locked: boolean | null;
  deal_id: string | null;
}

export const useClients = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [segments, setSegments] = useState<ClientSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch segments
      const { data: segmentsData } = await supabase
        .from('client_segments')
        .select('*');
      
      setSegments(segmentsData || []);
      
      // Fetch all profiles for name resolution
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email');
      
      const profileMap = new Map<string, string>();
      (profilesData || []).forEach((profile: any) => {
        const displayName = profile.full_name || profile.email || profile.id;
        profileMap.set(profile.id, displayName);
      });
      
      // First, check if clients table has data
      const { data: existingClients, error: clientsError } = await supabase
        .from('clients')
        .select(`
          *,
          client_segments(name, color)
        `);
      
      if (clientsError) throw clientsError;
      
      // Fetch ALL communications (both linked and legacy)
      const { data: commsData } = await supabase
        .from('communication_log')
        .select('*')
        .order('communication_date', { ascending: false });
      
      // Get follow-ups
      const { data: followUps } = await supabase
        .from('follow_up_history')
        .select('communication_log_id, status_after')
        .in('status_after', ['Open', 'In Follow-up']);
      
      // Get projects count per client
      const { data: projectCounts } = await supabase
        .from('projects')
        .select('client_id');
      
      // Get opportunities with interest levels per client
      const { data: oppData } = await supabase
        .from('opportunities')
        .select('client_id, is_closed, interest_level');
      
      // Build a unified list: start with clients from new table
      const clientMap = new Map<string, ClientData>();
      
      // Add clients from the clients table
      (existingClients || []).forEach((client: any) => {
        const key = client.company_name?.trim().toLowerCase();
        if (!key) return;
        
        // Get communications for this client (by client_id OR matching company_name)
        const clientComms = (commsData || []).filter((c: any) => 
          c.client_id === client.id || 
          c.company_name?.trim().toLowerCase() === key
        );
        
        const clientOpps = (oppData || []).filter((o: any) => o.client_id === client.id) || [];
        const clientProjects = (projectCounts || []).filter((p: any) => p.client_id === client.id) || [];
        
        // Get open follow-ups for this client's communications
        const commIds = clientComms.map((c: any) => c.id);
        const openFollowUps = (followUps || []).filter((f: any) => commIds.includes(f.communication_log_id)) || [];
        
        const lastComm = clientComms[0];
        
        // Calculate overall interest level from active opportunities
        const overallInterest = calculateOverallInterest(clientOpps);
        
        clientMap.set(key, {
          id: client.id,
          company_name: client.company_name,
          segment_id: client.segment_id,
          segment_name: client.client_segments?.name || null,
          segment_color: client.client_segments?.color || null,
          primary_contact_name: client.primary_contact_name,
          primary_contact_phone: client.primary_contact_phone,
          city: client.city,
          district: client.district,
          interest_level: client.interest_level,
          assigned_to: client.assigned_to ? (profileMap.get(client.assigned_to) || client.assigned_to) : null,
          notes: client.notes,
          created_at: client.created_at,
          updated_at: client.updated_at,
          active_opportunities: clientOpps.filter((o: any) => !o.is_closed).length,
          open_follow_ups: openFollowUps.length,
          last_activity_date: lastComm?.communication_date || null,
          last_activity_type: lastComm?.communication_channels || null,
          total_communications: clientComms.length,
          total_projects: clientProjects.length,
          is_legacy: false,
          is_in_pipeline: isInPipeline(client.interest_level),
          is_cold_lead: isColdLead(client.interest_level),
          overall_interest_level: overallInterest,
        });
      });
      
      // Now add any legacy communications that don't have a matching client
      (commsData || []).forEach((comm: any) => {
        const companyName = comm.company_name?.trim().toLowerCase();
        if (!companyName) return;
        
        // Skip if we already have this client
        if (clientMap.has(companyName)) return;
        
        // Get all communications for this company
        const companyComms = (commsData || []).filter((c: any) => 
          c.company_name?.trim().toLowerCase() === companyName
        );
        
        // Get open follow-ups for this company's communications
        const commIdsForCompany = companyComms.map((c: any) => c.id);
        const openFollowUps = (followUps || []).filter((f: any) => 
          commIdsForCompany.includes(f.communication_log_id)
        );
        
        // Find highest interest level
        let bestInterest: string | null = null;
        const levels = ['High', 'Medium', 'Low', 'Not interested'];
        companyComms.forEach((c: any) => {
          const idx = levels.indexOf(c.interest_level || '');
          const bestIdx = levels.indexOf(bestInterest || '');
          if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) {
            bestInterest = c.interest_level;
          }
        });
        
        const latestComm = companyComms[0];
        const activeOpps = companyComms.filter((c: any) => c.quotation_required).length;
        const projectCount = new Set(companyComms.filter((c: any) => c.project_type).map((c: any) => c.project_type)).size;
        
        clientMap.set(companyName, {
          id: latestComm.id, // Use latest comm ID as pseudo-client ID
          company_name: latestComm.company_name,
          segment_id: null,
          segment_name: null,
          segment_color: null,
          primary_contact_name: latestComm.person_name,
          primary_contact_phone: latestComm.contact_info,
          city: latestComm.city,
          district: latestComm.district,
          interest_level: bestInterest,
          assigned_to: latestComm.assigned_to ? (profileMap.get(latestComm.assigned_to) || latestComm.assigned_to) : null,
          notes: null,
          created_at: latestComm.created_at,
          updated_at: latestComm.updated_at,
          active_opportunities: activeOpps,
          open_follow_ups: openFollowUps.length,
          last_activity_date: latestComm.communication_date,
          last_activity_type: latestComm.communication_channels,
          total_communications: companyComms.length,
          total_projects: projectCount,
          is_legacy: true,
          // Legacy clients: always treat as in-pipeline to preserve existing behavior
          is_in_pipeline: true,
          is_cold_lead: false,
          // Legacy clients: derive overall interest from bestInterest (no opportunities)
          overall_interest_level: bestInterest || 'Not set',
        });
      });
      
      setClients(Array.from(clientMap.values()));
    } catch (err: any) {
      console.error('Error fetching clients:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const createClient = async (data: Partial<ClientData>) => {
    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        company_name: data.company_name,
        segment_id: data.segment_id,
        primary_contact_name: data.primary_contact_name,
        primary_contact_phone: data.primary_contact_phone,
        city: data.city,
        district: data.district,
        interest_level: data.interest_level,
        assigned_to: data.assigned_to,
        notes: data.notes,
      })
      .select()
      .single();
    
    if (error) throw error;
    await fetchClients();
    return newClient;
  };

  const updateClient = async (id: string, data: Partial<ClientData>) => {
    const { error } = await supabase
      .from('clients')
      .update({
        company_name: data.company_name,
        segment_id: data.segment_id,
        primary_contact_name: data.primary_contact_name,
        primary_contact_phone: data.primary_contact_phone,
        city: data.city,
        district: data.district,
        interest_level: data.interest_level,
        assigned_to: data.assigned_to,
        notes: data.notes,
      })
      .eq('id', id);
    
    if (error) throw error;
    await fetchClients();
  };

  const deleteClient = async (id: string, clientData?: ClientData) => {
    const clientName = clientData?.company_name || 'Unknown Client';
    const isLegacy = clientData?.is_legacy || false;
    
    if (isLegacy) {
      // For legacy clients, delete by company name from communication_log
      const companyName = clientData.company_name;
      
      // Get all communication_log IDs for this company
      const { data: comms } = await supabase
        .from('communication_log')
        .select('id')
        .ilike('company_name', companyName);
      
      const commIds = (comms || []).map(c => c.id);
      
      if (commIds.length > 0) {
        // Delete follow_up_history entries
        await supabase
          .from('follow_up_history')
          .delete()
          .in('communication_log_id', commIds);
        
        // Delete activities linked to these communications
        await supabase
          .from('activities')
          .delete()
          .in('legacy_communication_id', commIds);
        
        // Delete communication_log entries
        await supabase
          .from('communication_log')
          .delete()
          .in('id', commIds);
      }
      
      // Log audit for legacy client deletion
      await logAudit({
        action: 'deleted',
        module: 'Clients',
        recordId: id,
        recordName: `${clientName} (Legacy)`,
        oldValues: { company_name: clientName, is_legacy: true, communications_deleted: commIds.length },
        description: `Legacy client "${clientName}" deleted with ${commIds.length} communication records`,
      });
    } else {
      // For real clients, delete related data first, then the client
      // Delete activities
      await supabase.from('activities').delete().eq('client_id', id);
      
      // Get projects to delete opportunities
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('client_id', id);
      
      const projectIds = (projects || []).map(p => p.id);
      
      // Get opportunity IDs for cleaning up references
      let opportunityIds: string[] = [];
      if (projectIds.length > 0) {
        const { data: opps } = await supabase
          .from('opportunities')
          .select('id')
          .in('project_id', projectIds);
        opportunityIds = (opps || []).map(o => o.id);
      }
      
      // Delete operations_orders that reference this client/projects/opportunities
      // (must be deleted before the referenced records)
      await supabase.from('operations_orders').delete().eq('client_id', id);
      
      // Delete opportunity_materials before opportunities
      if (opportunityIds.length > 0) {
        await supabase.from('opportunity_materials').delete().in('opportunity_id', opportunityIds);
      }
      
      // Get communication_log IDs for this client
      const { data: clientComms } = await supabase
        .from('communication_log')
        .select('id')
        .eq('client_id', id);
      
      const commIds = (clientComms || []).map(c => c.id);
      
      // Delete follow_up_history entries for this client's communications
      if (commIds.length > 0) {
        await supabase
          .from('follow_up_history')
          .delete()
          .in('communication_log_id', commIds);
      }
      
      // Clear FK references in communication_log BEFORE deleting the referenced records
      if (opportunityIds.length > 0) {
        await supabase
          .from('communication_log')
          .update({ opportunity_id: null })
          .in('opportunity_id', opportunityIds);
      }
      
      if (projectIds.length > 0) {
        await supabase
          .from('communication_log')
          .update({ project_id: null })
          .in('project_id', projectIds);
      }
      
      // Delete communication_log entries for this client (not just nullify)
      await supabase
        .from('communication_log')
        .delete()
        .eq('client_id', id);
      
      // Now delete opportunities and projects
      if (projectIds.length > 0) {
        await supabase.from('opportunities').delete().in('project_id', projectIds);
        await supabase.from('projects').delete().in('id', projectIds);
      }
      
      // Delete client contacts
      await supabase.from('client_contacts').delete().eq('client_id', id);
      
      // Delete the client
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      
      // Log audit for client deletion
      await logAudit({
        action: 'deleted',
        module: 'Clients',
        recordId: id,
        recordName: clientName,
        oldValues: { 
          company_name: clientName, 
          projects_deleted: projectIds.length,
          opportunities_deleted: opportunityIds.length,
          communications_deleted: commIds.length 
        },
        description: `Client "${clientName}" deleted with ${projectIds.length} projects, ${opportunityIds.length} opportunities`,
      });
    }
    
    await fetchClients();
  };

  const deleteClients = async (ids: string[], clientsList: ClientData[]) => {
    for (const id of ids) {
      const client = clientsList.find(c => c.id === id);
      if (client) {
        await deleteClient(id, client);
      }
    }
    
    await fetchClients();
    return { deletedCount: ids.length };
  };

  return {
    clients,
    segments,
    loading,
    error,
    refresh: fetchClients,
    createClient,
    updateClient,
    deleteClient,
    deleteClients,
  };
};

export interface ProjectWithOpportunities extends ProjectData {
  opportunities: OpportunityData[];
}

export const useClientProjects = (clientId: string | null) => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!clientId) {
      setProjects([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Get opportunities count per project
      const projectIds = (data || []).map(p => p.id);
      const { data: opps } = await supabase
        .from('opportunities')
        .select('project_id')
        .in('project_id', projectIds);
      
      const projectsWithCounts = (data || []).map(p => ({
        ...p,
        opportunities_count: (opps || []).filter(o => o.project_id === p.id).length,
      }));
      
      setProjects(projectsWithCounts);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (data: Partial<ProjectData>) => {
    if (!clientId) {
      throw new Error('Client ID is required to create a project');
    }
    
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        client_id: clientId,
        name: data.name,
        project_type: data.project_type,
        project_size: data.project_size,
        current_phase: data.current_phase,
        city: data.city,
        district: data.district,
        location: data.location,
        status: data.status || 'Active',
        notes: data.notes,
      })
      .select()
      .single();
    
    if (error) throw error;
    await fetchProjects();
    return newProject;
  };

  return {
    projects,
    loading,
    refresh: fetchProjects,
    createProject,
  };
};

// New hook: Fetch projects WITH nested opportunities (for hierarchy view)
export const useClientProjectsWithOpportunities = (clientId: string | null) => {
  const [projects, setProjects] = useState<ProjectWithOpportunities[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!clientId) {
      setProjects([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (projectsError) throw projectsError;
      
      // Fetch all opportunities for this client
      const { data: oppsData, error: oppsError } = await supabase
        .from('opportunities')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (oppsError) throw oppsError;
      
      // Check which opportunities have initial conversations
      const oppIds = (oppsData || []).map(o => o.id);
      const { data: activitiesData } = await supabase
        .from('activities')
        .select('opportunity_id')
        .in('opportunity_id', oppIds)
        .eq('activity_type', 'initial_conversation');
      
      const oppsWithInitialConvo = new Set((activitiesData || []).map(a => a.opportunity_id));
      
      // Build projects with nested opportunities
      const projectsWithOpportunities = (projectsData || []).map(project => {
        const projectOpps = (oppsData || [])
          .filter(o => o.project_id === project.id)
          .map(o => ({
            ...o,
            project_name: project.name,
            has_initial_conversation: oppsWithInitialConvo.has(o.id),
          }));
        
        return {
          ...project,
          opportunities_count: projectOpps.length,
          opportunities: projectOpps,
        };
      });
      
      setProjects(projectsWithOpportunities);
    } catch (err) {
      console.error('Error fetching projects with opportunities:', err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    loading,
    refresh: fetchProjects,
  };
};

export const useClientOpportunities = (clientId: string | null) => {
  const [opportunities, setOpportunities] = useState<OpportunityData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOpportunities = useCallback(async () => {
    if (!clientId) {
      setOpportunities([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          projects(name)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const oppsWithProject = (data || []).map((o: any) => ({
        ...o,
        project_name: o.projects?.name || null,
      }));
      
      setOpportunities(oppsWithProject);
    } catch (err) {
      console.error('Error fetching opportunities:', err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const createOpportunity = async (data: Partial<OpportunityData>) => {
    if (!clientId) {
      throw new Error('Client ID is required to create an opportunity');
    }
    
    const { data: newOpp, error } = await supabase
      .from('opportunities')
      .insert({
        project_id: data.project_id,
        client_id: clientId,
        name: data.name,
        stage: data.stage || 'Discovery',
        interest_level: data.interest_level,
        expected_value: data.expected_value,
        expected_close_date: data.expected_close_date,
        assigned_to: data.assigned_to,
        notes: data.notes,
      })
      .select()
      .single();
    
    if (error) throw error;
    await fetchOpportunities();
    return newOpp;
  };

  return {
    opportunities,
    loading,
    refresh: fetchOpportunities,
    createOpportunity,
  };
};

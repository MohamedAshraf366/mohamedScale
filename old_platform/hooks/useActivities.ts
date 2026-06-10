import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface Activity {
  id: string;
  client_id: string;
  opportunity_id: string | null;
  project_id: string | null;
  activity_type: string;
  channel: string | null;
  summary: string | null;
  notes: string | null;
  activity_date: string;
  created_by: string | null;
  assigned_to: string | null;
  interest_level: string | null;
  legacy_status: string | null;
  legacy_communication_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateActivityInput {
  client_id: string;
  opportunity_id?: string | null;
  project_id?: string | null;
  activity_type: string;
  channel?: string | null;
  summary?: string | null;
  notes?: string | null;
  activity_date?: string;
  created_by?: string | null;
  assigned_to?: string | null;
  interest_level?: string | null;
}

// Fetch activities for a specific client
export const useClientActivities = (clientId: string | null) => {
  return useQuery({
    queryKey: ['activities', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('client_id', clientId)
        .order('activity_date', { ascending: false });
      
      if (error) throw error;
      return data as Activity[];
    },
    enabled: !!clientId,
  });
};

// Fetch all activities
export const useAllActivities = () => {
  return useQuery({
    queryKey: ['activities', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          clients:client_id (company_name)
        `)
        .order('activity_date', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
  });
};

// Create activity mutation
export const useCreateActivity = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateActivityInput) => {
      const { data, error } = await supabase
        .from('activities')
        .insert({
          ...input,
          activity_date: input.activity_date || new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      toast.success('Activity added successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to add activity', { description: error.message });
    },
  });
};

// Migration utilities
export interface MigrationStats {
  totalCommunications: number;
  totalClients: number;
  totalActivities: number;
  migratedActivities: number;
  unmappedCommunications: number;
}

export const useMigrationStats = () => {
  return useQuery({
    queryKey: ['migration', 'stats'],
    queryFn: async (): Promise<MigrationStats> => {
      // Count legacy communications
      const { count: commCount, error: commError } = await supabase
        .from('communication_log')
        .select('*', { count: 'exact', head: true });
      
      if (commError) throw commError;
      
      // Count clients
      const { count: clientCount, error: clientError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });
      
      if (clientError) throw clientError;
      
      // Count activities
      const { count: activityCount, error: activityError } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true });
      
      if (activityError) throw activityError;
      
      // Count migrated activities (those with legacy_communication_id)
      const { count: migratedCount, error: migratedError } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .not('legacy_communication_id', 'is', null);
      
      if (migratedError) throw migratedError;
      
      // Count unmapped communications (no matching client)
      const { data: unmapped, error: unmappedError } = await supabase
        .from('communication_log')
        .select('id')
        .is('client_id', null);
      
      if (unmappedError) throw unmappedError;
      
      return {
        totalCommunications: commCount || 0,
        totalClients: clientCount || 0,
        totalActivities: activityCount || 0,
        migratedActivities: migratedCount || 0,
        unmappedCommunications: unmapped?.length || 0,
      };
    },
  });
};

// Run migration
export const useRunMigration = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Fetch all communications that haven't been migrated yet
      const { data: communications, error: commError } = await supabase
        .from('communication_log')
        .select('*')
        .order('communication_date', { ascending: true });
      
      if (commError) throw commError;
      
      // Check which communications are already migrated
      const { data: existingActivities, error: existingError } = await supabase
        .from('activities')
        .select('legacy_communication_id')
        .not('legacy_communication_id', 'is', null);
      
      if (existingError) throw existingError;
      
      const migratedIds = new Set(existingActivities?.map(a => a.legacy_communication_id) || []);
      const toMigrate = communications?.filter(c => !migratedIds.has(c.id)) || [];
      
      if (toMigrate.length === 0) {
        return { migrated: 0, created: 0 };
      }
      
      let migrated = 0;
      let clientsCreated = 0;
      
      for (const comm of toMigrate) {
        try {
          let clientId = comm.client_id;
          
          // If no client_id, try to find or create client
          if (!clientId && comm.company_name) {
            // Try to find existing client by company name
            const { data: existingClient } = await supabase
              .from('clients')
              .select('id')
              .ilike('company_name', comm.company_name.trim())
              .maybeSingle();
            
            if (existingClient) {
              clientId = existingClient.id;
            } else {
              // Create new client
              const { data: newClient, error: createError } = await supabase
                .from('clients')
                .insert({
                  company_name: comm.company_name.trim(),
                  primary_contact_name: comm.person_name,
                  primary_contact_phone: comm.contact_info,
                  city: comm.city,
                  district: comm.district,
                  interest_level: comm.interest_level,
                  assigned_to: comm.assigned_to,
                })
                .select('id')
                .single();
              
              if (!createError && newClient) {
                clientId = newClient.id;
                clientsCreated++;
              }
            }
          }
          
          // Only create activity if we have a client
          if (clientId) {
            const { error: activityError } = await supabase
              .from('activities')
              .insert({
                client_id: clientId,
                opportunity_id: comm.opportunity_id,
                project_id: comm.project_id,
                activity_type: 'communication',
                channel: comm.communication_channels,
                summary: [comm.topic, comm.summary].filter(Boolean).join(' - ') || 'Communication',
                notes: comm.notes,
                activity_date: comm.communication_date || comm.created_at,
                created_by: comm.owner_id,
                assigned_to: comm.assigned_to,
                interest_level: comm.interest_level,
                legacy_status: comm.status,
                legacy_communication_id: comm.id,
              });
            
            if (!activityError) {
              migrated++;
            }
          }
        } catch (err) {
          console.error('Error migrating communication:', comm.id, err);
        }
      }
      
      return { migrated, created: clientsCreated };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['migration'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Migration completed', {
        description: `Migrated ${data.migrated} activities, created ${data.created} clients`,
      });
    },
    onError: (error: Error) => {
      toast.error('Migration failed', { description: error.message });
    },
  });
};

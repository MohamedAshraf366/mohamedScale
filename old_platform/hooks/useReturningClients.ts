import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface CompanyCount {
  company_name: string;
  count: number;
}

interface PreviousInteraction {
  id: string;
  communication_date: string;
  communication_channels: string | null;
  summary: string | null;
}

export const useReturningClients = () => {
  const [companyCounts, setCompanyCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchCompanyCounts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('communication_log')
        .select('company_name');

      if (error) throw error;

      // Count occurrences of each company
      const counts: Record<string, number> = {};
      (data || []).forEach((row) => {
        if (row.company_name) {
          const normalized = row.company_name.trim().toLowerCase();
          counts[normalized] = (counts[normalized] || 0) + 1;
        }
      });

      setCompanyCounts(counts);
    } catch (error) {
      console.error('Error fetching company counts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanyCounts();
  }, [fetchCompanyCounts]);

  const getCompanyCount = useCallback((companyName: string | null): number => {
    if (!companyName) return 0;
    const normalized = companyName.trim().toLowerCase();
    return companyCounts[normalized] || 0;
  }, [companyCounts]);

  const isReturningClient = useCallback((companyName: string | null): boolean => {
    return getCompanyCount(companyName) > 1;
  }, [getCompanyCount]);

  const fetchPreviousInteractions = useCallback(async (
    companyName: string | null, 
    excludeId?: string
  ): Promise<PreviousInteraction[]> => {
    if (!companyName) return [];

    try {
      let query = supabase
        .from('communication_log')
        .select('id, communication_date, communication_channels, summary')
        .ilike('company_name', companyName.trim())
        .order('communication_date', { ascending: false })
        .limit(4); // Get 4 to exclude current if needed

      const { data, error } = await query;

      if (error) throw error;

      // Filter out the current communication and limit to 3
      return (data || [])
        .filter((item) => item.id !== excludeId)
        .slice(0, 3);
    } catch (error) {
      console.error('Error fetching previous interactions:', error);
      return [];
    }
  }, []);

  return {
    companyCounts,
    loading,
    getCompanyCount,
    isReturningClient,
    fetchPreviousInteractions,
    refresh: fetchCompanyCounts,
  };
};

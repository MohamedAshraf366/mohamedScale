import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface ClientData {
  company_name: string;
  person_name: string | null;
  contact_info: string | null;
  city: string | null;
  district: string | null;
  category: string | null;
}

interface CompanySuggestion {
  company_name: string;
  persons: Array<{
    person_name: string;
    contact_info: string | null;
  }>;
  city: string | null;
  district: string | null;
  category: string | null;
}

export function useClientSuggestions() {
  const [allClients, setAllClients] = useState<ClientData[]>([]);
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([]);
  const [personSuggestions, setPersonSuggestions] = useState<Array<{ person_name: string; contact_info: string | null }>>([]);
  const [selectedCompanyData, setSelectedCompanyData] = useState<CompanySuggestion | null>(null);
  const [isExistingClient, setIsExistingClient] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all unique clients on mount
  const fetchAllClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('communication_log')
        .select('company_name, person_name, contact_info, city, district, category')
        .not('company_name', 'is', null)
        .order('communication_date', { ascending: false });

      if (error) throw error;
      setAllClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllClients();
  }, [fetchAllClients]);

  // Get unique company suggestions based on search term
  const searchCompanies = useCallback((searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setCompanySuggestions([]);
      setIsExistingClient(false);
      return;
    }

    const lowerSearch = searchTerm.toLowerCase().trim();
    const uniqueCompanies = [...new Set(
      allClients
        .filter(c => c.company_name?.toLowerCase().includes(lowerSearch))
        .map(c => c.company_name)
    )].slice(0, 10);

    setCompanySuggestions(uniqueCompanies);

    // Check if exact match exists
    const exactMatch = allClients.some(
      c => c.company_name?.toLowerCase() === lowerSearch
    );
    setIsExistingClient(exactMatch);
  }, [allClients]);

  // Select a company and get its data
  const selectCompany = useCallback((companyName: string) => {
    const companyRecords = allClients.filter(
      c => c.company_name?.toLowerCase() === companyName.toLowerCase()
    );

    if (companyRecords.length === 0) {
      setSelectedCompanyData(null);
      setPersonSuggestions([]);
      setIsExistingClient(false);
      return null;
    }

    setIsExistingClient(true);

    // Get unique persons for this company
    const personsMap = new Map<string, { person_name: string; contact_info: string | null }>();
    companyRecords.forEach(record => {
      if (record.person_name && record.person_name.trim()) {
        const key = record.person_name.toLowerCase();
        if (!personsMap.has(key)) {
          personsMap.set(key, {
            person_name: record.person_name,
            contact_info: record.contact_info,
          });
        }
      }
    });

    const persons = Array.from(personsMap.values());
    setPersonSuggestions(persons);

    // Get the most recent record for auto-fill data
    const mostRecentRecord = companyRecords[0];
    
    const companyData: CompanySuggestion = {
      company_name: companyName,
      persons,
      city: mostRecentRecord?.city || null,
      district: mostRecentRecord?.district || null,
      category: mostRecentRecord?.category || null,
    };

    setSelectedCompanyData(companyData);
    return companyData;
  }, [allClients]);

  // Select a person and get their contact info
  const selectPerson = useCallback((personName: string) => {
    const person = personSuggestions.find(
      p => p.person_name.toLowerCase() === personName.toLowerCase()
    );
    return person || null;
  }, [personSuggestions]);

  // Reset suggestions
  const resetSuggestions = useCallback(() => {
    setCompanySuggestions([]);
    setPersonSuggestions([]);
    setSelectedCompanyData(null);
    setIsExistingClient(false);
  }, []);

  return {
    companySuggestions,
    personSuggestions,
    selectedCompanyData,
    isExistingClient,
    isLoading,
    searchCompanies,
    selectCompany,
    selectPerson,
    resetSuggestions,
    refreshClients: fetchAllClients,
  };
}

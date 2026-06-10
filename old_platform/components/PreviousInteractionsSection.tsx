import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock, MessageSquare } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';

interface PreviousInteraction {
  id: string;
  communication_date: string;
  communication_channels: string | null;
  summary: string | null;
}

interface PreviousInteractionsSectionProps {
  companyName: string | null;
  currentCommunicationId?: string;
}

export const PreviousInteractionsSection = ({ 
  companyName, 
  currentCommunicationId 
}: PreviousInteractionsSectionProps) => {
  const [interactions, setInteractions] = useState<PreviousInteraction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInteractions = async () => {
      if (!companyName) {
        setInteractions([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('communication_log')
          .select('id, communication_date, communication_channels, summary')
          .ilike('company_name', companyName.trim())
          .order('communication_date', { ascending: false })
          .limit(4);

        if (error) throw error;

        // Filter out current communication and limit to 3
        const filtered = (data || [])
          .filter((item) => item.id !== currentCommunicationId)
          .slice(0, 3);

        setInteractions(filtered);
      } catch (error) {
        console.error('Error fetching previous interactions:', error);
        setInteractions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchInteractions();
  }, [companyName, currentCommunicationId]);

  if (!companyName || interactions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
        <Clock className="h-4 w-4" />
        Previous Interactions
      </div>
      
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-2">
          {interactions.map((interaction) => (
            <div 
              key={interaction.id} 
              className="flex items-start gap-3 text-sm bg-background/50 rounded px-3 py-2"
            >
              <div className="flex-shrink-0 mt-0.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">
                    {format(new Date(interaction.communication_date), 'MMM dd, yyyy')}
                  </span>
                  {interaction.communication_channels && (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {interaction.communication_channels}
                    </span>
                  )}
                </div>
                {interaction.summary && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {interaction.summary}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

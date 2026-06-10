import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

interface FollowUpHistoryEntry {
  id: string;
  follow_up_date: string;
  status_after: string | null;
  notes: string | null;
  action: string | null;
  created_at: string;
  user_id: string;
}

interface CollapsibleFollowUpHistoryProps {
  communicationId: string;
}

const CollapsibleFollowUpHistory = ({ communicationId }: CollapsibleFollowUpHistoryProps) => {
  const [history, setHistory] = useState<FollowUpHistoryEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('follow_up_history')
        .select('*')
        .eq('communication_log_id', communicationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching follow-up history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, communicationId]);

  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-muted text-muted-foreground';
    switch (status) {
      case 'Open':
        return 'bg-accent/10 text-accent';
      case 'Follow-up':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'Closed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Follow-up History ({history.length})
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {loading ? (
          <div className="text-sm text-muted-foreground py-2">Loading...</div>
        ) : history.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2">No follow-up history yet.</div>
        ) : (
          <div className="space-y-3 border-l-2 border-border pl-4 ml-2">
            {history.map((entry) => (
              <div key={entry.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {format(new Date(entry.follow_up_date), 'MMM dd, yyyy')}
                  </span>
                  {entry.status_after && (
                    <Badge className={getStatusColor(entry.status_after)}>
                      {entry.status_after}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>
                {entry.action && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Action:</span> {entry.action}
                  </div>
                )}
                {entry.notes && (
                  <div className="text-sm text-foreground">
                    {entry.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default CollapsibleFollowUpHistory;

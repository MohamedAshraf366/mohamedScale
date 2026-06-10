import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { 
  Calendar, 
  User, 
  Phone, 
  MessageSquare, 
  Target, 
  Package,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface CommunicationRecord {
  id: string;
  communication_date: string;
  company_name: string;
  person_name: string | null;
  contact_info: string | null;
  communication_channels: string | null;
  topic: string | null;
  summary: string | null;
  status: string | null;
  interest_level: string | null;
  outcome_notes: string | null;
  quotation_required: boolean;
  category: string | null;
}

interface ClientHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
}

const getStatusColor = (status: string | null) => {
  switch (status) {
    case 'Closed':
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'In Follow-up':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'Open':
    default:
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  }
};

const getInterestColor = (level: string | null) => {
  switch (level) {
    case 'High':
      return 'bg-green-500/10 text-green-600';
    case 'Medium':
      return 'bg-amber-500/10 text-amber-600';
    case 'Low':
      return 'bg-orange-500/10 text-orange-600';
    case 'Not interested':
      return 'bg-red-500/10 text-red-600';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const ClientHistoryPanel = ({ open, onOpenChange, companyName }: ClientHistoryPanelProps) => {
  const [communications, setCommunications] = useState<CommunicationRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && companyName) {
      fetchClientHistory();
    }
  }, [open, companyName]);

  const fetchClientHistory = async () => {
    if (!companyName) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('communication_log')
        .select('*')
        .ilike('company_name', companyName)
        .order('communication_date', { ascending: false });

      if (error) throw error;
      setCommunications(data || []);
    } catch (error) {
      console.error('Error fetching client history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Client History
          </SheetTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Past communications with <span className="font-medium text-foreground">{companyName}</span>
          </p>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : communications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No previous communications found</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{communications.length}</p>
                  <p className="text-xs text-muted-foreground">Total Contacts</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {communications.filter(c => c.status === 'Closed').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Closed</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">
                    {communications.filter(c => c.quotation_required).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Quotations</p>
                </div>
              </div>

              <Separator />

              {/* Timeline */}
              <div className="space-y-4">
                {communications.map((comm, index) => (
                  <div 
                    key={comm.id} 
                    className="relative pl-6 pb-4 border-l-2 border-muted last:border-transparent"
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-primary" />
                    
                    <div className="bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {comm.communication_date ? 
                            format(new Date(comm.communication_date), 'MMM d, yyyy') : 
                            'No date'
                          }
                        </div>
                        <Badge variant="outline" className={getStatusColor(comm.status)}>
                          {comm.status || 'Open'}
                        </Badge>
                      </div>

                      {/* Person & Contact */}
                      {(comm.person_name || comm.contact_info) && (
                        <div className="flex flex-wrap gap-3 mb-2 text-sm">
                          {comm.person_name && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                              {comm.person_name}
                            </span>
                          )}
                          {comm.contact_info && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              {comm.contact_info}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Channel */}
                      {comm.communication_channels && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {comm.communication_channels}
                        </div>
                      )}

                      {/* Category */}
                      {comm.category && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                          <Package className="h-3.5 w-3.5" />
                          {comm.category}
                        </div>
                      )}

                      {/* Interest Level */}
                      {comm.interest_level && (
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge variant="secondary" className={getInterestColor(comm.interest_level)}>
                            {comm.interest_level}
                          </Badge>
                        </div>
                      )}

                      {/* Summary/Outcome */}
                      {(comm.summary || comm.outcome_notes) && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {comm.outcome_notes || comm.summary}
                          </p>
                        </div>
                      )}

                      {/* Quotation indicator */}
                      {comm.quotation_required && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                          <CheckCircle2 className="h-3 w-3" />
                          Quotation Required
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default ClientHistoryPanel;

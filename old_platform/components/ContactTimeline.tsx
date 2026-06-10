import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { 
  MessageSquare, 
  CalendarCheck, 
  CheckCircle2, 
  Clock, 
  FileText,
  Phone,
  Mail,
  Users,
  X
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface TimelineEvent {
  id: string;
  type: 'communication' | 'follow_up' | 'status_change' | 'deal_closed';
  date: string;
  title: string;
  description?: string;
  status?: string;
  channel?: string;
  assignedTo?: string;
  notes?: string;
}

interface ContactTimelineProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
}

const ContactTimeline = ({ open, onOpenChange, companyName }: ContactTimelineProps) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCommunications: 0,
    totalFollowUps: 0,
    dealsCompleted: 0,
    lastContact: ''
  });

  useEffect(() => {
    if (open && companyName) {
      fetchTimelineData();
    }
  }, [open, companyName]);

  const fetchTimelineData = async () => {
    setLoading(true);
    try {
      // Fetch all communications for this company
      const { data: communications } = await supabase
        .from('communication_log')
        .select('*')
        .eq('company_name', companyName)
        .order('communication_date', { ascending: false });

      // Fetch all follow-ups for this company's communications
      const commIds = communications?.map(c => c.id) || [];
      const { data: followUps } = await supabase
        .from('follow_up_history')
        .select('*')
        .in('communication_log_id', commIds)
        .order('follow_up_date', { ascending: false });

      // Build timeline events
      const timelineEvents: TimelineEvent[] = [];

      // Add communication events
      communications?.forEach(comm => {
        timelineEvents.push({
          id: `comm-${comm.id}`,
          type: comm.deal_completed ? 'deal_closed' : 'communication',
          date: comm.communication_date,
          title: comm.topic || 'Communication',
          description: comm.summary,
          status: comm.status,
          channel: comm.communication_channels,
          assignedTo: comm.assigned_to,
          notes: comm.notes
        });
      });

      // Add follow-up events
      followUps?.forEach(fu => {
        timelineEvents.push({
          id: `fu-${fu.id}`,
          type: fu.status_after === 'Closed' ? 'status_change' : 'follow_up',
          date: fu.follow_up_date,
          title: fu.action || 'Follow-up',
          description: fu.notes,
          status: fu.status_after
        });
      });

      // Sort by date descending
      timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setEvents(timelineEvents);

      // Calculate stats
      const dealsCompleted = communications?.filter(c => c.deal_completed).length || 0;
      const lastContact = communications?.[0]?.communication_date || '';

      setStats({
        totalCommunications: communications?.length || 0,
        totalFollowUps: followUps?.length || 0,
        dealsCompleted,
        lastContact
      });
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string, channel?: string) => {
    if (channel) {
      if (channel.toLowerCase().includes('phone')) return Phone;
      if (channel.toLowerCase().includes('email')) return Mail;
      if (channel.toLowerCase().includes('meeting')) return Users;
    }
    
    switch (type) {
      case 'communication':
        return MessageSquare;
      case 'follow_up':
        return CalendarCheck;
      case 'status_change':
        return Clock;
      case 'deal_closed':
        return CheckCircle2;
      default:
        return FileText;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'communication':
        return 'bg-blue-500';
      case 'follow_up':
        return 'bg-amber-500';
      case 'status_change':
        return 'bg-purple-500';
      case 'deal_closed':
        return 'bg-green-500';
      default:
        return 'bg-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Contact History: {companyName}
          </DialogTitle>
        </DialogHeader>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{stats.totalCommunications}</p>
            <p className="text-xs text-muted-foreground">Communications</p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{stats.totalFollowUps}</p>
            <p className="text-xs text-muted-foreground">Follow-ups</p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{stats.dealsCompleted}</p>
            <p className="text-xs text-muted-foreground">Deals Closed</p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-sm font-semibold">
              {stats.lastContact ? format(new Date(stats.lastContact), 'MMM dd') : '-'}
            </p>
            <p className="text-xs text-muted-foreground">Last Contact</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading timeline...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No interactions found</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              
              {events.map((event, index) => {
                const Icon = getEventIcon(event.type, event.channel);
                return (
                  <div key={event.id} className="relative pl-12 pb-6">
                    {/* Timeline dot */}
                    <div className={`absolute left-2 w-5 h-5 rounded-full ${getEventColor(event.type)} flex items-center justify-center`}>
                      <Icon className="h-3 w-3 text-white" />
                    </div>
                    
                    {/* Event card */}
                    <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium">{event.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(event.date), 'MMM dd, yyyy • h:mm a')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {event.status && (
                            <Badge variant={event.status === 'Closed' ? 'default' : 'secondary'}>
                              {event.status}
                            </Badge>
                          )}
                          {event.channel && (
                            <Badge variant="outline" className="text-xs">
                              {event.channel}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {event.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {event.description}
                        </p>
                      )}
                      
                      {event.assignedTo && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Assigned to:</span> {event.assignedTo}
                        </p>
                      )}
                      
                      {event.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {event.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContactTimeline;

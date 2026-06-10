import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Pencil, Check, X, MessageSquare, History, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StatusChange {
  id: string;
  changed_at: string;
  old_status: string | null;
  new_status: string | null;
  changed_by_name: string | null;
}

interface FollowUp {
  id: string;
  follow_up_date: string;
  action?: string | null;
  follow_up_channel?: string | null;
  status_after?: string | null;
  client_response?: string | null;
  outcome?: string | null;
  notes?: string | null;
}

interface FollowUpTableRowProps {
  followUp: FollowUp;
  onUpdate: () => void;
}

const STATUS_OPTIONS = ['Open', 'Done', 'Cancelled'];

// Map database status to UI status
const mapDbStatusToUi = (dbStatus: string | null | undefined): string => {
  if (dbStatus === 'Closed' || dbStatus === 'In Follow-up') return 'Done';
  if (dbStatus === 'Cancelled') return 'Cancelled';
  if (dbStatus === 'Done') return 'Done';
  return dbStatus || 'Open';
};

export function FollowUpTableRow({ followUp, onUpdate }: FollowUpTableRowProps) {
  // Map the status on load
  const displayStatus = mapDbStatusToUi(followUp.status_after);
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const [clientResponse, setClientResponse] = useState(followUp.client_response || '');
  const [isSaving, setIsSaving] = useState(false);
  const [statusHistory, setStatusHistory] = useState<StatusChange[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const fetchStatusHistory = async () => {
    if (statusHistory.length > 0) return; // Already loaded
    
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('follow_up_audit_log')
        .select(`
          id,
          changed_at,
          old_values,
          new_values,
          changed_by,
          profiles:changed_by(full_name)
        `)
        .eq('follow_up_id', followUp.id)
        .order('changed_at', { ascending: false });

      if (error) throw error;

      // Filter to only status changes
      const statusChanges: StatusChange[] = (data || [])
        .filter((log: any) => {
          const oldStatus = log.old_values?.status_after;
          const newStatus = log.new_values?.status_after;
          return oldStatus !== newStatus && (oldStatus || newStatus);
        })
        .map((log: any) => ({
          id: log.id,
          changed_at: log.changed_at,
          old_status: log.old_values?.status_after || null,
          new_status: log.new_values?.status_after || null,
          changed_by_name: log.profiles?.full_name || 'Unknown',
        }));

      setStatusHistory(statusChanges);
    } catch (error) {
      console.error('Error fetching status history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    const oldStatus = followUp.status_after;
    
    try {
      // Update the status
      const { error } = await supabase
        .from('follow_up_history')
        .update({ status_after: newStatus })
        .eq('id', followUp.id);

      if (error) throw error;

      // Log the change to audit log
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('follow_up_audit_log')
        .insert({
          follow_up_id: followUp.id,
          action: 'status_changed',
          changed_by: user?.id,
          old_values: { status_after: oldStatus },
          new_values: { status_after: newStatus },
        });

      // Clear cached history so it reloads
      setStatusHistory([]);
      
      toast.success('Status updated');
      onUpdate();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleSaveResponse = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('follow_up_history')
        .update({ client_response: clientResponse || null })
        .eq('id', followUp.id);

      if (error) throw error;
      toast.success('Client response saved');
      setIsEditingResponse(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving response:', error);
      toast.error('Failed to save response');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setClientResponse(followUp.client_response || '');
    setIsEditingResponse(false);
  };

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case 'Open':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            Open
          </Badge>
        );
      case 'Done':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            Done
          </Badge>
        );
      case 'Cancelled':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status || 'Open'}</Badge>;
    }
  };

  return (
    <TableRow className="group">
      <TableCell className="whitespace-nowrap font-medium">
        {format(new Date(followUp.follow_up_date), 'MMM d, yyyy')}
      </TableCell>
      <TableCell>{followUp.action || '-'}</TableCell>
      <TableCell>
        {followUp.follow_up_channel ? (
          <Badge variant="outline">{followUp.follow_up_channel}</Badge>
        ) : '-'}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Select
            value={displayStatus}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger className="w-[120px] h-8 text-xs border-dashed">
              <SelectValue>
                {getStatusBadge(displayStatus)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {getStatusBadge(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Popover open={historyOpen} onOpenChange={(open) => {
            setHistoryOpen(open);
            if (open) fetchStatusHistory();
          }}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <History className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
              <div className="p-3 border-b">
                <h4 className="font-medium text-sm">Status History</h4>
              </div>
              <ScrollArea className="max-h-[200px]">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : statusHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3">No status changes recorded.</p>
                ) : (
                  <div className="p-2 space-y-2">
                    {statusHistory.map((change) => (
                      <div key={change.id} className="text-xs border-l-2 border-muted pl-2 py-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {change.old_status && (
                            <>
                              {getStatusBadge(change.old_status)}
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          {getStatusBadge(change.new_status)}
                        </div>
                        <p className="text-muted-foreground mt-1">
                          {change.changed_by_name} • {format(new Date(change.changed_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </TableCell>
      <TableCell className="max-w-[250px]">
        {isEditingResponse ? (
          <div className="flex items-start gap-2">
            <Textarea
              value={clientResponse}
              onChange={(e) => setClientResponse(e.target.value)}
              placeholder="Enter client response..."
              className="min-h-[60px] text-sm"
              autoFocus
            />
            <div className="flex flex-col gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleSaveResponse}
                disabled={isSaving}
              >
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                <X className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          </div>
        ) : (
          <div 
            className={cn(
              "flex items-center gap-2 cursor-pointer group/response",
              !followUp.client_response && "text-muted-foreground"
            )}
            onClick={() => setIsEditingResponse(true)}
          >
            {followUp.client_response ? (
              <span className="truncate">{followUp.client_response}</span>
            ) : (
              <span className="text-xs italic">Click to add...</span>
            )}
            <Pencil className="h-3 w-3 opacity-0 group-hover/response:opacity-100 transition-opacity shrink-0" />
          </div>
        )}
      </TableCell>
      <TableCell>
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Notes & Outcome</h4>
              {followUp.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes:</p>
                  <p className="text-sm">{followUp.notes}</p>
                </div>
              )}
              {followUp.outcome && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Outcome:</p>
                  <p className="text-sm">{followUp.outcome}</p>
                </div>
              )}
              {!followUp.notes && !followUp.outcome && (
                <p className="text-sm text-muted-foreground">No notes or outcome recorded.</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </TableCell>
    </TableRow>
  );
}
import { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  MessageSquare, 
  MoreHorizontal, 
  Pencil, 
  Clock,
  ArrowRight,
  GripVertical,
  CalendarIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { COMMUNICATION_CHANNELS } from '@/constants/communicationChannels';
interface FollowUp {
  id: string;
  follow_up_date: string;
  action?: string | null;
  follow_up_channel?: string | null;
  status_after?: string | null;
  client_response?: string | null;
  outcome?: string | null;
  notes?: string | null;
  communication_log_id?: string;
}

interface FollowUpKanbanProps {
  followUps: FollowUp[];
  onUpdate: () => void;
}

const KANBAN_COLUMNS = [
  { 
    id: 'Open', 
    label: 'Open', 
    color: 'bg-amber-500',
    bgColor: 'bg-amber-500/5',
    borderColor: 'border-amber-500/20',
    textColor: 'text-amber-600'
  },
  { 
    id: 'Done', 
    label: 'Done', 
    color: 'bg-green-500',
    bgColor: 'bg-green-500/5',
    borderColor: 'border-green-500/20',
    textColor: 'text-green-600'
  },
  { 
    id: 'Cancelled', 
    label: 'Cancelled', 
    color: 'bg-red-500',
    bgColor: 'bg-red-500/5',
    borderColor: 'border-red-500/20',
    textColor: 'text-red-600'
  },
];

export function FollowUpKanban({ followUps, onUpdate }: FollowUpKanbanProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [clientResponse, setClientResponse] = useState('');
  const [savingResponse, setSavingResponse] = useState(false);
  
  // Create next follow-up state
  const [createNextFollowUp, setCreateNextFollowUp] = useState(false);
  const [nextFollowUpDate, setNextFollowUpDate] = useState<Date | undefined>(undefined);
  const [nextFollowUpChannel, setNextFollowUpChannel] = useState<string>('');
  const [nextFollowUpAction, setNextFollowUpAction] = useState<string>('');

  const handleOpenResponseDialog = (followUp: FollowUp) => {
    setEditingFollowUp(followUp);
    setClientResponse(followUp.client_response || '');
    setCreateNextFollowUp(false);
    setNextFollowUpDate(undefined);
    setNextFollowUpChannel('');
    setNextFollowUpAction('');
    setResponseDialogOpen(true);
  };

  const handleSaveClientResponse = async () => {
    if (!editingFollowUp) return;
    
    setSavingResponse(true);
    try {
      const { error } = await supabase
        .from('follow_up_history')
        .update({ client_response: clientResponse.trim() || null })
        .eq('id', editingFollowUp.id);

      if (error) throw error;

      // Create next follow-up if requested
      if (createNextFollowUp && nextFollowUpDate && editingFollowUp.communication_log_id) {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error: createError } = await supabase
          .from('follow_up_history')
          .insert({
            communication_log_id: editingFollowUp.communication_log_id,
            follow_up_date: nextFollowUpDate.toISOString(),
            follow_up_channel: nextFollowUpChannel || null,
            action: nextFollowUpAction || 'Follow-up',
            status_after: 'Open',
            user_id: user?.id,
          });
        
        if (createError) throw createError;
      }

      toast.success('Saved successfully');
      setResponseDialogOpen(false);
      setEditingFollowUp(null);
      setClientResponse('');
      setCreateNextFollowUp(false);
      setNextFollowUpDate(undefined);
      setNextFollowUpChannel('');
      setNextFollowUpAction('');
      onUpdate();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save');
    } finally {
      setSavingResponse(false);
    }
  };
  const getFollowUpsByStatus = (status: string) => {
    return followUps
      .filter(fu => (fu.status_after || 'Open') === status)
      .sort((a, b) => new Date(b.follow_up_date).getTime() - new Date(a.follow_up_date).getTime());
  };

  const handleDragStart = (e: React.DragEvent, followUpId: string) => {
    setDraggedItem(followUpId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedItem) return;

    const followUp = followUps.find(fu => fu.id === draggedItem);
    if (!followUp || followUp.status_after === newStatus) {
      setDraggedItem(null);
      return;
    }

    try {
      const oldStatus = followUp.status_after || 'Open';

      // Update the status
      const { error } = await supabase
        .from('follow_up_history')
        .update({ status_after: newStatus })
        .eq('id', draggedItem);

      if (error) throw error;

      // Log the change to audit log
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('follow_up_audit_log')
        .insert({
          follow_up_id: draggedItem,
          action: 'status_changed',
          changed_by: user?.id,
          old_values: { status_after: oldStatus },
          new_values: { status_after: newStatus },
        });

      toast.success(`Moved to ${newStatus}`);
      onUpdate();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setDraggedItem(null);
    }
  };

  const handleQuickMove = async (followUpId: string, newStatus: string) => {
    const followUp = followUps.find(fu => fu.id === followUpId);
    if (!followUp) return;

    try {
      const oldStatus = followUp.status_after || 'Open';

      const { error } = await supabase
        .from('follow_up_history')
        .update({ status_after: newStatus })
        .eq('id', followUpId);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('follow_up_audit_log')
        .insert({
          follow_up_id: followUpId,
          action: 'status_changed',
          changed_by: user?.id,
          old_values: { status_after: oldStatus },
          new_values: { status_after: newStatus },
        });

      toast.success(`Moved to ${newStatus}`);
      onUpdate();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const isOverdue = (dateStr: string) => {
    return new Date(dateStr) < new Date() && new Date(dateStr).toDateString() !== new Date().toDateString();
  };

  const isToday = (dateStr: string) => {
    return new Date(dateStr).toDateString() === new Date().toDateString();
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[400px]">
      {KANBAN_COLUMNS.map((column) => {
        const columnFollowUps = getFollowUpsByStatus(column.id);
        const isDropTarget = dragOverColumn === column.id;

        return (
          <div
            key={column.id}
            className={cn(
              "flex-1 min-w-[240px] max-w-[280px] rounded-xl border transition-all duration-200",
              column.bgColor,
              column.borderColor,
              isDropTarget && "ring-2 ring-primary/50 scale-[1.02]"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="p-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2.5 h-2.5 rounded-full", column.color)} />
                  <h3 className={cn("font-medium text-sm", column.textColor)}>
                    {column.label}
                  </h3>
                </div>
                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                  {columnFollowUps.length}
                </Badge>
              </div>
            </div>

            {/* Column Content */}
            <ScrollArea className="h-[350px]">
              <div className="p-2 space-y-2">
                {columnFollowUps.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-xs">
                    No items
                  </div>
                ) : (
                  columnFollowUps.map((fu) => (
                    <Card
                      key={fu.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, fu.id)}
                      className={cn(
                        "p-3 cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md group",
                        draggedItem === fu.id && "opacity-50 scale-95",
                        isOverdue(fu.follow_up_date) && column.id !== 'Done' && column.id !== 'Closed' && column.id !== 'Cancelled' && "border-red-500/50 bg-red-500/5"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        <div className="flex-1 min-w-0">
                          {/* Action/Title */}
                          <p className="font-medium text-sm line-clamp-2 mb-1.5">
                            {fu.action || 'Follow-up'}
                          </p>

                          {/* Date */}
                          <div className={cn(
                            "flex items-center gap-1 text-xs mb-2",
                            isOverdue(fu.follow_up_date) && column.id !== 'Done' && column.id !== 'Closed' && column.id !== 'Cancelled'
                              ? "text-red-600 font-medium"
                              : isToday(fu.follow_up_date)
                              ? "text-amber-600 font-medium"
                              : "text-muted-foreground"
                          )}>
                            <Clock className="h-3 w-3" />
                            {format(new Date(fu.follow_up_date), 'MMM d, yyyy')}
                            {isOverdue(fu.follow_up_date) && column.id !== 'Done' && column.id !== 'Closed' && column.id !== 'Cancelled' && (
                              <span className="text-red-600">(Overdue)</span>
                            )}
                            {isToday(fu.follow_up_date) && (
                              <span className="text-amber-600">(Today)</span>
                            )}
                          </div>

                          {/* Channel Badge */}
                          {fu.follow_up_channel && (
                            <Badge variant="outline" className="text-xs h-5 mb-2">
                              {fu.follow_up_channel}
                            </Badge>
                          )}

                          {/* Notes Preview */}
                          {fu.notes && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {fu.notes}
                            </p>
                          )}

                          {/* Client Response */}
                          {fu.client_response && (
                            <div className="flex items-start gap-1.5 text-xs bg-muted/50 rounded p-1.5 mt-2">
                              <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{fu.client_response}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => handleOpenResponseDialog(fu)}
                              className="gap-2"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              {fu.client_response ? 'Edit Client Response' : 'Add Client Response'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {KANBAN_COLUMNS.filter(c => c.id !== (fu.status_after || 'Open')).map((col) => (
                              <DropdownMenuItem
                                key={col.id}
                                onClick={() => handleQuickMove(fu.id, col.id)}
                                className="gap-2"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                                Move to {col.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}

      {/* Client Response Dialog */}
      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Client Response
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Textarea
              value={clientResponse}
              onChange={(e) => setClientResponse(e.target.value)}
              placeholder="Enter the client's response..."
              rows={4}
              className="resize-none"
            />
            
            {/* Create next follow-up checkbox */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createNextKanban"
                  checked={createNextFollowUp}
                  onCheckedChange={(checked) => setCreateNextFollowUp(checked === true)}
                />
                <Label htmlFor="createNextKanban" className="text-sm font-medium cursor-pointer">
                  Create next follow-up
                </Label>
              </div>
              
              {createNextFollowUp && (
                <div className="ml-6 space-y-3 border-l-2 border-primary/20 pl-4">
                  {/* Next follow-up date */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Follow-up Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !nextFollowUpDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {nextFollowUpDate ? format(nextFollowUpDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={nextFollowUpDate}
                          onSelect={setNextFollowUpDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  {/* Channel */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Channel</Label>
                    <Select value={nextFollowUpChannel} onValueChange={setNextFollowUpChannel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select channel..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMUNICATION_CHANNELS.map((channel) => (
                          <SelectItem key={channel.value} value={channel.value}>
                            <div className="flex items-center gap-2">
                              <channel.icon className="h-4 w-4" />
                              {channel.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Action required */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Action Required</Label>
                    <Input
                      value={nextFollowUpAction}
                      onChange={(e) => setNextFollowUpAction(e.target.value)}
                      placeholder="e.g., Follow up on quotation"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResponseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveClientResponse} disabled={savingResponse}>
              {savingResponse ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

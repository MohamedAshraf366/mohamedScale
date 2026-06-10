import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  CheckCircle2, CalendarDays, List, ChevronLeft, ChevronRight, Plus, Search, Filter, XCircle, ClipboardList,
  Pencil, Trash2, UserCheck, MoreHorizontal, Undo2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, isWithinInterval, isBefore, startOfDay, isAfter, parseISO, addDays, isToday } from 'date-fns';
import TaskKPISummary from '@/components/TaskKPISummary';
import TaskCompletionTrendsChart from '@/components/TaskCompletionTrendsChart';
import TaskNotificationManager from '@/components/TaskNotificationManager';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import FollowUpDialog from '@/components/FollowUpDialog';
import GeneralTaskDialog from '@/components/GeneralTaskDialog';
import CompleteFollowUpModal from '@/components/CompleteFollowUpModal';
import InteractionHistoryModal from '@/components/InteractionHistoryModal';
import { useTranslation } from 'react-i18next';
import { getChannelInfo } from '@/constants/communicationChannels';
import { logAudit } from '@/lib/auditLogger';
import { TaskKanban } from '@/components/TaskKanban';

interface Task {
  id: string;
  action: string;
  follow_up_date: string;
  created_at: string;
  status_after: string | null;
  notes: string | null;
  communication_log_id: string;
  follow_up_number?: number;
  follow_up_channel?: string | null;
  isGeneralTask?: boolean;
  priority?: string | null;
  communication_log: {
    id: string;
    company_name: string;
    contact_info: string;
    person_name: string;
    assigned_to: string | null;
    related_supplier_id: string | null;
  } | null;
}

interface GeneralTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  assigned_to: string;
  priority: string | null;
  status: string | null;
  created_at: string;
}

interface Communication {
  id: string;
  company_name: string | null;
  person_name: string | null;
  follow_up_date: string | null;
  status: string | null;
  action: string | null;
  notes: string | null;
  quotation_required: boolean | null;
  summary: string | null;
  current_phase: string | null;
}

type ViewMode = 'list' | 'month' | 'week';
type TaskStatus = 'active' | 'all' | 'Open' | 'Done' | 'Cancelled';

const Tasks = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const communicationIdFilter = searchParams.get('communication_id');
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();
  
  // Filters - default to all statuses
  const [statusFilter, setStatusFilter] = useState<TaskStatus>('all');
  const [assignedToFilter, setAssignedToFilter] = useState<string>('all');
  
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');
  const [assignedToOptions, setAssignedToOptions] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  
  // Add Task states
  const [selectCommDialogOpen, setSelectCommDialogOpen] = useState(false);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [commSearchQuery, setCommSearchQuery] = useState('');
  const [loadingComms, setLoadingComms] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState<Communication | null>(null);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  
  // General Task states
  const [generalTaskDialogOpen, setGeneralTaskDialogOpen] = useState(false);
  const [editingGeneralTask, setEditingGeneralTask] = useState<{
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    assigned_to: string;
    priority: string | null;
    status: string | null;
  } | null>(null);

  // Selection states
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  
  // Edit follow-up dialog states
  const [editFollowUpDialogOpen, setEditFollowUpDialogOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<Task | null>(null);
  
  // Delete confirmation states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  
  // Bulk reassign states
  const [bulkReassignOpen, setBulkReassignOpen] = useState(false);
  const [bulkReassignTo, setBulkReassignTo] = useState<string>('');
  
  // Complete follow-up modal states
  const [completeFollowUpModalOpen, setCompleteFollowUpModalOpen] = useState(false);
  const [followUpToComplete, setFollowUpToComplete] = useState<Task | null>(null);
  
  // Interaction history modal states
  const [interactionHistoryOpen, setInteractionHistoryOpen] = useState(false);
  const [viewingCommunicationId, setViewingCommunicationId] = useState<string>('');
  
  // KPI filter state
  const [activeKPIFilter, setActiveKPIFilter] = useState<'dueToday' | 'overdue' | null>(null);

  // Undo state - track last action for reverting
  interface UndoAction {
    type: 'status_change' | 'delete' | 'reassign' | 'bulk_status' | 'bulk_reassign' | 'bulk_delete';
    taskIds: string[];
    previousData: Array<{ id: string; isGeneralTask: boolean; status?: string; assigned_to?: string; taskData?: Task }>;
    description: string;
  }
  const [lastAction, setLastAction] = useState<UndoAction | null>(null);

  // Fetch team members from profiles table
  const fetchTeamMembers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');
    if (data) setTeamMembers(data);
  };

  useEffect(() => {
    fetchTasks();
    fetchTeamMembers();
    
    // Subscribe to real-time changes on follow_up_history table
    const followUpChannel = supabase
      .channel('tasks-follow-up-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follow_up_history'
        },
        () => fetchTasks()
      )
      .subscribe();

    // Subscribe to real-time changes on general_tasks table
    const generalTasksChannel = supabase
      .channel('tasks-general-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'general_tasks'
        },
        () => fetchTasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(followUpChannel);
      supabase.removeChannel(generalTasksChannel);
    };
  }, [communicationIdFilter]);

  const fetchTasks = async () => {
    try {
      // Fetch follow-up tasks
      let followUpQuery = supabase
        .from('follow_up_history')
        .select(`
          id,
          action,
          follow_up_date,
          created_at,
          status_after,
          notes,
          communication_log_id,
          follow_up_channel,
          communication_log:communication_log_id (
            id,
            company_name,
            contact_info,
            person_name,
            assigned_to,
            related_supplier_id
          )
        `)
        .not('follow_up_date', 'is', null)
        .order('follow_up_date', { ascending: true });

      // Filter by communication if specified in URL
      if (communicationIdFilter) {
        followUpQuery = followUpQuery.eq('communication_log_id', communicationIdFilter);
      }

      // Fetch general tasks (only when not filtering by communication)
      const generalTasksPromise = !communicationIdFilter 
        ? supabase
            .from('general_tasks')
            .select('*')
            .order('due_date', { ascending: true })
        : Promise.resolve({ data: [], error: null });

      const [followUpResult, generalTasksResult] = await Promise.all([
        followUpQuery,
        generalTasksPromise
      ]);

      if (followUpResult.error) throw followUpResult.error;
      if (generalTasksResult.error) throw generalTasksResult.error;
      
      // Group follow-ups by communication and add follow-up numbers
      const groupedByComm: Record<string, Task[]> = {};
      (followUpResult.data || []).forEach((task: any) => {
        const commId = task.communication_log_id;
        if (!groupedByComm[commId]) {
          groupedByComm[commId] = [];
        }
        groupedByComm[commId].push(task);
      });
      
      // Sort each group by created_at and assign follow-up numbers
      const tasksWithNumbers: Task[] = [];
      Object.values(groupedByComm).forEach(group => {
        group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        group.forEach((task, index) => {
          tasksWithNumbers.push({ ...task, follow_up_number: index + 1, isGeneralTask: false });
        });
      });

      // Convert general tasks to Task format
      const generalTasks: Task[] = (generalTasksResult.data || []).map((gt: GeneralTask) => ({
        id: gt.id,
        action: gt.title,
        follow_up_date: gt.due_date || gt.created_at,
        created_at: gt.created_at,
        status_after: gt.status === 'Completed' ? 'Done' : gt.status === 'Cancelled' ? 'Cancelled' : 'Open',
        notes: gt.description,
        communication_log_id: '',
        follow_up_channel: null,
        isGeneralTask: true,
        priority: gt.priority,
        communication_log: {
          id: '',
          company_name: '',
          contact_info: '',
          person_name: '',
          assigned_to: gt.assigned_to,
          related_supplier_id: null,
        },
      }));
      
      // Merge and sort all tasks by created_at descending (newest first)
      const allTasksData = [...tasksWithNumbers, ...generalTasks];
      allTasksData.sort((a, b) => {
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      setTasks(allTasksData);
      
      // Extract unique assigned_to values
      const assignees = new Set<string>();
      allTasksData.forEach(task => {
        if (task.communication_log?.assigned_to) {
          assignees.add(task.communication_log.assigned_to);
        }
      });
      setAssignedToOptions(Array.from(assignees));
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Filtered tasks based on filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Map legacy statuses to new statuses for filtering
      const mappedStatus = task.status_after === 'Closed' || task.status_after === 'In Follow-up' ? 'Done' : task.status_after;
      
      // Status filter - 'active' means Open only
      if (statusFilter === 'active') {
        if (mappedStatus !== 'Open') return false;
      } else if (statusFilter !== 'all' && mappedStatus !== statusFilter) {
        return false;
      }
      
      // Assigned to filter
      if (assignedToFilter !== 'all' && task.communication_log?.assigned_to !== assignedToFilter) {
        return false;
      }
      
      // Date range filter
      if (dateFromFilter && task.follow_up_date) {
        const taskDate = parseISO(task.follow_up_date);
        const fromDate = parseISO(dateFromFilter);
        if (isBefore(taskDate, fromDate)) return false;
      }
      
      if (dateToFilter && task.follow_up_date) {
        const taskDate = parseISO(task.follow_up_date);
        const toDate = parseISO(dateToFilter);
        if (isAfter(taskDate, toDate)) return false;
      }
      
      
      return true;
    });
  }, [tasks, statusFilter, assignedToFilter, dateFromFilter, dateToFilter, activeKPIFilter]);
  
  const clearFilters = () => {
    setStatusFilter('all');
    setAssignedToFilter('all');
    setAssignedToFilter('all');
    setDateFromFilter('');
    setDateToFilter('');
    setActiveKPIFilter(null);
  };
  
  const hasActiveFilters = statusFilter !== 'all' || assignedToFilter !== 'all' || dateFromFilter || dateToFilter || activeKPIFilter !== null;

  // KPI Filter handlers
  const handleFilterDueToday = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setDateFromFilter(todayStr);
    setDateToFilter(todayStr);
    setStatusFilter('active');
    setActiveKPIFilter('dueToday');
  };

  const handleFilterOverdue = () => {
    const yesterdayStr = format(addDays(new Date(), -1), 'yyyy-MM-dd');
    setDateFromFilter('');
    setDateToFilter(yesterdayStr);
    setStatusFilter('active');
    setActiveKPIFilter('overdue');
  };


  // Fetch communications for "Add Task" dialog
  const fetchCommunications = async () => {
    setLoadingComms(true);
    try {
      const { data, error } = await supabase
        .from('communication_log')
        .select('id, company_name, person_name, follow_up_date, status, action, notes, quotation_required, summary, current_phase')
        .order('communication_date', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setCommunications(data || []);
    } catch (error) {
      console.error('Error fetching communications:', error);
    } finally {
      setLoadingComms(false);
    }
  };

  const handleAddTaskClick = () => {
    fetchCommunications();
    setSelectCommDialogOpen(true);
  };

  const handleSelectCommunication = (comm: Communication) => {
    setSelectedCommunication(comm);
    setSelectCommDialogOpen(false);
    setFollowUpDialogOpen(true);
  };

  const handleFollowUpSaved = () => {
    fetchTasks();
    setSelectedCommunication(null);
  };

  const filteredCommunications = communications.filter(comm => {
    if (!commSearchQuery) return true;
    const query = commSearchQuery.toLowerCase();
    return (
      comm.company_name?.toLowerCase().includes(query) ||
      comm.person_name?.toLowerCase().includes(query)
    );
  });

  const handleMarkComplete = (task: Task) => {
    // Open the complete follow-up modal instead of marking done directly
    setFollowUpToComplete(task);
    setCompleteFollowUpModalOpen(true);
  };
  
  const handleFollowUpCompleted = () => {
    fetchTasks();
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (followUpToComplete) {
        newSet.delete(followUpToComplete.id);
      }
      return newSet;
    });
    setFollowUpToComplete(null);
  };

  const handleCompleteGeneralTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('general_tasks')
        .update({ status: 'Completed' })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Task completed',
        description: 'General task has been marked as completed.',
      });

      fetchTasks();
    } catch (error) {
      console.error('Error updating general task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task.',
        variant: "destructive",
      });
    }
  };

  const handleEditGeneralTask = (task: Task) => {
    // Find the original general task data
    setEditingGeneralTask({
      id: task.id,
      title: task.action,
      description: task.notes,
      due_date: task.follow_up_date,
      assigned_to: task.communication_log?.assigned_to || '',
      priority: task.priority || 'Medium',
      status: task.status_after === 'Closed' || task.status_after === 'Done' ? 'Completed' : task.status_after === 'Cancelled' ? 'Cancelled' : 'Open',
    });
    setGeneralTaskDialogOpen(true);
  };

  const handleAddGeneralTask = () => {
    setEditingGeneralTask(null);
    setSelectCommDialogOpen(false);
    setGeneralTaskDialogOpen(true);
  };

  // Selection handlers
  const handleSelectTask = (taskId: string, checked: boolean) => {
    const newSelection = new Set(selectedTaskIds);
    if (checked) {
      newSelection.add(taskId);
    } else {
      newSelection.delete(taskId);
    }
    setSelectedTaskIds(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
    } else {
      setSelectedTaskIds(new Set());
    }
  };

  const isAllSelected = filteredTasks.length > 0 && selectedTaskIds.size === filteredTasks.length;
  const isSomeSelected = selectedTaskIds.size > 0;

  // Edit follow-up handler
  const handleEditFollowUp = (task: Task) => {
    setEditingFollowUp(task);
    setEditFollowUpDialogOpen(true);
  };

  // Delete handlers
  const handleDeleteClick = (task: Task) => {
    setTaskToDelete(task);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    
    try {
      const tableName = taskToDelete.isGeneralTask ? 'general_tasks' : 'follow_up_history';
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', taskToDelete.id);

      if (error) throw error;

      // Log audit
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await logAudit({
          action: 'deleted',
          module: taskToDelete.isGeneralTask ? 'Tasks' : 'Follow-ups',
          recordId: taskToDelete.id,
          recordName: taskToDelete.action || 'Task',
          oldValues: taskToDelete as unknown as Record<string, unknown>,
          newValues: null,
        });
      }

      toast({
        title: 'Task deleted',
        description: 'The task has been deleted successfully.',
      });

      setSelectedTaskIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskToDelete.id);
        return newSet;
      });
      fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task.',
        variant: 'destructive',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setTaskToDelete(null);
    }
  };

  // Bulk actions
  const handleBulkMarkDone = async () => {
    try {
      const selectedTasks = filteredTasks.filter(t => selectedTaskIds.has(t.id));
      const followUpIds = selectedTasks.filter(t => !t.isGeneralTask).map(t => t.id);
      const generalTaskIds = selectedTasks.filter(t => t.isGeneralTask).map(t => t.id);

      // Save previous state for undo - status_after is the unified status field
      const previousData = selectedTasks.map(t => ({
        id: t.id,
        isGeneralTask: t.isGeneralTask || false,
        status: t.status_after || 'Open',
      }));

      if (followUpIds.length > 0) {
        const { error } = await supabase
          .from('follow_up_history')
          .update({ status_after: 'Closed' })
          .in('id', followUpIds);
        if (error) throw error;
      }

      if (generalTaskIds.length > 0) {
        const { error } = await supabase
          .from('general_tasks')
          .update({ status: 'Completed' })
          .in('id', generalTaskIds);
        if (error) throw error;
      }

      // Set undo action
      setLastAction({
        type: 'bulk_status',
        taskIds: [...selectedTaskIds],
        previousData,
        description: `Reverted ${selectedTaskIds.size} task(s) to previous status`,
      });

      toast({
        title: 'Tasks marked as done',
        description: `${selectedTaskIds.size} task(s) marked as completed.`,
      });

      setSelectedTaskIds(new Set());
      fetchTasks();
    } catch (error) {
      console.error('Error marking tasks done:', error);
      toast({
        title: 'Error',
        description: 'Failed to update tasks.',
        variant: 'destructive',
      });
    }
  };

  const handleBulkChangeStatus = async (newStatus: string) => {
    try {
      const selectedTasks = filteredTasks.filter(t => selectedTaskIds.has(t.id));
      const followUpIds = selectedTasks.filter(t => !t.isGeneralTask).map(t => t.id);
      const generalTaskIds = selectedTasks.filter(t => t.isGeneralTask).map(t => t.id);

      // Save previous state for undo - status_after is the unified status field
      const previousData = selectedTasks.map(t => ({
        id: t.id,
        isGeneralTask: t.isGeneralTask || false,
        status: t.status_after || 'Open',
      }));

      // Map status for database - ensure proper type
      const dbStatus: 'Open' | 'Done' | 'Cancelled' = newStatus === 'Done' ? 'Done' : newStatus === 'Cancelled' ? 'Cancelled' : 'Open';
      const generalStatus = newStatus === 'Done' ? 'Completed' : newStatus === 'Cancelled' ? 'Cancelled' : 'Open';

      if (followUpIds.length > 0) {
        const { error } = await supabase
          .from('follow_up_history')
          .update({ status_after: dbStatus })
          .in('id', followUpIds);
        if (error) throw error;
      }

      if (generalTaskIds.length > 0) {
        const { error } = await supabase
          .from('general_tasks')
          .update({ status: generalStatus })
          .in('id', generalTaskIds);
        if (error) throw error;
      }

      // Set undo action
      setLastAction({
        type: 'bulk_status',
        taskIds: [...selectedTaskIds],
        previousData,
        description: `Reverted ${selectedTaskIds.size} task(s) to previous status`,
      });

      toast({
        title: 'Status updated',
        description: `${selectedTaskIds.size} task(s) updated to ${newStatus}.`,
      });

      setSelectedTaskIds(new Set());
      fetchTasks();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update tasks.',
        variant: 'destructive',
      });
    }
  };

  const handleBulkReassign = async () => {
    if (!bulkReassignTo) return;
    
    try {
      const selectedTasks = filteredTasks.filter(t => selectedTaskIds.has(t.id));
      const generalTaskIds = selectedTasks.filter(t => t.isGeneralTask).map(t => t.id);
      // Note: Follow-ups are linked to communications, so reassigning would need to update the communication
      const followUpCommIds = [...new Set(selectedTasks.filter(t => !t.isGeneralTask && t.communication_log_id).map(t => t.communication_log_id))];

      // Save previous state for undo - assigned_to is stored in communication_log for both task types
      const previousData = selectedTasks.map(t => ({
        id: t.isGeneralTask ? t.id : t.communication_log_id,
        isGeneralTask: t.isGeneralTask || false,
        assigned_to: t.communication_log?.assigned_to || '',
      }));

      if (generalTaskIds.length > 0) {
        const { error } = await supabase
          .from('general_tasks')
          .update({ assigned_to: bulkReassignTo })
          .in('id', generalTaskIds);
        if (error) throw error;
      }

      if (followUpCommIds.length > 0) {
        const { error } = await supabase
          .from('communication_log')
          .update({ assigned_to: bulkReassignTo })
          .in('id', followUpCommIds);
        if (error) throw error;
      }

      // Set undo action
      setLastAction({
        type: 'bulk_reassign',
        taskIds: [...selectedTaskIds],
        previousData,
        description: `Reverted ${selectedTaskIds.size} task(s) to previous assignee`,
      });

      toast({
        title: 'Tasks reassigned',
        description: `${selectedTaskIds.size} task(s) reassigned to ${bulkReassignTo}.`,
      });

      setSelectedTaskIds(new Set());
      setBulkReassignOpen(false);
      setBulkReassignTo('');
      fetchTasks();
    } catch (error) {
      console.error('Error reassigning tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to reassign tasks.',
        variant: 'destructive',
      });
    }
  };

  const handleBulkDelete = async () => {
    try {
      const selectedTasks = filteredTasks.filter(t => selectedTaskIds.has(t.id));
      const followUpIds = selectedTasks.filter(t => !t.isGeneralTask).map(t => t.id);
      const generalTaskIds = selectedTasks.filter(t => t.isGeneralTask).map(t => t.id);

      if (followUpIds.length > 0) {
        const { error } = await supabase
          .from('follow_up_history')
          .delete()
          .in('id', followUpIds);
        if (error) throw error;
      }

      if (generalTaskIds.length > 0) {
        const { error } = await supabase
          .from('general_tasks')
          .delete()
          .in('id', generalTaskIds);
        if (error) throw error;
      }

      toast({
        title: 'Tasks deleted',
        description: `${selectedTaskIds.size} task(s) deleted successfully.`,
      });

      setSelectedTaskIds(new Set());
      setBulkDeleteConfirmOpen(false);
      fetchTasks();
    } catch (error) {
      console.error('Error deleting tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete tasks.',
        variant: 'destructive',
      });
    }
  };

  // Undo last action handler
  const handleUndoLastAction = async () => {
    if (!lastAction) return;
    
    try {
      if (lastAction.type === 'status_change' || lastAction.type === 'bulk_status') {
        // Revert status changes
        const generalTaskUpdates = lastAction.previousData.filter(item => item.isGeneralTask);
        const followUpUpdates = lastAction.previousData.filter(item => !item.isGeneralTask);

        // Group general tasks by their original status and update in batches
        const openGeneralIds = generalTaskUpdates.filter(i => i.status === 'Open').map(i => i.id);
        const completedGeneralIds = generalTaskUpdates.filter(i => i.status === 'Done' || i.status === 'Closed' || i.status === 'Completed').map(i => i.id);
        const cancelledGeneralIds = generalTaskUpdates.filter(i => i.status === 'Cancelled').map(i => i.id);

        if (openGeneralIds.length > 0) {
          const { error } = await supabase.from('general_tasks').update({ status: 'Open' }).in('id', openGeneralIds);
          if (error) throw error;
        }
        if (completedGeneralIds.length > 0) {
          const { error } = await supabase.from('general_tasks').update({ status: 'Completed' }).in('id', completedGeneralIds);
          if (error) throw error;
        }
        if (cancelledGeneralIds.length > 0) {
          const { error } = await supabase.from('general_tasks').update({ status: 'Cancelled' }).in('id', cancelledGeneralIds);
          if (error) throw error;
        }

        // Group follow-up tasks by their original status and update in batches
        const openFollowUpIds = followUpUpdates.filter(i => i.status === 'Open').map(i => i.id);
        const doneFollowUpIds = followUpUpdates.filter(i => i.status === 'Done' || i.status === 'Closed').map(i => i.id);
        const cancelledFollowUpIds = followUpUpdates.filter(i => i.status === 'Cancelled').map(i => i.id);

        if (openFollowUpIds.length > 0) {
          const { error } = await supabase.from('follow_up_history').update({ status_after: 'Open' }).in('id', openFollowUpIds);
          if (error) throw error;
        }
        if (doneFollowUpIds.length > 0) {
          const { error } = await supabase.from('follow_up_history').update({ status_after: 'Done' }).in('id', doneFollowUpIds);
          if (error) throw error;
        }
        if (cancelledFollowUpIds.length > 0) {
          const { error } = await supabase.from('follow_up_history').update({ status_after: 'Cancelled' }).in('id', cancelledFollowUpIds);
          if (error) throw error;
        }
      } else if (lastAction.type === 'reassign' || lastAction.type === 'bulk_reassign') {
        // Revert reassignments - need individual updates as each has different assigned_to
        const generalTaskUpdates = lastAction.previousData.filter(item => item.isGeneralTask);
        const followUpUpdates = lastAction.previousData.filter(item => !item.isGeneralTask);

        for (const item of generalTaskUpdates) {
          const { error } = await supabase
            .from('general_tasks')
            .update({ assigned_to: item.assigned_to || '' })
            .eq('id', item.id);
          if (error) throw error;
        }

        for (const item of followUpUpdates) {
          // For follow-ups, the assigned_to is on communication_log (id stored is communication_log_id)
          const { error } = await supabase
            .from('communication_log')
            .update({ assigned_to: item.assigned_to })
            .eq('id', item.id);
          if (error) throw error;
        }
      }

      toast({
        title: 'Action undone',
        description: lastAction.description,
      });

      setLastAction(null);
      fetchTasks();
    } catch (error) {
      console.error('Error undoing action:', error);
      toast({
        title: 'Error',
        description: 'Failed to undo action.',
        variant: 'destructive',
      });
    }
  };

  // Get tasks for a specific date
  const getTasksForDate = (date: Date) => {
    return filteredTasks.filter(task => {
      if (!task.follow_up_date) return false;
      return isSameDay(new Date(task.follow_up_date), date);
    });
  };

  // Get dates that have tasks
  const datesWithTasks = useMemo(() => {
    const dates: Date[] = [];
    filteredTasks.forEach(task => {
      if (task.follow_up_date) {
        dates.push(new Date(task.follow_up_date));
      }
    });
    return dates;
  }, [filteredTasks]);

  // Check if a date has tasks
  const hasTasksOnDate = (date: Date) => {
    return datesWithTasks.some(taskDate => isSameDay(taskDate, date));
  };

  // Check if a date has overdue tasks
  const hasOverdueOnDate = (date: Date) => {
    const today = startOfDay(new Date());
    return isBefore(date, today) && hasTasksOnDate(date);
  };

  // Get week days for weekly view
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Navigation handlers
  const navigatePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Tasks to display in sidebar based on selected date or current view range
  const displayedTasks = useMemo(() => {
    if (selectedDate) {
      return getTasksForDate(selectedDate);
    }
    
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return filteredTasks.filter(task => {
        if (!task.follow_up_date) return false;
        const taskDate = new Date(task.follow_up_date);
        return isWithinInterval(taskDate, { start, end });
      });
    }
    
    if (viewMode === 'month') {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return filteredTasks.filter(task => {
        if (!task.follow_up_date) return false;
        const taskDate = new Date(task.follow_up_date);
        return isWithinInterval(taskDate, { start, end });
      });
    }
    
    return filteredTasks;
  }, [filteredTasks, selectedDate, viewMode, currentDate]);
  
  const getStatusBadgeColor = (status: string | null) => {
    // Map legacy statuses
    const mappedStatus = status === 'Closed' || status === 'In Follow-up' ? 'Done' : status;
    switch (mappedStatus) {
      case 'Open':
        return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
      case 'Done':
        return 'bg-green-500/15 text-green-600 border-green-500/30';
      case 'Cancelled':
        return 'bg-red-500/15 text-red-600 border-red-500/30';
      default:
        return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
    }
  };
  
  const handleViewCommunication = (communicationId: string) => {
    setViewingCommunicationId(communicationId);
    setInteractionHistoryOpen(true);
  };

  const renderListView = () => (
    <Card>
      <CardHeader>
        <CardTitle>
          {communicationIdFilter ? t('tasks.followUpsForCommunication') : t('tasks.allTasks')}
        </CardTitle>
        <CardDescription>
          {filteredTasks.length} {t('tasks.followUps')} 
          {hasActiveFilters && ` ${t('tasks.filtered')}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Bulk Actions Bar */}
        {isSomeSelected && (
          <div className="flex items-center gap-3 p-3 mb-4 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-sm font-medium text-primary">
              {selectedTaskIds.size} selected
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBulkMarkDone}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark as Done
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    Change Status
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-1" align="end">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => handleBulkChangeStatus('Open')}
                  >
                    Open
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => handleBulkChangeStatus('Done')}
                  >
                    Done
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => handleBulkChangeStatus('Cancelled')}
                  >
                    Cancelled
                  </Button>
                </PopoverContent>
              </Popover>
              <Button
                variant="outline" 
                size="sm" 
                onClick={() => setBulkReassignOpen(true)}
                className="gap-1.5"
              >
                <UserCheck className="h-4 w-4" />
                Reassign
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setBulkDeleteConfirmOpen(true)}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedTaskIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{t('tasks.loadingTasks')}</div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {hasActiveFilters ? t('tasks.noTasksMatch') : t('tasks.noTasksFound')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox 
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>{t('tasks.actionRequired')}</TableHead>
                <TableHead>{t('tasks.company')}</TableHead>
                <TableHead>{t('tasks.contactPerson')}</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>{t('tasks.dueDate')}</TableHead>
                <TableHead>{t('tasks.status')}</TableHead>
                <TableHead>{t('tasks.assignedTo')}</TableHead>
                <TableHead className="text-right">{t('tasks.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => {
                const mappedStatus = task.status_after === 'Closed' || task.status_after === 'In Follow-up' ? 'Done' : (task.status_after || 'Open');
                const isOverdue = mappedStatus === 'Open' && task.follow_up_date && isBefore(new Date(task.follow_up_date), startOfDay(new Date()));
                const isSelected = selectedTaskIds.has(task.id);
                return (
                  <TableRow 
                    key={task.id} 
                    className={cn(isSelected && "bg-primary/5")}
                  >
                    <TableCell>
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectTask(task.id, !!checked)}
                        aria-label={`Select ${task.action}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{task.action || '-'}</TableCell>
                    <TableCell>{task.isGeneralTask ? '-' : (task.communication_log?.company_name || '-')}</TableCell>
                    <TableCell>{task.isGeneralTask ? '-' : (task.communication_log?.person_name || '-')}</TableCell>
                    <TableCell>
                      {task.isGeneralTask ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (() => {
                        const channelInfo = getChannelInfo(task.follow_up_channel);
                        if (!channelInfo) return <span className="text-muted-foreground">-</span>;
                        const Icon = channelInfo.icon;
                        return (
                          <span className="flex items-center gap-1.5 text-sm">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {channelInfo.label}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {task.follow_up_date ? (
                        <Badge variant={isOverdue ? "destructive" : "outline"}>
                          {format(new Date(task.follow_up_date), 'MMM dd, yyyy')}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(task.status_after)}>
                        {mappedStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const assignedId = task.communication_log?.assigned_to;
                        if (!assignedId) return '-';
                        const member = teamMembers.find(m => m.id === assignedId);
                        return member?.full_name || member?.email || assignedId;
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Edit Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => task.isGeneralTask ? handleEditGeneralTask(task) : handleEditFollowUp(task)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        
                        {/* Delete Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(task)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>

                        {/* Complete Button - only show for Open tasks */}
                        {mappedStatus === 'Open' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-600"
                            onClick={() => task.isGeneralTask ? handleCompleteGeneralTask(task.id) : handleMarkComplete(task)}
                            title="Mark as Done"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}

                        {/* View Communication (for follow-ups) */}
                        {!task.isGeneralTask && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewCommunication(task.communication_log_id)}
                            className="h-8 text-xs"
                          >
                            View
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const renderWeeklyView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Weekly View</CardTitle>
              <CardDescription>
                {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={navigatePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={navigateToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const dayTasks = getTasksForDate(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const hasOverdue = hasOverdueOnDate(day);
                
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-[120px] p-2 rounded-lg border cursor-pointer transition-colors",
                      isToday && "border-primary bg-primary/5",
                      isSelected && "ring-2 ring-primary",
                      !isToday && !isSelected && "hover:bg-muted/50"
                    )}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className={cn(
                      "text-sm font-medium mb-2",
                      isToday && "text-primary"
                    )}>
                      {format(day, 'EEE')}
                      <span className={cn(
                        "ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs",
                        isToday && "bg-primary text-primary-foreground"
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map((task) => (
                        <div
                          key={task.id}
                          className={cn(
                            "text-xs p-1 rounded truncate",
                            hasOverdue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                          )}
                        >
                          {task.action}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Task Details Sidebar */}
      <div>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'This Week\'s Tasks'}
            </CardTitle>
            <CardDescription>
              {displayedTasks.length} task{displayedTasks.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {displayedTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No tasks {selectedDate ? 'on this date' : 'this week'}
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedTasks.map((task) => {
                    const isOverdue = task.follow_up_date && isBefore(new Date(task.follow_up_date), startOfDay(new Date()));
                    return (
                      <div key={task.id} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{task.action}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {task.communication_log?.company_name || 'No company'}
                            </p>
                            <Badge variant={isOverdue ? "destructive" : "outline"} className="mt-1 text-xs">
                              {task.follow_up_date ? format(new Date(task.follow_up_date), 'MMM d') : 'No date'}
                            </Badge>
                          </div>
                          {(task.status_after === 'Closed' || task.status_after === 'In Follow-up' ? 'Done' : (task.status_after || 'Open')) === 'Open' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => task.isGeneralTask ? handleCompleteGeneralTask(task.id) : handleMarkComplete(task)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderMonthlyView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Monthly View</CardTitle>
              <CardDescription>{format(currentDate, 'MMMM yyyy')}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={navigatePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={navigateToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={currentDate}
              onMonthChange={setCurrentDate}
              className="rounded-md border w-full pointer-events-auto"
              classNames={{
                months: "w-full",
                month: "w-full",
                table: "w-full",
                head_row: "flex w-full",
                head_cell: "flex-1 text-muted-foreground font-normal text-sm",
                row: "flex w-full mt-2",
                cell: "flex-1 text-center text-sm relative p-0",
                day: cn(
                  "h-12 w-full rounded-md transition-colors hover:bg-muted",
                  "aria-selected:bg-primary aria-selected:text-primary-foreground"
                ),
                day_today: "bg-accent text-accent-foreground font-semibold",
              }}
              components={{
                Day: ({ date, ...props }) => {
                  const dayTasks = getTasksForDate(date);
                  const hasOverdue = hasOverdueOnDate(date);
                  const hasTasks = dayTasks.length > 0;
                  
                  return (
                    <button
                      {...props}
                      className={cn(
                        "h-12 w-full rounded-md transition-colors hover:bg-muted relative flex flex-col items-center justify-center",
                        isSameDay(date, new Date()) && "bg-accent font-semibold",
                        selectedDate && isSameDay(date, selectedDate) && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => setSelectedDate(date)}
                    >
                      <span>{format(date, 'd')}</span>
                      {hasTasks && (
                        <div className="flex gap-0.5 mt-0.5">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            hasOverdue ? "bg-destructive" : "bg-primary"
                          )} />
                          {dayTasks.length > 1 && (
                            <span className="text-[10px] text-muted-foreground">
                              {dayTasks.length}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                }
              }}
            />
          </CardContent>
        </Card>
      </div>
      
      {/* Task Details Sidebar */}
      <div>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'This Month\'s Tasks'}
            </CardTitle>
            <CardDescription>
              {displayedTasks.length} task{displayedTasks.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {displayedTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No tasks {selectedDate ? 'on this date' : 'this month'}
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedTasks.map((task) => {
                    const isOverdue = task.follow_up_date && isBefore(new Date(task.follow_up_date), startOfDay(new Date()));
                    return (
                      <div key={task.id} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{task.action}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {task.communication_log?.company_name || 'No company'}
                            </p>
                            <Badge variant={isOverdue ? "destructive" : "outline"} className="mt-1 text-xs">
                              {task.follow_up_date ? format(new Date(task.follow_up_date), 'MMM d') : 'No date'}
                            </Badge>
                          </div>
                          {(task.status_after === 'Closed' || task.status_after === 'In Follow-up' ? 'Done' : (task.status_after || 'Open')) === 'Open' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => task.isGeneralTask ? handleCompleteGeneralTask(task.id) : handleMarkComplete(task)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Tasks List</h1>
            <p className="text-muted-foreground">
              {communicationIdFilter 
                ? 'Follow-ups for selected communication' 
                : 'All follow-ups from Communication Tracker'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Notification Manager */}
            <TaskNotificationManager tasks={tasks} />
            
            {/* Add Task Button */}
            <Button onClick={handleAddTaskClick} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => { setViewMode('list'); setSelectedDate(undefined); }}
                className="gap-2"
              >
                <List className="h-4 w-4" />
                List
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => { setViewMode('week'); setSelectedDate(undefined); }}
                className="gap-2"
              >
                <CalendarDays className="h-4 w-4" />
                Week
              </Button>
              <Button
                variant={viewMode === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => { setViewMode('month'); setSelectedDate(undefined); }}
                className="gap-2"
              >
                <CalendarDays className="h-4 w-4" />
                Month
              </Button>
            </div>
          </div>
        </div>
        {/* KPI Summary Cards */}
        <TaskKPISummary
          tasks={filteredTasks}
          onFilterDueToday={handleFilterDueToday}
          onFilterOverdue={handleFilterOverdue}
          onRefresh={fetchTasks}
          activeFilter={activeKPIFilter}
        />
        
        {/* Daily Tasks Kanban Section */}
        {(() => {
          const todayTasks = tasks.filter(task => {
            if (!task.follow_up_date) return false;
            return isToday(new Date(task.follow_up_date));
          });
          
          if (todayTasks.length === 0) return null;
          
          return (
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      Today's Tasks
                    </CardTitle>
                    <CardDescription>
                      {todayTasks.length} task{todayTasks.length !== 1 ? 's' : ''} scheduled for today
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <TaskKanban
                  tasks={todayTasks}
                  onStatusChange={async (taskId, newStatus, isGeneralTask) => {
                    try {
                      if (isGeneralTask) {
                        const dbStatus = newStatus === 'Done' ? 'Completed' : newStatus;
                        const { error } = await supabase
                          .from('general_tasks')
                          .update({ status: dbStatus })
                          .eq('id', taskId);
                        if (error) throw error;
                      } else {
                        const { error } = await supabase
                          .from('follow_up_history')
                          .update({ status_after: newStatus as 'Open' | 'Done' | 'Cancelled' | 'Closed' | 'In Follow-up' })
                          .eq('id', taskId);
                        if (error) throw error;
                      }
                      toast({ title: 'Task updated', description: `Moved to ${newStatus}` });
                      fetchTasks();
                    } catch (error) {
                      console.error('Error updating status:', error);
                      toast({ title: 'Error', description: 'Failed to update task status', variant: 'destructive' });
                    }
                  }}
                  onEdit={(task) => task.isGeneralTask ? handleEditGeneralTask(task) : handleEditFollowUp(task)}
                  onDelete={handleDeleteClick}
                  onComplete={(task) => task.isGeneralTask ? handleCompleteGeneralTask(task.id) : handleMarkComplete(task)}
                  onViewCommunication={handleViewCommunication}
                  onAddClientResponse={(task) => {
                    if (!task.isGeneralTask) {
                      setFollowUpToComplete(task);
                      setCompleteFollowUpModalOpen(true);
                    }
                  }}
                />
              </CardContent>
            </Card>
          );
        })()}
        
        {/* Task Completion Trends Chart */}
        <TaskCompletionTrendsChart tasks={tasks} />
        
        {/* Filters Section */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card rounded-lg border">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as TaskStatus)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Open
                </div>
              </SelectItem>
              <SelectItem value="Done">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Done
                </div>
              </SelectItem>
              <SelectItem value="Cancelled">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Cancelled
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          

          <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Assigned To" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {assignedToOptions.map((assignee) => (
                <SelectItem key={assignee} value={assignee}>
                  {assignee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">From:</span>
            <Input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              className="w-[150px]"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">To:</span>
            <Input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              className="w-[150px]"
            />
          </div>
          
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <XCircle className="h-4 w-4" />
              Clear
            </Button>
          )}
          
          {communicationIdFilter && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.href = '/tasks'}
              className="gap-1"
            >
              <XCircle className="h-4 w-4" />
              Show All Tasks
            </Button>
          )}

          {lastAction && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleUndoLastAction}
              className="gap-1 ml-auto"
            >
              <Undo2 className="h-4 w-4" />
              Undo Last Action
            </Button>
          )}
        </div>

        {viewMode === 'list' && renderListView()}
        {viewMode === 'week' && renderWeeklyView()}
        {viewMode === 'month' && renderMonthlyView()}
      </div>

      {/* Select Communication Dialog */}
      <Dialog open={selectCommDialogOpen} onOpenChange={setSelectCommDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>
              Create a new task or link to a communication
            </DialogDescription>
          </DialogHeader>
          
          {/* Add General Task Button */}
          <Button
            variant="outline"
            onClick={handleAddGeneralTask}
            className="w-full mb-4 border-dashed border-2 hover:border-solid"
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            Add General Task
          </Button>
          
          <div className="relative mb-4">
            <p className="text-sm text-muted-foreground mb-2">Or select a communication for follow-up:</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company or contact..."
                value={commSearchQuery}
                onChange={(e) => setCommSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 -mx-6 px-6">
            {loadingComms ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredCommunications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {commSearchQuery ? 'No communications found' : 'No communications available'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCommunications.map((comm) => (
                  <button
                    key={comm.id}
                    onClick={() => handleSelectCommunication(comm)}
                    className="w-full p-3 rounded-lg border bg-card text-left hover:bg-accent/50 transition-colors"
                  >
                    <p className="font-medium text-sm">{comm.company_name || 'Unknown Company'}</p>
                    <p className="text-xs text-muted-foreground">
                      {comm.person_name || 'No contact'} • {comm.status || 'No status'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Follow-up Dialog */}
      {selectedCommunication && (
        <FollowUpDialog
          open={followUpDialogOpen}
          onOpenChange={setFollowUpDialogOpen}
          communication={{
            id: selectedCommunication.id,
            follow_up_date: selectedCommunication.follow_up_date,
            status: selectedCommunication.status || 'Open',
            action: selectedCommunication.action,
            notes: selectedCommunication.notes,
            quotation_required: selectedCommunication.quotation_required,
            summary: selectedCommunication.summary,
            current_phase: selectedCommunication.current_phase,
          }}
          onSaved={handleFollowUpSaved}
        />
      )}

      {/* General Task Dialog */}
      <GeneralTaskDialog
        open={generalTaskDialogOpen}
        onOpenChange={setGeneralTaskDialogOpen}
        onSaved={fetchTasks}
        editTask={editingGeneralTask}
      />

      {/* Edit Follow-up Dialog */}
      {editingFollowUp && (
        <FollowUpDialog
          open={editFollowUpDialogOpen}
          onOpenChange={(open) => {
            setEditFollowUpDialogOpen(open);
            if (!open) setEditingFollowUp(null);
          }}
          communication={{
            id: editingFollowUp.communication_log_id,
            follow_up_date: editingFollowUp.follow_up_date,
            status: editingFollowUp.status_after || 'Open',
            action: editingFollowUp.action,
            notes: editingFollowUp.notes,
            quotation_required: null,
            summary: null,
            current_phase: null,
          }}
          editingFollowUp={{
            id: editingFollowUp.id,
            follow_up_date: editingFollowUp.follow_up_date,
            action: editingFollowUp.action,
            status_after: editingFollowUp.status_after,
            notes: editingFollowUp.notes,
            follow_up_channel: editingFollowUp.follow_up_channel,
          }}
          onSaved={() => {
            fetchTasks();
            setEditingFollowUp(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{taskToDelete?.action || 'this task'}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedTaskIds.size} Tasks</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedTaskIds.size} selected task(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Reassign Dialog */}
      <Dialog open={bulkReassignOpen} onOpenChange={setBulkReassignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reassign {selectedTaskIds.size} Tasks</DialogTitle>
            <DialogDescription>
              Select a team member to reassign the selected tasks to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reassign-to" className="mb-2 block">Assign To</Label>
            <Select value={bulkReassignTo} onValueChange={setBulkReassignTo}>
              <SelectTrigger id="reassign-to">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name || member.email || member.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkReassignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkReassign} disabled={!bulkReassignTo}>
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Follow-up Modal */}
      <CompleteFollowUpModal
        open={completeFollowUpModalOpen}
        onOpenChange={setCompleteFollowUpModalOpen}
        followUp={followUpToComplete}
        onCompleted={handleFollowUpCompleted}
      />

      {/* Interaction History Modal */}
      <InteractionHistoryModal
        open={interactionHistoryOpen}
        onClose={() => setInteractionHistoryOpen(false)}
        communicationId={viewingCommunicationId}
      />
    </Layout>
  );
};

export default Tasks;

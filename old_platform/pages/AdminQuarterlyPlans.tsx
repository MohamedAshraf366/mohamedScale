import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, GripVertical, Trash2, Calendar, MoreHorizontal, Check, Pencil, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface QuarterlyTask {
  id: string;
  name: string;
  owner: string | null;
  area: string;
  start_week: number;
  end_week: number;
  quarter: string;
  year: number;
  status: string;
}

const AREAS = [
  { value: 'Sales', color: 'bg-blue-500', textColor: 'text-white' },
  { value: 'Supply', color: 'bg-orange-500', textColor: 'text-white' },
  { value: 'Operations', color: 'bg-emerald-500', textColor: 'text-white' },
  { value: 'Admin', color: 'bg-purple-500', textColor: 'text-white' },
];

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const WEEKS = Array.from({ length: 12 }, (_, i) => i + 1);

const getAreaColor = (area: string) => {
  const found = AREAS.find(a => a.value === area);
  return found || { color: 'bg-gray-500', textColor: 'text-white' };
};

const AdminQuarterlyPlans = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const activeSection = searchParams.get('section') || 'all';
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeQuarter, setActiveQuarter] = useState('Q1');
  const [activeYear] = useState(new Date().getFullYear());
  const [newTask, setNewTask] = useState({
    name: '',
    owner: '',
    area: 'Sales',
    start_week: 1,
    end_week: 3,
  });
  
  // Dragging state
  const [draggedTask, setDraggedTask] = useState<QuarterlyTask | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['quarterly-tasks', activeQuarter, activeYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quarterly_tasks')
        .select('*')
        .eq('quarter', activeQuarter)
        .eq('year', activeYear)
        .order('start_week', { ascending: true });
      
      if (error) throw error;
      return data as QuarterlyTask[];
    },
  });

  // Filter tasks by section and status
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(t => t.status !== 'completed');
    if (activeSection !== 'all') {
      filtered = filtered.filter(t => t.area === activeSection);
    }
    return filtered;
  }, [tasks, activeSection]);

  // Completed tasks for table
  const completedTasks = useMemo(() => {
    let filtered = tasks.filter(t => t.status === 'completed');
    if (activeSection !== 'all') {
      filtered = filtered.filter(t => t.area === activeSection);
    }
    return filtered;
  }, [tasks, activeSection]);

  // Add task mutation
  const addTaskMutation = useMutation({
    mutationFn: async (task: Omit<QuarterlyTask, 'id'>) => {
      const { data, error } = await supabase
        .from('quarterly_tasks')
        .insert([task])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarterly-tasks'] });
      toast.success('Task added successfully');
      setIsAddDialogOpen(false);
      setNewTask({ name: '', owner: '', area: 'Sales', start_week: 1, end_week: 3 });
    },
    onError: (error) => {
      toast.error('Failed to add task');
      console.error(error);
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<QuarterlyTask> & { id: string }) => {
      const { data, error } = await supabase
        .from('quarterly_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quarterly-tasks'] });
      if (variables.status === 'completed') {
        toast.success('Task marked as completed');
      } else if (variables.status === 'active') {
        toast.success('Task restored to timeline');
      }
    },
    onError: (error) => {
      toast.error('Failed to update task');
      console.error(error);
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quarterly_tasks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarterly-tasks'] });
      toast.success('Task deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete task');
      console.error(error);
    },
  });

  const handleAddTask = () => {
    if (!newTask.name.trim()) {
      toast.error('Please enter a task name');
      return;
    }
    addTaskMutation.mutate({
      ...newTask,
      quarter: activeQuarter,
      year: activeYear,
      status: 'active',
    });
  };

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent, task: QuarterlyTask, type: 'move' | 'resize-left' | 'resize-right') => {
    e.preventDefault();
    setDraggedTask(task);
    
    if (type === 'resize-left') {
      setIsResizing('left');
    } else if (type === 'resize-right') {
      setIsResizing('right');
    } else {
      setIsResizing(null);
      const barElement = e.currentTarget.closest('.task-bar');
      if (barElement) {
        const rect = barElement.getBoundingClientRect();
        const weekWidth = rect.width / (task.end_week - task.start_week + 1);
        setDragOffset(Math.floor((e.clientX - rect.left) / weekWidth));
      }
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggedTask) return;

    const grid = document.querySelector('.week-grid');
    if (!grid) return;

    const gridRect = grid.getBoundingClientRect();
    const weekWidth = gridRect.width / 12;
    const relativeX = e.clientX - gridRect.left;
    const hoveredWeek = Math.max(1, Math.min(12, Math.floor(relativeX / weekWidth) + 1));

    if (isResizing === 'left') {
      const newStart = Math.min(hoveredWeek, draggedTask.end_week);
      if (newStart !== draggedTask.start_week) {
        updateTaskMutation.mutate({ id: draggedTask.id, start_week: newStart });
        setDraggedTask({ ...draggedTask, start_week: newStart });
      }
    } else if (isResizing === 'right') {
      const newEnd = Math.max(hoveredWeek, draggedTask.start_week);
      if (newEnd !== draggedTask.end_week) {
        updateTaskMutation.mutate({ id: draggedTask.id, end_week: newEnd });
        setDraggedTask({ ...draggedTask, end_week: newEnd });
      }
    } else {
      const duration = draggedTask.end_week - draggedTask.start_week;
      const newStart = Math.max(1, Math.min(12 - duration, hoveredWeek - dragOffset));
      const newEnd = newStart + duration;
      
      if (newStart !== draggedTask.start_week) {
        updateTaskMutation.mutate({ id: draggedTask.id, start_week: newStart, end_week: newEnd });
        setDraggedTask({ ...draggedTask, start_week: newStart, end_week: newEnd });
      }
    }
  }, [draggedTask, dragOffset, isResizing, updateTaskMutation]);

  const handleMouseUp = useCallback(() => {
    setDraggedTask(null);
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (draggedTask) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedTask, handleMouseMove, handleMouseUp]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quarterly Development Plan</h1>
            <p className="text-muted-foreground mt-1">
              Plan and track initiatives across the quarter with visual timeline bars
            </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        </div>

        {/* Quarter Selector */}
        <div className="flex gap-2">
          {QUARTERS.map((q) => (
            <Button
              key={q}
              variant={activeQuarter === q ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveQuarter(q)}
            >
              {q}
            </Button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {AREAS.map((area) => (
            <div key={area.value} className="flex items-center gap-2">
              <div className={cn('w-4 h-4 rounded', area.color)} />
              <span className="text-sm text-muted-foreground">{area.value}</span>
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              12-Week Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Week Headers */}
            <div className="week-grid grid grid-cols-12 border-b bg-muted/30">
              {WEEKS.map((week) => (
                <div
                  key={week}
                  className="p-3 text-center text-sm font-medium border-r last:border-r-0"
                >
                  W{week}
                </div>
              ))}
            </div>

            {/* Task Rows */}
            <div className="relative min-h-[400px]">
              {(() => {
                if (isLoading) {
                  return (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                      Loading tasks...
                    </div>
                  );
                }
                
                if (filteredTasks.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground gap-2">
                      <Calendar className="h-12 w-12 opacity-30" />
                      <p>No tasks for {activeSection !== 'all' ? `${activeSection} in ` : ''}{activeQuarter} {activeYear}</p>
                      <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}>
                        Add your first task
                      </Button>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-0.5 py-4">
                    {filteredTasks.map((task) => {
                    const areaStyle = getAreaColor(task.area);
                    const startPercent = ((task.start_week - 1) / 12) * 100;
                    const widthPercent = ((task.end_week - task.start_week + 1) / 12) * 100;
                    
                      return (
                      <div key={task.id} className="relative h-12 mb-0.5 flex items-center">
                        <div
                          className={cn(
                            'task-bar absolute h-8 rounded-lg shadow-md flex items-center justify-between px-1.5 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-lg group',
                            areaStyle.color,
                            areaStyle.textColor,
                            draggedTask?.id === task.id && 'opacity-80 ring-2 ring-white'
                          )}
                          style={{
                            left: `${startPercent}%`,
                            width: `${widthPercent}%`,
                          }}
                        >
                          {/* Left resize handle */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 rounded-l-lg"
                            onMouseDown={(e) => handleDragStart(e, task, 'resize-left')}
                          />
                          
                          {/* Drag handle */}
                          <div
                            className="flex items-center gap-2 flex-1 min-w-0"
                            onMouseDown={(e) => handleDragStart(e, task, 'move')}
                          >
                            <span className="text-xs font-medium truncate">{task.name}</span>
                          </div>
                          
                          {/* Three dots menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/20 rounded"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updateTaskMutation.mutate({ id: task.id, status: 'completed' })}>
                                <Check className="h-4 w-4 mr-2" />
                                Completed
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toast.info('Edit functionality coming soon')}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => deleteTaskMutation.mutate(task.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          
                          {/* Right resize handle */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 rounded-r-lg"
                            onMouseDown={(e) => handleDragStart(e, task, 'resize-right')}
                          />
                        </div>
                        {/* Owner to the right of the bar */}
                        {task.owner && (
                          <div 
                            className="absolute text-xs text-muted-foreground whitespace-nowrap pl-2"
                            style={{
                              left: `${startPercent + widthPercent}%`,
                            }}
                          >
                            {task.owner}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                );
              })()}

              {/* Grid overlay for visual reference */}
              <div className="absolute inset-0 pointer-events-none week-grid grid grid-cols-12">
                {WEEKS.map((week) => (
                  <div key={week} className="border-r border-dashed border-border/30 last:border-r-0" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completed Tasks Table */}
        {completedTasks.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Completed Tasks
                <Badge variant="secondary" className="ml-2">{completedTasks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedTasks.map((task) => {
                    const areaStyle = getAreaColor(task.area);
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.name}</TableCell>
                        <TableCell>{task.owner || '-'}</TableCell>
                        <TableCell>
                          <Badge className={cn(areaStyle.color, areaStyle.textColor)}>
                            {task.area}
                          </Badge>
                        </TableCell>
                        <TableCell>W{task.start_week} - W{task.end_week}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateTaskMutation.mutate({ id: task.id, status: 'active' })}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteTaskMutation.mutate(task.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Add Task Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Task Name</Label>
                <Input
                  id="name"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  placeholder="Enter task name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner">Owner</Label>
                <Input
                  id="owner"
                  value={newTask.owner}
                  onChange={(e) => setNewTask({ ...newTask, owner: e.target.value })}
                  placeholder="Enter owner name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area">Department Area</Label>
                <Select
                  value={newTask.area}
                  onValueChange={(value) => setNewTask({ ...newTask, area: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AREAS.map((area) => (
                      <SelectItem key={area.value} value={area.value}>
                        <div className="flex items-center gap-2">
                          <div className={cn('w-3 h-3 rounded', area.color)} />
                          {area.value}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_week">Start Week</Label>
                  <Select
                    value={String(newTask.start_week)}
                    onValueChange={(value) => setNewTask({ ...newTask, start_week: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKS.map((week) => (
                        <SelectItem key={week} value={String(week)}>
                          Week {week}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_week">End Week</Label>
                  <Select
                    value={String(newTask.end_week)}
                    onValueChange={(value) => setNewTask({ ...newTask, end_week: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKS.filter(w => w >= newTask.start_week).map((week) => (
                        <SelectItem key={week} value={String(week)}>
                          Week {week}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddTask} disabled={addTaskMutation.isPending}>
                {addTaskMutation.isPending ? 'Adding...' : 'Add Task'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminQuarterlyPlans;

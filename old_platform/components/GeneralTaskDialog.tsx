import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface GeneralTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editTask?: {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    assigned_to: string;
    priority: string | null;
    status: string | null;
  } | null;
}

const GeneralTaskDialog = ({ open, onOpenChange, onSaved, editTask }: GeneralTaskDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null }[]>([]);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    assigned_to: '',
    priority: 'Medium',
    status: 'Open',
  });

  const [errors, setErrors] = useState<{ title?: string; assigned_to?: string }>({});

  useEffect(() => {
    if (open) {
      fetchProfiles();
      if (editTask) {
        setFormData({
          title: editTask.title || '',
          description: editTask.description || '',
          due_date: editTask.due_date ? editTask.due_date.split('T')[0] : '',
          assigned_to: editTask.assigned_to || '',
          priority: editTask.priority || 'Medium',
          status: editTask.status || 'Open',
        });
      } else {
        setFormData({
          title: '',
          description: '',
          due_date: '',
          assigned_to: '',
          priority: 'Medium',
          status: 'Open',
        });
      }
      setErrors({});
    }
  }, [open, editTask]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name');
    setProfiles(data || []);
  };

  const validate = () => {
    const newErrors: { title?: string; assigned_to?: string } = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Task title is required';
    }
    if (!formData.assigned_to.trim()) {
      newErrors.assigned_to = 'Assigned to is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setSaving(true);
    try {
      const taskData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        due_date: formData.due_date || null,
        assigned_to: formData.assigned_to.trim(),
        priority: formData.priority,
        status: formData.status,
        created_by: user?.id,
      };

      if (editTask) {
        const { error } = await supabase
          .from('general_tasks')
          .update(taskData)
          .eq('id', editTask.id);
        
        if (error) throw error;
        toast({ title: 'Task updated', description: 'General task has been updated successfully.' });
      } else {
        const { error } = await supabase
          .from('general_tasks')
          .insert(taskData);
        
        if (error) throw error;
        toast({ title: 'Task created', description: 'General task has been created successfully.' });
      }

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving task:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to save task. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editTask ? 'Edit General Task' : 'Add General Task'}</DialogTitle>
          <DialogDescription>
            Create a standalone task not linked to any communication
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title"
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter task description (optional)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assigned To *</Label>
            <Select value={formData.assigned_to} onValueChange={(val) => setFormData({ ...formData, assigned_to: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.full_name || profile.id}>
                    {profile.full_name || 'Unknown User'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.assigned_to && <p className="text-sm text-destructive">{errors.assigned_to}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(val) => setFormData({ ...formData, priority: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editTask ? 'Update Task' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GeneralTaskDialog;

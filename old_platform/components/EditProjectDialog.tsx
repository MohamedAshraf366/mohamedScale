import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Info } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  client_id: string;
  city?: string;
  district?: string;
  location?: string;
  project_type?: string;
  project_size?: string;
  current_phase?: string;
  status?: string;
  notes?: string;
}

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onSuccess: (updatedProject: Project) => void;
}

const PROJECT_TYPES = [
  'Residential',
  'Commercial',
  'Industrial',
  'Infrastructure',
  'Mixed-Use',
  'Other',
];

const PROJECT_SIZES = [
  'Very Small (< 100 m²)',
  'Small (100-1,000 m²)',
  'Medium (1,000-10,000 m²)',
  'Large (10,000-100,000 m²)',
  'Huge (+100,000 m²)',
];

const PROJECT_PHASES = [
  'Site Preparation & Fencing',
  'Foundation Works / Substructure',
  'Skeleton Works / Superstructure',
  'Masonry & MEP Works',
  'Finishing Works',
];

const PROJECT_STATUSES = ['Active', 'On Hold', 'Completed', 'Cancelled'];

export const EditProjectDialog = ({
  open,
  onOpenChange,
  project,
  onSuccess,
}: EditProjectDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    project_type: '',
    project_size: '',
    current_phase: '',
    city: '',
    district: '',
    location: '',
    status: '',
    notes: '',
  });
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (open && project) {
      const completed = project.status === 'Completed';
      setIsCompleted(completed);
      setFormData({
        name: project.name || '',
        project_type: project.project_type || '',
        project_size: project.project_size || '',
        current_phase: project.current_phase || '',
        city: project.city || '',
        district: project.district || '',
        location: project.location || '',
        status: project.status || 'Active',
        notes: project.notes || '',
      });
    }
  }, [open, project]);

  const handleCompletedChange = (checked: boolean) => {
    setIsCompleted(checked);
    if (checked) {
      setFormData({ ...formData, status: 'Completed' });
    } else if (formData.status === 'Completed') {
      setFormData({ ...formData, status: 'Active' });
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({
          name: formData.name,
          project_type: formData.project_type || null,
          project_size: formData.project_size || null,
          current_phase: formData.current_phase || null,
          city: formData.city || null,
          district: formData.district || null,
          location: formData.location || null,
          status: formData.status || null,
          notes: formData.notes || null,
        })
        .eq('id', project.id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Project updated successfully');
      onSuccess(data);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating project:', error);
      toast.error(error.message || 'Failed to update project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update the project details
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Villa Construction - Phase 1"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Project Type</Label>
              <Select
                value={formData.project_type}
                onValueChange={(value) => setFormData({ ...formData, project_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Project Size</Label>
              <Select
                value={formData.project_size}
                onValueChange={(value) => setFormData({ ...formData, project_size: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Current Phase</Label>
              <Select
                value={formData.current_phase}
                onValueChange={(value) => setFormData({ ...formData, current_phase: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select phase" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_PHASES.map((phase) => (
                    <SelectItem key={phase} value={phase}>
                      {phase}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => {
                  setFormData({ ...formData, status: value });
                  setIsCompleted(value === 'Completed');
                }}
                disabled={isCompleted}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Project Completed Checkbox */}
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <Checkbox
              id="project-completed"
              checked={isCompleted}
              onCheckedChange={handleCompletedChange}
            />
            <div className="flex-1">
              <Label
                htmlFor="project-completed"
                className="text-sm font-medium cursor-pointer"
              >
                Project Completed (No new opportunities allowed)
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When enabled, status is set to "Completed" and adding new opportunities is disabled
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[200px]">
                Existing opportunities remain visible. Only new opportunity creation is disabled.
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="e.g., Riyadh"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="district">District</Label>
              <Input
                id="district"
                placeholder="e.g., Al Olaya"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">Location / Site</Label>
            <Input
              id="location"
              placeholder="e.g., Near King Fahd Road"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this project..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditProjectDialog;

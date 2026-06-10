import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onSuccess: () => void;
  onCreate: (data: any) => Promise<any>;
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

export const ProjectDialog = ({
  open,
  onOpenChange,
  clientId,
  clientName,
  onSuccess,
  onCreate,
}: ProjectDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    project_type: '',
    project_size: '',
    current_phase: 'Planning',
    city: 'Riyadh',
    district: '',
    location: '',
    notes: '',
  });

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    setLoading(true);
    try {
      await onCreate(formData);
      toast.success('Project created successfully');
      onSuccess();
      onOpenChange(false);
      setFormData({
        name: '',
        project_type: '',
        project_size: '',
        current_phase: 'Planning',
        city: 'Riyadh',
        district: '',
        location: '',
        notes: '',
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Project</DialogTitle>
          <DialogDescription>
            Create a new project for {clientName}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="p-0">
          <ScrollArea className="max-h-[60vh] px-6" type="always">
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
          </ScrollArea>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectDialog;

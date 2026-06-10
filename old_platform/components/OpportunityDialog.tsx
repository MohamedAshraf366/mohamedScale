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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onSuccess: () => void;
  onCreate: (data: any) => Promise<any>;
}

interface Project {
  id: string;
  name: string;
  status?: string;
}

export const OpportunityDialog = ({
  open,
  onOpenChange,
  clientId,
  clientName,
  onSuccess,
  onCreate,
}: OpportunityDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjectsCount, setAllProjectsCount] = useState(0);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [existingDealsCount, setExistingDealsCount] = useState(0);
  const [formData, setFormData] = useState({
    project_id: '',
    stage: 'Discovery',
    interest_level: 'Medium',
    material_category: '',
    notes: '',
    closed_result: '' as '' | 'Won' | 'Lost',
    objection_type: '',
    objection_other: '',
  });

  useEffect(() => {
    if (open && clientId) {
      fetchProjects();
    }
  }, [open, clientId]);

  useEffect(() => {
    if (formData.project_id) {
      fetchExistingDealsCount(formData.project_id);
    }
  }, [formData.project_id]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAllProjectsCount(data?.length || 0);
      // Filter out completed projects - no new opportunities allowed
      const activeProjects = (data || []).filter(p => p.status !== 'Completed');
      setProjects(activeProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const createGeneralInterestProject = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          client_id: clientId,
          name: 'General Interest',
          status: 'Active',
          project_type: 'Other',
          city: 'Riyadh',
          notes: 'Auto-created for tracking general client interest',
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating general interest project:', error);
      toast.error('Failed to create General Interest project');
      return null;
    }
  };

  const fetchExistingDealsCount = async (projectId: string) => {
    try {
      const { count, error } = await supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);
      
      if (error) throw error;
      setExistingDealsCount(count || 0);
    } catch (error) {
      console.error('Error fetching deals count:', error);
    }
  };

  const generateOpportunityId = () => {
    const nextNumber = existingDealsCount + 1;
    return `Opportunity ${String(nextNumber).padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    // Validate project selection - allow 'general_interest' as special value
    if (!formData.project_id) {
      toast.error('Please select a project');
      return;
    }

    if (!formData.interest_level) {
      toast.error('Please select an interest level');
      return;
    }

    if (!formData.material_category.trim()) {
      toast.error('Please enter a material category');
      return;
    }

    // Validate closed result when stage is Closed
    if (formData.stage === 'Closed' && !formData.closed_result) {
      toast.error('Please select a closed result (Won/Lost)');
      return;
    }

    // Validate objection reason when Not Interested
    if (formData.interest_level === 'Not interested' && !formData.objection_type) {
      toast.error('Please select an objection reason');
      return;
    }
    if (formData.interest_level === 'Not interested' && formData.objection_type === 'Other' && !formData.objection_other.trim()) {
      toast.error('Please provide details for the objection');
      return;
    }

    setLoading(true);
    try {
      // Handle General Interest project creation
      let projectId = formData.project_id;
      if (formData.project_id === 'general_interest') {
        const newProjectId = await createGeneralInterestProject();
        if (!newProjectId) {
          setLoading(false);
          return;
        }
        projectId = newProjectId;
      }

      const opportunityName = generateOpportunityId();
      
      // Determine is_closed and won based on stage and closed_result
      const isClosed = formData.stage === 'Closed';
      const won = isClosed ? formData.closed_result === 'Won' : null;
      
      // Build notes with material category and objection if applicable
      let fullNotes = `Material Category: ${formData.material_category}`;
      if (formData.interest_level === 'Not interested') {
        const objectionText = formData.objection_type === 'Other' 
          ? `Other: ${formData.objection_other}` 
          : formData.objection_type;
        fullNotes += `\nObjection: ${objectionText}`;
      }
      if (formData.notes) {
        fullNotes += `\n\n${formData.notes}`;
      }
      
      // Create the opportunity
      await onCreate({
        project_id: projectId,
        name: opportunityName,
        stage: formData.stage === 'Closed' 
          ? `Closed ${formData.closed_result}` 
          : formData.stage,
        interest_level: formData.interest_level,
        notes: fullNotes,
        is_closed: isClosed,
        won: won,
      });

      toast.success('Opportunity created successfully');
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create opportunity');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      project_id: '',
      stage: 'Discovery',
      interest_level: 'Medium',
      material_category: '',
      notes: '',
      closed_result: '',
      objection_type: '',
      objection_other: '',
    });
    setExistingDealsCount(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Opportunity</DialogTitle>
          <DialogDescription>
            Create a new opportunity for {clientName}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-180px)] overflow-auto">
          <div className="grid gap-4 py-4 px-1 pr-4">
            {/* Project Selection */}
            <div className="grid gap-2">
              <Label>Project *</Label>
              {loadingProjects ? (
                <div className="h-10 bg-muted animate-pulse rounded-md" />
              ) : (
                <Select
                  value={formData.project_id}
                  onValueChange={(value) => setFormData({ ...formData, project_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.length === 0 && allProjectsCount > 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        All existing projects are completed
                      </div>
                    )}
                    {/* General Interest option - always available */}
                    <SelectItem value="general_interest" className="text-primary font-medium">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        General Interest (No specific project)
                      </span>
                    </SelectItem>
                    {projects.length > 0 && (
                      <div className="px-2 py-1 text-xs text-muted-foreground border-t mt-1 pt-1">
                        Existing Projects
                      </div>
                    )}
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                Select "General Interest" for clients interested but without a specific project yet
              </p>
            </div>

            {/* Auto-generated Opportunity ID */}
            {formData.project_id && (
              <div className="grid gap-2">
                <Label>Opportunity ID</Label>
                <div className="h-10 px-3 flex items-center bg-muted/50 border border-border rounded-md text-sm text-muted-foreground">
                  <Package className="h-4 w-4 mr-2" />
                  {generateOpportunityId()}
                  <span className="ml-2 text-xs">(auto-generated)</span>
                </div>
              </div>
            )}

            {/* Stage - default Discovery */}
            <div className="grid gap-2">
              <Label>Stage *</Label>
              <Select
                value={formData.stage}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  stage: value,
                  closed_result: value !== 'Closed' ? '' : formData.closed_result 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Discovery">Discovery</SelectItem>
                  <SelectItem value="RFP">RFP</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Closed Result - only shown when stage is Closed */}
            {formData.stage === 'Closed' && (
              <div className="grid gap-2">
                <Label>Closed Result *</Label>
                <Select
                  value={formData.closed_result}
                  onValueChange={(value: 'Won' | 'Lost') => setFormData({ ...formData, closed_result: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select result" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Won">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Won
                      </span>
                    </SelectItem>
                    <SelectItem value="Lost">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Lost
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Interest Level - Required */}
            <div className="grid gap-2">
              <Label>Interest Level *</Label>
              <Select
                value={formData.interest_level}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  interest_level: value,
                  objection_type: value !== 'Not interested' ? '' : formData.objection_type,
                  objection_other: value !== 'Not interested' ? '' : formData.objection_other,
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select interest level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      High
                    </span>
                  </SelectItem>
                  <SelectItem value="Medium">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="Low">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      Low
                    </span>
                  </SelectItem>
                  <SelectItem value="Not interested">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Not Interested
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                High/Medium/Low interest appears in Pipeline. "Not Interested" stays outside.
              </p>
            </div>

            {/* Objection Reason - only shown when Not Interested */}
            {formData.interest_level === 'Not interested' && (
              <div className="grid gap-2">
                <Label>Objection Reason *</Label>
                <Select
                  value={formData.objection_type}
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    objection_type: value,
                    objection_other: value !== 'Other' ? '' : formData.objection_other,
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Not interested / No need now">Not interested / No need now</SelectItem>
                    <SelectItem value="Price too high">Price too high</SelectItem>
                    <SelectItem value="Specs / approved vendor / technical requirements">Specs / approved vendor / technical requirements</SelectItem>
                    <SelectItem value="Payment terms">Payment terms</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                
                {formData.objection_type === 'Other' && (
                  <Input
                    placeholder="Please specify the objection..."
                    value={formData.objection_other}
                    onChange={(e) => setFormData({ ...formData, objection_other: e.target.value })}
                    className="mt-2"
                  />
                )}
              </div>
            )}

            {/* Material Category - Simple text field */}
            <div className="grid gap-2">
              <Label>Material Category *</Label>
              <Input
                placeholder="e.g., Steel, Concrete, Finishing Materials..."
                value={formData.material_category}
                onChange={(e) => setFormData({ ...formData, material_category: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Specify the main material category for this opportunity
              </p>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any additional notes about this opportunity..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Opportunity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OpportunityDialog;

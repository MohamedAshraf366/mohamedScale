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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, Clock, Package, Calendar as CalendarDays } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface OpportunityMaterial {
  id: string;
  material_name: string;
  quantity: number | null;
  pricing_type: string;
  expected_delivery_date: string | null;
}

interface Opportunity {
  id: string;
  name: string;
  stage: string;
  client_id?: string;
  created_at?: string;
  interest_level?: string | null;
  expected_value?: number | null;
  expected_close_date?: string | null;
  notes?: string | null;
  is_closed?: boolean | null;
  won?: boolean | null;
}

interface EditOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: Opportunity | null;
  onSuccess: () => void;
  readOnly?: boolean;
}

// Helper to parse stage into base stage and closed result
const parseStage = (stage: string): { baseStage: string; closedResult: '' | 'Won' | 'Lost' } => {
  if (stage === 'Closed Won') {
    return { baseStage: 'Closed', closedResult: 'Won' };
  }
  if (stage === 'Closed Lost') {
    return { baseStage: 'Closed', closedResult: 'Lost' };
  }
  // Map legacy stages to new simplified model
  if (['Qualification', 'Proposal', 'Negotiation', 'Order Confirmed'].includes(stage)) {
    return { baseStage: 'RFP', closedResult: '' };
  }
  if (stage === 'Discovery' || stage === 'RFP' || stage === 'Closed') {
    return { baseStage: stage, closedResult: '' };
  }
  // Default fallback
  return { baseStage: 'Discovery', closedResult: '' };
};

export const EditOpportunityDialog = ({
  open,
  onOpenChange,
  opportunity,
  onSuccess,
  readOnly = false,
}: EditOpportunityDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<OpportunityMaterial[]>([]);
  const [formData, setFormData] = useState({
    interest_level: 'Medium',
    stage: 'Discovery',
    closed_result: '' as '' | 'Won' | 'Lost',
    expected_value: '',
    expected_close_date: undefined as Date | undefined,
    notes: '',
  });

  // Fetch opportunity materials for preview
  useEffect(() => {
    const fetchMaterials = async () => {
      if (opportunity && open && readOnly) {
        const { data } = await supabase
          .from('opportunity_materials')
          .select('*')
          .eq('opportunity_id', opportunity.id);
        
        setMaterials(data || []);
      }
    };
    fetchMaterials();
  }, [opportunity, open, readOnly]);

  useEffect(() => {
    if (opportunity && open) {
      const { baseStage, closedResult } = parseStage(opportunity.stage || 'Discovery');
      setFormData({
        interest_level: opportunity.interest_level || 'Medium',
        stage: baseStage,
        closed_result: closedResult,
        expected_value: opportunity.expected_value?.toString() || '',
        expected_close_date: opportunity.expected_close_date 
          ? new Date(opportunity.expected_close_date) 
          : undefined,
        notes: opportunity.notes || '',
      });
    }
  }, [opportunity, open]);

  const handleSubmit = async () => {
    if (!opportunity) return;
    
    if (!formData.interest_level) {
      toast.error('Interest Level is required');
      return;
    }

    // Validate closed result when stage is Closed
    if (formData.stage === 'Closed' && !formData.closed_result) {
      toast.error('Please select a closed result (Won/Lost)');
      return;
    }

    setLoading(true);
    try {
      // Determine final stage value
      const finalStage = formData.stage === 'Closed' 
        ? `Closed ${formData.closed_result}` 
        : formData.stage;
      
      // Track if stage changed
      const previousStage = opportunity.stage || 'Discovery';
      const stageChanged = previousStage !== finalStage;
      
      // Determine is_closed and won
      const isClosed = formData.stage === 'Closed';
      const won = isClosed ? formData.closed_result === 'Won' : null;

      const updates: Record<string, any> = {
        interest_level: formData.interest_level,
        stage: finalStage,
        is_closed: isClosed,
        won: won,
        expected_value: formData.expected_value ? parseFloat(formData.expected_value) : null,
        expected_close_date: formData.expected_close_date 
          ? format(formData.expected_close_date, 'yyyy-MM-dd') 
          : null,
        notes: formData.notes || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('opportunities')
        .update(updates)
        .eq('id', opportunity.id);

      if (error) throw error;

      // Log stage change to activities table
      if (stageChanged) {
        // Use the client_id from opportunity or fetch it from the updated opportunity
        const clientId = opportunity.client_id;
        if (clientId) {
          const { error: activityError } = await supabase
            .from('activities')
            .insert({
              client_id: clientId,
              opportunity_id: opportunity.id,
              activity_type: 'stage_change',
              summary: `Stage changed: ${previousStage} → ${finalStage}`,
              notes: `Opportunity "${opportunity.name}" stage updated from ${previousStage} to ${finalStage}`,
              activity_date: new Date().toISOString(),
            });
          
          if (activityError) {
            console.error('Failed to log stage change activity:', activityError);
          }
        }
      }

      toast.success('Opportunity updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update opportunity');
    } finally {
      setLoading(false);
    }
  };

  if (!opportunity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{readOnly ? 'Preview Opportunity' : 'Edit Opportunity'}</DialogTitle>
          <DialogDescription>
            {readOnly ? 'View details for' : 'Update details for'} {opportunity.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 grid gap-4 py-4">
          {/* Preview-only: Timeline & Key Dates */}
          {readOnly && opportunity.created_at && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-primary" />
                Timeline
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Started:</span>
                  <p className="font-medium">{format(new Date(opportunity.created_at), 'PPP')}</p>
                  <p className="text-xs text-muted-foreground">
                    ({formatDistanceToNow(new Date(opportunity.created_at), { addSuffix: true })})
                  </p>
                </div>
                {formData.expected_close_date && (
                  <div>
                    <span className="text-muted-foreground">Expected Close:</span>
                    <p className="font-medium">{format(formData.expected_close_date, 'PPP')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview-only: Materials & Quantities */}
          {readOnly && materials.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4 text-primary" />
                Materials / Needs ({materials.length})
              </div>
              <div className="space-y-2">
                {materials.map((mat) => (
                  <div key={mat.id} className="flex items-center justify-between text-sm p-2 bg-background rounded border">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{mat.material_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {mat.pricing_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      {mat.quantity && (
                        <span>Qty: <span className="font-medium text-foreground">{mat.quantity}</span></span>
                      )}
                      {mat.expected_delivery_date && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {format(new Date(mat.expected_delivery_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {readOnly && (opportunity.created_at || materials.length > 0) && (
            <Separator />
          )}

          {/* Interest Level - Required */}
          <div className="grid gap-2">
            <Label>Interest Level *</Label>
            <Select
              value={formData.interest_level}
              onValueChange={(value) => setFormData({ ...formData, interest_level: value })}
              disabled={readOnly}
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
              High/Medium/Low appears in Pipeline. "Not Interested" stays outside.
            </p>
          </div>

          {/* Stage - Simplified to 3 options */}
          <div className="grid gap-2">
            <Label>Stage</Label>
            <Select
              value={formData.stage}
              onValueChange={(value) => setFormData({ 
                ...formData, 
                stage: value,
                closed_result: value !== 'Closed' ? '' : formData.closed_result 
              })}
              disabled={readOnly}
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
                disabled={readOnly}
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

          {/* Expected Value */}
          <div className="grid gap-2">
            <Label>Expected Value (SAR)</Label>
            <Input
              type="number"
              placeholder="e.g., 50000"
              value={formData.expected_value}
              onChange={(e) => setFormData({ ...formData, expected_value: e.target.value })}
              disabled={readOnly}
            />
          </div>

          {/* Expected Close Date */}
          <div className="grid gap-2">
            <Label>Expected Close Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !formData.expected_close_date && "text-muted-foreground"
                  )}
                  disabled={readOnly}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.expected_close_date
                    ? format(formData.expected_close_date, 'PPP')
                    : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.expected_close_date}
                  onSelect={(date) => setFormData({ ...formData, expected_close_date: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Additional notes about this opportunity..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              disabled={readOnly}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditOpportunityDialog;

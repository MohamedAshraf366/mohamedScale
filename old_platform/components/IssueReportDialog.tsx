import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, Truck, MessageSquare, DollarSign, HelpCircle, Upload, X, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { 
  useCreateIssue, 
  IssueType, 
  IssueSeverity, 
  IssueSource,
  getSeverityColor 
} from '@/hooks/useSupplierIssues';
import { z } from 'zod';
import { toast } from 'sonner';

interface IssueReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: IssueSource;
  preselectedSupplierId?: string;
  preselectedMaterialId?: string;
  preselectedShipmentId?: string;
}

const issueSchema = z.object({
  supplier_id: z.string().uuid('Please select a supplier'),
  issue_type: z.enum(['critically_delayed', 'quality_issue', 'pricing_issue', 'communication_issue', 'delay', 'quality', 'price_dispute', 'other']),
  severity: z.enum(['minor', 'major', 'critical']),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  order_reference: z.string().max(100, 'Reference must be less than 100 characters').optional(),
});

const issueTypes: { value: IssueType; label: string; icon: React.ReactNode }[] = [
  { value: 'delay', label: 'Delivery Delay', icon: <Truck className="h-4 w-4" /> },
  { value: 'quality', label: 'Quality Issue', icon: <Package className="h-4 w-4" /> },
  { value: 'price_dispute', label: 'Price Dispute', icon: <DollarSign className="h-4 w-4" /> },
  { value: 'communication_issue', label: 'Communication Issue', icon: <MessageSquare className="h-4 w-4" /> },
  { value: 'other', label: 'Other', icon: <HelpCircle className="h-4 w-4" /> },
];

const IssueReportDialog = ({
  open,
  onOpenChange,
  source,
  preselectedSupplierId,
  preselectedMaterialId,
  preselectedShipmentId,
}: IssueReportDialogProps) => {
  const { t } = useTranslation();
  const createIssue = useCreateIssue();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [supplierId, setSupplierId] = useState(preselectedSupplierId || '');
  const [materialId, setMaterialId] = useState(preselectedMaterialId || '');
  const [issueType, setIssueType] = useState<IssueType>('delay');
  const [severity, setSeverity] = useState<IssueSeverity>('major');
  const [description, setDescription] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('status', 'Active')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch materials
  const { data: materials = [] } = useQuery({
    queryKey: ['materials-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, category')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSupplierId(preselectedSupplierId || '');
      setMaterialId(preselectedMaterialId || '');
      setIssueType('delay');
      setSeverity('major');
      setDescription('');
      setOrderReference('');
      setErrors({});
      setAttachments([]);
      setPreviewUrls([]);
    }
  }, [open, preselectedSupplierId, preselectedMaterialId]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      toast.error('Only image files are allowed');
    }

    // Limit to 5 photos max
    const maxPhotos = 5;
    const remainingSlots = maxPhotos - attachments.length;
    const filesToAdd = imageFiles.slice(0, remainingSlots);
    
    if (imageFiles.length > remainingSlots) {
      toast.warning(`Maximum ${maxPhotos} photos allowed. Only ${remainingSlots} added.`);
    }

    // Create preview URLs
    const newPreviewUrls = filesToAdd.map(file => URL.createObjectURL(file));
    
    setAttachments(prev => [...prev, ...filesToAdd]);
    setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setAttachments(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (attachments.length === 0) return [];

    const uploadedUrls: string[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < attachments.length; i++) {
      const file = attachments[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${timestamp}-${i}.${fileExt}`;
      const filePath = `issues/${supplierId}/${fileName}`;

      const { error } = await supabase.storage
        .from('issue-attachments')
        .upload(filePath, file);

      if (error) {
        console.error('Upload error:', error);
        throw new Error(`Failed to upload ${file.name}`);
      }

      const { data: urlData } = supabase.storage
        .from('issue-attachments')
        .getPublicUrl(filePath);

      uploadedUrls.push(urlData.publicUrl);
    }

    return uploadedUrls;
  };

  const handleSubmit = async () => {
    // Validate
    const result = issueSchema.safeParse({
      supplier_id: supplierId,
      issue_type: issueType,
      severity,
      description: description || undefined,
      order_reference: orderReference || undefined,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    
    try {
      setUploadingPhotos(true);
      
      // Upload photos first
      const photoUrls = await uploadPhotos();

      await createIssue.mutateAsync({
        supplier_id: supplierId,
        issue_type: issueType,
        severity,
        source,
        description: description.trim() || undefined,
        material_id: materialId || undefined,
        shipment_id: preselectedShipmentId,
        order_reference: orderReference.trim() || undefined,
        attachments: photoUrls.length > 0 ? photoUrls : undefined,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setUploadingPhotos(false);
    }
  };

  const getSourceLabel = () => {
    switch (source) {
      case 'manual_sales':
        return 'Sales Feedback';
      case 'manual_ops':
        return 'Operations Report';
      default:
        return 'Issue Report';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Report Supplier Issue
          </DialogTitle>
          <DialogDescription>
            {getSourceLabel()} - Log an issue to track and resolve supplier problems
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className={errors.supplier_id ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.supplier_id && (
              <p className="text-sm text-destructive">{errors.supplier_id}</p>
            )}
          </div>

          {/* Material Selection (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="material">Related Material (Optional)</Label>
            <Select value={materialId} onValueChange={setMaterialId}>
              <SelectTrigger>
                <SelectValue placeholder="Select material if applicable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {materials.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} ({m.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Issue Type */}
          <div className="space-y-2">
            <Label>Issue Type *</Label>
            <div className="grid grid-cols-2 gap-2">
              {issueTypes.map(type => (
                <Button
                  key={type.value}
                  type="button"
                  variant={issueType === type.value ? 'default' : 'outline'}
                  className="justify-start gap-2"
                  onClick={() => setIssueType(type.value)}
                >
                  {type.icon}
                  {type.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label>Severity *</Label>
            <div className="flex gap-2">
              {(['minor', 'major', 'critical'] as IssueSeverity[]).map(sev => (
                <Button
                  key={sev}
                  type="button"
                  variant="outline"
                  className={`flex-1 capitalize ${severity === sev ? getSeverityColor(sev) : ''}`}
                  onClick={() => setSeverity(sev)}
                >
                  {sev}
                </Button>
              ))}
            </div>
            {severity === 'critical' && (
              <p className="text-xs text-amber-600">
                Critical issues require supplier justification before resolution
              </p>
            )}
          </div>

          {/* Order Reference */}
          <div className="space-y-2">
            <Label htmlFor="orderRef">Order/PO Reference (Optional)</Label>
            <Input
              id="orderRef"
              value={orderReference}
              onChange={(e) => setOrderReference(e.target.value)}
              placeholder="e.g., PO-2024-001"
              maxLength={100}
            />
            {errors.order_reference && (
              <p className="text-sm text-destructive">{errors.order_reference}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail..."
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/1000
            </p>
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Photo Attachments */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Attach Photos (Optional)
            </Label>
            <p className="text-xs text-muted-foreground">
              Especially useful for quality issues. Max 5 photos.
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {/* Photo Previews */}
            {previewUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {previewUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Attachment ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-md border"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {attachments.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {attachments.length === 0 ? 'Upload Photos' : 'Add More Photos'}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createIssue.isPending || uploadingPhotos}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {uploadingPhotos ? 'Uploading...' : createIssue.isPending ? 'Submitting...' : 'Report Issue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IssueReportDialog;
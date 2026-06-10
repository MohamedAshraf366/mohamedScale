import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/auditLogger';
import { useTranslation } from 'react-i18next';
import { Upload, Eye, Download, X } from 'lucide-react';
interface MaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  material?: {
    id: string;
    name: string;
    category: string;
    subcategory: string | null;
    uom: string;
    moq: string | null;
    spec_ref: string | null;
    short_desc: string | null;
    long_desc: string | null;
    transportation_type: string | null;
    delivery_time_days: number | null;
    fast_moving_score: number | null;
    datasheet_url: string | null;
    image_url: string | null;
    main_supplier_id: string | null;
    scale_price: number | null;
    market_price_min: number | null;
    market_price_avg: number | null;
    market_price_max: number | null;
    cumulative_order_quantity: number | null;
  } | null;
  prefilledCategory?: string;
  prefilledSubcategory?: string;
}

const PREDEFINED_CATEGORIES = [
  'Blocks',
  'Cements',
  'Fittings',
  'Glass',
  'Aluminum',
  'Steel',
  'Insulation',
  'Gypsum Board',
  'Cables & Wiring',
] as const;

const MaterialDialog = ({ open, onOpenChange, onSuccess, material, prefilledCategory, prefilledSubcategory }: MaterialDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: material?.name || '',
    category: material?.category || prefilledCategory || '',
    subcategory: material?.subcategory || prefilledSubcategory || '',
    uom: material?.uom || '',
    moq: material?.moq || '',
    spec_ref: material?.spec_ref || '',
    short_desc: material?.short_desc || '',
    long_desc: material?.long_desc || '',
    transportation_type: material?.transportation_type || '',
    delivery_time_days: material?.delivery_time_days?.toString() || '',
    fast_moving_score: material?.fast_moving_score?.toString() || '',
    datasheet_url: material?.datasheet_url || '',
    image_url: material?.image_url || '',
    main_supplier_id: material?.main_supplier_id || '',
    scale_price: material?.scale_price?.toString() || '',
    market_price_min: material?.market_price_min?.toString() || '',
    market_price_avg: material?.market_price_avg?.toString() || '',
    market_price_max: material?.market_price_max?.toString() || '',
  });

  // Fetch suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');
      if (!error && data) {
        setSuppliers(data);
      }
    };
    fetchSuppliers();
  }, []);

  // Update form when material changes
  useEffect(() => {
    if (material) {
      // Check if category is custom (not in predefined list)
      const isCustom = !PREDEFINED_CATEGORIES.includes(material.category as any);
      setIsCustomCategory(isCustom);
      
      setFormData({
        name: material.name,
        category: material.category,
        subcategory: material.subcategory || '',
        uom: material.uom,
        moq: material.moq || '',
        spec_ref: material.spec_ref || '',
        short_desc: material.short_desc || '',
        long_desc: material.long_desc || '',
        transportation_type: material.transportation_type || '',
        delivery_time_days: material.delivery_time_days?.toString() || '',
        fast_moving_score: material.fast_moving_score?.toString() || '',
        datasheet_url: material.datasheet_url || '',
        image_url: material.image_url || '',
        main_supplier_id: material.main_supplier_id || '',
        scale_price: material.scale_price?.toString() || '',
        market_price_min: material.market_price_min?.toString() || '',
        market_price_avg: material.market_price_avg?.toString() || '',
        market_price_max: material.market_price_max?.toString() || '',
      });
    } else {
      setIsCustomCategory(false);
      setFormData({
        name: '',
        category: prefilledCategory || '',
        subcategory: prefilledSubcategory || '',
        uom: '',
        moq: '',
        spec_ref: '',
        short_desc: '',
        long_desc: '',
        transportation_type: '',
        delivery_time_days: '',
        fast_moving_score: '',
        datasheet_url: '',
        image_url: '',
        main_supplier_id: '',
        scale_price: '',
        market_price_min: '',
        market_price_avg: '',
        market_price_max: '',
      });
    }
  }, [material, prefilledCategory, prefilledSubcategory]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('common.error'),
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('common.error'),
        description: 'Image size must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `materials/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('material-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('material-images')
        .getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });
      toast({
        title: t('common.success'),
        description: 'Image uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadImage = () => {
    if (formData.image_url) {
      const link = document.createElement('a');
      link.href = formData.image_url;
      link.download = 'material-image';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const materialData = {
        name: formData.name,
        category: formData.category,
        subcategory: formData.subcategory || null,
        uom: formData.uom,
        moq: formData.moq || null,
        spec_ref: formData.spec_ref || null,
        short_desc: formData.short_desc || null,
        long_desc: formData.long_desc || null,
        transportation_type: formData.transportation_type || null,
        delivery_time_days: formData.delivery_time_days
          ? parseInt(formData.delivery_time_days)
          : null,
        fast_moving_score: formData.fast_moving_score
          ? parseInt(formData.fast_moving_score)
          : null,
        datasheet_url: formData.datasheet_url || null,
        image_url: formData.image_url || null,
        main_supplier_id: formData.main_supplier_id || null,
        scale_price: formData.scale_price ? parseFloat(formData.scale_price) : null,
        market_price_min: formData.market_price_min ? parseFloat(formData.market_price_min) : null,
        market_price_avg: formData.market_price_avg ? parseFloat(formData.market_price_avg) : null,
        market_price_max: formData.market_price_max ? parseFloat(formData.market_price_max) : null,
      };

      let result;
      if (material) {
        result = await supabase.from('materials').update(materialData).eq('id', material.id).select().single();
      } else {
        result = await supabase.from('materials').insert([materialData]).select().single();
      }

      if (result.error) throw result.error;

      // Log audit
      if (material) {
        await logAudit({
          action: 'updated',
          module: 'Materials',
          recordId: material.id,
          recordName: materialData.name,
          oldValues: material,
          newValues: materialData,
        });
      } else if (result.data) {
        await logAudit({
          action: 'created',
          module: 'Materials',
          recordId: result.data.id,
          recordName: materialData.name,
          newValues: materialData,
        });
      }

      toast({
        title: t('common.success'),
        description: material ? t('dialogs.material.updated') : t('dialogs.material.added'),
      });

      setFormData({
        name: '',
        category: '',
        subcategory: '',
        uom: '',
        moq: '',
        spec_ref: '',
        short_desc: '',
        long_desc: '',
        transportation_type: '',
        delivery_time_days: '',
        fast_moving_score: '',
        datasheet_url: '',
        image_url: '',
        main_supplier_id: '',
        scale_price: '',
        market_price_min: '',
        market_price_avg: '',
        market_price_max: '',
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding material:', error);
      toast({
        title: t('common.error'),
        description: t('dialogs.material.saveError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{material ? t('dialogs.material.titleEdit') : t('dialogs.material.titleNew')}</DialogTitle>
          <DialogDescription>
            {material ? t('dialogs.material.descriptionEdit') : t('dialogs.material.descriptionNew')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('dialogs.material.name')} *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">{t('dialogs.material.category')} *</Label>
              {isCustomCategory ? (
                <div className="space-y-2">
                  <Input
                    id="category"
                    required
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder={t('dialogs.material.enterCustomCategory')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsCustomCategory(false);
                      setFormData({ ...formData, category: '' });
                    }}
                    className="h-8 text-xs"
                  >
                    {t('dialogs.material.backToPredefined')}
                  </Button>
                </div>
              ) : (
                <Select
                  required
                  value={formData.category}
                  onValueChange={(value) => {
                    if (value === '__new_category__') {
                      setIsCustomCategory(true);
                      setFormData({ ...formData, category: '' });
                    } else {
                      setFormData({ ...formData, category: value });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('dialogs.material.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PREDEFINED_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new_category__">
                      {t('dialogs.material.newCategory')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subcategory">{t('dialogs.material.subcategory')}</Label>
              <Input
                id="subcategory"
                value={formData.subcategory}
                onChange={(e) =>
                  setFormData({ ...formData, subcategory: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uom">{t('dialogs.material.uom')} *</Label>
              <Select
                required
                value={formData.uom}
                onValueChange={(value) =>
                  setFormData({ ...formData, uom: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('dialogs.material.selectUom')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="piece">Piece</SelectItem>
                  <SelectItem value="meter">Meter</SelectItem>
                  <SelectItem value="m3">m³</SelectItem>
                  <SelectItem value="ton">Ton</SelectItem>
                  <SelectItem value="m2">m²</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="moq">{t('dialogs.material.moq')}</Label>
              <Input
                id="moq"
                value={formData.moq}
                onChange={(e) =>
                  setFormData({ ...formData, moq: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="spec_ref">{t('dialogs.material.specRef')}</Label>
              <Input
                id="spec_ref"
                value={formData.spec_ref}
                onChange={(e) =>
                  setFormData({ ...formData, spec_ref: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="short_desc">{t('dialogs.material.shortDesc')}</Label>
            <Textarea
              id="short_desc"
              rows={2}
              value={formData.short_desc}
              onChange={(e) =>
                setFormData({ ...formData, short_desc: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="long_desc">{t('dialogs.material.longDesc')}</Label>
            <Textarea
              id="long_desc"
              rows={3}
              value={formData.long_desc}
              onChange={(e) =>
                setFormData({ ...formData, long_desc: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="transportation_type">{t('dialogs.material.transportationType')}</Label>
              <Select
                value={formData.transportation_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, transportation_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('dialogs.material.selectTransportType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Flatbed">Flatbed</SelectItem>
                  <SelectItem value="Mixer">Mixer</SelectItem>
                  <SelectItem value="Trailer">Trailer</SelectItem>
                  <SelectItem value="Box Truck">Box Truck</SelectItem>
                  <SelectItem value="Van">Van</SelectItem>
                  <SelectItem value="Crane-assisted Flatbed">
                    Crane-assisted Flatbed
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_time_days">{t('dialogs.material.deliveryTimeDays')}</Label>
              <Input
                id="delivery_time_days"
                type="number"
                min="0"
                value={formData.delivery_time_days}
                onChange={(e) =>
                  setFormData({ ...formData, delivery_time_days: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="main_supplier_id">{t('dialogs.material.mainSupplier')}</Label>
              <Select
                value={formData.main_supplier_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, main_supplier_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('dialogs.material.selectSupplier')} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fast_moving_score">{t('dialogs.material.fastMovingScore')}</Label>
              <Input
                id="fast_moving_score"
                type="number"
                min="0"
                max="100"
                value={formData.fast_moving_score}
                onChange={(e) =>
                  setFormData({ ...formData, fast_moving_score: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scale_price">{t('dialogs.material.scalePrice')}</Label>
            <Input
              id="scale_price"
              type="number"
              step="0.001"
              min="0"
              value={formData.scale_price}
              onChange={(e) =>
                setFormData({ ...formData, scale_price: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Market Price</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="market_price_min" className="text-xs">Min</Label>
                <Input
                  id="market_price_min"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Min"
                  value={formData.market_price_min}
                  onChange={(e) => {
                    const min = e.target.value;
                    const max = formData.market_price_max;
                    const avg = min && max 
                      ? ((parseFloat(min) + parseFloat(max)) / 2).toFixed(3)
                      : formData.market_price_avg;
                    setFormData({ ...formData, market_price_min: min, market_price_avg: avg });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="market_price_avg" className="text-xs">Avg</Label>
                <Input
                  id="market_price_avg"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Avg"
                  value={formData.market_price_avg}
                  readOnly
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="market_price_max" className="text-xs">Max</Label>
                <Input
                  id="market_price_max"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Max"
                  value={formData.market_price_max}
                  onChange={(e) => {
                    const max = e.target.value;
                    const min = formData.market_price_min;
                    const avg = min && max 
                      ? ((parseFloat(min) + parseFloat(max)) / 2).toFixed(3)
                      : formData.market_price_avg;
                    setFormData({ ...formData, market_price_max: max, market_price_avg: avg });
                  }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="datasheet_url">{t('dialogs.material.datasheetUrl')}</Label>
              <Input
                id="datasheet_url"
                type="url"
                value={formData.datasheet_url}
                onChange={(e) =>
                  setFormData({ ...formData, datasheet_url: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Material Image</Label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingImage ? 'Uploading...' : 'Upload'}
                </Button>
                {formData.image_url && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewOpen(true)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadImage}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, image_url: '' })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              {formData.image_url && (
                <p className="text-xs text-muted-foreground truncate">
                  {formData.image_url.split('/').pop()}
                </p>
              )}
            </div>
          </div>

          {/* Image Preview Dialog */}
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Image Preview</DialogTitle>
              </DialogHeader>
              <div className="flex justify-center">
                <img
                  src={formData.image_url}
                  alt="Material preview"
                  className="max-h-[60vh] object-contain rounded-lg"
                />
              </div>
            </DialogContent>
          </Dialog>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('dialogs.material.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('common.loading') : (material ? `${t('dialogs.material.update')} ${t('dialogs.material.material')}` : `${t('dialogs.material.add')} ${t('dialogs.material.material')}`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialDialog;

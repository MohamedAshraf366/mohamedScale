import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/auditLogger';
import { useTranslation } from 'react-i18next';
import { Upload, FileText, X, Loader2, Plus, Trash2, Download, Calendar, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Supplier {
  id: string;
  name: string;
  supplier_code: string | null;
  contact_person: string | null;
  phone: string | null;
  secondary_phone: string | null;
  email: string | null;
  city: string | null;
  location: string | null;
  rating: number | null;
  lead_time_days: number | null;
  notes: string | null;
  quotation_url: string | null;
  supplier_type: string | null;
  coverage: string[] | null;
  status: string | null;
  total_orders: number | null;
  on_time_delivery_percent: number | null;
  updated_at: string | null;
}

interface Material {
  id: string;
  name: string;
}

interface SupplierMaterial {
  material_id: string;
  unit_price: number | null;
  manufacturer_price: number | null;
  delivery_price: number | null;
  moq: number | null;
  price_valid_until: string | null;
  material_notes: string | null;
}

interface SupplierQuotation {
  id: string;
  file_url: string;
  file_name: string;
  title: string | null;
  quotation_date: string;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  related_materials: string[];
}

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  onSuccess: () => void;
  mode?: 'view' | 'edit';
}

const SUPPLIER_TYPES = ['Manufacturer', 'Distributor', 'Both'];

const SupplierDialog = ({ open, onOpenChange, supplier, onSuccess, mode = 'edit' }: SupplierDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<SupplierMaterial[]>([]);
  const [quotations, setQuotations] = useState<SupplierQuotation[]>([]);
  const [uploadingQuotation, setUploadingQuotation] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const quotationFileInputRef = useRef<HTMLInputElement>(null);
  
  // Quotation upload form
  const [newQuotationFile, setNewQuotationFile] = useState<File | null>(null);
  const [newQuotationTitle, setNewQuotationTitle] = useState('');
  const [newQuotationDate, setNewQuotationDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newQuotationNotes, setNewQuotationNotes] = useState('');
  const [newQuotationMaterials, setNewQuotationMaterials] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    secondary_phone: '',
    email: '',
    city: '',
    location: '',
    rating: '',
    lead_time_days: '',
    notes: '',
    supplier_type: '',
    status: 'Active',
    total_orders: '',
    on_time_delivery_percent: '',
  });

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('id, name')
      .order('name');
    
    if (!error && data) {
      setMaterials(data);
    }
  };

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name,
        contact_person: supplier.contact_person || '',
        phone: supplier.phone || '',
        secondary_phone: supplier.secondary_phone || '',
        email: supplier.email || '',
        city: supplier.city || '',
        location: supplier.location || '',
        rating: supplier.rating?.toString() || '',
        lead_time_days: supplier.lead_time_days?.toString() || '',
        notes: supplier.notes || '',
        supplier_type: supplier.supplier_type || '',
        status: supplier.status || 'Active',
        total_orders: supplier.total_orders?.toString() || '',
        on_time_delivery_percent: supplier.on_time_delivery_percent?.toString() || '',
      });
      
      fetchSupplierMaterials(supplier.id);
      fetchSupplierQuotations(supplier.id);
    } else {
      resetForm();
    }
  }, [supplier]);

  const resetForm = () => {
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      secondary_phone: '',
      email: '',
      city: '',
      location: '',
      rating: '',
      lead_time_days: '',
      notes: '',
      supplier_type: '',
      status: 'Active',
      total_orders: '',
      on_time_delivery_percent: '',
    });
    setSelectedMaterials([]);
    setQuotations([]);
    setNewQuotationFile(null);
    setNewQuotationTitle('');
    setNewQuotationDate(format(new Date(), 'yyyy-MM-dd'));
    setNewQuotationNotes('');
    setNewQuotationMaterials([]);
  };

  const fetchSupplierMaterials = async (supplierId: string) => {
    const { data, error } = await supabase
      .from('material_alt_suppliers')
      .select('material_id, unit_price, manufacturer_price, delivery_price, moq, price_valid_until, material_notes')
      .eq('supplier_id', supplierId);
    
    if (!error && data) {
      setSelectedMaterials(data.map(m => ({
        ...m,
        price_valid_until: m.price_valid_until || null,
      })));
    }
  };

  const fetchSupplierQuotations = async (supplierId: string) => {
    const { data, error } = await supabase
      .from('supplier_quotations')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      // Fetch related materials for each quotation
      const quotationsWithMaterials = await Promise.all(data.map(async (q) => {
        const { data: materialsData } = await supabase
          .from('supplier_quotation_materials')
          .select('material_id')
          .eq('quotation_id', q.id);
        
        return {
          ...q,
          related_materials: materialsData?.map(m => m.material_id) || [],
        };
      }));
      
      setQuotations(quotationsWithMaterials);
    }
  };

  const handleAddMaterial = () => {
    setSelectedMaterials([...selectedMaterials, { 
      material_id: '', 
      unit_price: null, 
      manufacturer_price: null, 
      delivery_price: null,
      moq: null,
      price_valid_until: null,
      material_notes: null,
    }]);
  };

  const handleRemoveMaterial = (index: number) => {
    setSelectedMaterials(selectedMaterials.filter((_, i) => i !== index));
  };

  const handleMaterialChange = (index: number, field: keyof SupplierMaterial, value: any) => {
    const updated = [...selectedMaterials];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedMaterials(updated);
  };


  const uploadQuotationToStorage = async (file: File, supplierId: string): Promise<{ url: string; name: string }> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${supplierId}/${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('supplier-quotations')
      .upload(fileName, file, { upsert: true });
    
    if (uploadError) throw uploadError;
    
    return { url: fileName, name: file.name };
  };

  const handleUploadQuotation = async () => {
    if (!newQuotationFile || !supplier || !newQuotationDate) {
      toast({
        title: 'Missing required fields',
        description: 'Please select a file and enter quotation date',
        variant: 'destructive',
      });
      return;
    }

    setUploadingQuotation(true);
    try {
      const { url, name } = await uploadQuotationToStorage(newQuotationFile, supplier.id);
      
      const { data: quotationData, error: quotationError } = await supabase
        .from('supplier_quotations')
        .insert({
          supplier_id: supplier.id,
          file_url: url,
          file_name: name,
          title: newQuotationTitle || null,
          quotation_date: newQuotationDate,
          notes: newQuotationNotes || null,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select('id')
        .single();

      if (quotationError) throw quotationError;

      // Add related materials
      if (newQuotationMaterials.length > 0) {
        await supabase
          .from('supplier_quotation_materials')
          .insert(
            newQuotationMaterials.map(materialId => ({
              quotation_id: quotationData.id,
              material_id: materialId,
            }))
          );
      }

      toast({ title: 'Quotation uploaded successfully' });
      
      // Reset form and refresh
      setNewQuotationFile(null);
      setNewQuotationTitle('');
      setNewQuotationDate(format(new Date(), 'yyyy-MM-dd'));
      setNewQuotationNotes('');
      setNewQuotationMaterials([]);
      if (quotationFileInputRef.current) {
        quotationFileInputRef.current.value = '';
      }
      
      fetchSupplierQuotations(supplier.id);
    } catch (error) {
      console.error('Error uploading quotation:', error);
      toast({
        title: 'Error uploading quotation',
        variant: 'destructive',
      });
    } finally {
      setUploadingQuotation(false);
    }
  };

  const handleDeleteQuotation = async (quotation: SupplierQuotation) => {
    if (!confirm('Are you sure you want to delete this quotation?')) return;

    try {
      // Delete from storage
      await supabase.storage.from('supplier-quotations').remove([quotation.file_url]);
      
      // Delete from database (cascade will handle materials junction)
      const { error } = await supabase
        .from('supplier_quotations')
        .delete()
        .eq('id', quotation.id);

      if (error) throw error;

      toast({ title: 'Quotation deleted' });
      if (supplier) {
        fetchSupplierQuotations(supplier.id);
      }
    } catch (error) {
      console.error('Error deleting quotation:', error);
      toast({
        title: 'Error deleting quotation',
        variant: 'destructive',
      });
    }
  };

  const getQuotationPublicUrl = (fileUrl: string) => {
    const { data } = supabase.storage.from('supplier-quotations').getPublicUrl(fileUrl);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const supplierData: any = {
      name: formData.name,
      contact_person: formData.contact_person || null,
      phone: formData.phone || null,
      secondary_phone: formData.secondary_phone || null,
      email: formData.email || null,
      city: formData.city || null,
      location: formData.location || null,
      rating: formData.rating ? parseInt(formData.rating) : null,
      lead_time_days: formData.lead_time_days ? parseInt(formData.lead_time_days) : null,
      notes: formData.notes || null,
      supplier_type: formData.supplier_type || null,
      status: formData.status || 'Active',
      total_orders: formData.total_orders ? parseInt(formData.total_orders) : null,
      on_time_delivery_percent: formData.on_time_delivery_percent ? parseFloat(formData.on_time_delivery_percent) : null,
    };

    try {
      let supplierId: string;
      
      if (supplier) {
        supplierId = supplier.id;
        
        const { error } = await supabase
          .from('suppliers')
          .update(supplierData)
          .eq('id', supplier.id);

        if (error) throw error;
        
        await logAudit({
          action: 'updated',
          module: 'Suppliers',
          recordId: supplier.id,
          recordName: supplierData.name,
          oldValues: supplier,
          newValues: supplierData,
        });
      } else {
        const { data, error } = await supabase
          .from('suppliers')
          .insert([supplierData])
          .select('id')
          .single();

        if (error) throw error;
        supplierId = data.id;
        
        await logAudit({
          action: 'created',
          module: 'Suppliers',
          recordId: data.id,
          recordName: supplierData.name,
          newValues: supplierData,
        });
      }

      // Update materials
      if (supplier) {
        await supabase
          .from('material_alt_suppliers')
          .delete()
          .eq('supplier_id', supplierId);
      }

      const validMaterials = selectedMaterials.filter(m => m.material_id);
      if (validMaterials.length > 0) {
        const { error: materialsError } = await supabase
          .from('material_alt_suppliers')
          .insert(
            validMaterials.map(m => ({
              supplier_id: supplierId,
              material_id: m.material_id,
              unit_price: m.unit_price,
              manufacturer_price: m.manufacturer_price,
              delivery_price: m.delivery_price,
              moq: m.moq,
              price_valid_until: m.price_valid_until || null,
              material_notes: m.material_notes || null,
            }))
          );

        if (materialsError) throw materialsError;
      }

      toast({ title: supplier ? t('dialogs.supplier.updated') : t('dialogs.supplier.added') });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast({
        title: t('dialogs.supplier.saveError'),
        description: t('common.error'),
        variant: 'destructive',
      });
    }
  };

  const isViewMode = mode === 'view';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isViewMode ? t('dialogs.supplier.titleView') : (supplier ? t('dialogs.supplier.titleEdit') : t('dialogs.supplier.titleNew'))}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="materials">Materials & Pricing</TabsTrigger>
            <TabsTrigger value="quotations" disabled={!supplier}>Quotations</TabsTrigger>
          </TabsList>
          
          <ScrollArea className="flex-1 pr-4">
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <TabsContent value="details" className="mt-0 space-y-4">
                {supplier?.supplier_code && (
                  <div className="bg-muted p-3 rounded-lg">
                    <Label className="text-sm text-muted-foreground">{t('dialogs.supplier.supplierCode')}</Label>
                    <p className="font-mono text-lg font-semibold">{supplier.supplier_code}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('dialogs.supplier.name')} *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Supplier Type</Label>
                    <Select
                      value={formData.supplier_type}
                      onValueChange={(value) => setFormData({ ...formData, supplier_type: value })}
                      disabled={isViewMode}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPLIER_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_person">{t('dialogs.supplier.contactPerson')}</Label>
                    <Input
                      id="contact_person"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                      disabled={isViewMode}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('dialogs.supplier.phone')}</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondary_phone">{t('dialogs.supplier.secondaryPhone')}</Label>
                    <Input
                      id="secondary_phone"
                      value={formData.secondary_phone}
                      onChange={(e) => setFormData({ ...formData, secondary_phone: e.target.value })}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('dialogs.supplier.email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">{t('dialogs.supplier.city')}</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">{t('dialogs.supplier.location')}</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rating">{t('dialogs.supplier.rating')}</Label>
                    <Input
                      id="rating"
                      type="number"
                      min="1"
                      max="5"
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                      disabled={isViewMode}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">{t('dialogs.supplier.notes')}</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    disabled={isViewMode}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="performance" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="total_orders">Total Orders</Label>
                    <Input
                      id="total_orders"
                      type="number"
                      min="0"
                      value={formData.total_orders}
                      onChange={(e) => setFormData({ ...formData, total_orders: e.target.value })}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="on_time_delivery_percent">On-time Delivery %</Label>
                    <Input
                      id="on_time_delivery_percent"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.on_time_delivery_percent}
                      onChange={(e) => setFormData({ ...formData, on_time_delivery_percent: e.target.value })}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead_time_days">{t('dialogs.supplier.leadTimeDays')}</Label>
                    <Input
                      id="lead_time_days"
                      type="number"
                      value={formData.lead_time_days}
                      onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
                      disabled={isViewMode}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  These fields are for manual tracking. Future updates will automate these metrics.
                </p>
              </TabsContent>
              
              <TabsContent value="materials" className="mt-0 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">{t('dialogs.supplier.materialsPricing')}</Label>
                  {!isViewMode && (
                    <Button type="button" variant="outline" size="sm" onClick={handleAddMaterial}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('dialogs.supplier.addMaterial')}
                    </Button>
                  )}
                </div>
                
                {selectedMaterials.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No materials added. Click "Add Material" to add pricing information.
                  </p>
                ) : (
                  selectedMaterials.map((material, index) => {
                    const manufacturerPrice = material.manufacturer_price || 0;
                    const deliveryPrice = material.delivery_price || 0;
                    const totalPrice = manufacturerPrice + deliveryPrice;
                    const totalPriceWithVAT = totalPrice + (totalPrice * 0.15);
                    
                    return (
                      <div key={index} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">Material #{index + 1}</Label>
                          {!isViewMode && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMaterial(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2 space-y-2">
                            <Label>Material</Label>
                            <Select
                              value={material.material_id}
                              onValueChange={(value) => handleMaterialChange(index, 'material_id', value)}
                              disabled={isViewMode}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select material" />
                              </SelectTrigger>
                              <SelectContent>
                                {materials.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Manufacturer Price</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={material.manufacturer_price || ''}
                              onChange={(e) => handleMaterialChange(index, 'manufacturer_price', e.target.value ? parseFloat(e.target.value) : null)}
                              disabled={isViewMode}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Delivery Price</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={material.delivery_price || ''}
                              onChange={(e) => handleMaterialChange(index, 'delivery_price', e.target.value ? parseFloat(e.target.value) : null)}
                              disabled={isViewMode}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>MOQ</Label>
                            <Input
                              type="number"
                              min="0"
                              value={material.moq || ''}
                              onChange={(e) => handleMaterialChange(index, 'moq', e.target.value ? parseFloat(e.target.value) : null)}
                              disabled={isViewMode}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Price Valid Until</Label>
                            <Input
                              type="date"
                              value={material.price_valid_until || ''}
                              onChange={(e) => handleMaterialChange(index, 'price_valid_until', e.target.value || null)}
                              disabled={isViewMode}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Total (excl. VAT)</Label>
                            <Input
                              type="text"
                              value={`SAR ${totalPrice.toFixed(3)}`}
                              disabled
                              className="bg-muted"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Total (incl. VAT 15%)</Label>
                            <Input
                              type="text"
                              value={`SAR ${totalPriceWithVAT.toFixed(3)}`}
                              disabled
                              className="bg-muted"
                            />
                          </div>
                          
                          <div className="col-span-2 space-y-2">
                            <Label>Material Notes</Label>
                            <Textarea
                              value={material.material_notes || ''}
                              onChange={(e) => handleMaterialChange(index, 'material_notes', e.target.value || null)}
                              disabled={isViewMode}
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>
              
              <TabsContent value="quotations" className="mt-0 space-y-4">
                {!isViewMode && (
                  <div className="border rounded-lg p-4 space-y-4">
                    <Label className="text-lg font-semibold">Upload New Quotation</Label>
                    
                    <input
                      ref={quotationFileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      onChange={(e) => setNewQuotationFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-20 border-dashed"
                          onClick={() => quotationFileInputRef.current?.click()}
                        >
                          {newQuotationFile ? (
                            <div className="flex items-center gap-2">
                              <FileText className="h-5 w-5" />
                              <span className="truncate max-w-xs">{newQuotationFile.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNewQuotationFile(null);
                                  if (quotationFileInputRef.current) {
                                    quotationFileInputRef.current.value = '';
                                  }
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Upload className="h-6 w-6" />
                              <span>Click to upload file (PDF, Excel, Images)</span>
                            </div>
                          )}
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Title (optional)</Label>
                        <Input
                          value={newQuotationTitle}
                          onChange={(e) => setNewQuotationTitle(e.target.value)}
                          placeholder="e.g., Q4 2024 Pricing"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Quotation Date *</Label>
                        <Input
                          type="date"
                          value={newQuotationDate}
                          onChange={(e) => setNewQuotationDate(e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="col-span-2 space-y-2">
                        <Label>Related Materials (optional)</Label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
                          {materials.map(m => (
                            <div key={m.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`qm-${m.id}`}
                                checked={newQuotationMaterials.includes(m.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setNewQuotationMaterials([...newQuotationMaterials, m.id]);
                                  } else {
                                    setNewQuotationMaterials(newQuotationMaterials.filter(id => id !== m.id));
                                  }
                                }}
                              />
                              <Label htmlFor={`qm-${m.id}`} className="text-sm font-normal">{m.name}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="col-span-2 space-y-2">
                        <Label>Notes (optional)</Label>
                        <Textarea
                          value={newQuotationNotes}
                          onChange={(e) => setNewQuotationNotes(e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>
                    
                    <Button
                      type="button"
                      onClick={handleUploadQuotation}
                      disabled={!newQuotationFile || uploadingQuotation}
                    >
                      {uploadingQuotation ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Quotation
                        </>
                      )}
                    </Button>
                  </div>
                )}
                
                <Separator />
                
                <div className="space-y-2">
                  <Label className="text-lg font-semibold">Uploaded Quotations ({quotations.length})</Label>
                  
                  {quotations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No quotations uploaded yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {quotations.map((q) => (
                        <div key={q.id} className="border rounded-lg p-3 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-medium truncate">{q.title || q.file_name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(q.quotation_date), 'MMM d, yyyy')}</span>
                              <span>•</span>
                              <span>Uploaded {format(new Date(q.created_at), 'MMM d, yyyy')}</span>
                            </div>
                            {q.related_materials.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {q.related_materials.slice(0, 3).map(matId => {
                                  const mat = materials.find(m => m.id === matId);
                                  return mat ? (
                                    <Badge key={matId} variant="secondary" className="text-xs">
                                      {mat.name}
                                    </Badge>
                                  ) : null;
                                })}
                                {q.related_materials.length > 3 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{q.related_materials.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              asChild
                            >
                              <a href={getQuotationPublicUrl(q.file_url)} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              asChild
                            >
                              <a href={getQuotationPublicUrl(q.file_url)} download={q.file_name}>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                            {!isViewMode && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteQuotation(q)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {isViewMode ? t('dialogs.supplier.close') : t('dialogs.supplier.cancel')}
                </Button>
                {!isViewMode && (
                  <Button type="submit">
                    {supplier ? t('dialogs.supplier.update') : t('dialogs.supplier.add')} {t('dialogs.supplier.supplier')}
                  </Button>
                )}
              </div>
            </form>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierDialog;
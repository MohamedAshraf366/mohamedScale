import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface PipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineItem: any | null;
  onSave: () => void;
}

interface QuotationItem {
  id?: string;
  material_id: string;
  quantity: string;
  unit_price: string;
  scale_price?: number;
  supplier_id?: string;
}

const PipelineDialog = ({ open, onOpenChange, pipelineItem, onSave }: PipelineDialogProps) => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [projectType, setProjectType] = useState('');
  const [projectSize, setProjectSize] = useState('');
  const [currentPhase, setCurrentPhase] = useState('');
  const [isGeneralQuotation, setIsGeneralQuotation] = useState(false);
  const [isSoftQuotation, setIsSoftQuotation] = useState(false);
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([
    { material_id: '', quantity: '', unit_price: '', scale_price: 0, supplier_id: '' }
  ]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: materialsData } = await supabase.from('materials').select('id, name, scale_price').order('name');
      setMaterials(materialsData || []);
      
      const { data: suppliersData } = await supabase.from('suppliers').select('id, name').order('name');
      setSuppliers(suppliersData || []);
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchQuotationItems = async () => {
      if (pipelineItem?.id) {
        // Set common fields from pipelineItem
        setDistrict(pipelineItem.district || '');
        setCity(pipelineItem.city || '');
        setLocation(pipelineItem.location || '');
        setProjectType(pipelineItem.project_type || '');
        setProjectSize(pipelineItem.project_size || '');
        setCurrentPhase(pipelineItem.current_phase || '');
        setIsGeneralQuotation(pipelineItem.is_general_quotation || false);
        setIsSoftQuotation(pipelineItem.is_soft_quotation || false);

        const { data } = await supabase
          .from('quotation_items')
          .select('*')
          .eq('communication_log_id', pipelineItem.id);
        
        if (data && data.length > 0) {
          setQuotationItems(data.map(item => ({
            id: item.id,
            material_id: item.material_id || '',
            quantity: item.quantity?.toString() || '',
            unit_price: item.unit_price?.toString() || '',
            supplier_id: item.supplier_id || '',
          })));
        } else {
          setQuotationItems([{ material_id: '', quantity: '', unit_price: '', scale_price: 0, supplier_id: '' }]);
        }
      } else {
        setDistrict('');
        setCity('');
        setLocation('');
        setProjectType('');
        setProjectSize('');
        setCurrentPhase('');
        setIsGeneralQuotation(false);
        setIsSoftQuotation(false);
        setQuotationItems([{ material_id: '', quantity: '', unit_price: '', scale_price: 0, supplier_id: '' }]);
      }
    };
    
    if (open) {
      fetchQuotationItems();
    }
  }, [pipelineItem, open]);

  const addItem = () => {
    setQuotationItems([...quotationItems, { material_id: '', quantity: '', unit_price: '', scale_price: 0, supplier_id: '' }]);
  };

  const removeItem = (index: number) => {
    if (quotationItems.length > 1) {
      setQuotationItems(quotationItems.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: string) => {
    const newItems = [...quotationItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // If material changed, fetch and set scale price
    if (field === 'material_id' && value) {
      const material = materials.find(m => m.id === value);
      if (material?.scale_price) {
        newItems[index].scale_price = parseFloat(material.scale_price);
        if (!newItems[index].unit_price) {
          newItems[index].unit_price = material.scale_price.toString();
        }
      }
    }
    
    setQuotationItems(newItems);
  };

  const calculateTotal = () => {
    return quotationItems.reduce((total, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return total + (quantity * price);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pipelineItem?.id) {
      toast.error('No quotation selected');
      return;
    }

    try {
      // Update communication_log with common fields
      const { error: updateError } = await supabase
        .from('communication_log')
        .update({
          district,
          city,
          location,
          project_type: projectType || null,
          project_size: projectSize || null,
          current_phase: currentPhase || null,
          is_general_quotation: isGeneralQuotation,
          is_soft_quotation: isSoftQuotation,
        })
        .eq('id', pipelineItem.id);

      if (updateError) throw updateError;

      // Delete existing items
      const { error: deleteError } = await supabase
        .from('quotation_items')
        .delete()
        .eq('communication_log_id', pipelineItem.id);

      if (deleteError) throw deleteError;

      // Insert new items
      const itemsToInsert = quotationItems
        .filter(item => item.material_id) // Only save items with material selected
        .map(item => ({
          communication_log_id: pipelineItem.id,
          material_id: item.material_id || null,
          quantity: item.quantity ? parseFloat(item.quantity) : null,
          unit_price: item.unit_price ? parseFloat(item.unit_price) : null,
          supplier_id: item.supplier_id || null,
        }));

      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('quotation_items')
          .insert(itemsToInsert);

        if (insertError) throw insertError;
      }

      toast.success('Quotation items saved successfully');
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving quotation items:', error);
      toast.error('Failed to save quotation items');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Quotation Details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Common Fields */}
            <Card className="p-4">
              <div className="mb-4">
                <Label className="text-base font-semibold">Quotation Details</Label>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Project Type</Label>
                  <Select value={projectType} onValueChange={setProjectType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project type" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="Residential (Villa)">Residential (Villa)</SelectItem>
                      <SelectItem value="Residential (Apartments)">Residential (Apartments)</SelectItem>
                      <SelectItem value="Residential (Compounds)">Residential (Compounds)</SelectItem>
                      <SelectItem value="Commercial (Complex)">Commercial (Complex)</SelectItem>
                      <SelectItem value="Commercial (Entertainment)">Commercial (Entertainment)</SelectItem>
                      <SelectItem value="Commercial (Malls)">Commercial (Malls)</SelectItem>
                      <SelectItem value="Towers">Towers</SelectItem>
                      <SelectItem value="Hospitality">Hospitality</SelectItem>
                      <SelectItem value="Mixed Use">Mixed Use</SelectItem>
                      <SelectItem value="Medical">Medical</SelectItem>
                      <SelectItem value="Fit-out (Interior)">Fit-out (Interior)</SelectItem>
                      <SelectItem value="Offices">Offices</SelectItem>
                      <SelectItem value="Educational (School)">Educational (School)</SelectItem>
                      <SelectItem value="Educational (University)">Educational (University)</SelectItem>
                      <SelectItem value="Religious (mosques)">Religious (mosques)</SelectItem>
                      <SelectItem value="Others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Project Size</Label>
                  <Select value={projectSize} onValueChange={setProjectSize}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project size" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="Very Small (less than 100m²)">Very Small (less than 100m²)</SelectItem>
                      <SelectItem value="Small (100-1000m²)">Small (100-1000m²)</SelectItem>
                      <SelectItem value="Medium (1000-5000m²)">Medium (1000-5000m²)</SelectItem>
                      <SelectItem value="Large (5000-50000m²)">Large (5000-50000m²)</SelectItem>
                      <SelectItem value="Huge (+50000m²)">Huge (+50000m²)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Current Phase</Label>
                  <Select value={currentPhase} onValueChange={setCurrentPhase}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select phase" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="0% (Site Preparation & Fencing)">0% (Site Preparation & Fencing)</SelectItem>
                      <SelectItem value="10% (Excavation & Earthworks)">10% (Excavation & Earthworks)</SelectItem>
                      <SelectItem value="20% (Foundation Works)">20% (Foundation Works)</SelectItem>
                      <SelectItem value="30% (Substructure Works)">30% (Substructure Works)</SelectItem>
                      <SelectItem value="40% (Superstructure Works)">40% (Superstructure Works)</SelectItem>
                      <SelectItem value="50% (Masonry & Blockwork)">50% (Masonry & Blockwork)</SelectItem>
                      <SelectItem value="60% (MEP – First Fix)">60% (MEP – First Fix)</SelectItem>
                      <SelectItem value="70% (Internal Finishing Works)">70% (Internal Finishing Works)</SelectItem>
                      <SelectItem value="80% (External Works & Façade)">80% (External Works & Façade)</SelectItem>
                      <SelectItem value="90% (Landscaping)">90% (Landscaping)</SelectItem>
                      <SelectItem value="100% (Completed)">100% (Completed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>District</Label>
                  <Input
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="Enter district"
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Enter city"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter location"
                  />
                </div>
              </div>
            </Card>

            <>
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Quotation Items</Label>
                  <Button type="button" onClick={addItem} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {quotationItems.map((item, index) => (
                <Card key={index} className="p-4 relative">
                  {quotationItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                  
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Material</Label>
                        <Select 
                          value={item.material_id} 
                          onValueChange={(value) => updateItem(index, 'material_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select material" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            {materials.map((material) => (
                              <SelectItem key={material.id} value={material.id}>
                                {material.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Supplier</Label>
                        <Select 
                          value={item.supplier_id} 
                          onValueChange={(value) => updateItem(index, 'supplier_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            {suppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>
                          Quantity
                          {!isSoftQuotation && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        <Input
                          type="number"
                          step="1"
                          min={isSoftQuotation ? 0 : 1}
                          value={item.quantity}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || parseInt(value) >= 0) {
                              updateItem(index, 'quantity', value);
                            }
                          }}
                          placeholder={isSoftQuotation ? "Optional" : "Required"}
                          onKeyDown={(e) => {
                            if (e.key === '.' || e.key === ',' || e.key === '-') {
                              e.preventDefault();
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Scale Price</Label>
                        <Input
                          value={item.scale_price ? item.scale_price.toString() : ''}
                          disabled
                          placeholder="Auto-filled"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Custom Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                          placeholder="Override price"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
                </div>

                {/* Soft Quotation Checkbox */}
                <Card className="p-4 border-dashed">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="softQuotation"
                      checked={isSoftQuotation}
                      onCheckedChange={(checked) => setIsSoftQuotation(checked as boolean)}
                    />
                    <div>
                      <Label htmlFor="softQuotation" className="cursor-pointer font-medium">
                        Soft Quotation (no quantities)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        عرض سعر مبدئي (بدون كميات)
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Total Summary */}
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">
                        {isSoftQuotation ? 'Soft Quotation' : 'Quotation Total'}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {isSoftQuotation 
                          ? 'Indicative price only – quantities not provided.' 
                          : 'Sum of all items (Quantity × Custom Price)'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {isSoftQuotation ? (
                          <span className="text-muted-foreground">N/A</span>
                        ) : (
                          `${calculateTotal().toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })} SAR`
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {quotationItems.length} item{quotationItems.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </Card>
            </>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PipelineDialog;

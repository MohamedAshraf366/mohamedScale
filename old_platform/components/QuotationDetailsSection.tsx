import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, ChevronsUpDown, Plus, Trash2, FolderKanban, ChevronDown, ChevronUp, MapPin, Building, Layers, FileQuestion, Send } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export interface QuotationItem {
  id?: string;
  material_id: string;
  material_name?: string;
  quantity: string;
  unit_price: string;
  scale_price?: number;
  supplier_id: string;
  supplier_name?: string;
}

export interface QuotationDetails {
  projectName: string;
  projectType: string;
  projectSize: string;
  currentPhase: string;
  district: string;
  city: string;
  location: string;
  quotationRequested: 'yes' | 'no' | '';
  quotationType: 'soft' | 'qty-based' | '';
  isSoftQuotation: boolean;
  quotationSent: boolean;
  items: QuotationItem[];
}

interface QuotationDetailsSectionProps {
  details: QuotationDetails;
  onChange: (details: QuotationDetails) => void;
  isVisible: boolean;
}

const PROJECT_TYPES = [
  "Residential (Villa)",
  "Residential (Apartments)",
  "Residential (Compounds)",
  "Commercial (Complex)",
  "Commercial (Entertainment)",
  "Commercial (Malls)",
  "Towers",
  "Hospitality",
  "Mixed Use",
  "Medical",
  "Fit-out (Interior)",
  "Offices",
  "Educational (School)",
  "Educational (University)",
  "Religious (mosques)",
  "Others"
];

const PROJECT_SIZES = [
  "Very Small (less than 100m²)",
  "Small (100-1000m²)",
  "Medium (1000-5000m²)",
  "Large (5000-50000m²)",
  "Huge (+50000m²)"
];

const CURRENT_PHASES = [
  "0% (Site Preparation & Fencing)",
  "10% (Excavation & Earthworks)",
  "20% (Foundation Works)",
  "30% (Substructure Works)",
  "40% (Superstructure Works)",
  "50% (Masonry & Blockwork)",
  "60% (MEP – First Fix)",
  "70% (Internal Finishing Works)",
  "80% (External Works & Façade)",
  "90% (Landscaping)",
  "100% (Completed)"
];

export default function QuotationDetailsSection({ 
  details, 
  onChange, 
  isVisible 
}: QuotationDetailsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [materials, setMaterials] = useState<Array<{ id: string; name: string; scale_price: number | null }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [materialSearchOpen, setMaterialSearchOpen] = useState<number | null>(null);
  const [supplierSearchOpen, setSupplierSearchOpen] = useState<number | null>(null);

  useEffect(() => {
    if (isVisible) {
      fetchMaterials();
      fetchSuppliers();
      setIsOpen(true);
    }
  }, [isVisible]);

  const fetchMaterials = async () => {
    const { data } = await supabase
      .from('materials')
      .select('id, name, scale_price')
      .order('name');
    setMaterials(data || []);
  };

  const fetchSuppliers = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .order('name');
    setSuppliers(data || []);
  };

  const updateDetails = (field: keyof QuotationDetails, value: any) => {
    const newDetails = { ...details, [field]: value };
    
    // Sync quotationType with isSoftQuotation for backward compatibility
    if (field === 'quotationType') {
      newDetails.isSoftQuotation = value === 'soft';
    }
    
    // If quotation not requested, clear quotation type
    if (field === 'quotationRequested' && value === 'no') {
      newDetails.quotationType = '';
      newDetails.isSoftQuotation = false;
    }
    
    onChange(newDetails);
  };

  const addItem = () => {
    const newItems = [...details.items, { 
      material_id: '', 
      quantity: '', 
      unit_price: '', 
      scale_price: 0, 
      supplier_id: '' 
    }];
    updateDetails('items', newItems);
  };

  const removeItem = (index: number) => {
    if (details.items.length > 1) {
      const newItems = details.items.filter((_, i) => i !== index);
      updateDetails('items', newItems);
    }
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: string) => {
    const newItems = [...details.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'material_id' && value) {
      const material = materials.find(m => m.id === value);
      if (material) {
        newItems[index].material_name = material.name;
        newItems[index].scale_price = material.scale_price || 0;
        if (!newItems[index].unit_price && material.scale_price) {
          newItems[index].unit_price = material.scale_price.toString();
        }
      }
    }
    
    if (field === 'supplier_id' && value) {
      const supplier = suppliers.find(s => s.id === value);
      if (supplier) {
        newItems[index].supplier_name = supplier.name;
      }
    }
    
    updateDetails('items', newItems);
  };

  const calculateTotal = () => {
    if (details.quotationType === 'soft') return null;
    return details.items.reduce((total, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return total + (quantity * price);
    }, 0);
  };

  const hasProjectData = details.projectName || details.projectType || details.projectSize || 
    details.currentPhase || details.district || details.city || details.location;
  
  const hasQuotationData = details.items.some(item => item.material_id);

  const showQuotationItems = details.quotationRequested === 'yes' && details.quotationType === 'qty-based';
  const showSoftQuotationNote = details.quotationRequested === 'yes' && details.quotationType === 'soft';

  if (!isVisible) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg"
          >
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Project Information</span>
              {hasProjectData && (
                <Badge variant="secondary" className="text-xs">
                  Has data
                </Badge>
              )}
              {details.quotationRequested === 'yes' && (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                  {details.quotationType === 'soft' ? 'Soft Quote' : 'Qty Quote'}
                </Badge>
              )}
              {details.quotationRequested === 'no' && (
                <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                  No Quote
                </Badge>
              )}
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4">
            {/* Project Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <Building className="h-3.5 w-3.5" />
                Project Details
              </div>
              
              {/* Project Name - new field */}
              <div className="space-y-1.5">
                <Label className="text-xs">Project Name (optional)</Label>
                <Input
                  className="h-9"
                  value={details.projectName || ''}
                  onChange={(e) => updateDetails('projectName', e.target.value)}
                  placeholder="Enter project name"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Project Type</Label>
                  <Select value={details.projectType} onValueChange={(v) => updateDetails('projectType', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Project Size</Label>
                  <Select value={details.projectSize} onValueChange={(v) => updateDetails('projectSize', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Current Phase</Label>
                  <Select value={details.currentPhase} onValueChange={(v) => updateDetails('currentPhase', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select phase" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENT_PHASES.map((phase) => (
                        <SelectItem key={phase} value={phase}>{phase}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <MapPin className="h-3.5 w-3.5" />
                Location
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">City</Label>
                  <Input
                    className="h-9"
                    value={details.city}
                    onChange={(e) => updateDetails('city', e.target.value)}
                    placeholder="Enter city"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">District</Label>
                  <Input
                    className="h-9"
                    value={details.district}
                    onChange={(e) => updateDetails('district', e.target.value)}
                    placeholder="Enter district"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Location/Site</Label>
                  <Input
                    className="h-9"
                    value={details.location}
                    onChange={(e) => updateDetails('location', e.target.value)}
                    placeholder="Site name or address"
                  />
                </div>
              </div>
            </div>

            {/* Quotation Gating Question */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <FileQuestion className="h-3.5 w-3.5" />
                Quotation Request
              </div>
              
              <div className="space-y-3">
                <Label className="text-sm font-medium">Did the client request a quotation?</Label>
                <RadioGroup
                  value={details.quotationRequested}
                  onValueChange={(v) => updateDetails('quotationRequested', v as 'yes' | 'no')}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="quote-yes" />
                    <Label htmlFor="quote-yes" className="text-sm cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="quote-no" />
                    <Label htmlFor="quote-no" className="text-sm cursor-pointer">No</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Quotation Type - only show if Yes */}
              {details.quotationRequested === 'yes' && (
                <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                  <Label className="text-sm font-medium">Quotation Type</Label>
                  <RadioGroup
                    value={details.quotationType}
                    onValueChange={(v) => updateDetails('quotationType', v as 'soft' | 'qty-based')}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="soft" id="quote-soft" />
                      <Label htmlFor="quote-soft" className="text-sm cursor-pointer">Soft Quotation</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="qty-based" id="quote-qty" />
                      <Label htmlFor="quote-qty" className="text-sm cursor-pointer">Qty-based Quotation</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* No quotation message */}
              {details.quotationRequested === 'no' && (
                <p className="text-xs text-muted-foreground italic pl-4 border-l-2 border-muted">
                  Client did not request a quotation.
                </p>
              )}
            </div>

            {/* Quotation Sent Toggle - Only show if quotation was requested */}
            {details.quotationRequested === 'yes' && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Send className="h-3.5 w-3.5" />
                  Quotation Status
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="quotation-sent" className="text-sm font-medium cursor-pointer">
                      Quotation Sent?
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {details.quotationSent 
                        ? 'Pipeline stage: Proposals Sent' 
                        : 'Pipeline stage: Qualified Leads'}
                    </p>
                  </div>
                  <Switch
                    id="quotation-sent"
                    checked={details.quotationSent}
                    onCheckedChange={(checked) => updateDetails('quotationSent', checked)}
                  />
                </div>
                
                {details.quotationSent && (
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-xs text-primary">
                      <strong>✓ Quotation Sent:</strong> This record is now counted under "Proposals Sent" in KPIs/analytics.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Soft Quotation Note */}
            {showSoftQuotationNote && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>Soft Quotation:</strong> Indicative pricing only. Final amount depends on actual quantities confirmed by the client.
                </p>
              </div>
            )}

            {/* Quotation Items - only show for qty-based */}
            {showQuotationItems && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Layers className="h-3.5 w-3.5" />
                    Quotation Items
                  </div>
                  <Button type="button" onClick={addItem} size="sm" variant="outline" className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-2">
                  {details.items.map((item, index) => (
                    <Card key={index} className="p-3 bg-muted/30">
                      <div className="grid grid-cols-12 gap-2 items-end">
                        {/* Material - Searchable */}
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Material</Label>
                          <Popover 
                            open={materialSearchOpen === index} 
                            onOpenChange={(open) => setMaterialSearchOpen(open ? index : null)}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                className="w-full h-9 justify-between text-xs font-normal"
                              >
                                <span className="truncate">
                                  {item.material_name || item.material_id 
                                    ? materials.find(m => m.id === item.material_id)?.name || 'Select material'
                                    : 'Select material'}
                                </span>
                                <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search materials..." className="h-9" />
                                <CommandList>
                                  <CommandEmpty>No material found.</CommandEmpty>
                                  <CommandGroup className="max-h-[200px] overflow-auto">
                                    {materials.map((material) => (
                                      <CommandItem
                                        key={material.id}
                                        value={material.name}
                                        onSelect={() => {
                                          updateItem(index, 'material_id', material.id);
                                          setMaterialSearchOpen(null);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            item.material_id === material.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {material.name}
                                        {material.scale_price && (
                                          <span className="ml-auto text-xs text-muted-foreground">
                                            SAR {material.scale_price}
                                          </span>
                                        )}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Supplier - Searchable */}
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Supplier</Label>
                          <Popover 
                            open={supplierSearchOpen === index} 
                            onOpenChange={(open) => setSupplierSearchOpen(open ? index : null)}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                className="w-full h-9 justify-between text-xs font-normal"
                              >
                                <span className="truncate">
                                  {item.supplier_name || item.supplier_id 
                                    ? suppliers.find(s => s.id === item.supplier_id)?.name || 'Select supplier'
                                    : 'Select supplier'}
                                </span>
                                <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[250px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search suppliers..." className="h-9" />
                                <CommandList>
                                  <CommandEmpty>No supplier found.</CommandEmpty>
                                  <CommandGroup className="max-h-[200px] overflow-auto">
                                    {suppliers.map((supplier) => (
                                      <CommandItem
                                        key={supplier.id}
                                        value={supplier.name}
                                        onSelect={() => {
                                          updateItem(index, 'supplier_id', supplier.id);
                                          setSupplierSearchOpen(null);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            item.supplier_id === supplier.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {supplier.name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Quantity */}
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">
                            Quantity<span className="text-destructive ml-0.5">*</span>
                          </Label>
                          <Input
                            type="number"
                            step="1"
                            min={0}
                            className="h-9 text-xs"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            placeholder="Required"
                          />
                        </div>

                        {/* Scale Price (read-only) */}
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Scale Price</Label>
                          <Input
                            className="h-9 text-xs bg-muted"
                            value={item.scale_price ? `SAR ${item.scale_price}` : ''}
                            disabled
                            placeholder="Auto"
                          />
                        </div>

                        {/* Custom Price */}
                        <div className="col-span-1 space-y-1">
                          <Label className="text-xs">Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-9 text-xs"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                            placeholder="SAR"
                          />
                        </div>

                        {/* Delete */}
                        <div className="col-span-1 flex justify-end">
                          {details.items.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Total */}
                <div className="flex justify-end pt-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-semibold text-primary">
                      SAR {calculateTotal()?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

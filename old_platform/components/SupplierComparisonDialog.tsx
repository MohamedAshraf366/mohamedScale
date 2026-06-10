import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Star, TrendingUp, TrendingDown, Minus, Package, Truck, Clock, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Material {
  id: string;
  name: string;
  category: string;
  uom: string;
}

interface SupplierPricing {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_type: string | null;
  supplier_status: string | null;
  supplier_rating: number | null;
  supplier_lead_time: number | null;
  supplier_on_time_delivery: number | null;
  supplier_total_orders: number | null;
  supplier_city: string | null;
  unit_price: number | null;
  manufacturer_price: number | null;
  delivery_price: number | null;
  moq: number | null;
  price_valid_until: string | null;
  material_notes: string | null;
}

interface SupplierComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedMaterialId?: string;
}

const SupplierComparisonDialog = ({ open, onOpenChange, preselectedMaterialId }: SupplierComparisonDialogProps) => {
  const { t } = useTranslation();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(preselectedMaterialId || '');
  const [supplierPricings, setSupplierPricings] = useState<SupplierPricing[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMaterials();
      if (preselectedMaterialId) {
        setSelectedMaterialId(preselectedMaterialId);
      }
    }
  }, [open, preselectedMaterialId]);

  useEffect(() => {
    if (selectedMaterialId) {
      fetchSupplierPricings(selectedMaterialId);
    } else {
      setSupplierPricings([]);
    }
  }, [selectedMaterialId]);

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('id, name, category, uom')
      .order('name');
    
    if (!error && data) {
      setMaterials(data);
    }
  };

  const fetchSupplierPricings = async (materialId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_alt_suppliers')
        .select(`
          id,
          supplier_id,
          unit_price,
          manufacturer_price,
          delivery_price,
          moq,
          price_valid_until,
          material_notes,
          suppliers (
            name,
            supplier_type,
            status,
            rating,
            lead_time_days,
            on_time_delivery_percent,
            total_orders,
            city
          )
        `)
        .eq('material_id', materialId);

      if (error) throw error;

      const pricings: SupplierPricing[] = (data || []).map((item: any) => ({
        id: item.id,
        supplier_id: item.supplier_id,
        supplier_name: item.suppliers?.name || 'Unknown',
        supplier_type: item.suppliers?.supplier_type,
        supplier_status: item.suppliers?.status,
        supplier_rating: item.suppliers?.rating,
        supplier_lead_time: item.suppliers?.lead_time_days,
        supplier_on_time_delivery: item.suppliers?.on_time_delivery_percent,
        supplier_total_orders: item.suppliers?.total_orders,
        supplier_city: item.suppliers?.city,
        unit_price: item.unit_price,
        manufacturer_price: item.manufacturer_price,
        delivery_price: item.delivery_price,
        moq: item.moq,
        price_valid_until: item.price_valid_until,
        material_notes: item.material_notes,
      }));

      setSupplierPricings(pricings);
    } catch (error) {
      console.error('Error fetching supplier pricings:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedMaterial = materials.find(m => m.id === selectedMaterialId);

  // Calculate best values for highlighting
  const getLowestPrice = () => {
    const prices = supplierPricings.map(s => s.unit_price).filter((p): p is number => p !== null);
    return prices.length > 0 ? Math.min(...prices) : null;
  };

  const getHighestRating = () => {
    const ratings = supplierPricings.map(s => s.supplier_rating).filter((r): r is number => r !== null);
    return ratings.length > 0 ? Math.max(...ratings) : null;
  };

  const getLowestLeadTime = () => {
    const times = supplierPricings.map(s => s.supplier_lead_time).filter((t): t is number => t !== null);
    return times.length > 0 ? Math.min(...times) : null;
  };

  const getHighestOnTimeDelivery = () => {
    const rates = supplierPricings.map(s => s.supplier_on_time_delivery).filter((r): r is number => r !== null);
    return rates.length > 0 ? Math.max(...rates) : null;
  };

  const lowestPrice = getLowestPrice();
  const highestRating = getHighestRating();
  const lowestLeadTime = getLowestLeadTime();
  const highestOnTimeDelivery = getHighestOnTimeDelivery();

  const renderRating = (rating: number | null) => {
    if (rating === null) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  const renderComparisonIndicator = (value: number | null, bestValue: number | null, isLowerBetter: boolean) => {
    if (value === null || bestValue === null) return null;
    
    const isBest = isLowerBetter ? value === bestValue : value === bestValue;
    
    if (isBest) {
      return <CheckCircle2 className="h-4 w-4 text-green-500 ml-1" />;
    }
    
    const percentDiff = isLowerBetter 
      ? ((value - bestValue) / bestValue) * 100
      : ((bestValue - value) / bestValue) * 100;
    
    if (percentDiff > 20) {
      return <TrendingDown className="h-4 w-4 text-red-500 ml-1" />;
    } else if (percentDiff > 0) {
      return <Minus className="h-4 w-4 text-yellow-500 ml-1" />;
    }
    
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Supplier Comparison
          </DialogTitle>
          <DialogDescription>
            Compare pricing and performance across multiple suppliers for the same material
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Material Selection */}
          <div className="space-y-2">
            <Label>Select Material</Label>
            <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a material to compare suppliers" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.name} ({material.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Material Info */}
          {selectedMaterial && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedMaterial.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Category: {selectedMaterial.category} | UoM: {selectedMaterial.uom}
                  </p>
                </div>
                <Badge variant="outline" className="ml-auto">
                  {supplierPricings.length} supplier{supplierPricings.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          )}

          {/* Comparison Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading suppliers...</div>
          ) : supplierPricings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Supplier</th>
                    <th className="text-left py-3 px-2 font-medium">Type</th>
                    <th className="text-left py-3 px-2 font-medium">City</th>
                    <th className="text-right py-3 px-2 font-medium">Unit Price</th>
                    <th className="text-right py-3 px-2 font-medium">Mfr Price</th>
                    <th className="text-right py-3 px-2 font-medium">Delivery</th>
                    <th className="text-right py-3 px-2 font-medium">MOQ</th>
                    <th className="text-center py-3 px-2 font-medium">Rating</th>
                    <th className="text-right py-3 px-2 font-medium">Lead Time</th>
                    <th className="text-right py-3 px-2 font-medium">On-Time %</th>
                    <th className="text-right py-3 px-2 font-medium">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierPricings.map((pricing) => (
                    <tr key={pricing.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{pricing.supplier_name}</span>
                          {pricing.supplier_status === 'Active' ? (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {pricing.supplier_type || '-'}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {pricing.supplier_city || '-'}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end">
                          {pricing.unit_price !== null ? (
                            <span className={pricing.unit_price === lowestPrice ? 'text-green-600 font-semibold' : ''}>
                              SAR {pricing.unit_price.toLocaleString()}
                            </span>
                          ) : '-'}
                          {renderComparisonIndicator(pricing.unit_price, lowestPrice, true)}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {pricing.manufacturer_price !== null ? `SAR ${pricing.manufacturer_price.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {pricing.delivery_price !== null ? `SAR ${pricing.delivery_price.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {pricing.moq !== null ? pricing.moq.toLocaleString() : '-'}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center">
                          {renderRating(pricing.supplier_rating)}
                          {pricing.supplier_rating === highestRating && pricing.supplier_rating !== null && (
                            <CheckCircle2 className="h-4 w-4 text-green-500 ml-1" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end">
                          {pricing.supplier_lead_time !== null ? (
                            <span className={pricing.supplier_lead_time === lowestLeadTime ? 'text-green-600 font-semibold' : ''}>
                              {pricing.supplier_lead_time} days
                            </span>
                          ) : '-'}
                          {renderComparisonIndicator(pricing.supplier_lead_time, lowestLeadTime, true)}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end">
                          {pricing.supplier_on_time_delivery !== null ? (
                            <span className={pricing.supplier_on_time_delivery === highestOnTimeDelivery ? 'text-green-600 font-semibold' : ''}>
                              {pricing.supplier_on_time_delivery}%
                            </span>
                          ) : '-'}
                          {pricing.supplier_on_time_delivery === highestOnTimeDelivery && pricing.supplier_on_time_delivery !== null && (
                            <CheckCircle2 className="h-4 w-4 text-green-500 ml-1" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {pricing.supplier_total_orders !== null ? pricing.supplier_total_orders.toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Legend */}
              <div className="mt-4 flex items-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>Best value</span>
                </div>
                <div className="flex items-center gap-1">
                  <Minus className="h-3 w-3 text-yellow-500" />
                  <span>Slightly higher</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span>Significantly higher (&gt;20%)</span>
                </div>
              </div>

              {/* Price Valid Until Notes */}
              {supplierPricings.some(p => p.price_valid_until) && (
                <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Price Validity</h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {supplierPricings
                      .filter(p => p.price_valid_until)
                      .map(p => (
                        <div key={p.id}>
                          <span className="font-medium">{p.supplier_name}:</span> Valid until {new Date(p.price_valid_until!).toLocaleDateString()}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : selectedMaterialId ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No suppliers found for this material.</p>
              <p className="text-xs mt-1">Add suppliers to this material from the Suppliers page.</p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Select a material above to compare suppliers</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierComparisonDialog;

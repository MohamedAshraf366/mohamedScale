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
import { TrendingUp, TrendingDown, Minus, History, Package } from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Material {
  id: string;
  name: string;
  category: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface PriceHistoryEntry {
  id: string;
  material_id: string;
  supplier_id: string;
  supplier_name: string;
  unit_price: number | null;
  manufacturer_price: number | null;
  delivery_price: number | null;
  recorded_at: string;
  change_reason: string | null;
}

interface PriceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedMaterialId?: string;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 65%, 60%)',
  'hsl(200, 80%, 50%)',
];

const PriceHistoryDialog = ({ open, onOpenChange, preselectedMaterialId }: PriceHistoryDialogProps) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(preselectedMaterialId || '');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
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
      fetchPriceHistory(selectedMaterialId);
      fetchSuppliersForMaterial(selectedMaterialId);
    } else {
      setPriceHistory([]);
      setSuppliers([]);
    }
  }, [selectedMaterialId]);

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('id, name, category')
      .order('name');
    
    if (!error && data) {
      setMaterials(data);
    }
  };

  const fetchSuppliersForMaterial = async (materialId: string) => {
    const { data, error } = await supabase
      .from('material_alt_suppliers')
      .select('supplier_id, suppliers(id, name)')
      .eq('material_id', materialId);

    if (!error && data) {
      const uniqueSuppliers = data
        .map((item: any) => item.suppliers)
        .filter((s: any) => s !== null)
        .reduce((acc: Supplier[], curr: any) => {
          if (!acc.find(s => s.id === curr.id)) {
            acc.push({ id: curr.id, name: curr.name });
          }
          return acc;
        }, []);
      setSuppliers(uniqueSuppliers);
    }
  };

  const fetchPriceHistory = async (materialId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_price_history')
        .select(`
          id,
          material_id,
          supplier_id,
          unit_price,
          manufacturer_price,
          delivery_price,
          recorded_at,
          change_reason,
          suppliers(name)
        `)
        .eq('material_id', materialId)
        .order('recorded_at', { ascending: true });

      if (error) throw error;

      const entries: PriceHistoryEntry[] = (data || []).map((item: any) => ({
        id: item.id,
        material_id: item.material_id,
        supplier_id: item.supplier_id,
        supplier_name: item.suppliers?.name || 'Unknown',
        unit_price: item.unit_price,
        manufacturer_price: item.manufacturer_price,
        delivery_price: item.delivery_price,
        recorded_at: item.recorded_at,
        change_reason: item.change_reason,
      }));

      setPriceHistory(entries);
    } catch (error) {
      console.error('Error fetching price history:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedMaterial = materials.find(m => m.id === selectedMaterialId);

  // Filter by supplier if selected
  const filteredHistory = selectedSupplierId === 'all' 
    ? priceHistory 
    : priceHistory.filter(h => h.supplier_id === selectedSupplierId);

  // Prepare chart data - group by date and show all suppliers
  const chartData = filteredHistory.reduce((acc: any[], entry) => {
    const date = format(new Date(entry.recorded_at), 'MMM dd');
    const existing = acc.find(d => d.date === date);
    
    if (existing) {
      existing[`${entry.supplier_name}_unit`] = entry.unit_price;
      existing[`${entry.supplier_name}_mfr`] = entry.manufacturer_price;
    } else {
      acc.push({
        date,
        fullDate: entry.recorded_at,
        [`${entry.supplier_name}_unit`]: entry.unit_price,
        [`${entry.supplier_name}_mfr`]: entry.manufacturer_price,
      });
    }
    return acc;
  }, []);

  // Get unique supplier names for chart lines
  const supplierNames = [...new Set(filteredHistory.map(h => h.supplier_name))];

  // Calculate price changes for summary
  const getPriceChange = (supplierId: string) => {
    const supplierHistory = priceHistory.filter(h => h.supplier_id === supplierId);
    if (supplierHistory.length < 2) return null;
    
    const latest = supplierHistory[supplierHistory.length - 1];
    const previous = supplierHistory[supplierHistory.length - 2];
    
    if (!latest.unit_price || !previous.unit_price) return null;
    
    const change = latest.unit_price - previous.unit_price;
    const percentChange = (change / previous.unit_price) * 100;
    
    return { change, percentChange, latest: latest.unit_price, previous: previous.unit_price };
  };

  const renderPriceChangeIndicator = (change: { change: number; percentChange: number } | null) => {
    if (!change) return <Minus className="h-4 w-4 text-muted-foreground" />;
    
    if (change.change > 0) {
      return (
        <div className="flex items-center text-red-500">
          <TrendingUp className="h-4 w-4 mr-1" />
          <span className="text-xs">+{change.percentChange.toFixed(1)}%</span>
        </div>
      );
    } else if (change.change < 0) {
      return (
        <div className="flex items-center text-green-500">
          <TrendingDown className="h-4 w-4 mr-1" />
          <span className="text-xs">{change.percentChange.toFixed(1)}%</span>
        </div>
      );
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Price History Tracker
          </DialogTitle>
          <DialogDescription>
            Monitor price changes over time from different suppliers
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Material</Label>
              <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a material" />
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
            <div className="space-y-2">
              <Label>Filter by Supplier</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="All suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selected Material Info */}
          {selectedMaterial && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{selectedMaterial.name}</h3>
                  <p className="text-sm text-muted-foreground">Category: {selectedMaterial.category}</p>
                </div>
                <Badge variant="outline">
                  {filteredHistory.length} price record{filteredHistory.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          )}

          {/* Price Change Summary Cards */}
          {selectedMaterialId && suppliers.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {suppliers.slice(0, 4).map((supplier) => {
                const change = getPriceChange(supplier.id);
                const latestEntry = priceHistory
                  .filter(h => h.supplier_id === supplier.id)
                  .slice(-1)[0];
                
                return (
                  <div key={supplier.id} className="bg-card border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium truncate">{supplier.name}</span>
                      {renderPriceChangeIndicator(change)}
                    </div>
                    <div className="text-2xl font-bold">
                      {latestEntry?.unit_price ? `SAR ${latestEntry.unit_price.toLocaleString()}` : '-'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {latestEntry ? format(new Date(latestEntry.recorded_at), 'MMM dd, yyyy') : 'No data'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Price Chart */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading price history...</div>
          ) : chartData.length > 0 ? (
            <div className="bg-card border rounded-lg p-4">
              <h4 className="font-medium mb-4">Price Trend (Unit Price)</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`SAR ${value?.toLocaleString() || '-'}`, '']}
                  />
                  <Legend />
                  {supplierNames.map((name, index) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={`${name}_unit`}
                      name={name}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : selectedMaterialId ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No price history found for this material.</p>
              <p className="text-xs mt-1">Price changes will be automatically recorded when supplier prices are updated.</p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Select a material above to view price history</p>
            </div>
          )}

          {/* Price History Table */}
          {filteredHistory.length > 0 && (
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="p-4 border-b">
                <h4 className="font-medium">Price Change Log</h4>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-4 font-medium">Date</th>
                      <th className="text-left py-2 px-4 font-medium">Supplier</th>
                      <th className="text-right py-2 px-4 font-medium">Unit Price</th>
                      <th className="text-right py-2 px-4 font-medium">Mfr Price</th>
                      <th className="text-right py-2 px-4 font-medium">Delivery</th>
                      <th className="text-left py-2 px-4 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredHistory].reverse().map((entry, index) => {
                      // Find previous entry for same supplier to calculate change
                      const previousEntry = filteredHistory
                        .slice(0, filteredHistory.length - 1 - index)
                        .reverse()
                        .find(h => h.supplier_id === entry.supplier_id);
                      
                      const priceChange = previousEntry && entry.unit_price && previousEntry.unit_price
                        ? entry.unit_price - previousEntry.unit_price
                        : null;

                      return (
                        <tr key={entry.id} className="border-t hover:bg-muted/30">
                          <td className="py-2 px-4">
                            {format(new Date(entry.recorded_at), 'MMM dd, yyyy HH:mm')}
                          </td>
                          <td className="py-2 px-4">{entry.supplier_name}</td>
                          <td className="py-2 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span>{entry.unit_price ? `SAR ${entry.unit_price.toLocaleString()}` : '-'}</span>
                              {priceChange !== null && priceChange !== 0 && (
                                <Badge 
                                  variant="outline" 
                                  className={priceChange > 0 
                                    ? 'text-red-600 border-red-200 bg-red-50' 
                                    : 'text-green-600 border-green-200 bg-green-50'
                                  }
                                >
                                  {priceChange > 0 ? '+' : ''}{priceChange.toLocaleString()}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-4 text-right text-muted-foreground">
                            {entry.manufacturer_price ? `SAR ${entry.manufacturer_price.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-2 px-4 text-right text-muted-foreground">
                            {entry.delivery_price ? `SAR ${entry.delivery_price.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-2 px-4 text-muted-foreground">
                            {entry.change_reason || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PriceHistoryDialog;

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import EscalationTimerBadge from '@/components/EscalationTimerBadge';
import { 
  Search, 
  Package, 
  Users, 
  MapPin, 
  Calendar, 
  TrendingUp, 
  Loader2,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  Building2,
  DollarSign,
  ArrowUpDown,
  RefreshCw,
  Bot
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { format, addDays, isAfter, isBefore } from 'date-fns';

interface Material {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  uom: string;
  target_price: number | null;
  scale_price: number | null;
}

interface SupplierMaterial {
  id: string;
  supplier_id: string;
  material_id: string;
  status: string | null;
  performance_rating: number | null;
  suppliers: { id: string; name: string; city: string | null } | null;
}

interface MaterialValidity {
  id: string;
  material_id: string;
  price_valid_until: string;
  is_active: boolean;
  escalation_phase: string | null;
  escalation_started_at: string | null;
  last_ai_message_at: string | null;
  ai_attempt_count: number | null;
  officer_assigned_at: string | null;
  confirmation_source: string | null;
  supplier_id: string | null;
}

interface PriceVersion {
  id: string;
  material_id: string;
  supplier_id: string;
  unit_price: number | null;
  delivery_price: number | null;
  total_price: number | null;
  valid_from: string;
  valid_until: string | null;
  confirmation_status: string;
  suppliers: { id: string; name: string } | null;
}

interface MaterialCoverage {
  id: string;
  material_id: string;
  zone_id: string;
  zones: { id: string; name: string; city: string | null } | null;
}

interface Zone {
  id: string;
  name: string;
  city: string | null;
}

interface EnrichedMaterial extends Material {
  activeSuppliers: number;
  minPrice: number | null;
  maxPrice: number | null;
  avgPrice: number | null;
  coverageRatio: { covered: number; total: number };
  validityStatus: 'ok' | 'expiring' | 'overdue' | 'unknown';
  unlockStatus: string | null;
  escalationPhase: string | null;
  aiAttemptCount: number;
  lastAiMessageAt: string | null;
  officerAssignedAt: string | null;
  validityTrackerId: string | null;
}

const SupplyMaterials = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedMaterial, setSelectedMaterial] = useState<EnrichedMaterial | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'suppliers' | 'avgPrice' | 'coverage'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Mutation for triggering manual AI outreach
  const triggerAIOutreachMutation = useMutation({
    mutationFn: async (validityTrackerId: string) => {
      const { data, error } = await supabase.functions.invoke('price-escalation-workflow', {
        body: { action: 'manual_trigger_ai', validity_tracker_id: validityTrackerId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('AI outreach triggered successfully');
      queryClient.invalidateQueries({ queryKey: ['material-validity-all'] });
    },
    onError: (error) => {
      toast.error(`Failed to trigger AI outreach: ${error.message}`);
    }
  });

  // Mutation for officer confirmation
  const officerConfirmMutation = useMutation({
    mutationFn: async (validityTrackerId: string) => {
      const { data, error } = await supabase.functions.invoke('price-escalation-workflow', {
        body: { action: 'officer_confirm', validity_tracker_id: validityTrackerId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Price confirmed successfully');
      queryClient.invalidateQueries({ queryKey: ['material-validity-all'] });
    },
    onError: (error) => {
      toast.error(`Failed to confirm price: ${error.message}`);
    }
  });

  // Fetch materials
  const { data: materials, isLoading: materialsLoading } = useQuery({
    queryKey: ['supply-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, category, subcategory, uom, target_price, scale_price')
        .order('name');
      if (error) throw error;
      return data as Material[];
    }
  });

  // Fetch supplier materials
  const { data: supplierMaterials } = useQuery({
    queryKey: ['supplier-materials-with-suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_materials')
        .select('id, supplier_id, material_id, status, performance_rating, suppliers(id, name, city)');
      if (error) throw error;
      return data as SupplierMaterial[];
    }
  });

  // Fetch material validity tracker with escalation fields
  const { data: materialValidity, refetch: refetchValidity } = useQuery({
    queryKey: ['material-validity-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_validity_tracker')
        .select('id, material_id, price_valid_until, is_active, escalation_phase, escalation_started_at, last_ai_message_at, ai_attempt_count, officer_assigned_at, confirmation_source, supplier_id')
        .eq('is_active', true);
      if (error) throw error;
      return data as MaterialValidity[];
    }
  });

  // Fetch price versions
  const { data: priceVersions } = useQuery({
    queryKey: ['price-versions-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_price_versions')
        .select('id, material_id, supplier_id, unit_price, delivery_price, total_price, valid_from, valid_until, confirmation_status, suppliers(id, name)')
        .eq('confirmation_status', 'confirmed');
      if (error) throw error;
      return data as PriceVersion[];
    }
  });

  // Fetch zones
  const { data: zones } = useQuery({
    queryKey: ['zones-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones')
        .select('id, name, city');
      if (error) throw error;
      return data as Zone[];
    }
  });

  // Fetch material coverage
  const { data: materialCoverage } = useQuery({
    queryKey: ['material-coverage-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_coverage')
        .select('id, material_id, zone_id, zones(id, name, city)')
        .eq('is_covered', true);
      if (error) throw error;
      return data as MaterialCoverage[];
    }
  });

  // Fetch unlock cycles
  const { data: unlockCycles } = useQuery({
    queryKey: ['unlock-cycles-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_unlock_cycles')
        .select('id, material_id, unlock_status');
      if (error) throw error;
      return data;
    }
  });

  // Compute enriched materials with all metrics
  const enrichedMaterials = useMemo<EnrichedMaterial[]>(() => {
    if (!materials) return [];
    
    const today = new Date();
    const in30Days = addDays(today, 30);
    const totalZones = zones?.length || 0;

    return materials.map(material => {
      // Count active suppliers (selected or backup status)
      const matSuppliers = supplierMaterials?.filter(
        sm => sm.material_id === material.id && 
        (sm.status === 'selected' || sm.status === 'backup' || sm.status === 'active')
      ) || [];
      
      // Get confirmed price versions for this material
      const matPrices = priceVersions?.filter(
        pv => pv.material_id === material.id
      ) || [];
      
      // Calculate min/max/avg prices
      const prices = matPrices
        .map(p => p.total_price || p.unit_price || 0)
        .filter(p => p > 0);
      
      const minPrice = prices.length > 0 ? Math.min(...prices) : null;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
      const avgPrice = prices.length > 0 
        ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100 
        : null;
      
      // Calculate coverage ratio
      const coveredZones = materialCoverage?.filter(mc => mc.material_id === material.id).length || 0;
      
      // Get validity status
      const validity = materialValidity?.find(mv => mv.material_id === material.id);
      let validityStatus: 'ok' | 'expiring' | 'overdue' | 'unknown' = 'unknown';
      if (validity) {
        const expiryDate = new Date(validity.price_valid_until);
        if (isBefore(expiryDate, today)) {
          validityStatus = 'overdue';
        } else if (isBefore(expiryDate, in30Days)) {
          validityStatus = 'expiring';
        } else {
          validityStatus = 'ok';
        }
      }
      
      // Get unlock status
      const unlockCycle = unlockCycles?.find(uc => uc.material_id === material.id);
      
      return {
        ...material,
        activeSuppliers: matSuppliers.length,
        minPrice,
        maxPrice,
        avgPrice,
        coverageRatio: { covered: coveredZones, total: totalZones },
        validityStatus,
        unlockStatus: unlockCycle?.unlock_status || null,
        escalationPhase: validity?.escalation_phase || null,
        aiAttemptCount: validity?.ai_attempt_count || 0,
        lastAiMessageAt: validity?.last_ai_message_at || null,
        officerAssignedAt: validity?.officer_assigned_at || null,
        validityTrackerId: validity?.id || null
      };
    });
  }, [materials, supplierMaterials, priceVersions, materialCoverage, materialValidity, unlockCycles, zones]);

  // Get unique categories and cities for filters
  const categories = useMemo(() => {
    const cats = new Set(materials?.map(m => m.category) || []);
    return Array.from(cats).sort();
  }, [materials]);

  const cities = useMemo(() => {
    const citiesSet = new Set(zones?.map(z => z.city).filter(Boolean) || []);
    return Array.from(citiesSet).sort() as string[];
  }, [zones]);

  // Filter and sort materials
  const filteredMaterials = useMemo(() => {
    let result = enrichedMaterials;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(m => 
        m.name.toLowerCase().includes(query) ||
        m.category.toLowerCase().includes(query) ||
        m.subcategory?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(m => m.category === categoryFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(m => m.unlockStatus === statusFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'suppliers':
          comparison = a.activeSuppliers - b.activeSuppliers;
          break;
        case 'avgPrice':
          comparison = (a.avgPrice || 0) - (b.avgPrice || 0);
          break;
        case 'coverage':
          const aCoverage = a.coverageRatio.total > 0 ? a.coverageRatio.covered / a.coverageRatio.total : 0;
          const bCoverage = b.coverageRatio.total > 0 ? b.coverageRatio.covered / b.coverageRatio.total : 0;
          comparison = aCoverage - bCoverage;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [enrichedMaterials, searchQuery, categoryFilter, statusFilter, sortBy, sortOrder]);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const openMaterialDetail = (material: EnrichedMaterial) => {
    setSelectedMaterial(material);
    setSidePanelOpen(true);
  };

  const getValidityBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>;
      case 'expiring':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="h-3 w-3 mr-1" />Expiring</Badge>;
      case 'overdue':
        return <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getUnlockStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">In Progress</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">Unlocked</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">—</Badge>;
    }
  };

  const isLoading = materialsLoading;

  // Data for price history chart (when material is selected)
  const priceHistoryData = useMemo(() => {
    if (!selectedMaterial || !priceVersions) return [];
    
    const materialPrices = priceVersions
      .filter(pv => pv.material_id === selectedMaterial.id)
      .sort((a, b) => new Date(a.valid_from).getTime() - new Date(b.valid_from).getTime());
    
    return materialPrices.map(pv => ({
      date: format(new Date(pv.valid_from), 'MMM dd'),
      price: pv.total_price || pv.unit_price || 0,
      supplier: pv.suppliers?.name || 'Unknown'
    }));
  }, [selectedMaterial, priceVersions]);

  // Get price versions grouped by supplier for selected material
  const pricesBySupplier = useMemo(() => {
    if (!selectedMaterial || !priceVersions) return {};
    
    const grouped: Record<string, PriceVersion[]> = {};
    priceVersions
      .filter(pv => pv.material_id === selectedMaterial.id)
      .forEach(pv => {
        const supplierName = pv.suppliers?.name || 'Unknown';
        if (!grouped[supplierName]) grouped[supplierName] = [];
        grouped[supplierName].push(pv);
      });
    
    return grouped;
  }, [selectedMaterial, priceVersions]);

  // Get coverage zones for selected material
  const materialZones = useMemo(() => {
    if (!selectedMaterial || !materialCoverage) return [];
    return materialCoverage
      .filter(mc => mc.material_id === selectedMaterial.id)
      .map(mc => mc.zones)
      .filter(Boolean);
  }, [selectedMaterial, materialCoverage]);

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('supply.materials', 'Supply Materials')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('supply.materialsDesc', 'View material pricing, suppliers, coverage, and validity')}
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search materials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="City/Zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Unlocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Materials Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Package className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">No materials found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Material <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('suppliers')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Users className="h-4 w-4" /> Suppliers
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <DollarSign className="h-4 w-4" /> Min / Max / Avg Price
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Target Price</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('coverage')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <MapPin className="h-4 w-4" /> Coverage
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Calendar className="h-4 w-4" /> Validity
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Bot className="h-4 w-4" /> Escalation
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaterials.map(material => (
                    <TableRow 
                      key={material.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openMaterialDetail(material)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{material.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {material.category}
                            {material.subcategory && ` / ${material.subcategory}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{material.activeSuppliers}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {material.minPrice !== null ? (
                          <div className="text-sm">
                            <span className="text-muted-foreground">{material.minPrice?.toFixed(2)}</span>
                            <span className="mx-1">/</span>
                            <span className="text-muted-foreground">{material.maxPrice?.toFixed(2)}</span>
                            <span className="mx-1">/</span>
                            <span className="font-medium">{material.avgPrice?.toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {material.target_price !== null ? (
                          <span className="font-medium">{material.target_price.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {material.coverageRatio.total > 0 ? (
                          <Badge variant={material.coverageRatio.covered === material.coverageRatio.total ? 'default' : 'outline'}>
                            {material.coverageRatio.covered}/{material.coverageRatio.total}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {getValidityBadge(material.validityStatus)}
                      </TableCell>
                      <TableCell className="text-center">
                        <EscalationTimerBadge 
                          escalationPhase={material.escalationPhase}
                          aiAttemptCount={material.aiAttemptCount}
                          lastAiMessageAt={material.lastAiMessageAt}
                          officerAssignedAt={material.officerAssignedAt}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {getUnlockStatusBadge(material.unlockStatus)}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Side Panel */}
        <Sheet open={sidePanelOpen} onOpenChange={setSidePanelOpen}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            {selectedMaterial && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    {selectedMaterial.name}
                  </SheetTitle>
                  <SheetDescription>
                    {selectedMaterial.category}
                    {selectedMaterial.subcategory && ` / ${selectedMaterial.subcategory}`}
                    <span className="mx-2">•</span>
                    {selectedMaterial.uom}
                  </SheetDescription>
                </SheetHeader>

                <Tabs defaultValue="prices" className="mt-6">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="prices">Prices</TabsTrigger>
                    <TabsTrigger value="chart">History</TabsTrigger>
                    <TabsTrigger value="coverage">Coverage</TabsTrigger>
                  </TabsList>

                  <TabsContent value="prices" className="mt-4 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <Card>
                        <CardContent className="p-3 text-center">
                          <p className="text-xs text-muted-foreground">Min</p>
                          <p className="text-lg font-bold">{selectedMaterial.minPrice?.toFixed(2) || '—'}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-3 text-center">
                          <p className="text-xs text-muted-foreground">Avg</p>
                          <p className="text-lg font-bold text-primary">{selectedMaterial.avgPrice?.toFixed(2) || '—'}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-3 text-center">
                          <p className="text-xs text-muted-foreground">Max</p>
                          <p className="text-lg font-bold">{selectedMaterial.maxPrice?.toFixed(2) || '—'}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {selectedMaterial.target_price && (
                      <Card className="border-primary/30 bg-primary/5">
                        <CardContent className="p-3 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Target Price</span>
                          <span className="text-lg font-bold">{selectedMaterial.target_price.toFixed(2)} SAR</span>
                        </CardContent>
                      </Card>
                    )}

                    {/* Escalation Status & Actions */}
                    {(selectedMaterial.validityStatus === 'expiring' || selectedMaterial.validityStatus === 'overdue') && (
                      <Card className="border-amber-500/30 bg-amber-500/5">
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 text-amber-600" />
                              <span className="text-sm font-medium">Escalation Status</span>
                            </div>
                            <EscalationTimerBadge 
                              escalationPhase={selectedMaterial.escalationPhase}
                              aiAttemptCount={selectedMaterial.aiAttemptCount}
                              lastAiMessageAt={selectedMaterial.lastAiMessageAt}
                              officerAssignedAt={selectedMaterial.officerAssignedAt}
                            />
                          </div>
                          
                          <div className="flex gap-2">
                            {selectedMaterial.validityTrackerId && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerAIOutreachMutation.mutate(selectedMaterial.validityTrackerId!);
                                  }}
                                  disabled={triggerAIOutreachMutation.isPending}
                                >
                                  <RefreshCw className={`h-3 w-3 mr-1 ${triggerAIOutreachMutation.isPending ? 'animate-spin' : ''}`} />
                                  Re-verify via AI
                                </Button>
                                
                                {selectedMaterial.escalationPhase === 'pending_officer' && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="flex-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      officerConfirmMutation.mutate(selectedMaterial.validityTrackerId!);
                                    }}
                                    disabled={officerConfirmMutation.isPending}
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Confirm Price
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Confirmed Prices by Supplier
                      </h4>
                      {Object.keys(pricesBySupplier).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No confirmed prices</p>
                      ) : (
                        Object.entries(pricesBySupplier).map(([supplierName, prices]) => (
                          <Card key={supplierName}>
                            <CardHeader className="py-2 px-3">
                              <CardTitle className="text-sm">{supplierName}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="py-2 text-xs">Valid From</TableHead>
                                    <TableHead className="py-2 text-xs text-right">Unit</TableHead>
                                    <TableHead className="py-2 text-xs text-right">Delivery</TableHead>
                                    <TableHead className="py-2 text-xs text-right">Total</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {prices.map(price => (
                                    <TableRow key={price.id}>
                                      <TableCell className="py-2 text-xs">
                                        {format(new Date(price.valid_from), 'MMM dd, yyyy')}
                                      </TableCell>
                                      <TableCell className="py-2 text-xs text-right">
                                        {price.unit_price?.toFixed(2) || '—'}
                                      </TableCell>
                                      <TableCell className="py-2 text-xs text-right">
                                        {price.delivery_price?.toFixed(2) || '—'}
                                      </TableCell>
                                      <TableCell className="py-2 text-xs text-right font-medium">
                                        {price.total_price?.toFixed(2) || '—'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="chart" className="mt-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Price History Over Time
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[280px]">
                          {priceHistoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={priceHistoryData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                                <XAxis 
                                  dataKey="date" 
                                  stroke="hsl(var(--muted-foreground))" 
                                  fontSize={12}
                                />
                                <YAxis 
                                  stroke="hsl(var(--muted-foreground))" 
                                  fontSize={12}
                                />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: 'hsl(var(--card))', 
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px'
                                  }}
                                />
                                <Legend />
                                <Line 
                                  type="monotone" 
                                  dataKey="price" 
                                  stroke="hsl(var(--primary))" 
                                  strokeWidth={2}
                                  dot={{ fill: 'hsl(var(--primary))' }}
                                  name="Price (SAR)"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                              <TrendingUp className="h-12 w-12 mb-3 opacity-30" />
                              <p className="text-sm">No price history available</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="coverage" className="mt-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Zone Coverage
                        </CardTitle>
                        <CardDescription>
                          {selectedMaterial.coverageRatio.covered} of {selectedMaterial.coverageRatio.total} zones covered
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {materialZones.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {materialZones.map(zone => (
                              <div 
                                key={zone?.id} 
                                className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/20"
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <div>
                                  <p className="text-sm font-medium">{zone?.name}</p>
                                  {zone?.city && (
                                    <p className="text-xs text-muted-foreground">{zone.city}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <MapPin className="h-12 w-12 mb-3 opacity-30" />
                            <p className="text-sm">No zone coverage configured</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </Layout>
  );
};

export default SupplyMaterials;

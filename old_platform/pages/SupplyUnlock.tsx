import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { UnlockKanbanCard, UnlockSupplierCard } from '@/components/unlock/UnlockKanbanCard';
import { CoverageAdvisor } from '@/components/unlock/CoverageAdvisor';
import { useCoverageAdvisor, SupplierCoverage } from '@/hooks/useCoverageAdvisor';
import { calculateWeightedScore } from '@/hooks/useWeightedScore';
import { 
  Unlock, 
  ArrowLeft, 
  Plus, 
  Package, 
  Building2, 
  DollarSign, 
  Loader2,
  Target,
  FileCheck,
  Handshake,
  Filter,
} from 'lucide-react';

interface UnlockCycle {
  id: string;
  material_id: string;
  unlock_status: string;
  cycle_status: string | null;
  target_price: number | null;
  initiated_by: string | null;
  initiated_at: string | null;
  notes: string | null;
  materials: { id: string; name: string; category: string } | null;
}

interface Material {
  id: string;
  name: string;
  category: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface Zone {
  id: string;
  name: string;
}

type KanbanColumn = 'collecting_quotes' | 'filtering' | 'negotiating' | 'agreement_signed';

const COLUMNS: { id: KanbanColumn; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'collecting_quotes', label: 'Collecting Quotes', icon: FileCheck, color: 'bg-blue-500' },
  { id: 'filtering', label: 'Filtering', icon: Filter, color: 'bg-amber-500' },
  { id: 'negotiating', label: 'Negotiating', icon: Handshake, color: 'bg-purple-500' },
  { id: 'agreement_signed', label: 'Agreement Signed', icon: Target, color: 'bg-green-500' },
];

const SupplyUnlock = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [newCycleDialogOpen, setNewCycleDialogOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [cycleNotes, setCycleNotes] = useState<string>('');
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [highlightedSupplierIds, setHighlightedSupplierIds] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Fetch zones for coverage
  const { data: zones = [] } = useQuery({
    queryKey: ['zones-for-unlock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as Zone[];
    }
  });

  // Fetch unlock cycles
  const { data: unlockCycles, isLoading: cyclesLoading } = useQuery({
    queryKey: ['unlock-cycles-with-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_unlock_cycles')
        .select('id, material_id, unlock_status, cycle_status, target_price, initiated_by, initiated_at, notes, materials(id, name, category)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as UnlockCycle[];
    }
  });

  // Fetch unlock suppliers (cards for kanban)
  const { data: unlockSuppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ['unlock-suppliers-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_unlock_suppliers')
        .select(`
          id, cycle_id, supplier_id, status, quoted_price, final_price, total_price, notes, quality_rating, coverage_zones,
          suppliers(id, name),
          material_unlock_cycles(id, target_price, materials(id, name, category))
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as UnlockSupplierCard[];
    }
  });

  // Fetch materials for dropdown
  const { data: materials } = useQuery({
    queryKey: ['materials-for-unlock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, category')
        .order('name');
      if (error) throw error;
      return data as Material[];
    }
  });

  // Fetch suppliers for selection
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-for-unlock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as Supplier[];
    }
  });

  // Transform unlock suppliers to coverage advisor format
  const supplierCoverages: SupplierCoverage[] = useMemo(() => {
    if (!unlockSuppliers) return [];
    return unlockSuppliers.map(s => {
      const targetPrice = s.material_unlock_cycles?.target_price || null;
      const currentPrice = s.total_price ?? s.quoted_price ?? null;
      const { weightedScore } = calculateWeightedScore({
        quotedPrice: currentPrice,
        targetPrice,
        qualityRating: s.quality_rating,
      });
      return {
        supplierId: s.id,
        supplierName: s.suppliers?.name || 'Unknown',
        coverageZones: s.coverage_zones || [],
        weightedScore,
        status: s.status,
      };
    });
  }, [unlockSuppliers]);

  // Coverage advisor hook
  const advisorData = useCoverageAdvisor(supplierCoverages, zones);

  // Create new unlock cycle mutation
  const createCycleMutation = useMutation({
    mutationFn: async (data: { materialId: string; targetPrice: number | null; notes: string; supplierIds: string[] }) => {
      const { data: cycle, error: cycleError } = await supabase
        .from('material_unlock_cycles')
        .insert({
          material_id: data.materialId,
          target_price: data.targetPrice,
          notes: data.notes,
          unlock_status: 'pending',
          cycle_status: 'collecting_quotes',
          initiated_by: user?.id,
          initiated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (cycleError) throw cycleError;
      
      if (data.supplierIds.length > 0) {
        const supplierInserts = data.supplierIds.map(supplierId => ({
          cycle_id: cycle.id,
          supplier_id: supplierId,
          status: 'collecting_quotes'
        }));
        
        const { error: suppliersError } = await supabase
          .from('material_unlock_suppliers')
          .insert(supplierInserts);
        
        if (suppliersError) throw suppliersError;
      }
      
      return cycle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unlock-cycles-with-materials'] });
      queryClient.invalidateQueries({ queryKey: ['unlock-suppliers-all'] });
      setNewCycleDialogOpen(false);
      resetForm();
      toast({ title: 'Success', description: 'Unlock cycle created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to create unlock cycle', variant: 'destructive' });
      console.error(error);
    }
  });

  // Update supplier status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ supplierId, newStatus }: { supplierId: string; newStatus: KanbanColumn }) => {
      const { error } = await supabase
        .from('material_unlock_suppliers')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', supplierId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unlock-suppliers-all'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
      console.error(error);
    }
  });

  // Update supplier price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async ({ supplierId, price }: { supplierId: string; price: number }) => {
      const { error } = await supabase
        .from('material_unlock_suppliers')
        .update({ quoted_price: price, total_price: price, updated_at: new Date().toISOString() })
        .eq('id', supplierId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unlock-suppliers-all'] });
      toast({ title: 'Price updated' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to update price', variant: 'destructive' });
      console.error(error);
    }
  });

  // Update supplier quality rating mutation
  const updateQualityMutation = useMutation({
    mutationFn: async ({ supplierId, rating }: { supplierId: string; rating: number }) => {
      const { error } = await supabase
        .from('material_unlock_suppliers')
        .update({ quality_rating: rating, updated_at: new Date().toISOString() })
        .eq('id', supplierId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unlock-suppliers-all'] });
      toast({ title: 'Quality rating updated' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to update rating', variant: 'destructive' });
      console.error(error);
    }
  });

  // Delete supplier from cycle mutation
  const deleteSupplierMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      const { error } = await supabase
        .from('material_unlock_suppliers')
        .delete()
        .eq('id', supplierId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unlock-suppliers-all'] });
      toast({ title: 'Supplier removed from cycle' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to remove supplier', variant: 'destructive' });
      console.error(error);
    }
  });

  const resetForm = () => {
    setSelectedMaterialId('');
    setTargetPrice('');
    setCycleNotes('');
    setSelectedSupplierIds([]);
  };

  const handleCreateCycle = () => {
    if (!selectedMaterialId) {
      toast({ title: 'Error', description: 'Please select a material', variant: 'destructive' });
      return;
    }
    
    createCycleMutation.mutate({
      materialId: selectedMaterialId,
      targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      notes: cycleNotes,
      supplierIds: selectedSupplierIds
    });
  };

  const toggleSupplierSelection = (supplierId: string) => {
    setSelectedSupplierIds(prev => 
      prev.includes(supplierId) 
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  // Drag and drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeSupplier = unlockSuppliers?.find(s => s.id === active.id);
    if (!activeSupplier) return;

    // Check if dropped on a column
    const targetColumn = COLUMNS.find(c => c.id === over.id);
    if (targetColumn && activeSupplier.status !== targetColumn.id) {
      updateStatusMutation.mutate({ supplierId: activeSupplier.id, newStatus: targetColumn.id });
    }
  }, [unlockSuppliers, updateStatusMutation]);

  const handleUpdatePrice = useCallback((supplierId: string, price: number) => {
    updatePriceMutation.mutate({ supplierId, price });
  }, [updatePriceMutation]);

  const handleUpdateQuality = useCallback((supplierId: string, rating: number) => {
    updateQualityMutation.mutate({ supplierId, rating });
  }, [updateQualityMutation]);

  const handleHighlightSuppliers = useCallback((supplierIds: string[]) => {
    setHighlightedSupplierIds(supplierIds);
  }, []);

  // Group suppliers by status for kanban columns
  const suppliersByStatus = useMemo(() => {
    const grouped: Record<KanbanColumn, UnlockSupplierCard[]> = {
      collecting_quotes: [],
      filtering: [],
      negotiating: [],
      agreement_signed: []
    };
    
    unlockSuppliers?.forEach(supplier => {
      const status = supplier.status as KanbanColumn;
      if (grouped[status]) {
        grouped[status].push(supplier);
      }
    });
    
    return grouped;
  }, [unlockSuppliers]);

  const activeSupplier = useMemo(() => {
    if (!activeId) return null;
    return unlockSuppliers?.find(s => s.id === activeId) || null;
  }, [activeId, unlockSuppliers]);

  const isLoading = cyclesLoading || suppliersLoading;

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/supply')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {t('supply.unlockPipeline', 'Unlock Pipeline')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('supply.unlockPipelineDesc', 'Manage material unlock cycles and pricing approvals')}
              </p>
            </div>
          </div>
          <Button onClick={() => setNewCycleDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('supply.newUnlockCycle', 'New Unlock Cycle')}
          </Button>
        </div>

        {/* Coverage Advisor */}
        {!isLoading && (
          <CoverageAdvisor 
            advisorData={advisorData} 
            onHighlightSuppliers={handleHighlightSuppliers}
          />
        )}

        {/* Kanban Board with Drag and Drop */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {COLUMNS.map(column => (
                <div key={column.id} className="flex flex-col" id={column.id}>
                  {/* Column Header */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className={`p-1.5 rounded-md ${column.color}`}>
                      <column.icon className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="font-medium text-sm">{column.label}</h3>
                    <Badge variant="secondary" className="ml-auto">
                      {suppliersByStatus[column.id].length}
                    </Badge>
                  </div>

                  {/* Column Cards - Droppable Area */}
                  <ScrollArea className="flex-1 min-h-[400px] max-h-[calc(100vh-320px)]">
                    <SortableContext
                      items={suppliersByStatus[column.id].map(s => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div 
                        className="space-y-3 pr-2 min-h-[400px] p-1"
                        data-column={column.id}
                      >
                        {suppliersByStatus[column.id].length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                            <Unlock className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-xs">Drop cards here</p>
                          </div>
                        ) : (
                          suppliersByStatus[column.id].map(supplier => (
                            <UnlockKanbanCard
                              key={supplier.id}
                              supplier={supplier}
                              zones={zones}
                              onDelete={deleteSupplierMutation.mutate}
                              onUpdatePrice={handleUpdatePrice}
                              onUpdateQuality={handleUpdateQuality}
                              isHighlighted={highlightedSupplierIds.includes(supplier.id)}
                              isDragging={activeId === supplier.id}
                            />
                          ))
                        )}
                      </div>
                    </SortableContext>
                  </ScrollArea>
                </div>
              ))}
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
              {activeSupplier && (
                <Card className="cursor-grabbing shadow-xl rotate-3 border-l-4 border-l-primary opacity-90">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">
                        {activeSupplier.material_unlock_cycles?.materials?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {activeSupplier.suppliers?.name}
                    </div>
                  </CardContent>
                </Card>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* New Unlock Cycle Dialog */}
        <Dialog open={newCycleDialogOpen} onOpenChange={setNewCycleDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Unlock className="h-5 w-5 text-primary" />
                New Unlock Cycle
              </DialogTitle>
              <DialogDescription>
                Create a new material unlock cycle and add suppliers to collect quotes.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Material Selection */}
              <div className="space-y-2">
                <Label>Material *</Label>
                <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials?.map(material => (
                      <SelectItem key={material.id} value={material.id}>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>{material.name}</span>
                          <span className="text-xs text-muted-foreground">({material.category})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Price */}
              <div className="space-y-2">
                <Label>Target Price (SAR)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Add any notes for this unlock cycle..."
                  value={cycleNotes}
                  onChange={(e) => setCycleNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Supplier Selection */}
              <div className="space-y-2">
                <Label>Initial Suppliers</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Building2 className="h-4 w-4 mr-2" />
                      {selectedSupplierIds.length > 0 
                        ? `${selectedSupplierIds.length} supplier(s) selected`
                        : 'Select suppliers'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <ScrollArea className="h-64">
                      <div className="p-2 space-y-1">
                        {suppliers?.map(supplier => (
                          <div 
                            key={supplier.id}
                            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                            onClick={() => toggleSupplierSelection(supplier.id)}
                          >
                            <Checkbox 
                              checked={selectedSupplierIds.includes(supplier.id)}
                              onCheckedChange={() => toggleSupplierSelection(supplier.id)}
                            />
                            <span className="text-sm">{supplier.name}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setNewCycleDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateCycle}
                disabled={createCycleMutation.isPending || !selectedMaterialId}
              >
                {createCycleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Cycle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default SupplyUnlock;

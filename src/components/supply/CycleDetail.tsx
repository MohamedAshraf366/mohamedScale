import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUpdateUnlockCycleStatus, useSupplyUnits, type UnlockCycle } from '@/hooks/useUnlockCycles';
import { useSupplyDomainsByCycle } from '@/hooks/useSupplyDomains';
import { usePromoteCycleResults } from '@/hooks/useCyclePromotion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, CheckCircle2, XCircle, LayoutDashboard, Target, FileText, Grid3X3, Users } from 'lucide-react';
import { format } from 'date-fns';
import { CycleSupplyOverview } from './CycleSupplyOverview';
import { CycleTargetPrices } from './CycleTargetPrices';
import { CycleQuotations } from './CycleQuotations';
import { SupplierSelectionMatrix } from './SupplierSelectionMatrix';

const statusColors: Record<string, string> = {
  planning: 'bg-muted text-muted-foreground',
  active: 'bg-emerald-500/15 text-emerald-600',
  completed: 'bg-primary/15 text-primary',
  cancelled: 'bg-destructive/15 text-destructive',
};

interface Props {
  cycle: UnlockCycle;
  onBack: () => void;
}

export function CycleDetail({ cycle, onBack }: Props) {
  const [tab, setTab] = useState('overview');
  const { data: supplyUnits, isLoading } = useSupplyUnits(cycle.id);
  const updateStatus = useUpdateUnlockCycleStatus();
  const promoteCycle = usePromoteCycleResults();

  // Fetch cycle domains
  const { data: cycleDomains } = useSupplyDomainsByCycle(cycle.id);

  // Fetch core material IDs
  const materialIds = useMemo(
    () => [...new Set((supplyUnits || []).map(u => u.material_id))],
    [supplyUnits]
  );

  const { data: materialsData } = useQuery({
    queryKey: ['cycle-materials-core', materialIds],
    enabled: materialIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, is_core')
        .in('id', materialIds);
      if (error) throw error;
      return data || [];
    },
  });

  const coreMaterialIds = useMemo(
    () => new Set((materialsData || []).filter(m => m.is_core).map(m => m.id)),
    [materialsData]
  );

  // Fetch supply_unit_suppliers for all units
  const supplyUnitIds = useMemo(
    () => (supplyUnits || []).map(u => u.id),
    [supplyUnits]
  );

  const { data: allSuppliers } = useQuery({
    queryKey: ['cycle-unit-suppliers', cycle.id, supplyUnitIds],
    enabled: supplyUnitIds.length > 0,
    queryFn: async () => {
      const results: any[] = [];
      for (let i = 0; i < supplyUnitIds.length; i += 100) {
        const batch = supplyUnitIds.slice(i, i + 100);
        const { data, error } = await supabase
          .from('supply_unit_suppliers')
          .select('*')
          .in('supply_unit_id', batch);
        if (error) throw error;
        results.push(...(data || []));
      }
      return results;
    },
  });

  // Build domain info for child components
  const domainInfoList = useMemo(() => {
    if (!cycleDomains || cycleDomains.length === 0) return [];
    return cycleDomains.map(cd => cd.domain);
  }, [cycleDomains]);

  // Summary stats
  const totalUnits = supplyUnits?.length || 0;
  const coreUnits = supplyUnits?.filter(u => coreMaterialIds.has(u.material_id)).length || 0;
  const uniqueMaterials = new Set(supplyUnits?.map(u => u.material_id) || []).size;
  const uniqueZones = new Set(supplyUnits?.map(u => u.zone_code) || []).size;
  const domainCount = cycleDomains?.length || 0;

  const handleComplete = async () => {
    // First promote results to domains, then mark as completed
    if (domainCount > 0) {
      try {
        await promoteCycle.mutateAsync({ cycleId: cycle.id });
      } catch {
        // promotion error already toasted
        return;
      }
    }
    updateStatus.mutate({ id: cycle.id, status: 'completed' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">{cycle.name}</h2>
            <Badge className={statusColors[cycle.status] || ''}>{cycle.status}</Badge>
          </div>
          {cycle.description && <p className="text-sm text-muted-foreground mt-1">{cycle.description}</p>}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
            {cycle.start_date && <span>Start: {format(new Date(cycle.start_date), 'dd MMM yyyy')}</span>}
            {cycle.end_date && <span>End: {format(new Date(cycle.end_date), 'dd MMM yyyy')}</span>}
            {/* SSOT §1: supply_units are atoms (Zone × Material) */}
            <span>{uniqueMaterials} material(s)</span>
            <span>{uniqueZones} zone(s)</span>
            <span>{coreUnits} Key / {totalUnits} total atoms</span>
            {domainCount > 0 && (
              <span className="flex items-center gap-1">
                <Grid3X3 className="h-3 w-3" />
                {domainCount} domain(s)
              </span>
            )}
          </div>
          {/* Domain labels */}
          {domainInfoList.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {domainInfoList.map(d => (
                <Badge key={d.id} variant="outline" className="text-[10px]">
                  {d.label}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-1.5 shrink-0">
          {cycle.status === 'planning' && (
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: cycle.id, status: 'active' })}>
              <Play className="h-3.5 w-3.5 mr-1" /> Activate
            </Button>
          )}
          {cycle.status === 'active' && (
            <Button size="sm" variant="outline" onClick={handleComplete} disabled={promoteCycle.isPending}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete
            </Button>
          )}
          {['planning', 'active'].includes(cycle.status) && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateStatus.mutate({ id: cycle.id, status: 'cancelled' })}>
              <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Suppliers
            </TabsTrigger>
            <TabsTrigger value="quotations" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Quotations
            </TabsTrigger>
            <TabsTrigger value="target-prices" className="gap-1.5">
              <Target className="h-3.5 w-3.5" /> Target Prices
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CycleSupplyOverview
              supplyUnits={supplyUnits || []}
              suppliers={allSuppliers || []}
              coreMaterialIds={coreMaterialIds}
              domains={domainInfoList}
            />
          </TabsContent>

          <TabsContent value="suppliers">
            <SupplierSelectionMatrix
              cycleId={cycle.id}
              supplyUnits={supplyUnits || []}
              suppliers={allSuppliers || []}
              coreMaterialIds={coreMaterialIds}
              domains={domainInfoList}
            />
          </TabsContent>

          <TabsContent value="quotations">
            <CycleQuotations
              cycleId={cycle.id}
              supplyUnits={supplyUnits || []}
              coreMaterialIds={coreMaterialIds}
            />
          </TabsContent>

          <TabsContent value="target-prices">
            <CycleTargetPrices
              cycleId={cycle.id}
              supplyUnits={supplyUnits || []}
              coreMaterialIds={coreMaterialIds}
              domains={domainInfoList}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
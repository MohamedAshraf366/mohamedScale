import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Target, Users, ShieldCheck, Crown, Eye, EyeOff, Package, Star, Shield,
  ChevronDown, ChevronRight, Grid3X3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SupplyUnit } from '@/hooks/useUnlockCycles';
import type { SupplyUnitSupplier } from '@/hooks/useSupplyUnitSuppliers';
import type { SupplyDomain } from '@/hooks/useSupplyDomains';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  supplyUnits: SupplyUnit[];
  suppliers: SupplyUnitSupplier[];
  coreMaterialIds: Set<string>;
  domains?: SupplyDomain[];
}

type SupplierRole = 'selected' | 'quality' | 'backup';

interface CellData {
  unitId: string;
  targetPrice: number | null;
  supplierRole: SupplierRole | null;
  supplierName: string | null;
  landedPrice: number | null;
  totalAssigned: number;
  score: number;
}

interface MatRow {
  materialId: string;
  materialName: string;
  materialCode: string | null;
  isCore: boolean;
  cells: Map<string, CellData>;
  avgScore: number;
}

interface DomainGroup {
  domainId: string | null;
  domainLabel: string;
  rows: MatRow[];
  zones: string[];
  stats: { total: number; withTarget: number; withSupplier: number };
}

interface SupplierSummary {
  accountId: string;
  name: string;
  selectedCount: number;
  backupCount: number;
  qualityCount: number;
}

function ScoreDot({ score }: { score: number }) {
  const bg = score === 2 ? 'bg-emerald-500' : score === 1 ? 'bg-amber-500' : 'bg-destructive';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', bg)} />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {score}/2 complete
      </TooltipContent>
    </Tooltip>
  );
}

const roleIcon: Record<string, { icon: typeof Crown; color: string; label: string }> = {
  selected: { icon: Crown, color: 'text-emerald-600', label: 'Selected' },
  quality: { icon: ShieldCheck, color: 'text-blue-600', label: 'Quality' },
  backup: { icon: Shield, color: 'text-amber-600', label: 'Backup' },
};

function DomainMatrixSection({ group }: { group: DomainGroup }) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full text-left py-2 px-3 hover:bg-muted/50 rounded-lg transition-colors">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <Grid3X3 className="h-3.5 w-3.5 text-muted-foreground" />
          {/* SSOT §1: Domain = Area × Group */}
          <span className="text-sm font-semibold">{group.domainLabel}</span>
          <Badge variant="secondary" className="text-[10px] ml-1">
            {group.rows.length} materials · {group.zones.length} zones
          </Badge>
          <div className="flex items-center gap-2 ml-auto text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Target className="h-3 w-3" /> {group.stats.withTarget}/{group.stats.total}</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {group.stats.withSupplier}/{group.stats.total}</span>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-1">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-semibold sticky left-0 bg-card z-10 min-w-[180px]">Material</TableHead>
                    {group.zones.map(z => (
                      <TableHead key={z} className="text-[10px] text-center font-semibold min-w-[120px]">{z}</TableHead>
                    ))}
                    <TableHead className="text-[10px] text-center font-semibold min-w-[60px]">Avg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.rows.map(row => (
                    <TableRow key={row.materialId}>
                      <TableCell className="sticky left-0 bg-card z-10 py-2">
                        <div className="flex items-center gap-1.5">
                          {row.isCore && <Star className="h-3 w-3 text-primary fill-primary shrink-0" />}
                          <span className="text-xs font-medium truncate max-w-[140px]">{row.materialName}</span>
                          {row.materialCode && (
                            <Badge variant="outline" className="font-mono text-[9px] shrink-0 px-1">{row.materialCode}</Badge>
                          )}
                        </div>
                      </TableCell>
                      {group.zones.map(zone => {
                        const cell = row.cells.get(zone);
                        if (!cell) {
                          return <TableCell key={zone} className="text-center py-2"><span className="text-muted-foreground/30">—</span></TableCell>;
                        }
                        return (
                          <TableCell key={zone} className={cn(
                            'py-2 text-center',
                            cell.score === 2 && 'bg-emerald-500/5',
                            cell.score === 0 && 'bg-amber-500/5',
                          )}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex flex-col items-center gap-1 cursor-default">
                                  <span className={cn(
                                    'text-xs font-mono font-semibold',
                                    cell.targetPrice != null ? 'text-foreground' : 'text-muted-foreground',
                                  )}>
                                    {cell.targetPrice != null ? cell.targetPrice.toFixed(2) : '—'}
                                  </span>
                                  {cell.supplierRole ? (() => {
                                    const r = roleIcon[cell.supplierRole];
                                    const Icon = r.icon;
                                    return (
                                      <span className={cn('flex items-center gap-0.5 text-[10px] font-medium', r.color)}>
                                        <Icon className="h-3 w-3" />
                                        {cell.totalAssigned > 1 && <span>+{cell.totalAssigned - 1}</span>}
                                      </span>
                                    );
                                  })() : (
                                    <span className="text-[10px] text-muted-foreground/40">—</span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs space-y-1 max-w-[200px]">
                                <p className="font-semibold">{row.materialName} — {zone}</p>
                                <p>Target: {cell.targetPrice != null ? `${cell.targetPrice.toFixed(2)} SAR` : 'Not set'}</p>
                                <p>Supplier: {cell.supplierName || 'None'}{cell.landedPrice != null ? ` (${cell.landedPrice.toFixed(2)})` : ''}</p>
                                <p>Role: {cell.supplierRole ? roleIcon[cell.supplierRole].label : 'Unassigned'}</p>
                                <p>Total assigned: {cell.totalAssigned}</p>
                                <p className="font-semibold">Score: {cell.score}/2</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center py-2">
                        <ScoreDot score={Math.round(row.avgScore)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CycleSupplyOverview({ supplyUnits, suppliers, coreMaterialIds, domains }: Props) {
  const [showNonCore, setShowNonCore] = useState(false);

  const supplierAccountIds = useMemo(
    () => [...new Set(suppliers.map(s => s.supplier_account_id))],
    [suppliers]
  );

  const { data: accounts } = useQuery({
    queryKey: ['cycle-overview-accounts', supplierAccountIds],
    enabled: supplierAccountIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, display_name').is('deleted_at', null)
        .in('id', supplierAccountIds);
      if (error) throw error;
      return data || [];
    },
  });

  const accountMap = useMemo(
    () => new Map((accounts || []).map(a => [a.id, a.display_name || 'Unknown'])),
    [accounts]
  );

  const suppliersByUnit = useMemo(() => {
    const map = new Map<string, SupplyUnitSupplier[]>();
    suppliers.forEach(s => {
      const list = map.get(s.supply_unit_id) || [];
      list.push(s);
      map.set(s.supply_unit_id, list);
    });
    return map;
  }, [suppliers]);

  const filteredUnits = useMemo(
    () => showNonCore ? supplyUnits : supplyUnits.filter(u => coreMaterialIds.has(u.material_id)),
    [supplyUnits, coreMaterialIds, showNonCore]
  );

  // Build cell data helper
  const buildCellData = (u: SupplyUnit): CellData => {
    const unitSups = suppliersByUnit.get(u.id) || [];
    const uniqueIds = new Set(unitSups.map(s => s.supplier_account_id));
    // const selectedSup = unitSups.find(s => s.role === 'selected');
    // const qualitySup = unitSups.find(s => s.is_quality_pick);
    // const backupSup = unitSups.find(s => s.role === 'backup');

    const selectedSup =
      unitSups.find(s => s.role === 'selected');

    const qualitySup =
      unitSups.find(s => s.role === 'selected' && s.is_quality_pick) ||
      unitSups.find(s => s.is_quality_pick);

    const backupSup =
      unitSups.find(s => s.role === 'backup');

    let supplierRole: SupplierRole | null = null;
    let supplierName: string | null = null;
    let landedPrice: number | null = null;

    if (selectedSup) {
      supplierRole = 'selected';
      supplierName = accountMap.get(selectedSup.supplier_account_id) || '?';
      landedPrice = selectedSup.landed_price;
    } else if (qualitySup) {
      supplierRole = 'quality';
      supplierName = accountMap.get(qualitySup.supplier_account_id) || '?';
      landedPrice = qualitySup.landed_price;
    } else if (backupSup) {
      supplierRole = 'backup';
      supplierName = accountMap.get(backupSup.supplier_account_id) || '?';
      landedPrice = backupSup.landed_price;
    }

    let score = 0;
    if (u.target_price != null) score++;
    if (supplierRole) score++;

    return {
      unitId: u.id,
      targetPrice: u.target_price,
      supplierRole,
      supplierName,
      landedPrice,
      totalAssigned: uniqueIds.size,
      score,
    };
  };

  // Build rows from a set of units
  const buildRows = (units: SupplyUnit[]): MatRow[] => {
    const matMap = new Map<string, { units: SupplyUnit[] }>();
    units.forEach(u => {
      if (!matMap.has(u.material_id)) matMap.set(u.material_id, { units: [] });
      matMap.get(u.material_id)!.units.push(u);
    });

    const result: MatRow[] = [];
    matMap.forEach((group, materialId) => {
      const first = group.units[0];
      const cells = new Map<string, CellData>();
      let totalScore = 0;

      group.units.forEach(u => {
        const cell = buildCellData(u);
        totalScore += cell.score;
        cells.set(u.zone_code, cell);
      });

      result.push({
        materialId,
        materialName: first.material_name || 'Unknown',
        materialCode: first.material_code || null,
        isCore: coreMaterialIds.has(materialId),
        cells,
        avgScore: group.units.length > 0 ? totalScore / group.units.length : 0,
      });
    });

    // Key (core) materials always pinned on top, secondary sort by avgScore then name
    result.sort((a, b) => {
      if (a.isCore !== b.isCore) return a.isCore ? -1 : 1;
      return a.avgScore - b.avgScore || a.materialName.localeCompare(b.materialName);
    });
    return result;
  };

  // Build domain groups
  const domainGroups = useMemo((): DomainGroup[] => {
    const hasDomains = domains && domains.length > 0;

    if (!hasDomains) {
      // Single group - no domain grouping
      const zones = [...new Set(filteredUnits.map(u => u.zone_code))].sort();
      const rows = buildRows(filteredUnits);
      const coreUnits = filteredUnits.filter(u => coreMaterialIds.has(u.material_id));
      let withTarget = 0, withSupplier = 0;
      coreUnits.forEach(u => {
        if (u.target_price != null) withTarget++;
        const us = suppliersByUnit.get(u.id) || [];
        if (us.some(s => s.role === 'selected' || s.is_quality_pick || s.role === 'backup')) withSupplier++;
      });
      return [{
        domainId: null,
        domainLabel: 'All Materials',
        rows,
        zones,
        stats: { total: coreUnits.length, withTarget, withSupplier },
      }];
    }

    // Group by domain
    const groups: DomainGroup[] = [];
    const domainMap = new Map<string, SupplyUnit[]>();
    const ungrouped: SupplyUnit[] = [];

    filteredUnits.forEach(u => {
      if (u.domain_id && domains.some(d => d.id === u.domain_id)) {
        if (!domainMap.has(u.domain_id)) domainMap.set(u.domain_id, []);
        domainMap.get(u.domain_id)!.push(u);
      } else {
        ungrouped.push(u);
      }
    });

    domains.forEach(domain => {
      const units = domainMap.get(domain.id) || [];
      if (units.length === 0) return;
      const zones = [...new Set(units.map(u => u.zone_code))].sort();
      const rows = buildRows(units);
      const coreUnits = units.filter(u => coreMaterialIds.has(u.material_id));
      let withTarget = 0, withSupplier = 0;
      coreUnits.forEach(u => {
        if (u.target_price != null) withTarget++;
        const us = suppliersByUnit.get(u.id) || [];
        if (us.some(s => s.role === 'selected' || s.is_quality_pick || s.role === 'backup')) withSupplier++;
      });
      groups.push({
        domainId: domain.id,
        domainLabel: domain.label,
        rows,
        zones,
        stats: { total: coreUnits.length, withTarget, withSupplier },
      });
    });

    if (ungrouped.length > 0) {
      const zones = [...new Set(ungrouped.map(u => u.zone_code))].sort();
      const rows = buildRows(ungrouped);
      groups.push({
        domainId: null,
        domainLabel: 'Ungrouped',
        rows,
        zones,
        stats: { total: ungrouped.length, withTarget: 0, withSupplier: 0 },
      });
    }

    return groups;
  }, [filteredUnits, domains, coreMaterialIds, suppliersByUnit, accountMap]);

  // Global KPIs (core only)
  const stats = useMemo(() => {
    const coreUnits = supplyUnits.filter(u => coreMaterialIds.has(u.material_id));
    const total = coreUnits.length;
    if (total === 0) return { total: 0, withTarget: 0, withSupplier: 0 };
    let withTarget = 0, withSupplier = 0;
    coreUnits.forEach(u => {
      const us = suppliersByUnit.get(u.id) || [];
      if (u.target_price != null) withTarget++;
      if (us.some(s => s.role === 'selected' || s.is_quality_pick || s.role === 'backup')) withSupplier++;
    });
    return { total, withTarget, withSupplier };
  }, [supplyUnits, suppliersByUnit, coreMaterialIds]);

  // Supplier summaries
  const supplierSummaries = useMemo((): SupplierSummary[] => {
    const map = new Map<string, SupplierSummary>();
    suppliers.forEach(s => {
      if (!map.has(s.supplier_account_id)) {
        map.set(s.supplier_account_id, {
          accountId: s.supplier_account_id,
          name: accountMap.get(s.supplier_account_id) || 'Unknown',
          selectedCount: 0, backupCount: 0, qualityCount: 0,
        });
      }
      const row = map.get(s.supplier_account_id)!;
      if (s.role === 'selected') row.selectedCount++;
      if (s.role === 'backup') row.backupCount++;
      if (s.is_quality_pick) row.qualityCount++;
    });
    return Array.from(map.values()).sort((a, b) => b.selectedCount - a.selectedCount);
  }, [suppliers, accountMap]);

  const pct = (n: number) => stats.total > 0 ? Math.round((n / stats.total) * 100) : 0;
  const nonCoreCount = useMemo(
    () => new Set(supplyUnits.filter(u => !coreMaterialIds.has(u.material_id)).map(u => u.material_id)).size,
    [supplyUnits, coreMaterialIds]
  );
  const totalRows = domainGroups.reduce((acc, g) => acc + g.rows.length, 0);
  const totalZones = new Set(filteredUnits.map(u => u.zone_code)).size;

  const kpis = [
    { label: 'Target Price', value: stats.withTarget, icon: Target, color: 'text-primary' },
    { label: 'Supplier Assigned', value: stats.withSupplier, icon: Users, color: 'text-emerald-600' },
  ];

  if (stats.total === 0 && !showNonCore) {
    return (
      <div className="text-center py-8 text-muted-foreground space-y-2">
        <Package className="h-8 w-8 mx-auto text-muted-foreground/50" />
        <p className="text-sm">No Key material supply units in this cycle yet.</p>
        {nonCoreCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowNonCore(true)}>
            <Eye className="h-3.5 w-3.5 mr-1" /> Show {nonCoreCount} more material{nonCoreCount !== 1 ? 's' : ''}
          </Button>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map(kpi => {
            const Icon = kpi.icon;
            const percentage = pct(kpi.value);
            return (
              <Card key={kpi.label} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Icon className={cn('h-3.5 w-3.5', kpi.color)} />
                      {kpi.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{percentage}%</span>
                  </div>
                  <div className="text-xl font-bold">
                    {kpi.value}
                    <span className="text-sm font-normal text-muted-foreground">/{stats.total}</span>
                  </div>
                  <Progress value={percentage} className="h-1 mt-2" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary line */}
        <div>
          <p className="text-sm text-muted-foreground">
            {totalRows} material{totalRows !== 1 ? 's' : ''} × {totalZones} zone{totalZones !== 1 ? 's' : ''}
            {domainGroups.length > 1 && ` · ${domainGroups.length} domains`}
          </p>
        </div>

        {/* Domain-grouped matrices */}
        {domainGroups.length === 1 && !domainGroups[0].domainId ? (
          // No domains - render flat matrix
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-semibold sticky left-0 bg-card z-10 min-w-[180px]">Material</TableHead>
                      {domainGroups[0].zones.map(z => (
                        <TableHead key={z} className="text-[10px] text-center font-semibold min-w-[120px]">{z}</TableHead>
                      ))}
                      <TableHead className="text-[10px] text-center font-semibold min-w-[60px]">Avg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {domainGroups[0].rows.map(row => (
                      <TableRow key={row.materialId}>
                        <TableCell className="sticky left-0 bg-card z-10 py-2">
                          <div className="flex items-center gap-1.5">
                            {row.isCore && <Star className="h-3 w-3 text-primary fill-primary shrink-0" />}
                            <span className="text-xs font-medium truncate max-w-[140px]">{row.materialName}</span>
                            {row.materialCode && (
                              <Badge variant="outline" className="font-mono text-[9px] shrink-0 px-1">{row.materialCode}</Badge>
                            )}
                          </div>
                        </TableCell>
                        {domainGroups[0].zones.map(zone => {
                          const cell = row.cells.get(zone);
                          if (!cell) return <TableCell key={zone} className="text-center py-2"><span className="text-muted-foreground/30">—</span></TableCell>;
                          return (
                            <TableCell key={zone} className={cn('py-2 text-center', cell.score === 2 && 'bg-emerald-500/5', cell.score === 0 && 'bg-amber-500/5')}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex flex-col items-center gap-1 cursor-default">
                                    <span className={cn('text-xs font-mono font-semibold', cell.targetPrice != null ? 'text-foreground' : 'text-muted-foreground')}>
                                      {cell.targetPrice != null ? cell.targetPrice.toFixed(2) : '—'}
                                    </span>
                                    {cell.supplierRole ? (() => {
                                      const r = roleIcon[cell.supplierRole];
                                      const Icon = r.icon;
                                      return (
                                        <span className={cn('flex items-center gap-0.5 text-[10px] font-medium', r.color)}>
                                          <Icon className="h-3 w-3" />
                                          {cell.totalAssigned > 1 && <span>+{cell.totalAssigned - 1}</span>}
                                        </span>
                                      );
                                    })() : <span className="text-[10px] text-muted-foreground/40">—</span>}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs space-y-1 max-w-[200px]">
                                  <p className="font-semibold">{row.materialName} — {zone}</p>
                                  <p>Target: {cell.targetPrice != null ? `${cell.targetPrice.toFixed(2)} SAR` : 'Not set'}</p>
                                  <p>Supplier: {cell.supplierName || 'None'}</p>
                                  <p>Score: {cell.score}/2</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center py-2"><ScoreDot score={Math.round(row.avgScore)} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Domain-grouped sections
          <div className="space-y-3">
            {domainGroups.map(group => (
              <DomainMatrixSection key={group.domainId || '__ungrouped'} group={group} />
            ))}
          </div>
        )}

        {/* Expand toggle (below table) */}
        {nonCoreCount > 0 && (
          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowNonCore(!showNonCore)} className="text-xs">
              {showNonCore ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
              {showNonCore ? 'Show Key only' : `Show ${nonCoreCount} more material${nonCoreCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Crown className="h-3 w-3 text-emerald-600" /> Selected</span>
          <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-blue-600" /> Quality</span>
          <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-amber-600" /> Backup</span>
          <span className="flex items-center gap-1"><Star className="h-3 w-3 text-primary fill-primary" /> Key</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> 2/2</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 1/2</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> 0/2</span>
        </div>

        {/* Supplier summary strip */}
        {supplierSummaries.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> Cycle Suppliers
                <Badge variant="secondary" className="text-xs ml-auto">{supplierSummaries.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {supplierSummaries.map(s => (
                  <div key={s.accountId} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                    <span className="text-sm font-medium truncate max-w-[140px]">{s.name}</span>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      {s.selectedCount > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 px-1.5">
                          <Crown className="h-2.5 w-2.5 mr-0.5" />{s.selectedCount}
                        </Badge>
                      )}
                      {s.qualityCount > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30 px-1.5">
                          <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />{s.qualityCount}
                        </Badge>
                      )}
                      {s.backupCount > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30 px-1.5">
                          <Shield className="h-2.5 w-2.5 mr-0.5" />{s.backupCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}

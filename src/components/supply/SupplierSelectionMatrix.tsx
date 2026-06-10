/**
 * SSOT §4.1: Supplier Selection Matrix
 *
 * Rows = material variations (Key expanded, others collapsed)
 * Columns = suppliers (dynamic)
 * Fixed columns = target price, best price, average price, coverage %, selected, quality, flags
 * INTERACTIVE: click supplier cells to assign/change roles
 */
import { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Crown, ShieldCheck, Shield, Star, Eye, EyeOff, Package,
  ChevronDown, ChevronRight, AlertTriangle, ArrowUpDown,
  TrendingDown, TrendingUp, MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SupplyUnit } from '@/hooks/useUnlockCycles';
import type { SupplyUnitSupplier } from '@/hooks/useSupplyUnitSuppliers';
import type { SupplyDomain } from '@/hooks/useSupplyDomains';

interface Props {
  cycleId: string;
  supplyUnits: SupplyUnit[];
  suppliers: SupplyUnitSupplier[];
  coreMaterialIds: Set<string>;
  domains?: SupplyDomain[];
}

type SortField = 'name' | 'coverage' | 'bestPrice' | 'avgPrice';

interface SupplierColumn {
  accountId: string;
  name: string;
  atomCount: number;
  bestPrice: number | null;
  primaryRole: 'selected' | 'quality' | 'backup' | 'candidate' | null;
  isQualityPick: boolean;
  /** IDs of supply_unit_suppliers rows for this supplier×material */
  assignmentIds: string[];
  /** Supply unit IDs for this material (all atoms) */
  materialUnitIds: string[];
}

interface MaterialRow {
  materialId: string;
  materialName: string;
  materialCode: string | null;
  isCore: boolean;
  targetPrice: number | null;
  bestQuotePrice: number | null;
  avgQuotePrice: number | null;
  totalAtoms: number;
  coveredAtoms: number;
  coveragePct: number;
  selectedSupplier: string | null;
  qualitySupplier: string | null;
  flags: string[];
  supplierCols: Map<string, SupplierColumn>;
  /** All supply unit IDs for this material */
  unitIds: string[];
}

interface DomainSection {
  domainId: string | null;
  domainLabel: string;
  rows: MaterialRow[];
}

const roleConfig = {
  selected: { icon: Crown, color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Selected' },
  quality: { icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-500/10', label: 'Quality' },
  backup: { icon: Shield, color: 'text-amber-600', bg: 'bg-amber-500/10', label: 'Backup' },
  candidate: { icon: Package, color: 'text-muted-foreground', bg: 'bg-muted/50', label: 'Candidate' },
};

export function SupplierSelectionMatrix({ cycleId, supplyUnits, suppliers, coreMaterialIds, domains }: Props) {
  const [showNonCore, setShowNonCore] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>('coverage');
  const qc = useQueryClient();

  const supplierAccountIdsFromAssignments = useMemo(
    () => [...new Set(suppliers.map(s => s.supplier_account_id))],
    [suppliers]
  );

  const materialIds = useMemo(
    () => [...new Set(supplyUnits.map(u => u.material_id))],
    [supplyUnits]
  );

  const { data: supplierMaterials } = useQuery({
    queryKey: ['matrix-supplier-materials', materialIds],
    enabled: materialIds.length > 0,
    queryFn: async () => {
      const allResults: any[] = [];
      for (let i = 0; i < materialIds.length; i += 50) {
        const batch = materialIds.slice(i, i + 50);
        const { data, error } = await supabase
          .from('supplier_materials')
          .select('material_id, supplier_account_id, unit_price, supplier_quote_id')
          .in('material_id', batch)
          .eq('is_current', true);
        if (error) throw error;
        allResults.push(...(data || []));
      }
      return allResults;
    },
  });

  const { data: targetPrices } = useQuery({
    queryKey: ['matrix-target-prices', materialIds],
    enabled: materialIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('target_prices')
        .select('material_id, scope_type, scope_id, target_price, best_price, average_price')
        .in('material_id', materialIds);
      if (error) throw error;
      return data || [];
    },
  });

  const suppliersByUnit = useMemo(() => {
    const map = new Map<string, SupplyUnitSupplier[]>();
    suppliers.forEach(s => {
      const list = map.get(s.supply_unit_id) || [];
      list.push(s);
      map.set(s.supply_unit_id, list);
    });
    return map;
  }, [suppliers]);

  const priceData = useMemo(() => {
    const map = new Map<string, { prices: number[]; bySupplier: Map<string, number> }>();
    (supplierMaterials || []).forEach((sm: any) => {
      if (sm.unit_price == null) return;
      if (!map.has(sm.material_id)) map.set(sm.material_id, { prices: [], bySupplier: new Map() });
      const entry = map.get(sm.material_id)!;
      const price = Number(sm.unit_price);
      entry.prices.push(price);
      const existing = entry.bySupplier.get(sm.supplier_account_id);
      if (existing == null || price < existing) {
        entry.bySupplier.set(sm.supplier_account_id, price);
      }
    });
    return map;
  }, [supplierMaterials]);

  const targetPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    (targetPrices || []).forEach((tp: any) => {
      if (tp.target_price != null && !map.has(tp.material_id)) {
        map.set(tp.material_id, Number(tp.target_price));
      }
    });
    return map;
  }, [targetPrices]);

  const cycleSupplierIds = useMemo(() => {
    const ids = new Set<string>();
    suppliers.forEach(s => ids.add(s.supplier_account_id));
    (supplierMaterials || []).forEach((sm: any) => ids.add(sm.supplier_account_id));
    return [...ids];
  }, [suppliers, supplierMaterials]);

  // Fetch display names for ALL suppliers participating in this cycle (assignments + quotes)
  const { data: accounts } = useQuery({
    queryKey: ['matrix-accounts', cycleSupplierIds],
    enabled: cycleSupplierIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, display_name').is('deleted_at', null)
        .in('id', cycleSupplierIds);
      if (error) throw error;
      return data || [];
    },
  });

  const accountMap = useMemo(
    () => new Map((accounts || []).map(a => [a.id, a.display_name || 'Unknown'])),
    [accounts]
  );

  // --- Role change handler ---
  const handleRoleChange = useCallback(async (
    row: MaterialRow,
    supplierAccountId: string,
    newRole: 'selected' | 'backup' | 'candidate',
    isQualityPick: boolean = false,
  ) => {
    const col = row.supplierCols.get(supplierAccountId);
    if (!col) return;

    try {
      // If this supplier already has assignments for this material, update them
      if (col.assignmentIds.length > 0) {
        await Promise.all(col.assignmentIds.map(id =>
          supabase
            .from('supply_unit_suppliers')
            .update({ role: newRole, is_quality_pick: isQualityPick } as any)
            .eq('id', id)
        ));
      } else {
        // Create assignments for all atoms of this material
        const unitIds = row.unitIds;
        if (unitIds.length === 0) return;
        await supabase
          .from('supply_unit_suppliers')
          .insert(unitIds.map(uid => ({
            supply_unit_id: uid,
            supplier_account_id: supplierAccountId,
            role: newRole,
            is_quality_pick: isQualityPick,
          })) as any);
      }

      // If assigning as 'selected', demote other 'selected' for this material
      if (newRole === 'selected') {
        const otherSelectedIds: string[] = [];
        row.supplierCols.forEach((otherCol, otherId) => {
          if (otherId !== supplierAccountId && otherCol.primaryRole === 'selected') {
            otherSelectedIds.push(...otherCol.assignmentIds);
          }
        });
        if (otherSelectedIds.length > 0) {
          await Promise.all(otherSelectedIds.map(id =>
            supabase
              .from('supply_unit_suppliers')
              .update({ role: 'backup' } as any)
              .eq('id', id)
          ));
        }
      }

      qc.invalidateQueries({ queryKey: ['supply-unit-suppliers'] });
      qc.invalidateQueries({ queryKey: ['supply-units'] });
      toast.success(`${accountMap.get(supplierAccountId) || 'Supplier'} → ${isQualityPick ? 'Quality Pick' : newRole} for ${row.materialName}`);
    } catch (e: any) {
      toast.error('Failed to update role: ' + e.message);
    }
  }, [qc, accountMap]);

  const buildRows = (units: SupplyUnit[]): MaterialRow[] => {
    const matGroups = new Map<string, SupplyUnit[]>();
    units.forEach(u => {
      const list = matGroups.get(u.material_id) || [];
      list.push(u);
      matGroups.set(u.material_id, list);
    });

    const rows: MaterialRow[] = [];

    matGroups.forEach((matUnits, materialId) => {
      const first = matUnits[0];
      const totalAtoms = matUnits.length;
      let coveredAtoms = 0;
      const supplierCols = new Map<string, SupplierColumn>();
      const unitIds = matUnits.map(u => u.id);

      cycleSupplierIds.forEach(sid => {
        supplierCols.set(sid, {
          accountId: sid,
          name: accountMap.get(sid) || 'Unknown',
          atomCount: 0,
          bestPrice: priceData.get(materialId)?.bySupplier.get(sid) ?? null,
          primaryRole: null,
          isQualityPick: false,
          assignmentIds: [],
          materialUnitIds: unitIds,
        });
      });

      matUnits.forEach(u => {
        const unitSups = suppliersByUnit.get(u.id) || [];
        if (unitSups.length > 0) coveredAtoms++;

        unitSups.forEach(s => {
          const col = supplierCols.get(s.supplier_account_id);
          if (!col) return;
          col.atomCount++;
          col.assignmentIds.push(s.id);
          if (s.landed_price != null) {
            col.bestPrice = col.bestPrice == null
              ? Number(s.landed_price)
              : Math.min(col.bestPrice, Number(s.landed_price));
          }
          if (s.role === 'selected') col.primaryRole = 'selected';
          else if (s.is_quality_pick && col.primaryRole !== 'selected') col.primaryRole = 'quality';
          else if (s.role === 'backup' && !col.primaryRole) col.primaryRole = 'backup';
          else if (!col.primaryRole) col.primaryRole = 'candidate';
          if (s.is_quality_pick) col.isQualityPick = true;
        });
      });

      const pd = priceData.get(materialId);
      const prices = pd?.prices || [];
      const bestQuotePrice = prices.length > 0 ? Math.min(...prices) : null;
      const avgQuotePrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
      const targetPrice = targetPriceMap.get(materialId) ?? null;
      const coveragePct = totalAtoms > 0 ? Math.round((coveredAtoms / totalAtoms) * 100) : 0;

      let selectedSupplier: string | null = null;
      let qualitySupplier: string | null = null;
      supplierCols.forEach(col => {
        if (col.primaryRole === 'selected' && !selectedSupplier) selectedSupplier = col.name;
        if ((col.primaryRole === 'quality' || col.isQualityPick) && !qualitySupplier) qualitySupplier = col.name;
      });

      const flags: string[] = [];
      if (coveredAtoms === 0) flags.push('uncovered');
      if (targetPrice == null) flags.push('no-target');
      if (coveragePct > 0 && coveragePct < 100) flags.push('partial');

      rows.push({
        materialId,
        materialName: first.material_name || 'Unknown',
        materialCode: first.material_code || null,
        isCore: coreMaterialIds.has(materialId),
        targetPrice,
        bestQuotePrice,
        avgQuotePrice,
        totalAtoms,
        coveredAtoms,
        coveragePct,
        selectedSupplier,
        qualitySupplier,
        flags,
        supplierCols,
        unitIds,
      });
    });

    rows.sort((a, b) => {
      // Key (core) materials always pinned on top
      if (a.isCore !== b.isCore) return a.isCore ? -1 : 1;
      if (sortBy === 'coverage') return a.coveragePct - b.coveragePct;
      if (sortBy === 'bestPrice') return (a.bestQuotePrice ?? Infinity) - (b.bestQuotePrice ?? Infinity);
      if (sortBy === 'avgPrice') return (a.avgQuotePrice ?? Infinity) - (b.avgQuotePrice ?? Infinity);
      return a.materialName.localeCompare(b.materialName);
    });

    return rows;
  };

  const filteredUnits = useMemo(
    () => showNonCore ? supplyUnits : supplyUnits.filter(u => coreMaterialIds.has(u.material_id)),
    [supplyUnits, coreMaterialIds, showNonCore]
  );

  const sections = useMemo((): DomainSection[] => {
    if (!domains || domains.length === 0) {
      return [{ domainId: null, domainLabel: 'All Materials', rows: buildRows(filteredUnits) }];
    }

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

    const result: DomainSection[] = [];
    domains.forEach(d => {
      const units = domainMap.get(d.id) || [];
      if (units.length === 0) return;
      result.push({ domainId: d.id, domainLabel: d.label, rows: buildRows(units) });
    });
    if (ungrouped.length > 0) {
      result.push({ domainId: null, domainLabel: 'Ungrouped', rows: buildRows(ungrouped) });
    }
    return result;
  }, [filteredUnits, domains, cycleSupplierIds, accountMap, suppliersByUnit, priceData, targetPriceMap, sortBy]);

  // Per-supplier role summary across the cycle (drives header indicator + bulk actions)
  const supplierSummaryMap = useMemo(() => {
    const map = new Map<string, { selected: number; quality: number; backup: number; total: number }>();
    cycleSupplierIds.forEach(id => map.set(id, { selected: 0, quality: 0, backup: 0, total: 0 }));
    // Walk all assignments
    suppliers.forEach(s => {
      const entry = map.get(s.supplier_account_id);
      if (!entry) return;
      entry.total++;
      if (s.role === 'selected') entry.selected++;
      else if (s.role === 'backup') entry.backup++;
      if (s.is_quality_pick) entry.quality++;
    });
    return map;
  }, [cycleSupplierIds, suppliers]);

  const sortedSuppliers = useMemo(() => {
    return cycleSupplierIds
      .map(id => {
        const s = supplierSummaryMap.get(id) || { selected: 0, quality: 0, backup: 0, total: 0 };
        // Dominant role (>= 80% of assignments share the same role)
        let dominant: 'selected' | 'quality' | 'backup' | 'mixed' | null = null;
        if (s.total > 0) {
          if (s.selected / s.total >= 0.8) dominant = 'selected';
          else if (s.quality / s.total >= 0.8) dominant = 'quality';
          else if (s.backup / s.total >= 0.8) dominant = 'backup';
          else dominant = 'mixed';
        }
        return {
          id,
          name: accountMap.get(id) || '',
          count: s.selected,
          summary: s,
          dominant,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [cycleSupplierIds, accountMap, supplierSummaryMap]);

  // Bulk-set a role across every quoted material for a supplier in this cycle.
  // Top-bottom precedence: only fills materials where this supplier has NO existing role for that material.
  const handleBulkSupplierRole = useCallback(async (
    supplierAccountId: string,
    newRole: 'selected' | 'backup' | 'candidate' | 'clear',
    isQualityPick: boolean = false,
  ) => {
    try {
      // Collect all unit IDs this supplier quotes in the cycle
      const quotedMaterialIds = new Set<string>(
        (supplierMaterials || [])
          .filter((sm: any) => sm.supplier_account_id === supplierAccountId)
          .map((sm: any) => sm.material_id)
      );
      const targetUnitIds = supplyUnits
        .filter(u => quotedMaterialIds.has(u.material_id))
        .map(u => u.id);
      if (targetUnitIds.length === 0) {
        toast.info('No quoted materials for this supplier in this cycle');
        return;
      }

      // Existing assignment rows for this supplier within target units
      const existing = suppliers.filter(s =>
        s.supplier_account_id === supplierAccountId && targetUnitIds.includes(s.supply_unit_id)
      );
      const existingUnitIds = new Set(existing.map(e => e.supply_unit_id));
      const missingUnitIds = targetUnitIds.filter(uid => !existingUnitIds.has(uid));

      if (newRole === 'clear') {
        // Wipe roles only on rows where it equals the cycle-level default (do not touch overrides without ambiguity → wipe all this supplier's rows)
        if (existing.length > 0) {
          await Promise.all(existing.map(e =>
            supabase.from('supply_unit_suppliers').delete().eq('id', e.id)
          ));
        }
        toast.success(`Cleared all roles for ${accountMap.get(supplierAccountId) || 'supplier'}`);
      } else {
        // Top-bottom: existing per-material assignments win — only fill the unassigned units
        const role = newRole;
        if (missingUnitIds.length > 0) {
          await supabase.from('supply_unit_suppliers').insert(
            missingUnitIds.map(uid => ({
              supply_unit_id: uid,
              supplier_account_id: supplierAccountId,
              role,
              is_quality_pick: isQualityPick,
            })) as any
          );
        }
        // For 'selected', also demote any other supplier currently 'selected' on those new units
        if (role === 'selected' && missingUnitIds.length > 0) {
          const others = suppliers.filter(s =>
            s.role === 'selected' &&
            s.supplier_account_id !== supplierAccountId &&
            missingUnitIds.includes(s.supply_unit_id)
          );
          if (others.length > 0) {
            await Promise.all(others.map(o =>
              supabase.from('supply_unit_suppliers').update({ role: 'backup' } as any).eq('id', o.id)
            ));
          }
        }
        toast.success(
          `${accountMap.get(supplierAccountId) || 'Supplier'} → ${isQualityPick ? 'Quality' : role} on ${missingUnitIds.length} unit${missingUnitIds.length !== 1 ? 's' : ''} (existing roles kept)`
        );
      }

      qc.invalidateQueries({ queryKey: ['supply-unit-suppliers'] });
      qc.invalidateQueries({ queryKey: ['supply-units'] });
    } catch (e: any) {
      toast.error('Bulk role change failed: ' + e.message);
    }
  }, [supplierMaterials, supplyUnits, suppliers, accountMap, qc]);

  const nonCoreCount = useMemo(
    () => new Set(supplyUnits.filter(u => !coreMaterialIds.has(u.material_id)).map(u => u.material_id)).size,
    [supplyUnits, coreMaterialIds]
  );
  const totalRows = sections.reduce((acc, s) => acc + s.rows.length, 0);

  if (totalRows === 0 && !showNonCore) {
    return (
      <div className="text-center py-8 text-muted-foreground space-y-2">
        <Package className="h-8 w-8 mx-auto text-muted-foreground/50" />
        <p className="text-sm">No Key materials in this cycle.</p>
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
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortField)}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <ArrowUpDown className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coverage">Sort: Coverage ↑</SelectItem>
                <SelectItem value="bestPrice">Sort: Best Price ↑</SelectItem>
                <SelectItem value="avgPrice">Sort: Avg Price ↑</SelectItem>
                <SelectItem value="name">Sort: Name A→Z</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {totalRows} material{totalRows !== 1 ? 's' : ''} · {sortedSuppliers.length} supplier{sortedSuppliers.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Hint */}
        <p className="text-[10px] text-muted-foreground">
          💡 Click any supplier cell to assign or change roles for that material × supplier.
        </p>

        {/* Matrix sections */}
        {sections.map(section => (
          <MatrixSection
            key={section.domainId || '__all'}
            section={section}
            sortedSuppliers={sortedSuppliers}
            showDomainHeader={sections.length > 1}
            onRoleChange={handleRoleChange}
            onBulkSupplierRole={handleBulkSupplierRole}
          />
        ))}

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
          <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" /> Uncovered</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

type SupplierCol = {
  id: string;
  name: string;
  count: number;
  summary: { selected: number; quality: number; backup: number; total: number };
  dominant: 'selected' | 'quality' | 'backup' | 'mixed' | null;
};

function SupplierHeaderCell({
  s,
  onBulkSupplierRole,
}: {
  s: SupplierCol;
  onBulkSupplierRole: (supplierId: string, role: 'selected' | 'backup' | 'candidate' | 'clear', isQuality?: boolean) => void;
}) {
  const dom = s.dominant;
  const Icon = dom === 'selected' ? Crown : dom === 'quality' ? ShieldCheck : dom === 'backup' ? Shield : null;
  const color =
    dom === 'selected' ? 'text-emerald-600' :
    dom === 'quality' ? 'text-blue-600' :
    dom === 'backup' ? 'text-amber-600' :
    dom === 'mixed' ? 'text-muted-foreground' : 'text-muted-foreground/40';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex flex-col items-center gap-0.5 hover:bg-accent/40 rounded px-1 py-0.5 cursor-pointer transition-colors">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate block max-w-[78px] text-[10px] font-semibold cursor-pointer">{s.name}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              <div className="font-semibold">{s.name}</div>
              <div>{s.summary.selected} Selected · {s.summary.quality} Quality · {s.summary.backup} Backup</div>
              <div className="text-muted-foreground">{dom === 'mixed' ? 'Mixed roles' : dom ? `Mostly ${dom}` : 'Unassigned'}</div>
            </TooltipContent>
          </Tooltip>
          {Icon ? (
            <Icon className={cn('h-3 w-3', color)} />
          ) : dom === 'mixed' ? (
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <div className="px-2 py-1.5 text-[10px] text-muted-foreground font-medium">
          Set whole supplier — {s.name}
        </div>
        <div className="px-2 pb-1 text-[9px] text-muted-foreground/70">
          Existing per-material roles are kept (top-bottom precedence). Only unassigned units get this role.
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs gap-2" onClick={() => onBulkSupplierRole(s.id, 'selected')}>
          <Crown className="h-3.5 w-3.5 text-emerald-600" /> Set as Selected
        </DropdownMenuItem>
        <DropdownMenuItem className="text-xs gap-2" onClick={() => onBulkSupplierRole(s.id, 'selected', true)}>
          <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Set as Quality
        </DropdownMenuItem>
        <DropdownMenuItem className="text-xs gap-2" onClick={() => onBulkSupplierRole(s.id, 'backup')}>
          <Shield className="h-3.5 w-3.5 text-amber-600" /> Set as Backup
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs gap-2 text-destructive" onClick={() => onBulkSupplierRole(s.id, 'clear')}>
          <Package className="h-3.5 w-3.5" /> Clear all roles
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MatrixSection({
  section,
  sortedSuppliers,
  showDomainHeader,
  onRoleChange,
  onBulkSupplierRole,
}: {
  section: DomainSection;
  sortedSuppliers: SupplierCol[];
  showDomainHeader: boolean;
  onRoleChange: (row: MaterialRow, supplierId: string, role: 'selected' | 'backup' | 'candidate', isQuality?: boolean) => void;
  onBulkSupplierRole: (supplierId: string, role: 'selected' | 'backup' | 'candidate' | 'clear', isQuality?: boolean) => void;
}) {
  const [open, setOpen] = useState(true);

  const content = (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-semibold sticky left-0 bg-card z-20 min-w-[160px]">
                  Material
                </TableHead>
                <TableHead className="text-[10px] text-center font-semibold min-w-[56px] px-1">Target</TableHead>
                <TableHead className="text-[10px] text-center font-semibold min-w-[56px] px-1">
                  <span className="flex items-center justify-center gap-0.5"><TrendingDown className="h-3 w-3" /> Best</span>
                </TableHead>
                <TableHead className="text-[10px] text-center font-semibold min-w-[56px] px-1">
                  <span className="flex items-center justify-center gap-0.5"><TrendingUp className="h-3 w-3" /> Avg</span>
                </TableHead>
                <TableHead className="text-[10px] text-center font-semibold min-w-[48px] px-1">Cov%</TableHead>
                {sortedSuppliers.map(s => (
                  <TableHead key={s.id} className="text-[10px] text-center font-semibold min-w-[84px] px-1">
                    <SupplierHeaderCell s={s} onBulkSupplierRole={onBulkSupplierRole} />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {section.rows.map(row => (
                <TableRow key={row.materialId} className={cn(row.flags.includes('uncovered') && 'bg-destructive/5')}>
                  <TableCell className="sticky left-0 bg-card z-10 py-2">
                    <div className="flex items-center gap-1.5">
                      {row.isCore && <Star className="h-3 w-3 text-primary fill-primary shrink-0" />}
                      <span className="text-xs font-medium truncate max-w-[130px]">{row.materialName}</span>
                      {row.materialCode && (
                        <Badge variant="outline" className="font-mono text-[9px] shrink-0 px-1">{row.materialCode}</Badge>
                      )}
                      {row.flags.includes('uncovered') && (
                        <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-center py-2">
                    <span className={cn('text-xs font-mono', row.targetPrice != null ? 'text-foreground' : 'text-muted-foreground/40')}>
                      {row.targetPrice != null ? row.targetPrice.toFixed(1) : '—'}
                    </span>
                  </TableCell>

                  <TableCell className="text-center py-2">
                    <span className={cn(
                      'text-xs font-mono font-semibold',
                      row.bestQuotePrice != null
                        ? (row.targetPrice != null && row.bestQuotePrice <= row.targetPrice ? 'text-emerald-600' : 'text-foreground')
                        : 'text-muted-foreground/40'
                    )}>
                      {row.bestQuotePrice != null ? row.bestQuotePrice.toFixed(1) : '—'}
                    </span>
                  </TableCell>

                  <TableCell className="text-center py-2">
                    <span className={cn('text-xs font-mono', row.avgQuotePrice != null ? 'text-foreground' : 'text-muted-foreground/40')}>
                      {row.avgQuotePrice != null ? row.avgQuotePrice.toFixed(1) : '—'}
                    </span>
                  </TableCell>

                  <TableCell className="text-center py-2">
                    <span className={cn(
                      'text-xs font-semibold',
                      row.coveragePct === 100 ? 'text-emerald-600' : row.coveragePct > 0 ? 'text-amber-600' : 'text-destructive'
                    )}>
                      {row.coveragePct}%
                    </span>
                  </TableCell>

                  {/* Interactive supplier columns */}
                  {sortedSuppliers.map(s => {
                    const col = row.supplierCols.get(s.id);
                    const hasQuote = col?.bestPrice != null;
                    const hasAssignment = col && col.atomCount > 0;
                    const isEmpty = !hasQuote && !hasAssignment;

                    if (isEmpty) {
                      return (
                        <TableCell key={s.id} className="text-center py-2">
                          <span className="text-muted-foreground/20 text-xs">—</span>
                        </TableCell>
                      );
                    }

                    const rc = col?.primaryRole ? roleConfig[col.primaryRole] : null;
                    const RoleIcon = rc?.icon;

                    return (
                      <TableCell key={s.id} className={cn('text-center py-1', rc?.bg)}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-full flex flex-col items-center gap-0.5 cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5 transition-colors group">
                              {col?.bestPrice != null && (
                                <span className={cn(
                                  'text-xs font-mono font-semibold',
                                  row.targetPrice != null && col.bestPrice <= row.targetPrice ? 'text-emerald-600' : 'text-foreground'
                                )}>
                                  {col.bestPrice.toFixed(1)}
                                </span>
                              )}
                              {RoleIcon && (
                                <span className={cn('flex items-center gap-0.5 text-[10px]', rc?.color)}>
                                  <RoleIcon className="h-3 w-3" />
                                  {col && col.atomCount > 1 && <span>{col.atomCount}</span>}
                                </span>
                              )}
                              {!RoleIcon && col?.bestPrice != null && (
                                <span className="text-[10px] text-muted-foreground group-hover:text-foreground">
                                  assign ▾
                                </span>
                              )}
                              {RoleIcon && (
                                <MoreHorizontal className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-44">
                            <div className="px-2 py-1.5 text-[10px] text-muted-foreground font-medium">
                              {col?.name} → {row.materialName}
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-xs gap-2"
                              onClick={() => onRoleChange(row, s.id, 'selected')}
                              disabled={col?.primaryRole === 'selected'}
                            >
                              <Crown className="h-3.5 w-3.5 text-emerald-600" />
                              Set as Selected
                              {col?.primaryRole === 'selected' && <Badge variant="outline" className="ml-auto text-[9px]">current</Badge>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-xs gap-2"
                              onClick={() => onRoleChange(row, s.id, 'selected', true)}
                              disabled={col?.isQualityPick}
                            >
                              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                              Set as Quality Pick
                              {col?.isQualityPick && <Badge variant="outline" className="ml-auto text-[9px]">current</Badge>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-xs gap-2"
                              onClick={() => onRoleChange(row, s.id, 'backup')}
                              disabled={col?.primaryRole === 'backup'}
                            >
                              <Shield className="h-3.5 w-3.5 text-amber-600" />
                              Set as Backup
                              {col?.primaryRole === 'backup' && <Badge variant="outline" className="ml-auto text-[9px]">current</Badge>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-xs gap-2 text-muted-foreground"
                              onClick={() => onRoleChange(row, s.id, 'candidate')}
                              disabled={col?.primaryRole === 'candidate' || !hasAssignment}
                            >
                              <Package className="h-3.5 w-3.5" />
                              Demote to Candidate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  if (!showDomainHeader) return content;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full text-left py-2 px-3 hover:bg-muted/50 rounded-lg transition-colors">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-semibold">{section.domainLabel}</span>
          <Badge variant="secondary" className="text-[10px]">{section.rows.length} materials</Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        {content}
      </CollapsibleContent>
    </Collapsible>
  );
}

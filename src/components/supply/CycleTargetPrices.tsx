import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calculator, Save, Loader2, ChevronDown, ChevronRight, Grid3X3, Lock, Unlock, Zap, Pencil, TrendingDown, BarChart3, Eye, EyeOff, Star } from 'lucide-react';
import { toast } from 'sonner';
import type { SupplyUnit } from '@/hooks/useUnlockCycles';
import type { SupplyDomain } from '@/hooks/useSupplyDomains';

interface Props {
  cycleId: string;
  supplyUnits: SupplyUnit[];
  coreMaterialIds: Set<string>;
  domains?: SupplyDomain[];
}

interface AreaInfo {
  id: string;
  name: string;
  color: string | null;
  zoneCodes: string[];
}

interface DomainPriceGroup {
  domainId: string | null;
  domainLabel: string;
  materials: { id: string; name: string; code: string | null; isCore: boolean }[];
  areas: AreaInfo[];
}

interface PriceCellData {
  targetPrice: number | null;
  bestPrice: number | null;
  averagePrice: number | null;
  sourceMode: string;
  isLocked: boolean;
  priceId: string | null;
}

export function CycleTargetPrices({ cycleId, supplyUnits, coreMaterialIds, domains }: Props) {
  const qc = useQueryClient();
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['__all__']));
  const [showNonCore, setShowNonCore] = useState(false);

  const nonCoreCount = useMemo(
    () => new Set(supplyUnits.filter(u => !coreMaterialIds.has(u.material_id)).map(u => u.material_id)).size,
    [supplyUnits, coreMaterialIds]
  );

  const materialIds = useMemo(
    () => [...new Set(supplyUnits.filter(u => showNonCore || coreMaterialIds.has(u.material_id)).map(u => u.material_id))],
    [supplyUnits, coreMaterialIds, showNonCore]
  );
  const areaIds = useMemo(() => [...new Set(supplyUnits.map(u => u.area_id).filter(Boolean))], [supplyUnits]);

  const [existingPrices, setExistingPrices] = useState<Map<string, PriceCellData>>(new Map());
  const [pricesLoaded, setPricesLoaded] = useState(false);

  useMemo(() => {
    if (materialIds.length === 0 || areaIds.length === 0) {
      setExistingPrices(new Map());
      setPricesLoaded(true);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('target_prices')
        .select('*')
        .in('material_id', materialIds)
        .eq('scope_type', 'area')
        .in('scope_id', areaIds as string[]);

      const map = new Map<string, PriceCellData>();
      (data || []).forEach((row: any) => {
        map.set(`${row.material_id}_${row.scope_id}`, {
          targetPrice: row.target_price != null ? Number(row.target_price) : null,
          bestPrice: row.best_price != null ? Number(row.best_price) : null,
          averagePrice: row.average_price != null ? Number(row.average_price) : null,
          sourceMode: row.source_mode || 'manual',
          isLocked: row.is_locked || false,
          priceId: row.id,
        });
      });
      setExistingPrices(map);
      setPricesLoaded(true);
    })();
  }, [materialIds.join(','), areaIds.join(',')]);

  const groups = useMemo((): DomainPriceGroup[] => {
    const hasDomains = domains && domains.length > 0;

    const buildGroupData = (units: SupplyUnit[]) => {
      const matMap = new Map<string, { id: string; name: string; code: string | null; isCore: boolean }>();
      const areaMap = new Map<string, AreaInfo>();

      units.forEach(u => {
        if (!showNonCore && !coreMaterialIds.has(u.material_id)) return;
        if (!matMap.has(u.material_id)) {
          matMap.set(u.material_id, {
            id: u.material_id,
            name: u.material_name || 'Unknown',
            code: u.material_code || null,
            isCore: coreMaterialIds.has(u.material_id),
          });
        }
        const areaKey = u.area_id || '__unassigned';
        if (!areaMap.has(areaKey)) {
          areaMap.set(areaKey, {
            id: u.area_id || '',
            name: u.area_name || 'Unassigned',
            color: u.area_color || null,
            zoneCodes: [],
          });
        }
        const area = areaMap.get(areaKey)!;
        if (!area.zoneCodes.includes(u.zone_code)) area.zoneCodes.push(u.zone_code);
      });

      // Key materials always pinned on top, then alpha
      const materials = Array.from(matMap.values()).sort((a, b) => {
        if (a.isCore !== b.isCore) return a.isCore ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return {
        materials,
        areas: Array.from(areaMap.values()),
      };
    };

    if (!hasDomains) {
      const { materials, areas } = buildGroupData(supplyUnits);
      return [{ domainId: null, domainLabel: 'All Materials', materials, areas }];
    }

    const result: DomainPriceGroup[] = [];
    const domainMap = new Map<string, SupplyUnit[]>();
    const ungrouped: SupplyUnit[] = [];

    supplyUnits.forEach(u => {
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
      const { materials, areas } = buildGroupData(units);
      if (materials.length > 0) {
        result.push({ domainId: domain.id, domainLabel: domain.label, materials, areas });
      }
    });

    if (ungrouped.length > 0) {
      const { materials, areas } = buildGroupData(ungrouped);
      if (materials.length > 0) {
        result.push({ domainId: null, domainLabel: 'Ungrouped', materials, areas });
      }
    }

    if (result.length > 0 && openSections.size <= 1) {
      setOpenSections(new Set(result.map(g => g.domainId || '__ungrouped')));
    }

    return result;
  }, [supplyUnits, coreMaterialIds, domains, showNonCore]);

  const getKey = (matId: string, areaId: string) => `${matId}_${areaId}`;

  const handlePriceChange = (matId: string, areaId: string, value: string) => {
    const cell = existingPrices.get(getKey(matId, areaId));
    if (cell?.isLocked) return;
    setEditedPrices(prev => ({ ...prev, [getKey(matId, areaId)]: value }));
  };

  // --- Lock/unlock toggle ---
  const handleToggleLock = useCallback(async (matId: string, areaId: string) => {
    const key = getKey(matId, areaId);
    const cell = existingPrices.get(key);
    if (!cell?.priceId) {
      toast.error('Save the target price first before locking');
      return;
    }
    const newLocked = !cell.isLocked;
    try {
      const { error } = await supabase
        .from('target_prices')
        .update({ is_locked: newLocked } as any)
        .eq('id', cell.priceId);
      if (error) throw error;
      setExistingPrices(prev => {
        const next = new Map(prev);
        next.set(key, { ...cell, isLocked: newLocked });
        return next;
      });
      toast.success(newLocked ? 'Cell locked' : 'Cell unlocked');
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    }
  }, [existingPrices]);

  const handleSave = async () => {
  setSaving(true);
  try {
    const upserts: { material_id: string; scope_type: string; scope_id: string; target_price: number; source_mode: string }[] = [];

    Object.entries(editedPrices).forEach(([key, value]) => {
      const price = parseFloat(value);
      if (isNaN(price)) return;
      const [matId, areaId] = key.split('_');
      
      // ✅ Skip if areaId is empty or invalid
      if (!areaId || areaId === '__unassigned' || areaId === '') {
        console.warn(`Skipping price for material ${matId} - invalid area ID`);
        toast.warning(`Cannot save price for "${matId}" - area not specified`);
        return;
      }
      
      upserts.push({
        material_id: matId,
        scope_type: 'area',
        scope_id: areaId,  // Now guaranteed to be non-empty
        target_price: price,
        source_mode: 'manual',
      });
    });

    if (upserts.length > 0) {
      const { error } = await supabase
        .from('target_prices')
        .upsert(upserts as any, { onConflict: 'material_id,scope_type,scope_id' });
      if (error) throw error;
    } else if (Object.keys(editedPrices).length > 0) {
      toast.warning('No valid prices to save - check area assignments');
    }

    setEditedPrices({});
    qc.invalidateQueries({ queryKey: ['target-prices'] });
    qc.invalidateQueries({ queryKey: ['supply-units', cycleId] });
    setPricesLoaded(false);
    toast.success('Target prices saved');
  } catch (e: any) {
    toast.error('Failed to save: ' + e.message);
  } finally {
    setSaving(false);
  }
};

  // --- Compute landed prices for all unlocked cells ---
  const computeLandedPrices = useCallback(async () => {
    const allMaterials = groups.flatMap(g => g.materials);
    const allAreas = groups.flatMap(g => g.areas);
    const matIds = [...new Set(allMaterials.map(m => m.id))];
    if (matIds.length === 0) return null;

    // TODO: Add expired-quotation inclusion toggle per SSOT §6.5 when UI supports it
    const { data: supplierMats } = await supabase
      .from('supplier_materials')
      .select('id, material_id, unit_price, supplier_account_id')
      .in('material_id', matIds)
      .eq('is_current', true);

    if (!supplierMats?.length) return null;

    const supplierIds = [...new Set(supplierMats.map(sm => sm.supplier_account_id))];
    const { data: deliveryRates } = await supabase
      .from('delivery_rates')
      .select('*')
      .in('supplier_account_id', supplierIds);

    // Build per material×area landed prices
    const result = new Map<string, { best: number; avg: number }>();

    allMaterials.forEach(mat => {
      const matQuotes = supplierMats.filter(sm => sm.material_id === mat.id && sm.unit_price != null);
      allAreas.forEach(area => {
        const landedPrices: number[] = [];
        matQuotes.forEach(quote => {
          const unitPrice = Number(quote.unit_price);
          const rate = deliveryRates?.find(dr =>
            dr.supplier_account_id === quote.supplier_account_id &&
            dr.zone_codes.some((zc: string) => area.zoneCodes.includes(zc))
          );
          const deliveryPerUnit = rate ? Number(rate.price_per_moq) : 0;
          landedPrices.push(unitPrice + deliveryPerUnit);
        });

        if (landedPrices.length > 0) {
          result.set(getKey(mat.id, area.id), {
            best: Math.min(...landedPrices),
            avg: landedPrices.reduce((a, b) => a + b, 0) / landedPrices.length,
          });
        }
      });
    });

    return result;
  }, [groups]);

  // --- Recalculate (legacy best-price fill) ---
  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const prices = await computeLandedPrices();
      if (!prices || prices.size === 0) {
        toast.info('No prices could be calculated');
        return;
      }

      const newPrices: Record<string, string> = {};
      prices.forEach(({ best }, key) => {
        const cell = existingPrices.get(key);
        if (cell?.isLocked) return;
        newPrices[key] = best.toFixed(2);
      });

      if (Object.keys(newPrices).length === 0) {
        toast.info('All cells are locked — no prices updated');
        return;
      }

      setEditedPrices(prev => ({ ...prev, ...newPrices }));
      toast.success(`Calculated ${Object.keys(newPrices).length} target prices — review and save`);
    } catch (e: any) {
      toast.error('Recalculate failed: ' + e.message);
    } finally {
      setRecalculating(false);
    }
  };

  // --- Fill from Best ---
  const handleFillFromBest = async () => {
    setRecalculating(true);
    try {
      const prices = await computeLandedPrices();
      if (!prices || prices.size === 0) {
        toast.info('No supplier quotes found');
        setRecalculating(false);
        return;
      }
      const newPrices: Record<string, string> = {};
      let skippedLocked = 0;
      prices.forEach(({ best }, key) => {
        const cell = existingPrices.get(key);
        if (cell?.isLocked) { skippedLocked++; return; }
        newPrices[key] = best.toFixed(2);
      });
      setEditedPrices(prev => ({ ...prev, ...newPrices }));
      toast.success(`Filled ${Object.keys(newPrices).length} cells from Best Price${skippedLocked > 0 ? ` (${skippedLocked} locked skipped)` : ''} — review and save`);
    } catch (e: any) {
      toast.error('Fill failed: ' + e.message);
    } finally {
      setRecalculating(false);
    }
  };

  // --- Fill from Average ---
  const handleFillFromAvg = async () => {
    setRecalculating(true);
    try {
      const prices = await computeLandedPrices();
      if (!prices || prices.size === 0) {
        toast.info('No supplier quotes found');
        setRecalculating(false);
        return;
      }
      const newPrices: Record<string, string> = {};
      let skippedLocked = 0;
      prices.forEach(({ avg }, key) => {
        const cell = existingPrices.get(key);
        if (cell?.isLocked) { skippedLocked++; return; }
        newPrices[key] = avg.toFixed(2);
      });
      setEditedPrices(prev => ({ ...prev, ...newPrices }));
      toast.success(`Filled ${Object.keys(newPrices).length} cells from Average Price${skippedLocked > 0 ? ` (${skippedLocked} locked skipped)` : ''} — review and save`);
    } catch (e: any) {
      toast.error('Fill failed: ' + e.message);
    } finally {
      setRecalculating(false);
    }
  };

  const hasEdits = Object.keys(editedPrices).length > 0;
  const totalMaterials = groups.reduce((acc, g) => acc + g.materials.length, 0);
  const lockedCount = Array.from(existingPrices.values()).filter(c => c.isLocked).length;

  if (totalMaterials === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground space-y-3">
        <p className="text-sm">No {showNonCore ? '' : 'Key '}materials in this cycle.</p>
        {!showNonCore && nonCoreCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowNonCore(true)} className="text-xs">
            <Eye className="h-3.5 w-3.5 mr-1" /> Show {nonCoreCount} more material{nonCoreCount !== 1 ? 's' : ''}
          </Button>
        )}
      </div>
    );
  }

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTable = (group: DomainPriceGroup) => (
    <div className="border rounded-lg overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-card z-10">Material</TableHead>
            {group.areas.map(area => (
              <TableHead key={area.id} className="text-center min-w-[140px]">
                <div className="flex items-center justify-center gap-1.5">
                  {area.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: area.color }} />}
                  {area.name}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {group.materials.map(mat => (
            <TableRow key={mat.id}>
              <TableCell className="sticky left-0 bg-card z-10">
                <div className="flex items-center gap-1.5">
                  {mat.isCore && <Star className="h-3 w-3 text-primary fill-primary shrink-0" />}
                  <span className="text-sm font-medium">{mat.name}</span>
                  {mat.code && <Badge variant="outline" className="ml-2 font-mono text-xs">{mat.code}</Badge>}
                </div>
              </TableCell>
              {group.areas.map(area => {
                const key = getKey(mat.id, area.id);
                const cell = existingPrices.get(key);
                const editedValue = editedPrices[key];
                const displayValue = editedValue !== undefined
                  ? editedValue
                  : (cell?.targetPrice != null ? cell.targetPrice.toString() : '');
                const isLocked = cell?.isLocked || false;
                const sourceMode = cell?.sourceMode || 'manual';

                // Visual indicator for source mode
                const sourceBadgeColor = sourceMode === 'best' ? 'text-emerald-600' : sourceMode === 'average' ? 'text-blue-500' : 'text-muted-foreground';

                return (
                  <TableCell key={area.id} className="text-center p-1">
                    <TooltipProvider>
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="relative w-full max-w-[120px]">
                          <Input
                            type="number"
                            step="0.01"
                            className={`w-full text-center h-8 text-sm tabular-nums pr-8 ${isLocked ? 'opacity-60 cursor-not-allowed bg-muted/50' : ''}`}
                            placeholder="—"
                            value={displayValue}
                            onChange={(e) => handlePriceChange(mat.id, area.id, e.target.value)}
                            disabled={isLocked}
                          />
                          {/* Lock/unlock button */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-accent transition-colors"
                                onClick={() => handleToggleLock(mat.id, area.id)}
                              >
                                {isLocked
                                  ? <Lock className="h-3 w-3 text-amber-500" />
                                  : <Unlock className="h-3 w-3 text-muted-foreground/40 hover:text-muted-foreground" />
                                }
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">{isLocked ? 'Click to unlock' : 'Click to lock'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        {/* Source + best/avg indicators */}
                        <div className="flex gap-2 text-[10px] tabular-nums items-center">
                          {cell && (cell.bestPrice != null || cell.averagePrice != null) && (
                            <>
                              {cell.bestPrice != null && <span className="text-emerald-600">B:{cell.bestPrice.toFixed(1)}</span>}
                              {cell.averagePrice != null && <span className="text-blue-500">A:{cell.averagePrice.toFixed(1)}</span>}
                            </>
                          )}
                          {sourceMode !== 'manual' && (
                            <Badge variant="outline" className={`text-[8px] px-1 py-0 ${sourceBadgeColor}`}>
                              {sourceMode}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {totalMaterials} materials · {groups.length > 1 ? `${groups.length} domains` : `${groups[0]?.areas.length || 0} areas`}
          </p>
          {lockedCount > 0 && (
            <Badge variant="outline" className="text-[10px] text-amber-600">
              <Lock className="h-3 w-3 mr-0.5" />{lockedCount} locked
            </Badge>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Bulk fill dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={recalculating}>
                {recalculating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Calculator className="h-4 w-4 mr-1" />}
                Fill Prices ▾
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleFillFromBest} className="text-xs gap-2">
                <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
                Fill all unlocked from Best Price
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleFillFromAvg} className="text-xs gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
                Fill all unlocked from Average Price
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {hasEdits && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save Changes
            </Button>
          )}
        </div>
      </div>

      {groups.length === 1 ? (
        renderTable(groups[0])
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const sectionId = group.domainId || '__ungrouped';
            const isOpen = openSections.has(sectionId);
            return (
              <Collapsible key={sectionId} open={isOpen} onOpenChange={() => toggleSection(sectionId)}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 w-full text-left py-2 px-3 hover:bg-muted/50 rounded-lg transition-colors">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <Grid3X3 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">{group.domainLabel}</span>
                    <Badge variant="secondary" className="text-[10px] ml-1">
                      {group.materials.length} materials · {group.areas.length} areas
                    </Badge>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1">
                  {renderTable(group)}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
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
    </div>
  );
}
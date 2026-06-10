import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSubcategoryAreas } from '@/hooks/useSubcategoryAreas';
import { useUpsertTargetPrices } from '@/hooks/useTargetPrices';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Save, AlertCircle, Loader2, Lock, Zap } from 'lucide-react';

interface Material {
  id: string;
  name: string;
  code: string | null;
}

interface PriceCellInfo {
  target_price: number;
  best_price: number | null;
  average_price: number | null;
  source_mode: string;
  is_locked: boolean;
}

export function TargetPriceMatrix() {
  const [selectedSubcatId, setSelectedSubcatId] = useState<string>('');

  const { data: subcategories } = useQuery({
    queryKey: ['subcategories-for-matrix'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_subcategories')
        .select('id, name_en, category_id')
        .eq('status', 'active')
        .order('name_en');
      if (error) throw error;

      const catIds = [...new Set((data || []).map(s => s.category_id))];
      const { data: cats } = await supabase
        .from('material_categories')
        .select('id, name_en')
        .in('id', catIds);
      const catMap = new Map((cats || []).map(c => [c.id, c.name_en]));

      return (data || []).map(s => ({
        id: s.id,
        name: `${catMap.get(s.category_id) || ''} › ${s.name_en}`,
      }));
    },
  });

  const { data: areas, isLoading: areasLoading } = useSubcategoryAreas(selectedSubcatId || null);

  const { data: materials, isLoading: matsLoading } = useQuery({
    queryKey: ['materials-for-matrix', selectedSubcatId],
    enabled: !!selectedSubcatId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, code')
        .eq('subcategory_id', selectedSubcatId)
        .eq('status', 'active')
        .order('code');
      if (error) throw error;
      return (data || []) as Material[];
    },
  });

  const materialIds = useMemo(() => (materials || []).map(m => m.id), [materials]);
  const areaIds = useMemo(() => (areas || []).map(a => a.id), [areas]);

  const { data: existingPrices, isLoading: pricesLoading } = useQuery({
    queryKey: ['target-prices-matrix', materialIds, areaIds],
    enabled: materialIds.length > 0 && areaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('target_prices')
        .select('id, material_id, scope_type, scope_id, target_price, best_price, average_price, source_mode, is_locked')
        .in('material_id', materialIds)
        .eq('scope_type', 'area')
        .in('scope_id', areaIds);
      if (error) throw error;
      return data || [];
    },
  });

  const priceMap = useMemo(() => {
    const map = new Map<string, PriceCellInfo>();
    (existingPrices || []).forEach((p: any) => {
      map.set(`${p.material_id}:${p.scope_id}`, {
        target_price: Number(p.target_price),
        best_price: p.best_price != null ? Number(p.best_price) : null,
        average_price: p.average_price != null ? Number(p.average_price) : null,
        source_mode: p.source_mode || 'manual',
        is_locked: p.is_locked || false,
      });
    });
    return map;
  }, [existingPrices]);

  const [edits, setEdits] = useState<Map<string, string>>(new Map());

  const handleCellChange = useCallback((materialId: string, areaId: string, value: string) => {
    const cell = priceMap.get(`${materialId}:${areaId}`);
    if (cell?.is_locked) return;
    setEdits(prev => {
      const next = new Map(prev);
      next.set(`${materialId}:${areaId}`, value);
      return next;
    });
  }, [priceMap]);

  const getCellValue = (materialId: string, areaId: string): string => {
    const key = `${materialId}:${areaId}`;
    if (edits.has(key)) return edits.get(key)!;
    const existing = priceMap.get(key);
    return existing != null ? String(existing.target_price) : '';
  };

  const dirtyCount = useMemo(() => {
    let count = 0;
    edits.forEach((val, key) => {
      const existing = priceMap.get(key);
      const newVal = val === '' ? null : Number(val);
      const oldVal = existing?.target_price ?? null;
      if (newVal !== oldVal) count++;
    });
    return count;
  }, [edits, priceMap]);

  const upsertMut = useUpsertTargetPrices();

  const handleSave = () => {
    const entries: { material_id: string; scope_type: string; scope_id: string; target_price: number }[] = [];
    edits.forEach((val, key) => {
      if (!val || Number(val) <= 0) return;
      const [materialId, areaId] = key.split(':');
      entries.push({ material_id: materialId, scope_type: 'area', scope_id: areaId, target_price: Number(val) });
    });
    if (entries.length === 0) return;
    upsertMut.mutate(entries, {
      onSuccess: () => setEdits(new Map()),
    });
  };

  const isLoading = areasLoading || matsLoading || pricesLoading;
  const hasAreas = (areas || []).length > 0;
  const hasMaterials = (materials || []).length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selectedSubcatId} onValueChange={(v) => { setSelectedSubcatId(v); setEdits(new Map()); }}>
          <SelectTrigger className="w-80">
            <SelectValue placeholder="Select a subcategory…" />
          </SelectTrigger>
          <SelectContent>
            {(subcategories || []).map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {dirtyCount > 0 && (
          <Button size="sm" onClick={handleSave} disabled={upsertMut.isPending}>
            {upsertMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save {dirtyCount} change(s)
          </Button>
        )}
      </div>

      {!selectedSubcatId && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Select a subcategory to view the target price matrix.</p>
        </div>
      )}

      {selectedSubcatId && !isLoading && !hasAreas && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">No areas defined for this subcategory</p>
            <p className="text-xs text-muted-foreground mt-1">
              Define areas first using the "Areas" button in the Materials page or the Unlock workflow.
            </p>
          </div>
        </div>
      )}

      {selectedSubcatId && !isLoading && hasAreas && !hasMaterials && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No materials found for this subcategory.</p>
        </div>
      )}

      {selectedSubcatId && !isLoading && hasAreas && hasMaterials && (
        <TooltipProvider>
          <div className="rounded-lg border bg-card overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10 min-w-[200px]">Material</TableHead>
                  {(areas || []).map(a => (
                    <TableHead key={a.id} className="text-center min-w-[140px]">
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        style={{ borderLeftColor: a.color, borderLeftWidth: 3 }}
                      >
                        {a.name}
                      </Badge>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(materials || []).map(mat => (
                  <TableRow key={mat.id}>
                    <TableCell className="sticky left-0 bg-card z-10">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium truncate max-w-[200px]">{mat.name}</span>
                        {mat.code && <span className="font-mono text-[10px] text-muted-foreground">{mat.code}</span>}
                      </div>
                    </TableCell>
                    {(areas || []).map(a => {
                      const key = `${mat.id}:${a.id}`;
                      const val = getCellValue(mat.id, a.id);
                      const cell = priceMap.get(key);
                      const isLocked = cell?.is_locked || false;
                      const isAuto = cell?.source_mode === 'auto';

                      return (
                        <TableCell key={a.id} className="p-1">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="relative w-full">
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={val}
                                onChange={e => handleCellChange(mat.id, a.id, e.target.value)}
                                className={`h-8 text-center text-sm w-full tabular-nums ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                                placeholder="—"
                                disabled={isLocked}
                              />
                              {(isLocked || isAuto) && (
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                                  {isLocked && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Lock className="h-3 w-3 text-amber-500" />
                                      </TooltipTrigger>
                                      <TooltipContent><p className="text-xs">Locked</p></TooltipContent>
                                    </Tooltip>
                                  )}
                                  {isAuto && !isLocked && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Zap className="h-3 w-3 text-blue-500" />
                                      </TooltipTrigger>
                                      <TooltipContent><p className="text-xs">Auto-calculated</p></TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              )}
                            </div>
                            {cell && (cell.best_price != null || cell.average_price != null) && (
                              <div className="flex gap-2 text-[10px] text-muted-foreground tabular-nums">
                                {cell.best_price != null && <span>Best: {cell.best_price.toFixed(1)}</span>}
                                {cell.average_price != null && <span>Avg: {cell.average_price.toFixed(1)}</span>}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      )}

      {isLoading && selectedSubcatId && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

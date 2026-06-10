import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle2, XCircle, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronRight, Loader2, Star, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { SupplyUnit } from '@/hooks/useUnlockCycles';

interface Props {
  cycleId: string;
  supplyUnits: SupplyUnit[];
  coreMaterialIds: Set<string>;
}

const quoteStatusColors: Record<string, string> = {
  quoter: 'bg-amber-500/15 text-amber-600',
  approved: 'bg-emerald-500/15 text-emerald-600',
  rejected: 'bg-destructive/15 text-destructive',
  superseded: 'bg-muted text-muted-foreground',
};

interface SupplierQuoteRow {
  supplierId: string;
  supplierName: string;
  quoteId: string | null;
  quoteStatus: string;
  materialPrices: Map<string, number | null>; // material_id → unit_price
  avgDeltaPct: number | null;
  materialCount: number;
  quotedCount: number;
  isDisabled: boolean;
}

export function CycleQuotations({ cycleId, supplyUnits, coreMaterialIds }: Props) {
  const qc = useQueryClient();
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  // const materialIds = useMemo(() =>
  //   [...new Set(supplyUnits.filter(u => coreMaterialIds.has(u.material_id)).map(u => u.material_id))],
  //   [supplyUnits, coreMaterialIds]
  // );
  const materialIds = useMemo(() => {
  const ids = supplyUnits
    .filter(u => coreMaterialIds.has(u.material_id))
    .map(u => u.material_id);

  return Array.from(new Set(ids)).sort(); // stable order
}, [supplyUnits, coreMaterialIds]);

  // Material names map
  const materialNames = useMemo(() => {
    const map = new Map<string, { name: string; code: string | null }>();
    supplyUnits.forEach(u => {
      if (!map.has(u.material_id)) {
        map.set(u.material_id, { name: u.material_name || 'Unknown', code: u.material_code || null });
      }
    });
    return map;
  }, [supplyUnits]);

  // Target prices per material (average across areas)
  const targetPrices = useMemo(() => {
    const map = new Map<string, number>();
    const counts = new Map<string, { sum: number; count: number }>();
    supplyUnits.forEach(u => {
      if (u.target_price != null) {
        const entry = counts.get(u.material_id) || { sum: 0, count: 0 };
        entry.sum += u.target_price;
        entry.count++;
        counts.set(u.material_id, entry);
      }
    });
    counts.forEach((v, k) => map.set(k, v.sum / v.count));
    return map;
  }, [supplyUnits]);

  // Fetch supplier_materials for cycle materials
  const { data: supplierMats, isLoading } = useQuery({
    queryKey: ['cycle-quotations', cycleId, materialIds],
    enabled: materialIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_materials')
        .select('id, material_id, unit_price, supplier_account_id, supplier_quote_id, is_current, status')
        .in('material_id', materialIds)
        .eq('is_current', true);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch quotes
  const quoteIds = useMemo(() =>
    [...new Set((supplierMats || []).map(sm => sm.supplier_quote_id).filter(Boolean))],
    [supplierMats]
  );

  const { data: quotes } = useQuery({
    queryKey: ['cycle-quotes', quoteIds],
    enabled: quoteIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_quotes')
        .select('id, supplier_account_id, status, created_at, notes')
        .in('id', quoteIds);
      if (error) throw error;
      return data || [];
    },
  });

  // Supplier names
  const supplierIds = useMemo(() =>
    [...new Set((supplierMats || []).map(sm => sm.supplier_account_id))],
    [supplierMats]
  );

  const { data: supplierAccounts } = useQuery({
    queryKey: ['cycle-supplier-names', supplierIds],
    enabled: supplierIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, display_name').is('deleted_at', null)
        .in('id', supplierIds);
      if (error) throw error;
      return data || [];
    },
  });

  // Build comparison rows
  const comparison = useMemo((): SupplierQuoteRow[] => {
    if (!supplierMats?.length) return [];

    const supplierNameMap = new Map((supplierAccounts || []).map(a => [a.id, a.display_name || 'Unknown']));
    const quoteMap = new Map((quotes || []).map(q => [q.id, q]));

    const bySupplier = new Map<string, typeof supplierMats>();
    supplierMats.forEach(sm => {
      const list = bySupplier.get(sm.supplier_account_id) || [];
      list.push(sm);
      bySupplier.set(sm.supplier_account_id, list);
    });

    return Array.from(bySupplier.entries()).map(([supplierId, items]) => {
      const quote = items[0]?.supplier_quote_id ? quoteMap.get(items[0].supplier_quote_id) : null;
      const materialPrices = new Map<string, number | null>();
      items.forEach(i => materialPrices.set(i.material_id, i.unit_price != null ? Number(i.unit_price) : null));

      let totalDelta = 0;
      let deltaCount = 0;
      items.forEach(item => {
        if (item.unit_price != null) {
          const target = targetPrices.get(item.material_id);
          // if (target) {
          //   totalDelta += ((Number(item.unit_price) - target) / target) * 100;
          //   deltaCount++;
          // }
          if (target != null && target !== 0) {
            totalDelta += ((Number(item.unit_price) - target) / target) * 100;
            deltaCount++;
          }
        }
      });
      const supplierName = supplierNameMap.get(supplierId);
      const isActiveSupplier = supplierNameMap.has(supplierId);
      return {
        supplierId,
        supplierName: supplierName || 'Cancelled Supplier',
        isDisabled: !isActiveSupplier,
        quoteId: quote?.id || null,
        quoteStatus: quote?.status || 'unknown',
        materialPrices,
        avgDeltaPct: deltaCount > 0 ? totalDelta / deltaCount : null,
        materialCount: items.length,
        quotedCount: items.filter(i => i.unit_price != null).length,
      };
    });
  }, [supplierMats, supplierAccounts, quotes, targetPrices]);

  // Find cheapest price per material
  const cheapestByMaterial = useMemo(() => {
    const map = new Map<string, { price: number; supplierId: string }>();
    comparison.forEach(row => {
      row.materialPrices.forEach((price, matId) => {
        if (price != null) {
          const current = map.get(matId);
          if (!current || price < current.price) {
            map.set(matId, { price, supplierId: row.supplierId });
          }
        }
      });
    });
    return map;
  }, [comparison]);

  // Approve/Reject quote mutation
  const approveQuote = useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: 'approved' | 'rejected' }) => {
      // If approving, supersede the old approved quote for this supplier
      if (status === 'approved') {
        const quote = quotes?.find(q => q.id === quoteId);
        if (quote) {
          // Supersede old approved quotes for this supplier
          const { data: oldQuotes } = await supabase
            .from('supplier_quotes')
            .select('id')
            .eq('supplier_account_id', quote.supplier_account_id)
            .eq('status', 'approved')
            .neq('id', quoteId);

          if (oldQuotes?.length) {
            await supabase
              .from('supplier_quotes')
              .update({ status: 'superseded' } as any)
              .in('id', oldQuotes.map(q => q.id));

            // Mark old materials as not current
            await supabase
              .from('supplier_materials')
              .update({ is_current: false } as any)
              .in('supplier_quote_id', oldQuotes.map(q => q.id));
          }
        }
      }

      const { error } = await supabase
        .from('supplier_quotes')
        .update({ status } as any)
        .eq('id', quoteId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      // qc.invalidateQueries({ queryKey: ['cycle-quotations'] });
      qc.invalidateQueries({ queryKey: ['cycle-quotations', cycleId] });
      qc.invalidateQueries({ queryKey: ['cycle-quotes'] });
      qc.invalidateQueries({ queryKey: ['supplier-quotes'] });
      toast.success(`Quote ${status}`);
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground text-center py-8">Loading quotations…</div>;
  }

  if (comparison.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No supplier quotations overlap with this cycle's materials yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {comparison.length} supplier(s) have quoted for materials in this cycle
      </p>

      <div className="space-y-2">
        {comparison.map(row => {
          const isExpanded = expandedSupplier === row.supplierId;
          return (
            <Collapsible key={row.supplierId} open={isExpanded} onOpenChange={(open) => setExpandedSupplier(open ? row.supplierId : null)}>
              <div className="border rounded-lg">
                <CollapsibleTrigger asChild>
                  <div
                    className={`flex items-center justify-between p-3 transition-colors
                      ${row.isDisabled ? 'opacity-50 pointer-events-none' : 'hover:bg-muted/50 cursor-pointer'}
                    `}>                    
                  <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-medium text-sm">{row.supplierName}</span>
                      <Badge className={`${quoteStatusColors[row.quoteStatus] || ''} text-xs`}>{row.quoteStatus}</Badge>
                      <span className="text-xs text-muted-foreground">{row.quotedCount}/{row.materialCount} priced</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {row.avgDeltaPct != null && (
                        <div className="flex items-center gap-1">
                          {row.avgDeltaPct < -2 ? (
                            <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
                          ) : row.avgDeltaPct > 2 ? (
                            <TrendingUp className="h-3.5 w-3.5 text-destructive" />
                          ) : (
                            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className={`text-sm font-medium ${
                            row.avgDeltaPct < -2 ? 'text-emerald-600' : row.avgDeltaPct > 2 ? 'text-destructive' : 'text-muted-foreground'
                          }`}>
                            {row.avgDeltaPct > 0 ? '+' : ''}{row.avgDeltaPct.toFixed(1)}%
                          </span>
                        </div>
                      )}

                      {/* Supplier selection has moved to the Domain Detail page. Quotations are read-only here. */}
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Target Price</TableHead>
                          <TableHead className="text-right">vs Target</TableHead>
                          <TableHead>Flags</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materialIds.map(matId => {
                          const mat = materialNames.get(matId);
                          const price = row.materialPrices.get(matId);
                          const target = targetPrices.get(matId);
                          const cheapest = cheapestByMaterial.get(matId);
                          const isCheapest = price != null && cheapest && cheapest.supplierId === row.supplierId;
                          const isOnlyOffer = price != null && comparison.filter(c => c.materialPrices.get(matId) != null).length === 1;
                          const isAboveTarget = price != null && target != null && price > target;
                          const hasValidTarget = target != null && target !== 0;
                          const deltaPct =
                            price != null && hasValidTarget
                              ? ((price - target!) / target!) * 100
                              : null;

                          // Only show materials this supplier has quoted
                          if (!row.materialPrices.has(matId)) return null;

                          return (
                            <TableRow key={matId}>
                              <TableCell>
                                <span className="text-sm font-medium">{mat?.name || 'Unknown'}</span>
                                {mat?.code && <Badge variant="outline" className="ml-2 font-mono text-xs">{mat.code}</Badge>}
                              </TableCell>
                              <TableCell className="text-right">
                                {price != null ? (
                                  <span className="text-sm font-medium">{price.toFixed(2)}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {target != null ? (
                                  <span className="text-sm text-muted-foreground">{target.toFixed(2)}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {deltaPct != null ? (
                                  <span className={`text-sm font-medium ${
                                    deltaPct < -2 ? 'text-emerald-600' : deltaPct > 2 ? 'text-destructive' : 'text-muted-foreground'
                                  }`}>
                                    {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {isCheapest && <Badge className="bg-emerald-500/15 text-emerald-600 text-xs">Cheapest</Badge>}
                                  {isOnlyOffer && <Badge className="bg-amber-500/15 text-amber-600 text-xs">Only offer</Badge>}
                                  {isAboveTarget && <Badge className="bg-destructive/15 text-destructive text-xs">Above target</Badge>}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

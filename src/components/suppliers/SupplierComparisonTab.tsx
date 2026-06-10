import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingDown, TrendingUp, Check } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useSupplierMaterialsWithTargets, type SupplierMaterialWithTarget } from '@/hooks/useSupplierMaterials';
import { Loader2 } from 'lucide-react';

interface MaterialGroup {
  material_id: string;
  material_name: string;
  material_code: string | null;
  target_price: number | null;
  quotes: SupplierMaterialWithTarget[];
}

export function SupplierComparisonTab() {
  const { data: materials = [], isLoading } = useSupplierMaterialsWithTargets();

  const groups = useMemo(() => {
    const map = new Map<string, MaterialGroup>();

    materials.forEach(m => {
      if (!map.has(m.material_id)) {
        map.set(m.material_id, {
          material_id: m.material_id,
          material_name: m.material_name || 'Unknown',
          material_code: m.material_code,
          target_price: m.target_price,
          quotes: [],
        });
      }
      map.get(m.material_id)!.quotes.push(m);
    });

    // Sort groups by material name
    const result = Array.from(map.values());
    result.forEach(g => {
      g.quotes.sort((a, b) => (a.unit_price ?? Infinity) - (b.unit_price ?? Infinity));
    });
    return result;
  }, [materials]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No supplier quotes to compare</p>
        <p className="text-xs text-muted-foreground mt-1">Add quotes to see them grouped by material</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(group => {
        const bestPrice = group.quotes[0]?.unit_price;
        return (
          <div key={group.material_id} className="border rounded-lg overflow-hidden">
            {/* Material Header */}
            <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
              <div>
                <span className="font-medium">{group.material_name}</span>
                {group.material_code && (
                  <span className="ml-2 text-xs text-muted-foreground font-mono">{group.material_code}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {group.target_price != null && (
                  <Badge variant="outline" className="gap-1">
                    Target: {group.target_price.toFixed(2)} SAR
                  </Badge>
                )}
                <Badge variant="secondary">{group.quotes.length} quote(s)</Badge>
              </div>
            </div>

            {/* Quotes Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  {group.target_price != null && <TableHead className="text-right">vs Target</TableHead>}
                  <TableHead className="text-right">MOQ</TableHead>
                  <TableHead className="text-right">Lead Time</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.quotes.map((q, idx) => {
                  const variance = group.target_price != null && q.unit_price != null
                    ? ((q.unit_price - group.target_price) / group.target_price) * 100
                    : null;
                  const isBest = idx === 0 && q.unit_price != null;

                  return (
                    <TableRow key={q.id} className={isBest ? 'bg-green-500/5' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {q.supplier_name || 'Unknown'}
                          {isBest && (
                            <Badge className="bg-green-600 text-[10px] gap-0.5 px-1.5">
                              <Check className="h-2.5 w-2.5" />
                              Best
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {q.unit_price != null ? `${q.unit_price.toFixed(2)} SAR` : '—'}
                      </TableCell>
                      {group.target_price != null && (
                        <TableCell className="text-right">
                          {variance != null ? (
                            <span className={cn(
                              'flex items-center justify-end gap-1 text-sm',
                              variance <= 0 ? 'text-green-600' : variance <= 10 ? 'text-yellow-600' : 'text-destructive'
                            )}>
                              {variance <= 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                              {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                            </span>
                          ) : '—'}
                        </TableCell>
                      )}
                      <TableCell className="text-right">{q.moq ?? '—'}</TableCell>
                      <TableCell className="text-right">{q.lead_time_days ? `${q.lead_time_days}d` : '—'}</TableCell>
                      <TableCell>
                        {q.supplier_rating != null ? (
                          <div className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <span className="text-sm">{q.supplier_rating.toFixed(1)}</span>
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={q.status === 'approved' ? 'default' : q.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                          {q.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}

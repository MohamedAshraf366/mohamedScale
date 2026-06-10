import { useState } from 'react';
import { useTargetPrices, useDeleteTargetPrice, useUpdateTargetPrice, type TargetPrice } from '@/hooks/useTargetPrices';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  onAdd: () => void;
}

export function TargetPricesTable({ onAdd }: Props) {
  const { data: prices, isLoading } = useTargetPrices();
  const deleteMut = useDeleteTargetPrice();
  const updateMut = useUpdateTargetPrice();
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');

  const startEdit = (tp: TargetPrice) => {
    setEditId(tp.id);
    setEditPrice(String(tp.target_price));
  };

  const saveEdit = () => {
    if (!editId) return;
    updateMut.mutate({ id: editId, target_price: Number(editPrice) }, {
      onSuccess: () => setEditId(null),
    });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading target prices…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{prices?.length || 0} target price(s)</h3>
        <Button size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Set Target Price
        </Button>
      </div>

      {(!prices || prices.length === 0) ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No target prices set yet.</p>
          <p className="text-xs mt-1">Target prices are required before collecting supplier quotations.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Area</TableHead>
                <TableHead className="text-right">Target (SAR)</TableHead>
                <TableHead>Set On</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.map(tp => (
                <TableRow key={tp.id}>
                  <TableCell className="font-medium text-sm">{tp.material_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">{tp.material_code || '—'}</Badge>
                  </TableCell>
                  <TableCell>
                    {tp.scope_label ? (
                      <Badge variant="secondary" className="text-xs">{tp.scope_label}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editId === tp.id ? (
                      <Input
                        type="number"
                        value={editPrice}
                        onChange={e => setEditPrice(e.target.value)}
                        className="h-7 w-24 text-right text-sm ml-auto"
                        autoFocus
                      />
                    ) : (
                      <span className="font-semibold tabular-nums">{tp.target_price.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(tp.created_at), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>
                    {editId === tp.id ? (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(tp)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteMut.mutate(tp.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

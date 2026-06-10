import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Star, Shield, UserCheck, UserMinus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { SupplyUnitSupplier } from '@/hooks/useSupplyUnitSuppliers';

interface Props {
  cycleId: string;
  suppliers: SupplyUnitSupplier[];
}

const roleBadge: Record<string, string> = {
  selected: 'bg-emerald-500/15 text-emerald-600',
  backup: 'bg-amber-500/15 text-amber-600',
  candidate: 'bg-muted text-muted-foreground',
};

interface SupplierRow {
  supplierId: string;
  supplierName: string;
  roles: Set<string>;
  isQuality: boolean;
  unitCount: number;
  selectedCount: number;
  backupCount: number;
  candidateCount: number;
  assignmentIds: string[];
}

export function CycleSuppliers({ cycleId, suppliers }: Props) {
  const qc = useQueryClient();

  // unique supplier IDs
  const supplierAccountIds = useMemo(() => {
    return [...new Set(suppliers.map(s => s.supplier_account_id))];
  }, [suppliers]);

  // fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['cycle-supplier-accounts', supplierAccountIds],
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

  // stable map
  const accountMap = useMemo(() => {
    if (!accounts?.length) return new Map();

    return new Map(
      accounts.map(a => [a.id, a.display_name || 'Unknown'])
    );
  }, [accounts]);

  const isAccountsReady = !!accounts?.length;

  // build rows
  const rows = useMemo((): SupplierRow[] => {
    const grouped = new Map<string, SupplierRow>();

    suppliers.forEach(s => {
      const id = s.supplier_account_id;
      const prev = grouped.get(id);

      const updated: SupplierRow = prev
        ? {
            ...prev,
            roles: new Set(prev.roles).add(s.role),
            assignmentIds: [...prev.assignmentIds, s.id],
            unitCount: prev.unitCount + 1,
            selectedCount: prev.selectedCount + (s.role === 'selected' ? 1 : 0),
            backupCount: prev.backupCount + (s.role === 'backup' ? 1 : 0),
            candidateCount: prev.candidateCount + (s.role === 'candidate' ? 1 : 0),
            isQuality: prev.isQuality || s.is_quality_pick,
          }
        : {
            supplierId: id,
            supplierName: isAccountsReady
              ? accountMap.get(id) || 'Unknown'
              : 'Loading...',
            roles: new Set([s.role]),
            isQuality: s.is_quality_pick,
            unitCount: 1,
            selectedCount: s.role === 'selected' ? 1 : 0,
            backupCount: s.role === 'backup' ? 1 : 0,
            candidateCount: s.role === 'candidate' ? 1 : 0,
            assignmentIds: [s.id],
          };

      grouped.set(id, updated);
    });

    return Array.from(grouped.values()).sort(
      (a, b) => b.selectedCount - a.selectedCount
    );
  }, [suppliers, accountMap, isAccountsReady]);

  // bulk update role
  const bulkUpdateRole = useMutation({
    mutationFn: async ({ supplierId, role }: { supplierId: string; role: string }) => {
      const assignmentIds = suppliers
        .filter(s => s.supplier_account_id === supplierId)
        .map(s => s.id);

      if (!assignmentIds.length) return;

      for (let i = 0; i < assignmentIds.length; i += 100) {
        const batch = assignmentIds.slice(i, i + 100);

        const { error } = await supabase
          .from('supply_unit_suppliers')
          .update({ role } as any)
          .in('id', batch);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycle-unit-suppliers'] });
      qc.invalidateQueries({ queryKey: ['supply-unit-suppliers'] });
      toast.success('Updated successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // toggle quality
  const toggleQuality = useMutation({
    mutationFn: async ({ supplierId, isQuality }: { supplierId: string; isQuality: boolean }) => {
      const assignmentIds = suppliers
        .filter(s => s.supplier_account_id === supplierId)
        .map(s => s.id);

      for (let i = 0; i < assignmentIds.length; i += 100) {
        const batch = assignmentIds.slice(i, i + 100);

        const { error } = await supabase
          .from('supply_unit_suppliers')
          .update({ is_quality_pick: isQuality } as any)
          .in('id', batch);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycle-unit-suppliers'] });
      qc.invalidateQueries({ queryKey: ['supply-unit-suppliers'] });
      toast.success('Quality updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPending = bulkUpdateRole.isPending || toggleQuality.isPending;

  if (!rows.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No suppliers assigned
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {rows.length} suppliers • {suppliers.length} assignments
      </p>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead>Selected</TableHead>
              <TableHead>Backup</TableHead>
              <TableHead>Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map(row => (
              <TableRow key={row.supplierId}>
                <TableCell className="font-medium">
                  {row.supplierName}
                </TableCell>

                <TableCell>
                  <div className="flex gap-1">
                    {Array.from(row.roles)
                      .filter(Boolean)
                      .map(role => (
                        <Badge
                          key={role}
                          className={`${roleBadge[role] || ''} text-xs`}
                        >
                          {role}
                        </Badge>
                      ))}
                  </div>
                </TableCell>

                <TableCell>
                  {row.isQuality ? (
                    <Badge className="bg-blue-500/15 text-blue-600 text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      Quality
                    </Badge>
                  ) : (
                    '—'
                  )}
                </TableCell>

                <TableCell>{row.selectedCount}</TableCell>
                <TableCell>{row.backupCount}</TableCell>
                <TableCell>{row.unitCount}</TableCell>

                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" disabled={isPending}>
                        {isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-3 w-3" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          bulkUpdateRole.mutate({
                            supplierId: row.supplierId,
                            role: 'selected',
                          })
                        }
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        Selected
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() =>
                          bulkUpdateRole.mutate({
                            supplierId: row.supplierId,
                            role: 'backup',
                          })
                        }
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Backup
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() =>
                          bulkUpdateRole.mutate({
                            supplierId: row.supplierId,
                            role: 'candidate',
                          })
                        }
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        Candidate
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() =>
                          toggleQuality.mutate({
                            supplierId: row.supplierId,
                            isQuality: !row.isQuality,
                          })
                        }
                      >
                        <Star className="h-4 w-4 mr-2" />
                        Toggle Quality
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
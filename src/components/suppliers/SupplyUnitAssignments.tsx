import { useSupplyUnitSuppliersBySupplier, type SupplyUnitSupplier } from '@/hooks/useSupplyUnitSuppliers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Shield, Users, Snowflake, Ban } from 'lucide-react';

const roleConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  selected: { label: 'Selected', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: Crown },
  backup: { label: 'Backup', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Shield },
  candidate: { label: 'Candidate', color: 'bg-muted text-muted-foreground border-border', icon: Users },
};

interface Props {
  supplierAccountId: string;
  isBlacklisted: boolean;
}

export function SupplyUnitAssignments({ supplierAccountId, isBlacklisted }: Props) {
  const { data: assignments = [], isLoading } = useSupplyUnitSuppliersBySupplier(supplierAccountId);

  // Fetch supply unit info for display
  const unitIds = [...new Set(assignments.map(a => a.supply_unit_id))];
  const { data: unitInfoMap } = useQuery({
    queryKey: ['supply-unit-info', unitIds.join(',')],
    enabled: unitIds.length > 0,
    queryFn: async () => {
      const { data: units } = await supabase.from('supply_units').select('id, material_id, zone_code, status, target_price').in('id', unitIds);
      if (!units) return new Map();
      const matIds = [...new Set(units.map(u => u.material_id))];
      const [mats, zones] = await Promise.all([
        supabase.from('materials').select('id, name, code').in('id', matIds).then(r => r.data || []),
        supabase.from('zones').select('code, name_en').in('code', [...new Set(units.map(u => u.zone_code))]).then(r => r.data || []),
      ]);
      const matMap = new Map((mats as any[]).map(m => [m.id, m]));
      const zoneMap = new Map((zones as any[]).map(z => [z.code, z.name_en]));
      const map = new Map<string, { material_name: string; zone_name: string; status: string; target_price: number | null }>();
      for (const u of units as any[]) {
        map.set(u.id, {
          material_name: matMap.get(u.material_id)?.name || u.material_id.slice(0, 8),
          zone_name: zoneMap.get(u.zone_code) || u.zone_code,
          status: u.status,
          target_price: u.target_price,
        });
      }
      return map;
    },
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  if (assignments.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No supply unit assignments yet</p>;
  }

  const summary = {
    selected: assignments.filter(a => a.role === 'selected').length,
    backup: assignments.filter(a => a.role === 'backup').length,
    candidate: assignments.filter(a => a.role === 'candidate').length,
    frozen: assignments.filter(a => a.is_frozen).length,
  };

  return (
    <div className="space-y-3">
      {/* Summary badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {isBlacklisted && <Badge variant="destructive" className="text-[10px]"><Ban className="h-3 w-3 mr-1" />Blacklisted</Badge>}
        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600"><Crown className="h-3 w-3 mr-1" />{summary.selected} Selected</Badge>
        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600"><Shield className="h-3 w-3 mr-1" />{summary.backup} Backup</Badge>
        <Badge variant="outline" className="text-[10px]">{summary.candidate} Candidate</Badge>
        {summary.frozen > 0 && <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600"><Snowflake className="h-3 w-3 mr-1" />{summary.frozen} Frozen</Badge>}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px]">Material</TableHead>
            <TableHead className="text-[10px]">Zone</TableHead>
            <TableHead className="text-[10px]">Role</TableHead>
            <TableHead className="text-[10px]">Landed Price</TableHead>
            <TableHead className="text-[10px]">Unit Status</TableHead>
            <TableHead className="text-[10px]">Assignment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map(a => {
            const info = unitInfoMap?.get(a.supply_unit_id);
            const rc = roleConfig[a.role] || roleConfig.candidate;
            const RoleIcon = rc.icon;
            return (
              <TableRow key={a.id} className={a.is_frozen ? 'opacity-60' : ''}>
                <TableCell className="text-xs py-2">{info?.material_name || '—'}</TableCell>
                <TableCell className="text-xs py-2">{info?.zone_name || '—'}</TableCell>
                <TableCell className="py-2">
                  <Badge variant="outline" className={`text-[10px] ${rc.color}`}>
                    <RoleIcon className="h-3 w-3 mr-1" />{rc.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs py-2 font-mono">
                  {a.landed_price != null ? `${Number(a.landed_price).toFixed(2)}` : '—'}
                </TableCell>
                <TableCell className="text-xs py-2">{info?.status || '—'}</TableCell>
                <TableCell className="py-2">
                  {a.is_frozen ? (
                    <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600">
                      <Snowflake className="h-3 w-3 mr-1" />Frozen
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-emerald-600">Active</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

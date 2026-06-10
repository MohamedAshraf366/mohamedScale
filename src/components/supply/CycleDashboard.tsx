import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Users, ShieldCheck, LifeBuoy, CheckCircle2 } from 'lucide-react';
import type { SupplyUnit } from '@/hooks/useUnlockCycles';
import type { SupplyUnitSupplier } from '@/hooks/useSupplyUnitSuppliers';

interface Props {
  supplyUnits: SupplyUnit[];
  suppliers: SupplyUnitSupplier[];
  coreMaterialIds: Set<string>;
}

interface AreaProgress {
  areaName: string;
  areaColor: string | null;
  total: number;
  withTarget: number;
  withSelected: number;
  withQuality: number;
  withBackup: number;
}

export function CycleDashboard({ supplyUnits, suppliers, coreMaterialIds }: Props) {
  const stats = useMemo(() => {
    // Only core materials
    const coreUnits = supplyUnits.filter(u => coreMaterialIds.has(u.material_id));
    const total = coreUnits.length;
    if (total === 0) return { total: 0, withTarget: 0, withSelected: 0, withQuality: 0, withBackup: 0, areaProgress: [] };

    // Build supplier map by supply_unit_id
    const suppliersByUnit = new Map<string, SupplyUnitSupplier[]>();
    // suppliers.forEach(s => {
    //   const list = suppliersByUnit.get(s.supply_unit_id) || [];
    //   list.push(s);
    //   suppliersByUnit.set(s.supply_unit_id, list);
    // });
    for (const s of suppliers) {
      if (!suppliersByUnit.has(s.supply_unit_id)) {
        suppliersByUnit.set(s.supply_unit_id, []);
      }
      suppliersByUnit.get(s.supply_unit_id)!.push(s);
    }
    let withTarget = 0;
    let withSelected = 0;
    let withQuality = 0;
    let withBackup = 0;

    // Area grouping
    const areaMap = new Map<string, AreaProgress>();

    coreUnits.forEach(u => {
      const unitSuppliers = suppliersByUnit.get(u.id) || [];
      const hasTarget = u.target_price != null;
      // const hasSelected = unitSuppliers.some(s => s.role === 'selected');
      // const hasQualityPick = unitSuppliers.some(s => s.is_quality_pick);
      // const hasBackupSupplier = unitSuppliers.some(s => s.role === 'backup');
      let hasSelected = false;
      let hasBackupSupplier = false;
      let hasQualityPick = false;

      for (const s of unitSuppliers) {
        if (s.role === 'selected') hasSelected = true;
        if (s.role === 'backup') hasBackupSupplier = true;
        if (s.is_quality_pick) hasQualityPick = true;

        if (hasSelected && hasBackupSupplier && hasQualityPick) break;
      }

      if (hasTarget) withTarget++;
      if (hasSelected) withSelected++;
      if (hasQualityPick) withQuality++;
      if (hasBackupSupplier) withBackup++;

      // Area progress
      const areaKey = u.area_id || '__unassigned';
      if (!areaMap.has(areaKey)) {
        areaMap.set(areaKey, {
          areaName: u.area_name || 'Unassigned',
          areaColor: u.area_color || null,
          total: 0,
          withTarget: 0,
          withSelected: 0,
          withQuality: 0,
          withBackup: 0,
        });
      }
      const area = areaMap.get(areaKey)!;
      area.total++;
      if (hasTarget) area.withTarget++;
      if (hasSelected) area.withSelected++;
      if (hasQualityPick) area.withQuality++;
      if (hasBackupSupplier) area.withBackup++;
    });

    return {
      total,
      withTarget,
      withSelected,
      withQuality,
      withBackup,
      areaProgress: Array.from(areaMap.values()),
    };
  }, [supplyUnits, suppliers, coreMaterialIds]);

  // const pct = (n: number) => stats.total > 0 ? Math.round((n / stats.total) * 100) : 0;
    const pct = (value: number, total: number) =>
    total > 0 ? Math.round((value / total) * 100) : 0;

  const kpis = [
    { label: 'Target Price Set', value: stats.withTarget, icon: Target, color: 'text-primary' },
    { label: 'Selected Supplier', value: stats.withSelected, icon: Users, color: 'text-emerald-600' },
    { label: 'Quality Pick', value: stats.withQuality, icon: ShieldCheck, color: 'text-blue-600' },
    { label: 'Backup Supplier', value: stats.withBackup, icon: LifeBuoy, color: 'text-amber-600' },
  ];

  if (stats.total === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No Key material supply units in this cycle yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          // const percentage = pct(kpi.value);
          const percentage = pct(kpi.value, stats.total);
          return (
            <Card key={kpi.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}<span className="text-sm font-normal text-muted-foreground">/{stats.total}</span></div>
                <Progress value={percentage} className="h-1.5 mt-2" />
                <p className="text-xs text-muted-foreground mt-1">{percentage}%</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Per-Area Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Progress by Area</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.areaProgress.map(area => {
              const completeness = area.total > 0
                ? Math.round(((area.withSelected + area.withTarget) / (area.total * 2)) * 100)
                : 0;
              return (
                <div key={`${area.areaName}-${area.total}`} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {area.areaColor && (
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: area.areaColor }} />
                      )}
                      <span className="text-sm font-medium">{area.areaName}</span>
                      <Badge variant="secondary" className="text-xs">{area.total} units</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Target: {area.withTarget}/{area.total}</span>
                      <span>Selected: {area.withSelected}/{area.total}</span>
                      <span>Quality: {area.withQuality}/{area.total}</span>
                      <span>Backup: {area.withBackup}/{area.total}</span>
                    </div>
                  </div>
                  <Progress value={completeness} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

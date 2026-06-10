import { useState, useMemo } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PageGuidance } from '@/components/supply/PageGuidance';
import { UNITS_GUIDANCE } from '@/components/supply/guidance-content';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupplyUnitSuppliersByUnit, useUpdateSupplyUnitSupplier, type SupplyUnitSupplier, type SupplyUnitSupplierRole } from '@/hooks/useSupplyUnitSuppliers';
import { useUnlockCycles } from '@/hooks/useUnlockCycles';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Search, ChevronDown, ChevronRight, Crown, Shield, Users as UsersIcon,
  ArrowUp, ArrowDown, Snowflake, Ban, Trash2, Layers, CheckCircle2,
  AlertTriangle, Pause, XCircle, Target, ShieldAlert, CircleAlert,
} from 'lucide-react';

// Types
interface SupplyUnitRow {
  id: string;
  cycle_id: string;
  material_id: string;
  zone_code: string;
  area_id: string | null;
  status: string;
  target_price: number | null;
  activated_at: string | null;
  frozen_reason: string | null;
  notes: string | null;
  created_at: string;
  // joined
  material_name?: string;
  material_code?: string | null;
  zone_name?: string;
  zone_city?: string | null;
  cycle_name?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
}

interface SupplierInfo {
  account_id: string;
  display_name: string | null;
  is_blacklisted: boolean;
}

// Status config
const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  planned: { label: 'Planned', color: 'bg-muted text-muted-foreground', icon: Target },
  sourcing: { label: 'Sourcing', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: Search },
  active: { label: 'Active', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
  frozen: { label: 'Frozen', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Snowflake },
  inactive: { label: 'Inactive', color: 'bg-destructive/10 text-destructive', icon: XCircle },
};

const roleConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  selected: { label: 'Selected', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: Crown },
  backup: { label: 'Backup', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Shield },
  candidate: { label: 'Candidate', color: 'bg-muted text-muted-foreground border-border', icon: UsersIcon },
};

// SupplyUnitRow Component
function SupplyUnitCard({
  unit,
  suppliers,
  supplierInfoMap,
  isManagement,
  userId,
}: {
  unit: SupplyUnitRow;
  suppliers: SupplyUnitSupplier[];
  supplierInfoMap: Map<string, SupplierInfo>;
  isManagement: boolean;
  userId: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const updateSus = useUpdateSupplyUnitSupplier();
  const queryClient = useQueryClient();
  const [actionDialog, setActionDialog] = useState<{
    sus: SupplyUnitSupplier;
    action: 'promote_selected' | 'promote_backup' | 'demote_backup' | 'remove' | 'freeze' | 'unfreeze';
  } | null>(null);
  const [reason, setReason] = useState('');

  const sorted = useMemo(() => {
    const roleOrder = { selected: 0, backup: 1, candidate: 2 };
    return [...suppliers].sort((a, b) => {
      const ro = (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
      if (ro !== 0) return ro;
      return (a.rank ?? 999) - (b.rank ?? 999);
    });
  }, [suppliers]);

  const sc = statusConfig[unit.status] || statusConfig.planned;
  const StatusIcon = sc.icon;

  const handleAction = async () => {
    if (!actionDialog) return;
    const { sus, action } = actionDialog;
    try {
      if (action === 'promote_selected') {
        // Demote current selected to backup
        const currentSelected = suppliers.find(s => s.role === 'selected' && s.id !== sus.id);
        if (currentSelected) {
          await updateSus.mutateAsync({ id: currentSelected.id, role: 'backup', updated_by: userId || null });
        }
        await updateSus.mutateAsync({ id: sus.id, role: 'selected', updated_by: userId || null });
      } else if (action === 'promote_backup') {
        await updateSus.mutateAsync({ id: sus.id, role: 'backup', updated_by: userId || null });
      } else if (action === 'demote_backup') {
        await updateSus.mutateAsync({ id: sus.id, role: 'backup', updated_by: userId || null });
      } else if (action === 'remove') {
        // supply_unit_suppliers is deprecated; this action is now a no-op
        // until the unit-detail flow is rebuilt on supplier_selections.
        toast.info('Per-unit assignment removal is disabled (legacy model).');
      } else if (action === 'freeze') {
        await updateSus.mutateAsync({
          id: sus.id,
          is_frozen: true,
          frozen_reason: reason || null,
          frozen_by: userId || null,
          frozen_at: new Date().toISOString(),
          updated_by: userId || null,
        });
      } else if (action === 'unfreeze') {
        await updateSus.mutateAsync({
          id: sus.id,
          is_frozen: false,
          frozen_reason: null,
          frozen_by: null,
          frozen_at: null,
          updated_by: userId || null,
        });
      }
      setActionDialog(null);
      setReason('');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{unit.material_name || unit.material_id.slice(0, 8)}</span>
                {unit.material_code && <span className="text-xs text-muted-foreground font-mono">{unit.material_code}</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{unit.zone_name || unit.zone_code}</span>
                {unit.cycle_name && <span className="text-xs text-muted-foreground">· {unit.cycle_name}</span>}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {unit.target_price != null && (
                <span className="text-xs text-muted-foreground">Target: <span className="font-medium text-foreground">{unit.target_price.toFixed(2)}</span></span>
              )}
              <Badge variant="outline" className={`text-[10px] ${sc.color}`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {sc.label}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 py-2 bg-muted/20 border-b border-border/30">
            {sorted.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No suppliers assigned yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-none">
                    <TableHead className="text-[10px] h-8">Rank</TableHead>
                    <TableHead className="text-[10px] h-8">Supplier</TableHead>
                    <TableHead className="text-[10px] h-8">Role</TableHead>
                    <TableHead className="text-[10px] h-8">Landed Price</TableHead>
                    <TableHead className="text-[10px] h-8">Status</TableHead>
                    {isManagement && <TableHead className="text-[10px] h-8 text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(sus => {
                    const info = supplierInfoMap.get(sus.supplier_account_id);
                    const rc = roleConfig[sus.role] || roleConfig.candidate;
                    const RoleIcon = rc.icon;
                    return (
                      <TableRow key={sus.id} className={`border-none ${sus.is_frozen ? 'opacity-60' : ''}`}>
                        <TableCell className="text-xs py-1.5 w-12">
                          {sus.rank ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{info?.display_name || sus.supplier_account_id.slice(0, 8)}</span>
                            {info?.is_blacklisted && (
                              <Badge variant="destructive" className="text-[9px] h-4"><Ban className="h-2.5 w-2.5 mr-0.5" />Blacklisted</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge variant="outline" className={`text-[10px] ${rc.color}`}>
                            <RoleIcon className="h-3 w-3 mr-1" />{rc.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-1.5 font-mono">
                          {sus.landed_price != null ? `${Number(sus.landed_price).toFixed(2)} SAR` : '—'}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {sus.is_frozen ? (
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                              <Snowflake className="h-3 w-3 mr-1" />Frozen
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-emerald-600">Active</span>
                          )}
                        </TableCell>
                        {isManagement && (
                          <TableCell className="py-1.5 text-right">
                            <div className="flex items-center gap-1 justify-end">
                              {sus.role !== 'selected' && !sus.is_frozen && !info?.is_blacklisted && (
                                <Button size="icon" variant="ghost" className="h-6 w-6" title="Promote to Selected"
                                  onClick={() => setActionDialog({ sus, action: 'promote_selected' })}>
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                              )}
                              {sus.role === 'selected' && (
                                <Button size="icon" variant="ghost" className="h-6 w-6" title="Demote to Backup"
                                  onClick={() => setActionDialog({ sus, action: 'demote_backup' })}>
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                              )}
                              {sus.role === 'candidate' && (
                                <Button size="icon" variant="ghost" className="h-6 w-6" title="Promote to Backup"
                                  onClick={() => setActionDialog({ sus, action: 'promote_backup' })}>
                                  <Shield className="h-3 w-3" />
                                </Button>
                              )}
                              {!sus.is_frozen ? (
                                <Button size="icon" variant="ghost" className="h-6 w-6" title="Freeze"
                                  onClick={() => setActionDialog({ sus, action: 'freeze' })}>
                                  <Snowflake className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Button size="icon" variant="ghost" className="h-6 w-6" title="Unfreeze"
                                  onClick={() => setActionDialog({ sus, action: 'unfreeze' })}>
                                  <Snowflake className="h-3 w-3 text-blue-500" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" title="Remove"
                                onClick={() => setActionDialog({ sus, action: 'remove' })}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Action confirmation dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setReason(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {actionDialog?.action === 'promote_selected' && 'Promote to Selected'}
              {actionDialog?.action === 'promote_backup' && 'Promote to Backup'}
              {actionDialog?.action === 'demote_backup' && 'Demote to Backup'}
              {actionDialog?.action === 'remove' && 'Remove Supplier'}
              {actionDialog?.action === 'freeze' && 'Freeze Assignment'}
              {actionDialog?.action === 'unfreeze' && 'Unfreeze Assignment'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {actionDialog?.action === 'promote_selected' && 'This supplier will become the selected vendor. The current selected supplier (if any) will be demoted to backup.'}
              {actionDialog?.action === 'remove' && 'This supplier will be removed from this supply unit permanently.'}
              {actionDialog?.action === 'freeze' && 'This assignment will be frozen and the supplier will not be available for orders.'}
              {actionDialog?.action === 'unfreeze' && 'This assignment will be unfrozen.'}
              {actionDialog?.action === 'promote_backup' && 'This supplier will be set as backup.'}
              {actionDialog?.action === 'demote_backup' && 'This supplier will be moved from selected to backup.'}
            </p>
            {(actionDialog?.action === 'freeze' || actionDialog?.action === 'remove') && (
              <Textarea placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} rows={2} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setReason(''); }}>Cancel</Button>
            <Button variant={actionDialog?.action === 'remove' ? 'destructive' : 'default'} onClick={handleAction}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Supply Unit with suppliers loader
function SupplyUnitWithSuppliers({
  unit,
  supplierInfoMap,
  isManagement,
  userId,
}: {
  unit: SupplyUnitRow;
  supplierInfoMap: Map<string, SupplierInfo>;
  isManagement: boolean;
  userId: string | undefined;
}) {
  const { data: suppliers = [] } = useSupplyUnitSuppliersByUnit(unit.id);

  return (
    <SupplyUnitCard
      unit={unit}
      suppliers={suppliers}
      supplierInfoMap={supplierInfoMap}
      isManagement={isManagement}
      userId={userId}
    />
  );
}

// Main page
export default function SupplyUnits() {
  const { user, roles } = useAuth();
  const isManagement = roles?.includes('management') || roles?.includes('admin');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cycleFilter, setCycleFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('all');

  // Fetch supply units with joins
  const { data: units = [], isLoading } = useQuery({
    queryKey: ['supply-units-page'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supply_units')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];

      // Batch fetch materials, zones, cycles
      const matIds = [...new Set(rows.map(r => r.material_id))];
      const zoneCodes = [...new Set(rows.map(r => r.zone_code))];
      const cycleIds = [...new Set(rows.map(r => r.cycle_id))];

      const [mats, zones, cycles] = await Promise.all([
        matIds.length > 0 ? supabase.from('materials').select('id, name, code, subcategory_id').in('id', matIds).then(r => r.data || []) : Promise.resolve([]),
        zoneCodes.length > 0 ? supabase.from('zones').select('code, name_en, city').in('code', zoneCodes).then(r => r.data || []) : Promise.resolve([]),
        cycleIds.length > 0 ? supabase.from('unlock_cycles').select('id, name').in('id', cycleIds).then(r => r.data || []) : Promise.resolve([]),
      ]);

      const matMap = new Map((mats as any[]).map(m => [m.id, m]));
      const zoneMap = new Map((zones as any[]).map(z => [z.code, z]));
      const cycleMap = new Map((cycles as any[]).map(c => [c.id, c.name]));

      return rows.map(r => {
        const mat = matMap.get(r.material_id);
        const zone = zoneMap.get(r.zone_code);
        return {
          ...r,
          material_name: mat?.name || null,
          material_code: mat?.code || null,
          subcategory_id: mat?.subcategory_id || null,
          zone_name: zone?.name_en || null,
          zone_city: zone?.city || null,
          cycle_name: cycleMap.get(r.cycle_id) || null,
        };
      }) as SupplyUnitRow[];
    },
  });

  // Fetch all supplier info for display
  const { data: supplierInfoMap } = useQuery({
    queryKey: ['supplier-info-map'],
    queryFn: async () => {
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('account_id, is_blacklisted');
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, display_name').is('deleted_at', null);
      const accMap = new Map((accounts || []).map(a => [a.id, a.display_name]));
      const map = new Map<string, SupplierInfo>();
      for (const s of (suppliers || []) as any[]) {
        map.set(s.account_id, {
          account_id: s.account_id,
          display_name: accMap.get(s.account_id) || null,
          is_blacklisted: s.is_blacklisted || false,
        });
      }
      return map;
    },
  });

  const { data: cycles = [] } = useUnlockCycles();

  // Aggregate KPIs from supplier_selections (new model) and supplier_issues.
  // Counts active selections by role, plus open/critical issues.
  const { data: aggKpis } = useQuery({
    queryKey: ['supply-unit-agg-kpis-v2'],
    queryFn: async () => {
      const [selRes, issuesRes] = await Promise.all([
        supabase.from('supplier_selections').select('role').eq('active', true),
        supabase.from('supplier_issues').select('status, severity'),
      ]);
      const sel = (selRes.data || []) as any[];
      const issues = (issuesRes.data || []) as any[];
      return {
        selectedCount: sel.filter(s => s.role === 'selected').length,
        backupCount: sel.filter(s => s.role === 'backup').length,
        frozenCount: 0, // freeze concept pending re-implementation on the new model
        openIssues: issues.filter(i => i.status === 'open' || i.status === 'investigating' || i.status === 'escalated').length,
        criticalIssues: issues.filter(i => i.severity === 'critical' && (i.status === 'open' || i.status === 'investigating' || i.status === 'escalated')).length,
      };
    },
  });

  // Fetch categories & subcategories for filters
  const { data: categories = [] } = useQuery({
    queryKey: ['material-categories-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('material_categories').select('id, name_en').order('name_en');
      return (data || []) as { id: string; name_en: string }[];
    },
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ['material-subcategories-filter', categoryFilter],
    queryFn: async () => {
      let q = supabase.from('material_subcategories').select('id, name_en, category_id').order('name_en');
      if (categoryFilter !== 'all') q = q.eq('category_id', categoryFilter);
      const { data } = await q;
      return (data || []) as { id: string; name_en: string; category_id: string }[];
    },
  });

  // Build subcategory→category map for filtering
  const { data: subcatToCatMap } = useQuery({
    queryKey: ['subcat-to-cat-map'],
    queryFn: async () => {
      const { data } = await supabase.from('material_subcategories').select('id, category_id');
      return new Map((data || []).map((s: any) => [s.id, s.category_id]));
    },
  });

  // Unique zones & cities from data
  const uniqueZones = useMemo(() => {
    const zones = new Map<string, string>();
    units.forEach(u => zones.set(u.zone_code, u.zone_name || u.zone_code));
    return Array.from(zones.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [units]);

  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    units.forEach(u => { if (u.zone_city) cities.add(u.zone_city); });
    return Array.from(cities).sort();
  }, [units]);

  // KPI counts
  const kpiCounts = useMemo(() => {
    const planned = units.filter(u => u.status === 'planned').length;
    const sourcing = units.filter(u => u.status === 'sourcing').length;
    const active = units.filter(u => u.status === 'active').length;
    const frozen = units.filter(u => u.status === 'frozen').length;
    const inactive = units.filter(u => u.status === 'inactive').length;
    return { total: units.length, planned, sourcing, active, frozen, inactive };
  }, [units]);

  // Filter
  const filtered = useMemo(() => {
    return units.filter(u => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (cycleFilter !== 'all' && u.cycle_id !== cycleFilter) return false;
      if (zoneFilter !== 'all' && u.zone_code !== zoneFilter) return false;
      if (cityFilter !== 'all' && u.zone_city !== cityFilter) return false;
      if (categoryFilter !== 'all' && u.subcategory_id) {
        const catId = subcatToCatMap?.get(u.subcategory_id);
        if (catId !== categoryFilter) return false;
      } else if (categoryFilter !== 'all' && !u.subcategory_id) {
        return false;
      }
      if (subcategoryFilter !== 'all' && u.subcategory_id !== subcategoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const match = (u.material_name || '').toLowerCase().includes(q)
          || (u.material_code || '').toLowerCase().includes(q)
          || u.zone_code.toLowerCase().includes(q)
          || (u.zone_name || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [units, statusFilter, cycleFilter, zoneFilter, cityFilter, categoryFilter, subcategoryFilter, search, subcatToCatMap]);

  return (
    <ProtectedRoute>
    <AppLayout title="Supply Units">
      <PageGuidance {...UNITS_GUIDANCE} />
      {/* Unit Status KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
        {[
          { label: 'Total', value: kpiCounts.total, icon: Layers, onClick: () => setStatusFilter('all'), active: statusFilter === 'all' },
          { label: 'Planned', value: kpiCounts.planned, icon: Target, onClick: () => setStatusFilter(statusFilter === 'planned' ? 'all' : 'planned'), active: statusFilter === 'planned' },
          { label: 'Sourcing', value: kpiCounts.sourcing, icon: Search, onClick: () => setStatusFilter(statusFilter === 'sourcing' ? 'all' : 'sourcing'), active: statusFilter === 'sourcing' },
          { label: 'Active', value: kpiCounts.active, icon: CheckCircle2, onClick: () => setStatusFilter(statusFilter === 'active' ? 'all' : 'active'), active: statusFilter === 'active' },
          { label: 'Frozen', value: kpiCounts.frozen, icon: Snowflake, onClick: () => setStatusFilter(statusFilter === 'frozen' ? 'all' : 'frozen'), active: statusFilter === 'frozen' },
          { label: 'Inactive', value: kpiCounts.inactive, icon: XCircle, onClick: () => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive'), active: statusFilter === 'inactive' },
        ].map(kpi => (
          <Card
            key={kpi.label}
            className={`cursor-pointer transition-all hover:shadow-md ${kpi.active ? 'ring-2 ring-primary' : ''}`}
            onClick={kpi.onClick}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xl font-bold leading-none">{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Supplier Aggregate KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        {[
          { label: 'Selected Suppliers', value: aggKpis?.selectedCount ?? '—', icon: Crown, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Backup Suppliers', value: aggKpis?.backupCount ?? '—', icon: Shield, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Frozen Assignments', value: aggKpis?.frozenCount ?? '—', icon: Snowflake, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Open Issues', value: aggKpis?.openIssues ?? '—', icon: ShieldAlert, color: 'text-orange-600 dark:text-orange-400' },
          { label: 'Critical Issues', value: aggKpis?.criticalIssues ?? '—', icon: CircleAlert, color: 'text-destructive' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold leading-none">{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar Row 1: Search + Quick Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search materials, zones..." className="pl-8 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={cycleFilter} onValueChange={setCycleFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="All Cycles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cycles</SelectItem>
            {cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="All Zones" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zones</SelectItem>
            {uniqueZones.map(([code, name]) => <SelectItem key={code} value={code}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Toolbar Row 2: City, Category, Subcategory */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="All Cities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {uniqueCities.map(city => <SelectItem key={city} value={city}>{city}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setSubcategoryFilter('all'); }}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={subcategoryFilter} onValueChange={setSubcategoryFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="All Subcategories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subcategories</SelectItem>
            {subcategories.map(s => <SelectItem key={s.id} value={s.id}>{s.name_en}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Supply Units List */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Supply Units
            <Badge variant="outline" className="ml-2 text-[10px]">{filtered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {units.length === 0
                ? 'No supply units yet. Approve supplier quotes to generate supply units automatically.'
                : 'No supply units match your filters.'}
            </div>
          ) : (
            filtered.map(unit => (
              <SupplyUnitWithSuppliers
                key={unit.id}
                unit={unit}
                supplierInfoMap={supplierInfoMap || new Map()}
                isManagement={!!isManagement}
                userId={user?.id}
              />
            ))
          )}
        </CardContent>
      </Card>
    </AppLayout>
    </ProtectedRoute>
  );
}

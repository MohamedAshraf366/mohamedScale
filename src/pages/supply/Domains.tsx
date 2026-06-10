import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  ArrowLeft, Crown, ShieldCheck, Shield, Package, MapPin, Layers,
  Loader2, Ban, ChevronDown, Eye, EyeOff, Lock, Unlock, RefreshCw, Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { parseSpecsFromCode } from '@/lib/coding-system';
import { useDomainsOverview, useDomainDetail } from '@/hooks/useDomainsOverview';
import {
  computeLandedBundle,
  supplierZoneCoverage,
  type DeliveryRateRow,
  type LandedBundle,
} from '@/lib/landedPrice';
import { resolveInherited } from '@/lib/resolve-inherited';
import { Truck, AlertTriangle } from 'lucide-react';

export default function DomainsPage() {
  const { id } = useParams<{ id?: string }>();
  if (id) return <DomainDetailView domainId={id} />;
  return <DomainsList />;
}

// ──────────────────────────────────────────────────────────────────
// List page
// ──────────────────────────────────────────────────────────────────
function DomainsList() {
  const { data: rows = [], isLoading } = useDomainsOverview();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Supply Domains</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Each domain is a subcategory × area (split by the subcategory's domain axis when set).
            Open one to compare quotes and pick suppliers. Sorted by quotation coverage.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No active domains yet.</div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead className="text-right">Materials</TableHead>
                  <TableHead className="text-right">Quotes</TableHead>
                  <TableHead className="text-right">Coverage</TableHead>
                  <TableHead>Selected</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Backup</TableHead>
                  <TableHead className="text-right">Targets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/supply/domains/${r.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{r.label}</span>
                          <span className="text-[11px] text-muted-foreground">{r.subcategory_name || '—'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {r.area_name || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{r.material_count}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.live_quotes > 0 ? 'secondary' : 'outline'} className="text-xs">
                        {r.live_quotes}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        'text-sm font-medium',
                        r.coverage_pct >= 80 ? 'text-emerald-600' :
                        r.coverage_pct >= 40 ? 'text-amber-600' : 'text-muted-foreground'
                      )}>{r.coverage_pct}%</span>
                    </TableCell>
                    <TableCell><RoleChips names={r.selected_names} role="selected" /></TableCell>
                    <TableCell><RoleChips names={r.quality_names} role="quality" /></TableCell>
                    <TableCell><RoleChips names={r.backup_names} role="backup" /></TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {r.target_prices_set}/{r.material_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ──────────────────────────────────────────────────────────────────
// Detail view types
// ──────────────────────────────────────────────────────────────────
type Role = 'selected' | 'quality' | 'backup' | 'rejected';

interface MaterialRow {
  id: string;
  name_en: string;
  name_ar: string | null;
  code: string | null;
  is_core: boolean;
  target_price: number | null;
  target_locked: boolean;
  prices: Map<string, number>;        // supplier_account_id -> landed_avg price
  rawPrices: Map<string, number>;     // supplier_account_id -> raw unit price
  bundles: Map<string, LandedBundle>; // supplier_account_id -> full landed bundle
  cellOverrides: Map<string, Role>;   // supplier_account_id -> material-level role
  coverage: number;                   // # of (non-rejected) suppliers quoting this material
}

interface Directive {
  id: string;
  supplier_account_id: string;
  role: Role;
  material_id: string | null;
}

const ROLE_CONFIG: Record<Role, { icon: any; color: string; bg: string; label: string }> = {
  selected:  { icon: Crown,       color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Selected' },
  quality:   { icon: ShieldCheck, color: 'text-blue-600',    bg: 'bg-blue-500/10',    label: 'Quality'  },
  backup:    { icon: Shield,      color: 'text-amber-600',   bg: 'bg-amber-500/10',   label: 'Backup'   },
  rejected:  { icon: Ban,         color: 'text-destructive', bg: 'bg-destructive/10', label: 'Rejected' },
};

// ──────────────────────────────────────────────────────────────────
// Detail view
// ──────────────────────────────────────────────────────────────────
function DomainDetailView({ domainId }: { domainId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: domain, isLoading: domainLoading } = useDomainDetail(domainId);

  const [showNonCore, setShowNonCore] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [nameColWidth, setNameColWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 240;
    const stored = localStorage.getItem(`dom-name-w-${domainId}`);
    return stored ? Number(stored) : 240;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(`dom-name-w-${domainId}`, String(nameColWidth));
  }, [nameColWidth, domainId]);

  // ── Materials in this domain (axis-filtered) ───────────────────
  const { data: materials = [], isLoading: matsLoading } = useQuery({
    queryKey: ['domain-materials-v3', domain?.subcategory_id, domain?.axis_value],
    enabled: !!domain?.subcategory_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name_en, name_ar, code, is_core, subcategory_id, status')
        .eq('subcategory_id', domain!.subcategory_id)
        .eq('status', 'active')
        .limit(2000);
      if (error) throw error;
      const all = data || [];
      const axis = domain!.domain_axis;
      const axisVal = domain!.axis_value;
      if (axis && axisVal) {
        const sc = {
          spec_definitions: domain!.spec_definitions || [],
          variant_definitions: domain!.variant_definitions || {},
        };
        return all.filter((m: any) => {
          const parsed = parseSpecsFromCode(m.code, sc as any);
          return parsed[axis] === axisVal;
        });
      }
      return all;
    },
  });

  const materialIds = useMemo(() => materials.map((m: any) => m.id), [materials]);

  // ── Quotes (include supplier_material id for delivery-rate override matching) ─
  const { data: supplierMaterials = [] } = useQuery({
    queryKey: ['domain-supplier-materials-v4', materialIds],
    enabled: materialIds.length > 0,
    queryFn: async () => {
      const out: any[] = [];
      for (let i = 0; i < materialIds.length; i += 100) {
        const batch = materialIds.slice(i, i + 100);
        const { data, error } = await supabase
          .from('supplier_materials')
          .select('id, material_id, supplier_account_id, unit_price, status')
          .in('material_id', batch)
          .eq('is_current', true);
        if (error) throw error;
        out.push(...(data || []).filter((sm: any) =>
          ['submitted', 'under_review', 'approved'].includes(sm.status)
        ));
      }
      return out;
    },
  });

  // ── MOQ resolution (Material -> Subcategory -> Category) ────────
  // materials.default_moq is force-NULLed by trigger, so we resolve via the
  // domain's subcategory + its parent category once.
  const { data: domainMoq = null } = useQuery({
    queryKey: ['domain-moq', domain?.subcategory_id],
    enabled: !!domain?.subcategory_id,
    queryFn: async (): Promise<number | null> => {
      const { data: sub } = await supabase
        .from('material_subcategories')
        .select('default_moq, category_id')
        .eq('id', domain!.subcategory_id)
        .maybeSingle();
      let cat: any = null;
      if (sub?.category_id) {
        const { data: c } = await supabase
          .from('material_categories')
          .select('default_moq')
          .eq('id', sub.category_id)
          .maybeSingle();
        cat = c;
      }
      return resolveInherited<number | null>('default_moq', [sub as any, cat], null);
    },
  });

  // ── Target prices ──────────────────────────────────────────────
  const { data: targetPrices = [] } = useQuery({
    queryKey: ['domain-target-prices-v3', domain?.area_id, materialIds],
    enabled: !!domain?.area_id && materialIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('target_prices')
        .select('material_id, target_price, is_locked')
        .eq('scope_type', 'area')
        .eq('scope_id', domain!.area_id)
        .in('material_id', materialIds);
      if (error) throw error;
      return data || [];
    },
  });

  // ── Selections (new model: supplier_selections) ─────────────────
  // Read all active selections for this domain, then map material_code → material_id
  // locally using the materials list already loaded above. The Domains matrix is
  // material × supplier (no zone), so:
  //   - column scope: material_code IS NULL, zone_code IS NULL  → "Domain" scope
  //   - cell   scope: material_code = M.code, zone_code IS NULL → "Unit"   scope
  const codeToId = useMemo(() => {
    const m = new Map<string, string>();
    (materials as any[]).forEach((mt: any) => { if (mt.code) m.set(mt.code, mt.id); });
    return m;
  }, [materials]);

  const { data: directives = [] } = useQuery({
    queryKey: ['domain-selections-v1', domainId, codeToId.size],
    queryFn: async (): Promise<Directive[]> => {
      const { data, error } = await supabase
        .from('supplier_selections')
        .select('id, supplier_id, role, material_code, zone_code')
        .eq('domain_id', domainId)
        .eq('active', true)
        .is('zone_code', null);
      if (error) throw error;
      return (data || []).map((s: any) => ({
        id: s.id,
        supplier_account_id: s.supplier_id,
        role: s.role as Role,
        material_id: s.material_code ? (codeToId.get(s.material_code) ?? null) : null,
      })) as any;
    },
  });

  // ── Account names ──────────────────────────────────────────────
  const supplierIds = useMemo(
    () => [...new Set(supplierMaterials.map((s: any) => s.supplier_account_id))],
    [supplierMaterials]
  );
  const { data: accounts = [] } = useQuery({
    queryKey: ['domain-accounts-v3', supplierIds],
    enabled: supplierIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('id, display_name').in('id', supplierIds);
      if (error) throw error;
      return data || [];
    },
  });
  const accountMap = useMemo(
    () => new Map((accounts as any[]).map(a => [a.id, a.display_name || 'Unknown'])),
    [accounts]
  );

  // ── Role resolution ────────────────────────────────────────────
  const columnRoles = useMemo(() => {
    const m = new Map<string, Role>();
    directives.forEach(d => {
      if (d.material_id == null) m.set(d.supplier_account_id, d.role);
    });
    return m;
  }, [directives]);

  const cellOverridesBy = useMemo(() => {
    const m = new Map<string, Map<string, Role>>();
    directives.forEach(d => {
      if (d.material_id == null) return;
      if (!m.has(d.material_id)) m.set(d.material_id, new Map());
      m.get(d.material_id)!.set(d.supplier_account_id, d.role);
    });
    return m;
  }, [directives]);

  // ── Delivery rates for all visible suppliers ────────────────────
  const { data: deliveryRates = [] } = useQuery({
    queryKey: ['domain-delivery-rates', supplierIds],
    enabled: supplierIds.length > 0,
    queryFn: async (): Promise<DeliveryRateRow[]> => {
      const { data, error } = await supabase
        .from('delivery_rates')
        .select('id, supplier_account_id, supplier_material_ids, is_default, zone_codes, price_per_moq')
        .in('supplier_account_id', supplierIds);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        supplier_account_id: r.supplier_account_id,
        supplier_material_ids: r.supplier_material_ids || [],
        is_default: !!r.is_default,
        zone_codes: r.zone_codes || [],
        price_per_moq: Number(r.price_per_moq),
      }));
    },
  });

  const ratesBySupplier = useMemo(() => {
    const m = new Map<string, DeliveryRateRow[]>();
    for (const r of deliveryRates) {
      if (!m.has(r.supplier_account_id)) m.set(r.supplier_account_id, []);
      m.get(r.supplier_account_id)!.push(r);
    }
    return m;
  }, [deliveryRates]);

  const zonesInArea = domain?.zone_codes || [];

  // Supplier-level zone coverage (default rates only) for header chips
  const supplierZoneCov = useMemo(() => {
    const m = new Map<string, { covered: string[]; pct: number }>();
    ratesBySupplier.forEach((rates, sid) => {
      m.set(sid, supplierZoneCoverage(rates, zonesInArea));
    });
    return m;
  }, [ratesBySupplier, zonesInArea]);

  // ── Row build ──────────────────────────────────────────────────
  const rows: MaterialRow[] = useMemo(() => {
    // Per-material per-supplier best raw quote + corresponding supplier_material id
    const rawPriceMap = new Map<string, Map<string, { raw: number; smId: string }>>();
    supplierMaterials.forEach((sm: any) => {
      if (sm.unit_price == null) return;
      if (!rawPriceMap.has(sm.material_id)) rawPriceMap.set(sm.material_id, new Map());
      const inner = rawPriceMap.get(sm.material_id)!;
      const p = Number(sm.unit_price);
      const existing = inner.get(sm.supplier_account_id);
      if (existing == null || p < existing.raw) inner.set(sm.supplier_account_id, { raw: p, smId: sm.id });
    });
    const targetMap = new Map<string, { value: number; locked: boolean }>();
    (targetPrices as any[]).forEach(t => {
      if (t.target_price != null) targetMap.set(t.material_id, { value: Number(t.target_price), locked: !!t.is_locked });
    });
    return (materials as any[]).map(m => {
      const rawInner = rawPriceMap.get(m.id) || new Map<string, { raw: number; smId: string }>();
      const overrides = cellOverridesBy.get(m.id) || new Map<string, Role>();
      const prices = new Map<string, number>();
      const rawPrices = new Map<string, number>();
      const bundles = new Map<string, LandedBundle>();
      rawInner.forEach((v, sid) => {
        rawPrices.set(sid, v.raw);
        const bundle = computeLandedBundle({
          rawUnit: v.raw,
          moq: domainMoq,
          zonesInArea,
          supplierMaterialId: v.smId,
          supplierRates: ratesBySupplier.get(sid) || [],
        });
        bundles.set(sid, bundle);
        prices.set(sid, bundle.landed_avg);
      });
      // Exclude column-rejected AND cell-rejected from coverage
      let cov = 0;
      prices.forEach((_p, sid) => {
        const cellRole = overrides.get(sid);
        const colRole = columnRoles.get(sid);
        const isRejected = cellRole === 'rejected' || (cellRole == null && colRole === 'rejected');
        if (!isRejected) cov++;
      });
      const tp = targetMap.get(m.id);
      return {
        id: m.id,
        name_en: m.name_en || m.name || '',
        name_ar: m.name_ar || null,
        code: m.code,
        is_core: !!m.is_core,
        target_price: tp?.value ?? null,
        target_locked: tp?.locked ?? false,
        prices,
        rawPrices,
        bundles,
        cellOverrides: overrides,
        coverage: cov,
      };
    });
  }, [materials, supplierMaterials, targetPrices, cellOverridesBy, columnRoles, ratesBySupplier, zonesInArea, domainMoq]);

  // Suppliers ordered by quoted material count (desc)
  const supplierCols = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach(r => r.prices.forEach((_, sid) => counts.set(sid, (counts.get(sid) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([sid]) => sid);
  }, [rows]);

  // Split core / non-core: core sorted alpha, others sorted by coverage desc
  const { coreRows, otherRows } = useMemo(() => {
    const core = rows.filter(r => r.is_core).sort((a, b) => a.name_en.localeCompare(b.name_en));
    const other = rows.filter(r => !r.is_core).sort((a, b) =>
      b.coverage - a.coverage || a.name_en.localeCompare(b.name_en)
    );
    return { coreRows: core, otherRows: other };
  }, [rows]);

  const visibleRows = useMemo(() => {
    return coreRows.length === 0 ? rows : (showNonCore ? [...coreRows, ...otherRows] : coreRows);
  }, [coreRows, otherRows, showNonCore, rows]);

  const visibleIds = useMemo(() => visibleRows.map(r => r.id), [visibleRows]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach(id => next.delete(id));
      else visibleIds.forEach(id => next.add(id));
      return next;
    });
  };
  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ── Mutations (write through set_supplier_selection RPC) ───────
  // The Domains matrix has no zone column, so all writes here are:
  //   - column scope (Domain): material_code = NULL, zone_code = NULL
  //   - cell   scope (Unit):   material_code = M.code, zone_code = NULL
  const idToCode = useMemo(() => {
    const m = new Map<string, string>();
    (materials as any[]).forEach((mt: any) => { if (mt.code) m.set(mt.id, mt.code); });
    return m;
  }, [materials]);

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['domain-selections-v1', domainId] });
    qc.invalidateQueries({ queryKey: ['supplier-selections'] });
    qc.invalidateQueries({ queryKey: ['domains-overview-v2'] });
  }, [qc, domainId]);

  const callSetSelection = useCallback(async (
    material_code: string | null,
    zone_code: string | null,
    supplier_id: string,
    role: Role,
    action: 'set' | 'remove' = 'set',
  ) => {
    const { error } = await supabase.rpc('set_supplier_selection' as any, {
      p_domain_id: domainId,
      p_material_code: material_code,
      p_zone_code: zone_code,
      p_supplier_id: supplier_id,
      p_role: role,
      p_action: action,
      p_reason: null,
    } as any);
    if (error) throw error;
  }, [domainId]);

  const setColumnRole = useCallback(async (supplier_account_id: string, role: Role | null) => {
    try {
      // Clear any active column-scope role this supplier currently has at this domain
      const { data: existing } = await supabase
        .from('supplier_selections')
        .select('role')
        .eq('domain_id', domainId)
        .eq('supplier_id', supplier_account_id)
        .is('material_code', null)
        .is('zone_code', null)
        .eq('active', true);
      for (const row of (existing || []) as any[]) {
        await callSetSelection(null, null, supplier_account_id, row.role as Role, 'remove');
      }

      if (role) {
        await callSetSelection(null, null, supplier_account_id, role, 'set');
      }
      invalidateAll();
      toast.success(`${accountMap.get(supplier_account_id) || 'Supplier'} → ${role ?? 'cleared'}`);
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    }
  }, [domainId, accountMap, callSetSelection, invalidateAll]);

  const setCellRole = useCallback(async (material_id: string, supplier_account_id: string, role: Role | null) => {
    try {
      const code = idToCode.get(material_id);
      if (!code) throw new Error('Material code missing');

      // Clear any active unit-scope role for this supplier × material
      const { data: existing } = await supabase
        .from('supplier_selections')
        .select('role')
        .eq('domain_id', domainId)
        .eq('supplier_id', supplier_account_id)
        .eq('material_code', code)
        .is('zone_code', null)
        .eq('active', true);
      for (const row of (existing || []) as any[]) {
        await callSetSelection(code, null, supplier_account_id, row.role as Role, 'remove');
      }

      if (role) {
        await callSetSelection(code, null, supplier_account_id, role, 'set');
      }
      invalidateAll();
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    }
  }, [domainId, idToCode, callSetSelection, invalidateAll]);

  const upsertTarget = useCallback(async (materialId: string, patch: { target_price?: number | null; is_locked?: boolean }) => {
    if (!domain) return;
    try {
      const { data: existing } = await supabase.from('target_prices').select('id')
        .eq('scope_type', 'area').eq('scope_id', domain.area_id).eq('material_id', materialId).maybeSingle();
      if (patch.target_price === null && existing) {
        await supabase.from('target_prices').delete().eq('id', (existing as any).id);
      } else if (existing) {
        await supabase.from('target_prices').update(patch as any).eq('id', (existing as any).id);
      } else if (patch.target_price != null) {
        await supabase.from('target_prices').insert({
          scope_type: 'area', scope_id: domain.area_id, material_id: materialId,
          target_price: patch.target_price, currency: 'SAR', source_mode: 'manual',
          is_locked: patch.is_locked ?? false,
        } as any);
      }
      qc.invalidateQueries({ queryKey: ['domain-target-prices-v3'] });
      qc.invalidateQueries({ queryKey: ['domains-overview-v2'] });
    } catch (e: any) {
      toast.error('Target update failed: ' + e.message);
    }
  }, [domain, qc]);

  const toggleCore = useCallback(async (materialId: string, value: boolean) => {
    try {
      const { error } = await supabase.from('materials').update({ is_core: value } as any).eq('id', materialId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['domain-materials-v3'] });
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    }
  }, [qc]);

  const recomputeTargets = useCallback(async (ids: string[]) => {
    const rowMap = new Map(rows.map(r => [r.id, r]));
    const toUpdate = ids.map(id => rowMap.get(id)).filter(Boolean) as MaterialRow[];
    const actionable = toUpdate.filter(r => !r.target_locked && r.prices.size > 0);
    if (actionable.length === 0) {
      toast.info('Nothing to recompute (all locked or no quotes).');
      return;
    }
    let skippedNoDelivery = 0;
    for (const r of actionable) {
      // best landed price excluding rejected AND suppliers with no delivery to this area
      const valid = [...r.prices.entries()].filter(([sid]) => {
        const cell = r.cellOverrides.get(sid);
        const col = columnRoles.get(sid);
        if (cell === 'rejected' || (cell == null && col === 'rejected')) return false;
        const b = r.bundles.get(sid);
        return !!b?.has_any_delivery;
      }).map(([, p]) => p);
      if (valid.length === 0) { skippedNoDelivery++; continue; }
      await upsertTarget(r.id, { target_price: Math.min(...valid) });
    }
    toast.success(`Recomputed ${actionable.length - skippedNoDelivery} target(s)${skippedNoDelivery ? ` · ${skippedNoDelivery} skipped (no landed prices)` : ''}`);
  }, [rows, columnRoles, upsertTarget]);

  const bulkSetCore = useCallback(async (ids: string[], value: boolean) => {
    if (ids.length === 0) return;
    try {
      const { error } = await supabase.from('materials').update({ is_core: value } as any).in('id', ids);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['domain-materials-v3'] });
      toast.success(`${value ? 'Marked' : 'Unmarked'} ${ids.length} as key material`);
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    }
  }, [qc]);

  const bulkRemove = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Remove ${ids.length} material(s) from the registry? This cannot be undone. Materials referenced anywhere will be skipped.`)) return;
    let removed = 0;
    const blocked: { id: string; name: string; reasons: string[] }[] = [];
    const rowMap = new Map(rows.map(r => [r.id, r]));
    for (const id of ids) {
      const { data: chk, error: chkErr } = await (supabase.rpc as any)('can_delete_material', { p_material_id: id });
      if (chkErr) { toast.error('Check failed: ' + chkErr.message); continue; }
      const result = Array.isArray(chk) ? chk[0] : chk;
      if (result?.can) {
        const { error } = await supabase.from('materials').delete().eq('id', id);
        if (error) {
          blocked.push({ id, name: rowMap.get(id)?.name_en || id, reasons: [error.message] });
        } else {
          removed++;
        }
      } else {
        blocked.push({ id, name: rowMap.get(id)?.name_en || id, reasons: result?.reasons || ['unknown'] });
      }
    }
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ['domain-materials-v3'] });
    if (removed) toast.success(`Removed ${removed} material(s)`);
    if (blocked.length) {
      toast.error(`${blocked.length} blocked: ${blocked.slice(0, 3).map(b => `${b.name} (${b.reasons[0]})`).join('; ')}${blocked.length > 3 ? '…' : ''}`, { duration: 7000 });
    }
  }, [rows, qc]);

  // ── Loading ────────────────────────────────────────────────────
  if (domainLoading || !domain) {
    return <AppLayout><div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div></AppLayout>;
  }

  const liveQuotes = supplierMaterials.length;
  const selectedCount = [...columnRoles.values()].filter(r => r === 'selected').length;
  const rejectedSupplierCount = [...columnRoles.values()].filter(r => r === 'rejected').length;

  // Sticky column widths (must match cells)
  const CHK_W = 36;
  const NAME_W = nameColWidth;
  const CORE_W = 52;
  const COV_W = 64;
  const TARGET_W = 116;
  const BEST_W = 80;
  const AVG_W = 80;
  const offsets = {
    chk: 0,
    name: CHK_W,
    core: CHK_W + NAME_W,
    cov:  CHK_W + NAME_W + CORE_W,
    target: CHK_W + NAME_W + CORE_W + COV_W,
    best:   CHK_W + NAME_W + CORE_W + COV_W + TARGET_W,
    avg:    CHK_W + NAME_W + CORE_W + COV_W + TARGET_W + BEST_W,
  };
  const selectedIds = [...selected];

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)] w-full min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-4 md:px-6 pt-4 pb-3 border-b shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0.5" onClick={() => navigate('/supply/domains')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">{domain.label}</h2>
              <Badge variant="outline" className="text-xs">{domain.subcategory_name}</Badge>
              <Badge variant="outline" className="text-xs gap-1"><MapPin className="h-3 w-3" />{domain.area_name}</Badge>
              {domain.axis_value && (
                <Badge variant="secondary" className="text-xs">
                  {domain.domain_axis}: {domain.axis_value}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1.5">
              <span>{visibleRows.length} of {rows.length} material(s)</span>
              <span>{supplierCols.length} supplier(s)</span>
              <span>{liveQuotes} quote(s)</span>
              <span>{selectedCount} selected</span>
              {rejectedSupplierCount > 0 && (
                <span className="text-destructive">{rejectedSupplierCount} rejected supplier(s)</span>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 md:px-6 py-2 border-b shrink-0 text-xs flex-wrap">
          {otherRows.length > 0 && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowNonCore(v => !v)}>
              {showNonCore ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
              {showNonCore ? `Hide non-core` : `Show all (${otherRows.length} more)`}
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowRejected(v => !v)}>
            {showRejected ? 'Hide rejected' : 'Show rejected'}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => recomputeTargets(visibleIds)}>
            <RefreshCw className="h-3 w-3" /> Recompute unlocked targets
          </Button>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l">
              <Badge variant="secondary" className="h-6 text-[10px]">{selectedIds.length} selected</Badge>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => bulkSetCore(selectedIds, true)}>
                <Crown className="h-3 w-3 text-amber-500" /> Mark core
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => bulkSetCore(selectedIds, false)}>
                Unmark core
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => recomputeTargets(selectedIds)}>
                <RefreshCw className="h-3 w-3" /> Recompute target
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => bulkRemove(selectedIds)}>
                <Trash2 className="h-3 w-3" /> Remove
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}

          <div className="text-muted-foreground ml-auto flex items-center gap-1">
            <Truck className="h-3 w-3" />
            <span>Prices shown as <strong>landed</strong> (raw + Ø delivery / MOQ across covered zones).</span>
          </div>
        </div>

        {/* Matrix */}
        {matsLoading ? (
          <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : visibleRows.length === 0 ? (
          <div className="m-4 border rounded-lg py-12 text-center text-sm text-muted-foreground">
            {coreRows.length === 0 && rows.length === 0
              ? 'No materials match this domain.'
              : 'No materials to show with current filters.'}
          </div>
        ) : (
          <div className="flex-1 overflow-auto min-w-0">
            <table className="border-collapse text-xs w-max">
              <thead className="sticky top-0 z-30 bg-background">
                <tr className="border-b">
                  <StickyHead left={offsets.chk} width={CHK_W} className="border-r">
                    <div className="flex items-center justify-center py-1.5">
                      <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                    </div>
                  </StickyHead>
                  <StickyHead left={offsets.name} width={NAME_W} className="border-r">
                    <div className="px-2 py-1.5 font-semibold">Material</div>
                    <ResizeHandle onResize={dx => setNameColWidth(w => Math.max(180, Math.min(500, w + dx)))} />
                  </StickyHead>
                  <StickyHead left={offsets.core} width={CORE_W} className="border-r text-center">
                    <HeaderLabel className="px-1 py-1.5 text-[10px] justify-center" tip="Core (key) materials. Pricing focus and the basis for supplier coverage %. Toggle per row.">Core</HeaderLabel>
                  </StickyHead>
                  <StickyHead left={offsets.cov} width={COV_W} className="border-r text-right">
                    <HeaderLabel className="px-1 py-1.5 text-[10px] justify-end" tip="How many non-rejected suppliers actually quoted this material (with a usable landed price).">Cov.</HeaderLabel>
                  </StickyHead>
                  <StickyHead left={offsets.target} width={TARGET_W} className="border-r" tint="bg-primary/10">
                    <HeaderLabel className="px-2 py-1.5 text-primary justify-end" tip="Target landed price (raw + delivery/unit) for this material. Lock to protect from recompute; recompute sets it to the best valid landed price.">Target</HeaderLabel>
                  </StickyHead>
                  <StickyHead left={offsets.best} width={BEST_W} className="border-r" tint="bg-emerald-500/15">
                    <HeaderLabel className="px-2 py-1.5 text-emerald-700 dark:text-emerald-400 justify-end" tip="Lowest landed price across suppliers (excluding rejected and suppliers with no delivery to this area).">Best</HeaderLabel>
                  </StickyHead>
                  <StickyHead left={offsets.avg} width={AVG_W} className="border-r" tint="bg-muted/60">
                    <HeaderLabel className="px-2 py-1.5 text-muted-foreground justify-end" tip="Average landed price across the same valid suppliers (no rejected, no zero-delivery).">Avg</HeaderLabel>
                  </StickyHead>
                   {supplierCols.map(sid => {
                     const cov = supplierZoneCov.get(sid);
                     const quoted = coreRows.filter(r => r.prices.has(sid)).length;
                     const totalMats = coreRows.length;
                    return (
                      <th key={sid} className={cn(
                        'min-w-[160px] border-r',
                        columnRoles.get(sid) === 'rejected' ? 'bg-destructive/5' : 'bg-background',
                      )}>
                        <SupplierHeader
                          name={accountMap.get(sid) || 'Unknown'}
                          role={columnRoles.get(sid)}
                          quotedCount={quoted}
                          totalMaterials={totalMats}
                          zoneCoveredCount={cov?.covered.length ?? 0}
                          zonesTotal={zonesInArea.length}
                          onChange={(r) => setColumnRole(sid, r)}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {coreRows.length > 0 && (
                  <SectionLabel
                    leftPaneWidth={offsets.avg + AVG_W}
                    label={`Key materials (${coreRows.length})`}
                  />
                )}
                {coreRows.map(r => (
                  <MaterialMatrixRow
                    key={r.id}
                    row={r}
                    supplierCols={supplierCols}
                    columnRoles={columnRoles}
                    accountMap={accountMap}
                    offsets={offsets}
                    widths={{ chk: CHK_W, name: NAME_W, core: CORE_W, cov: COV_W, target: TARGET_W, best: BEST_W, avg: AVG_W }}
                    showRejected={showRejected}
                    isSelected={selected.has(r.id)}
                    onToggleSelect={() => toggleSelect(r.id)}
                    onSetCellRole={setCellRole}
                    onUpsertTarget={upsertTarget}
                    onToggleCore={toggleCore}
                  />
                ))}
                {showNonCore && otherRows.length > 0 && (
                  <SectionLabel
                    leftPaneWidth={offsets.avg + AVG_W}
                    label={`Other materials (${otherRows.length}) — sorted by coverage`}
                  />
                )}
                {showNonCore && otherRows.map(r => (
                  <MaterialMatrixRow
                    key={r.id}
                    row={r}
                    supplierCols={supplierCols}
                    columnRoles={columnRoles}
                    accountMap={accountMap}
                    offsets={offsets}
                    widths={{ chk: CHK_W, name: NAME_W, core: CORE_W, cov: COV_W, target: TARGET_W, best: BEST_W, avg: AVG_W }}
                    showRejected={showRejected}
                    isSelected={selected.has(r.id)}
                    onToggleSelect={() => toggleSelect(r.id)}
                    onSetCellRole={setCellRole}
                    onUpsertTarget={upsertTarget}
                    onToggleCore={toggleCore}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ──────────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────────

function HeaderLabel({ children, tip, className }: { children: React.ReactNode; tip: string; className?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('font-semibold flex items-center gap-1 cursor-help select-none', className)}>
            {children}
            <span className="text-[8px] text-muted-foreground/60 leading-none">ⓘ</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] text-xs leading-snug">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StickyHead({ left, width, className, tint, children }: {
  left: number; width: number; className?: string; tint?: string; children: React.ReactNode;
}) {
  return (
    <th
      className={cn('sticky z-20 border-b bg-background', className)}
      style={{ left, width, minWidth: width, maxWidth: width }}
    >
      <div className="relative">
        {tint && <div className={cn('absolute inset-0 pointer-events-none', tint)} />}
        <div className="relative">{children}</div>
      </div>
    </th>
  );
}

function SectionLabel({ label, leftPaneWidth }: { label: string; leftPaneWidth: number }) {
  return (
    <tr>
      <td
        colSpan={9999}
        className="p-0 border-b bg-muted"
      >
        <div
          className="sticky left-0 inline-block px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-muted"
          style={{ maxWidth: leftPaneWidth }}
        >
          {label}
        </div>
      </td>
    </tr>
  );
}

function ResizeHandle({ onResize }: { onResize: (dx: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(dx);
    };
    const onUp = () => { dragging.current = false; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [onResize]);
  return (
    <div
      onMouseDown={(e) => { dragging.current = true; lastX.current = e.clientX; document.body.style.cursor = 'col-resize'; e.preventDefault(); }}
      className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/40 z-10"
    />
  );
}

interface RowWidths { chk: number; name: number; core: number; cov: number; target: number; best: number; avg: number }
interface RowOffsets { chk: number; name: number; core: number; cov: number; target: number; best: number; avg: number }

function MaterialMatrixRow({
  row, supplierCols, columnRoles, accountMap, offsets, widths, showRejected, isSelected,
  onToggleSelect, onSetCellRole, onUpsertTarget, onToggleCore,
}: {
  row: MaterialRow;
  supplierCols: string[];
  columnRoles: Map<string, Role>;
  accountMap: Map<string, string>;
  offsets: RowOffsets;
  widths: RowWidths;
  showRejected: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onSetCellRole: (mid: string, sid: string, r: Role | null) => void;
  onUpsertTarget: (mid: string, patch: { target_price?: number | null; is_locked?: boolean }) => void;
  onToggleCore: (mid: string, v: boolean) => void;
}) {
  // Compute best/avg excluding rejected AND suppliers with no delivery coverage
  // (without delivery there's no true landed price — only raw — so exclude from comparisons)
  const considered = [...row.prices.entries()].filter(([sid]) => {
    const cell = row.cellOverrides.get(sid);
    const col = columnRoles.get(sid);
    if (cell === 'rejected' || (cell == null && col === 'rejected')) return false;
    const b = row.bundles.get(sid);
    return !!b?.has_any_delivery;
  });
  const prices = considered.map(([, p]) => p);
  const best = prices.length ? Math.min(...prices) : null;
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

  const selOverlay = isSelected ? <div className="absolute inset-0 bg-primary/10 pointer-events-none" /> : null;
  const stickyBase = 'sticky z-10 border-r bg-background';

  return (
    <tr className="border-b group">
      {/* Checkbox */}
      <td
        className={cn(stickyBase)}
        style={{ left: offsets.chk, width: widths.chk, minWidth: widths.chk, maxWidth: widths.chk }}
      >
        {selOverlay}
        <div className="absolute inset-0 bg-transparent group-hover:bg-muted/40 pointer-events-none" />
        <div className="relative flex items-center justify-center py-1.5">
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} aria-label="Select row" />
        </div>
      </td>

      {/* Material */}
      <td
        className={cn(stickyBase, 'align-top')}
        style={{ left: offsets.name, width: widths.name, minWidth: widths.name, maxWidth: widths.name }}
      >
        {selOverlay}
        <div className="absolute inset-0 bg-transparent group-hover:bg-muted/40 pointer-events-none" />
        <div className="relative px-2 py-1.5 leading-tight">
          {row.code && <div className="font-mono text-[10px] text-muted-foreground truncate">{row.code}</div>}
          <div className="text-xs font-medium truncate" title={row.name_en}>{row.name_en}</div>
          {row.name_ar && (
            <div className="text-[10px] text-muted-foreground truncate" dir="rtl" title={row.name_ar}>
              {row.name_ar}
            </div>
          )}
        </div>
      </td>

      {/* Core */}
      <td
        className={cn(stickyBase, 'text-center')}
        style={{ left: offsets.core, width: widths.core, minWidth: widths.core, maxWidth: widths.core }}
      >
        {selOverlay}
        <div className="absolute inset-0 bg-transparent group-hover:bg-muted/40 pointer-events-none" />
        <div className="relative flex items-center justify-center py-1.5">
          <Checkbox
            checked={row.is_core}
            onCheckedChange={(v) => onToggleCore(row.id, !!v)}
            aria-label="Mark as key material"
          />
        </div>
      </td>

      {/* Coverage */}
      <td
        className={cn(stickyBase, 'text-right px-2 font-mono')}
        style={{ left: offsets.cov, width: widths.cov, minWidth: widths.cov, maxWidth: widths.cov }}
      >
        {selOverlay}
        <div className="absolute inset-0 bg-transparent group-hover:bg-muted/40 pointer-events-none" />
        <span className={cn('relative text-xs', row.coverage === 0 && 'text-muted-foreground/50')}>{row.coverage}</span>
      </td>

      {/* Target */}
      <td
        className={cn(stickyBase)}
        style={{ left: offsets.target, width: widths.target, minWidth: widths.target, maxWidth: widths.target }}
      >
        <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
        {selOverlay}
        <div className="relative">
          <TargetCell
            value={row.target_price}
            locked={row.target_locked}
            best={best}
            onChangeValue={v => onUpsertTarget(row.id, { target_price: v })}
            onToggleLock={() => onUpsertTarget(row.id, { is_locked: !row.target_locked })}
          />
        </div>
      </td>

      {/* Best */}
      <td
        className={cn(stickyBase, 'text-right px-2 font-mono')}
        style={{ left: offsets.best, width: widths.best, minWidth: widths.best, maxWidth: widths.best }}
      >
        <div className="absolute inset-0 bg-emerald-500/15 pointer-events-none" />
        {selOverlay}
        <div className="relative">
          {best != null
            ? <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{best.toFixed(2)}</span>
            : <span className="text-muted-foreground">—</span>}
        </div>
      </td>

      {/* Avg */}
      <td
        className={cn(stickyBase, 'text-right px-2 font-mono')}
        style={{ left: offsets.avg, width: widths.avg, minWidth: widths.avg, maxWidth: widths.avg }}
      >
        <div className="absolute inset-0 bg-muted pointer-events-none" />
        {selOverlay}
        <div className="relative text-muted-foreground">
          {avg != null ? avg.toFixed(2) : '—'}
        </div>
      </td>

      {/* Supplier price cells */}
      {supplierCols.map(sid => {
        const price = row.prices.get(sid);
        const rawPrice = row.rawPrices.get(sid);
        const bundle = row.bundles.get(sid);
        const cellRole = row.cellOverrides.get(sid);
        const colRole = columnRoles.get(sid);
        const effectiveRole: Role | undefined = cellRole ?? colRole;
        const isRejected = effectiveRole === 'rejected';
        if (isRejected && !showRejected) {
          return <td key={sid} className="border-r bg-muted/20" />;
        }
        const isBest = price != null && best != null && price === best && !isRejected;
        const aboveTarget = price != null && row.target_price != null && price > row.target_price && !isRejected;
        return (
          <td
            key={sid}
            className={cn(
              'border-r p-0 text-right',
              isBest && 'bg-emerald-500/10',
              isRejected && 'bg-destructive/5',
            )}
          >
            <CellMenu
              supplierName={accountMap.get(sid) || 'Unknown'}
              price={price ?? null}
              rawPrice={rawPrice ?? null}
              bundle={bundle ?? null}
              role={cellRole}
              effectiveRole={effectiveRole}
              isRejected={isRejected}
              aboveTarget={aboveTarget}
              onSetRole={(r) => onSetCellRole(row.id, sid, r)}
            />
          </td>
        );
      })}
    </tr>
  );
}

function CellMenu({
  supplierName, price, rawPrice, bundle, role, effectiveRole, isRejected, aboveTarget, onSetRole,
}: {
  supplierName: string;
  price: number | null;
  rawPrice: number | null;
  bundle: LandedBundle | null;
  role?: Role;
  effectiveRole?: Role;
  isRejected: boolean;
  aboveTarget: boolean;
  onSetRole: (r: Role | null) => void;
}) {
  if (price == null && !role) {
    return <div className="px-2 py-1.5 text-xs text-muted-foreground/40">—</div>;
  }
  const cfg = effectiveRole ? ROLE_CONFIG[effectiveRole] : null;
  const Icon = cfg?.icon;
  const covPct = bundle?.zone_coverage_pct ?? 0;
  const showCovChip = bundle && bundle.zones_in_area.length > 0 && covPct < 100;
  const covColor = covPct === 0
    ? 'text-destructive bg-destructive/10'
    : covPct < 70
      ? 'text-amber-700 bg-amber-500/15 dark:text-amber-400'
      : 'text-muted-foreground bg-muted';
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'w-full h-full px-2 py-1 text-xs font-mono text-right hover:bg-accent/40 relative group flex flex-col items-end gap-0',
            aboveTarget && 'text-destructive',
            isRejected && 'line-through text-muted-foreground',
          )}
        >
          <span className={cn('font-semibold leading-tight', covPct === 0 && 'text-muted-foreground/60')}>
            {price != null ? price.toFixed(2) : <span className="text-muted-foreground">—</span>}
          </span>
          {rawPrice != null && bundle && bundle.delivery_per_unit_avg > 0 && (
            <span className="text-[9px] text-muted-foreground/70 leading-none">
              raw {rawPrice.toFixed(2)}
            </span>
          )}
          {showCovChip && (
            <span className={cn('text-[8.5px] leading-none px-1 py-px rounded mt-0.5', covColor)} title={`Delivers to ${bundle!.covered_zones.length}/${bundle!.zones_in_area.length} zones in area`}>
              {covPct === 0 ? 'no delivery' : `${covPct}%`}
            </span>
          )}
          {role && Icon && (
            <span className="absolute top-0.5 left-0.5">
              <Icon className={cn('h-2.5 w-2.5', cfg?.color)} />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="end">
        <div className="px-1 py-1 border-b mb-2">
          <div className="text-xs font-medium">{supplierName}</div>
          {bundle && (
            <div className="text-[10px] text-muted-foreground mt-0.5 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
              <span>Raw unit</span><span className="text-right">{bundle.raw_unit_price.toFixed(2)}</span>
              <span>MOQ</span><span className="text-right">{bundle.moq ?? '—'}</span>
              <span>Avg delivery / unit</span><span className="text-right">{bundle.delivery_per_unit_avg.toFixed(2)}</span>
              <span className="font-semibold">Landed (avg)</span><span className="text-right font-semibold">{bundle.landed_avg.toFixed(2)}</span>
              <span>Zone coverage</span>
              <span className="text-right">{bundle.covered_zones.length}/{bundle.zones_in_area.length} ({bundle.zone_coverage_pct}%)</span>
            </div>
          )}
          {bundle && bundle.zones_in_area.length > 0 && (() => {
            const total = bundle.zones_in_area.length;
            const buckets = new Map<string, { rate: number; count: number; landed: number }>();
            for (const p of bundle.per_zone) {
              const key = p.rate_per_moq.toFixed(4);
              const existing = buckets.get(key);
              if (existing) existing.count++;
              else buckets.set(key, { rate: p.rate_per_moq, count: 1, landed: bundle.raw_unit_price + p.delivery_per_unit });
            }
            const rows = [...buckets.values()].sort((a, b) => a.rate - b.rate);
            const uncovered = bundle.uncovered_zones.length;
            return (
              <div className="mt-2 border-t pt-1">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Delivery rate breakdown</div>
                <table className="w-full text-[10px] font-mono">
                  <thead className="text-muted-foreground">
                    <tr><th className="text-left font-normal">Coverage</th><th className="text-right font-normal">Rate/MOQ</th><th className="text-right font-normal">Landed</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(b => {
                      const pct = Math.round((b.count / total) * 100);
                      return (
                        <tr key={b.rate} className="border-t border-border/40">
                          <td className="py-0.5">{pct}% <span className="text-muted-foreground">({b.count}/{total})</span></td>
                          <td className="text-right">{b.rate.toFixed(2)}</td>
                          <td className="text-right">{b.landed.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {uncovered > 0 && (
                      <tr className="border-t border-border/40 text-destructive/80">
                        <td className="py-0.5 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" />{Math.round((uncovered / total) * 100)}% <span className="text-muted-foreground">({uncovered}/{total})</span></td>
                        <td className="text-right">—</td>
                        <td className="text-right">no rate</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
        <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2" onClick={() => onSetRole('selected')}>
          <Crown className="h-3 w-3 text-emerald-600" /> Select for this material
        </button>
        <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2" onClick={() => onSetRole('quality')}>
          <ShieldCheck className="h-3 w-3 text-blue-600" /> Quality
        </button>
        <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2" onClick={() => onSetRole('backup')}>
          <Shield className="h-3 w-3 text-amber-600" /> Backup
        </button>
        <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2 text-destructive" onClick={() => onSetRole('rejected')}>
          <Ban className="h-3 w-3" /> Reject this quote
        </button>
        {role && (
          <>
            <div className="border-t my-1" />
            <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent text-destructive" onClick={() => onSetRole(null)}>
              Clear override
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SupplierHeader({
  name, role, onChange,
  quotedCount, totalMaterials, zoneCoveredCount, zonesTotal,
}: {
  name: string;
  role?: Role;
  onChange: (r: Role | null) => void;
  quotedCount?: number;
  totalMaterials?: number;
  zoneCoveredCount?: number;
  zonesTotal?: number;
}) {
  const cfg = role ? ROLE_CONFIG[role] : null;
  const Icon = cfg?.icon ?? Package;
  const zoneFull = zonesTotal && zoneCoveredCount === zonesTotal;
  const zoneNone = zonesTotal != null && zonesTotal > 0 && zoneCoveredCount === 0;
  const zoneColor = zoneNone ? 'text-destructive' : zoneFull ? 'text-emerald-600' : 'text-amber-600';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          'flex flex-col gap-0.5 hover:bg-accent/40 text-[11px] font-medium px-2 py-1.5 w-full items-end',
          role === 'rejected' && 'text-destructive line-through'
        )}>
          <div className="flex items-center gap-1">
            <Icon className={cn('h-3 w-3', cfg?.color ?? 'text-muted-foreground')} />
            <span className="truncate max-w-[110px]">{name}</span>
            <ChevronDown className="h-2.5 w-2.5 opacity-60" />
          </div>
          {(totalMaterials != null || zonesTotal != null) && (
            <div className="flex items-center gap-1.5 text-[9px] font-normal">
              {totalMaterials != null && (
                <span className="text-muted-foreground" title="Materials quoted in this domain">
                  <Package className="h-2.5 w-2.5 inline mr-0.5" />{quotedCount ?? 0}/{totalMaterials}
                </span>
              )}
              {zonesTotal != null && zonesTotal > 0 && (
                <span className={zoneColor} title="Area zones covered by supplier's default delivery rates">
                  <Truck className="h-2.5 w-2.5 inline mr-0.5" />{zoneCoveredCount ?? 0}/{zonesTotal}
                </span>
              )}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onChange('selected')}><Crown className="h-3.5 w-3.5 mr-2 text-emerald-600" />Selected</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange('quality')}><ShieldCheck className="h-3.5 w-3.5 mr-2 text-blue-600" />Quality</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange('backup')}><Shield className="h-3.5 w-3.5 mr-2 text-amber-600" />Backup</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange('rejected')} className="text-destructive">
          <Ban className="h-3.5 w-3.5 mr-2" />Reject supplier
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onChange(null)}>Clear role</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TargetCell({ value, locked, best, onChangeValue, onToggleLock }: {
  value: number | null; locked: boolean; best: number | null;
  onChangeValue: (v: number | null) => void; onToggleLock: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? '');
  const commit = () => {
    const n = draft.trim() === '' ? null : Number(draft);
    if (n != null && (isNaN(n) || n < 0)) { setEditing(false); return; }
    onChangeValue(n);
    setEditing(false);
  };
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {editing ? (
        <Input
          autoFocus
          type="number"
          min={0}
          step="0.01"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-6 text-right text-xs font-mono px-1 flex-1"
        />
      ) : (
        <button
          onClick={() => { setDraft(value?.toString() ?? ''); setEditing(true); }}
          className={cn(
            'flex-1 px-1 text-xs font-mono text-right hover:bg-accent/40 rounded',
            value == null && 'text-muted-foreground italic'
          )}
          title={value == null ? 'Click to set' : 'Click to edit'}
        >
          {value != null ? value.toFixed(2) : (best != null ? `(${best.toFixed(2)})` : 'set')}
        </button>
      )}
      <button
        onClick={onToggleLock}
        title={locked ? 'Unlock target' : 'Lock target to protect from recompute'}
        className={cn('p-0.5 rounded hover:bg-accent/60', locked ? 'text-primary' : 'text-muted-foreground/50')}
      >
        {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
      </button>
    </div>
  );
}

function RoleChips({ names, role }: { names: string[]; role: 'selected' | 'quality' | 'backup' }) {
  if (!names || names.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  const visible = names.slice(0, 2);
  const extra = names.length - visible.length;
  return (
    <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
      {visible.map(n => (
        <span key={n} className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium', cfg.bg, cfg.color)}>
          <Icon className="h-2.5 w-2.5" />
          <span className="truncate max-w-[120px]">{n}</span>
        </span>
      ))}
      {extra > 0 && <span className="text-[10px] text-muted-foreground">+{extra}</span>}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ZoneMapSelector } from '@/components/shared/ZoneMapSelector';
import {
  MapPin, Layers, CheckCircle2, AlertTriangle, CircleDot, ShieldAlert,
  ArrowUpDown, ArrowLeft, Info, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffectiveSupplier } from '@/hooks/useEffectiveSupplier';
import { useDomainReview } from '@/hooks/useDomainReview';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

/** 5-status coverage model per SSOT §8 */
type CoverageStatus = 'covered_default' | 'overridden_atom' | 'uncovered' | 'review_needed' | 'partial';

interface ZoneCoverage {
  zoneCode: string;
  status: CoverageStatus;
  domainCount: number;
  hasTarget: boolean;
  hasSupplier: boolean;
  hasAtomOverride: boolean;
  needsReview: boolean;
}

// ─── Portfolio mode: aggregated health per subcategory ───
interface SubcategoryHealth {
  id: string;
  name: string;
  totalZones: number;
  covered: number;
  partial: number;
  uncovered: number;
  review: number;
  overridden: number;
  healthPct: number;
}

function usePortfolioData() {

  return useQuery({
    queryKey: ['supply-coverage-portfolio'],
    queryFn: async () => {
      // Get all active subcategories
      const { data: subcats } = await supabase
        .from('material_subcategories')
        .select('id, name_en, category_id')
        .eq('status', 'active')
        .order('name_en');

      const catIds = [...new Set((subcats || []).map(s => s.category_id))];
      const { data: cats } = await supabase
        .from('material_categories')
        .select('id, name_en')
        .in('id', catIds);
      const catMap = new Map((cats || []).map(c => [c.id, c.name_en]));

      // Get all active domains with review status
      const { data: allDomains } = await supabase
        .from('supply_domains')
        .select('id, subcategory_id, area_id, status, review_status')
        .eq('status', 'active');

      // Get all directives
      const domainIds = (allDomains || []).map(d => d.id);
      let directiveDomainIds = new Set<string>();
      if (domainIds.length > 0) {
        const { data: directives } = await supabase
          .from('supply_domain_directives')
          .select('domain_id')
          .in('domain_id', domainIds)
          .eq('is_active', true)
          .eq('role', 'selected');
        directiveDomainIds = new Set((directives || []).map((d: any) => d.domain_id));
      }

      // Get all areas for zone counts
      const areaIds = [...new Set((allDomains || []).map(d => d.area_id))];
      let areaZoneMap = new Map<string, string[]>();
      if (areaIds.length > 0) {
        for (let i = 0; i < areaIds.length; i += 200) {
          const batch = areaIds.slice(i, i + 200);
          const { data: areas } = await supabase
            .from('subcategory_areas')
            .select('id, zone_codes')
            .in('id', batch);
          (areas || []).forEach((a: any) => areaZoneMap.set(a.id, a.zone_codes || []));
        }
      }

      // Build per-subcategory health
      const results: SubcategoryHealth[] = (subcats || []).map(sc => {
        const domains = (allDomains || []).filter(d => d.subcategory_id === sc.id);
        if (domains.length === 0) {
          return {
            id: sc.id,
            name: `${catMap.get(sc.category_id) || ''} › ${sc.name_en}`,
            totalZones: 0, covered: 0, partial: 0, uncovered: 0, review: 0, overridden: 0, healthPct: 0,
          };
        }

        // Collect unique zones for this subcategory
        const zoneSet = new Set<string>();
        domains.forEach(d => {
          const zones = areaZoneMap.get(d.area_id) || [];
          zones.forEach(z => zoneSet.add(z));
        });
        const totalZones = zoneSet.size;

        // Count domain statuses
        let covered = 0, uncovered = 0, review = 0;
        domains.forEach(d => {
          if ((d as any).review_status === 'needs_review') {
            review++;
          } else if (directiveDomainIds.has(d.id)) {
            covered++;
          } else {
            uncovered++;
          }
        });

        const healthPct = domains.length > 0 ? Math.round((covered / domains.length) * 100) : 0;

        return {
          id: sc.id,
          name: `${catMap.get(sc.category_id) || ''} › ${sc.name_en}`,
          totalZones,
          covered,
          partial: 0,
          uncovered,
          review,
          overridden: 0,
          healthPct,
        };
      })//.filter(sc => sc.totalZones > 0); // Only show subcategories with zones

      // Global stats
      const totalSubcategories = results.length;
      const totalZones = results.reduce((s, r) => s + r.totalZones, 0);
      const globalCoverage = results.length > 0
        ? Math.round(results.reduce((s, r) => s + r.healthPct, 0) / results.length)
        : 0;
      const totalReview = results.reduce((s, r) => s + r.review, 0);
      const totalUncovered = results.reduce((s, r) => s + r.uncovered, 0);

      return { subcategories: results, globalCoverage, totalReview, totalUncovered, totalSubcategories };
    },
  });
}

// ─── Focused mode coverage data (existing logic) ───
function useFocusedCoverageData(subcategoryId: string | null) {

  return useQuery({
    queryKey: ['supply-coverage-focused', subcategoryId],
    enabled: !!subcategoryId,
    queryFn: async () => {
      const { data: domains, error: domErr } = await supabase
        .from('supply_domains')
        .select('id, area_id, status, review_status')
        .eq('subcategory_id', subcategoryId!)
        .eq('status', 'active');
      if (domErr) throw domErr;

      if (!domains || domains.length === 0) return { zones: [] as ZoneCoverage[], domainCount: 0, supplierMap: new Map<string, string>() };

      const areaIds = [...new Set(domains.map(d => d.area_id))];
      const domainIds = domains.map(d => d.id);

      const reviewDomainIds = new Set(
        domains.filter((d: any) => d.review_status === 'needs_review').map(d => d.id)
      );

      const { data: areas } = await supabase
        .from('subcategory_areas' as any)
        .select('id, zone_codes')
        .in('id', areaIds);

      const areaZoneMap = new Map<string, string[]>();
      const domainAreaMap = new Map<string, string>();
      domains.forEach((d: any) => domainAreaMap.set(d.id, d.area_id));
      (areas || []).forEach((a: any) => areaZoneMap.set(a.id, a.zone_codes || []));

      const allZoneCodes = [...new Set((areas || []).flatMap((a: any) => a.zone_codes || []))];

      const { data: unitRows } = await supabase
        .from('supply_units')
        .select('id, zone_code, domain_id, target_price')
        .in('domain_id', domainIds);

      const unitIds = (unitRows || []).map((u: any) => u.id);

      // Get atom-level suppliers
      let supplierUnitIds = new Set<string>();
      let atomOverrideUnitIds = new Set<string>();
      let unitSupplierMap = new Map<string, string>(); // unit_id -> supplier_account_id
      if (unitIds.length > 0) {
        for (let i = 0; i < unitIds.length; i += 200) {
          const batch = unitIds.slice(i, i + 200);
          const { data: sups } = await supabase
            .from('supply_unit_suppliers')
            .select('supply_unit_id, role, supplier_account_id')
            .in('supply_unit_id', batch)
            .eq('role', 'selected');
          (sups || []).forEach((s: any) => {
            supplierUnitIds.add(s.supply_unit_id);
            atomOverrideUnitIds.add(s.supply_unit_id);
            unitSupplierMap.set(s.supply_unit_id, s.supplier_account_id);
          });
        }
      }

      // Domain directives
      const { data: directives } = await supabase
        .from('supply_domain_directives')
        .select('domain_id, role, supplier_account_id')
        .in('domain_id', domainIds)
        .eq('is_active', true)
        .eq('role', 'selected');

      const domainHasDirective = new Set((directives || []).map((d: any) => d.domain_id));
      const domainDirectiveSupplier = new Map<string, string>();
      (directives || []).forEach((d: any) => domainDirectiveSupplier.set(d.domain_id, d.supplier_account_id));

      // Build zone→supplier map for filtering
      const zoneSupplierMap = new Map<string, Set<string>>();
      (unitRows || []).forEach((u: any) => {
        const suppId = unitSupplierMap.get(u.id);
        if (suppId) {
          const set = zoneSupplierMap.get(u.zone_code) || new Set();
          set.add(suppId);
          zoneSupplierMap.set(u.zone_code, set);
        }
        // Also check domain directive supplier
        const dirSuppId = domainDirectiveSupplier.get(u.domain_id);
        if (dirSuppId) {
          const set = zoneSupplierMap.get(u.zone_code) || new Set();
          set.add(dirSuppId);
          zoneSupplierMap.set(u.zone_code, set);
        }
      });

      // Collect all supplier IDs for the filter dropdown
      const allSupplierIds = new Set<string>();
      zoneSupplierMap.forEach(set => set.forEach(id => allSupplierIds.add(id)));

      // Build zone→domain mapping
      const zoneDomainMap = new Map<string, Set<string>>();
      const zoneUnitMap = new Map<string, string[]>();
      (unitRows || []).forEach((u: any) => {
        const set = zoneDomainMap.get(u.zone_code) || new Set();
        set.add(u.domain_id);
        zoneDomainMap.set(u.zone_code, set);
        const list = zoneUnitMap.get(u.zone_code) || [];
        list.push(u.id);
        zoneUnitMap.set(u.zone_code, list);
      });

      // Build zone coverage with 5-status model
      const zoneCoverage: ZoneCoverage[] = allZoneCodes.map(zc => {
        const zoneUnits = (unitRows || []).filter((u: any) => u.zone_code === zc);
        const zoneUnitIdList = zoneUnitMap.get(zc) || [];
        const zoneDomains = zoneDomainMap.get(zc) || new Set<string>();
        const hasTarget = zoneUnits.some((u: any) => u.target_price != null);
        const hasSupplier = zoneUnitIdList.some(uid => supplierUnitIds.has(uid));
        const hasAtomOverride = zoneUnitIdList.some(uid => atomOverrideUnitIds.has(uid));
        const hasDomainDirective = [...zoneDomains].some(did => domainHasDirective.has(did));
        const needsReview = [...zoneDomains].some(did => reviewDomainIds.has(did));
        const domainCount = zoneDomains.size;

        let status: CoverageStatus;
        if (needsReview) status = 'review_needed';
        else if (hasAtomOverride) status = 'overridden_atom';
        else if (hasDomainDirective && hasTarget) status = 'covered_default';
        else if (hasDomainDirective || hasTarget) status = 'partial';
        else status = 'uncovered';

        return { zoneCode: zc, status, domainCount, hasTarget, hasSupplier: hasSupplier || hasDomainDirective, hasAtomOverride, needsReview };
      });

      return {
        zones: zoneCoverage,
        domainCount: domains.length,
        supplierIds: [...allSupplierIds],
        zoneSupplierMap,
      };
    },
  });
}

// ─── Supplier names lookup ───
function useSupplierNames(ids: string[]) {
  return useQuery({
    queryKey: ['supplier-names', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('accounts')
        .select('id, display_name').is('deleted_at', null)
        .in('id', ids);
      const map = new Map<string, string>();
      (data || []).forEach(a => map.set(a.id, a.display_name || a.id.slice(0, 8)));
      return map;
    },
  });
}

// ─── Materials for a subcategory ───
function useMaterialsForSubcategory(subcategoryId: string | null) {
  return useQuery({
    queryKey: ['coverage-materials', subcategoryId],
    enabled: !!subcategoryId,
    queryFn: async () => {
      const { data } = await supabase
        .from('materials')
        .select('id, name, code')
        .eq('subcategory_id', subcategoryId!)
        .eq('status', 'active')
        .order('name');
      return data || [];
    },
  });
}

const STATUS_COLORS: Record<CoverageStatus, string> = {
  covered_default: '#22c55e',
  overridden_atom: '#3b82f6',
  partial: '#f59e0b',
  uncovered: '#ef4444',
  review_needed: '#a855f7',
};

const STATUS_LABELS: Record<CoverageStatus, string> = {
  covered_default: 'Covered (Default)',
  overridden_atom: 'Overridden (Atom)',
  partial: 'Partial',
  uncovered: 'Uncovered',
  review_needed: 'Review Needed',
};

// ═══ Zone Detail Panel ═══
function ZoneDetailPanel({ zoneCode, subcategoryId, onClose }: { zoneCode: string; subcategoryId: string; onClose: () => void }) {
  const { flagForReview, clearReview } = useDomainReview();

  const { data: materials } = useQuery({
    queryKey: ['zone-panel-materials', subcategoryId],
    queryFn: async () => {
      const { data } = await supabase
        .from('materials')
        .select('id, name, code')
        .eq('subcategory_id', subcategoryId)
        .eq('status', 'active')
        .order('name', { ascending: true });
      return data || [];
    },
  });

  const { data: zoneDomains } = useQuery({
    queryKey: ['zone-panel-domains', subcategoryId, zoneCode],
    queryFn: async () => {
      const { data: domains } = await supabase
        .from('supply_domains')
        .select('id, area_id, status, review_status, review_reason')
        .eq('subcategory_id', subcategoryId)
        .eq('status', 'active');
      if (!domains) return [];

      const areaIds = [...new Set((domains as any[]).map((d: any) => d.area_id))];
      const { data: areas } = await supabase
        .from('subcategory_areas')
        .select('id, zone_codes')
        .in('id', areaIds);
      const areaHasZone = new Set(
        (areas || []).filter((a: any) => (a.zone_codes || []).includes(zoneCode)).map((a: any) => a.id)
      );
      return (domains as any[]).filter((d: any) => areaHasZone.has(d.area_id));
    },
  });

  return (
    <Sheet open onOpenChange={() => onClose()}>
      <SheetContent className="w-[400px] sm:w-[440px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Zone: {zoneCode}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)]">
          {/* Domain review flags */}
          {zoneDomains && zoneDomains.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Domain Review Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {zoneDomains.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between py-1 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      {d.review_status === 'needs_review' ? (
                        <Badge variant="destructive" className="text-[9px]">Review</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px]">OK</Badge>
                      )}
                      <span className="text-xs font-mono truncate max-w-[120px]">{d.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex gap-1">
                      {d.review_status === 'needs_review' ? (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                          onClick={() => clearReview.mutate({ domainId: d.id })} disabled={clearReview.isPending}>
                          Clear
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                          onClick={() => flagForReview.mutate({ domainId: d.id, reason: 'Manual review from coverage view' })} disabled={flagForReview.isPending}>
                          Flag
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {zoneDomains.some((d: any) => d.review_reason) && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {zoneDomains.find((d: any) => d.review_reason)?.review_reason}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Effective supplier resolution — ALL materials */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Effective Supplier Resolution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {materials?.map(mat => (
                <MaterialSupplierRow key={mat.id} materialId={mat.id} materialName={mat.name} zoneCode={zoneCode} />
              ))}
              {(!materials || materials.length === 0) && (
                <p className="text-xs text-muted-foreground">No materials in this subcategory.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MaterialSupplierRow({ materialId, materialName, zoneCode }: { materialId: string; materialName: string; zoneCode: string }) {
  const { data: result, isLoading } = useEffectiveSupplier(materialId, zoneCode);

  const { data: supplierAccount } = useQuery({
    queryKey: ['supplier-account-name', result?.supplier_account_id],
    enabled: !!result?.supplier_account_id,
    queryFn: async () => {
      const { data } = await supabase.from('accounts').select('display_name').is('deleted_at', null).eq('id', result!.supplier_account_id).single();
      return data;
    },
  });

  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0">
      <span className="text-xs font-medium truncate max-w-[160px]">{materialName}</span>
      {isLoading ? (
        <Skeleton className="h-4 w-20" />
      ) : result ? (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px]">{result.source}</Badge>
          <span className="text-xs">{supplierAccount?.display_name || '—'}</span>
          {result.landed_price != null && (
            <span className="text-xs tabular-nums text-muted-foreground">{result.landed_price.toFixed(2)}</span>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground italic">No supplier</span>
      )}
    </div>
  );
}

// ═══ Portfolio Health Table ═══
function PortfolioHealthBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 bg-border/30 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            value >= 80 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-destructive"
          )}
          style={{ width: `${Math.max(value, 2)}%` }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums w-10 text-right">{value}%</span>
    </div>
  );
}

// ═══ MAIN COMPONENT ═══
import { WipShelf } from '@/components/supply/WipShelf';

export default function CoveragePage() {
  return (
    <WipShelf
      title="Coverage — Work in Progress"
      description="Coverage analysis is paused. The new Domains page now shows material and zone coverage per supplier."
      redirectHint="Open Supply → Domains to review coverage."
    />
  );
}

function _LegacyCoveragePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'portfolio' | 'focused'>('portfolio');
  const [selectedSubcatId, setSelectedSubcatId] = useState<string>('');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  // Focused mode filters
  const [statusFilter, setStatusFilter] = useState<CoverageStatus | 'all'>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');

  // Portfolio data
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolioData();

  // Focused data
  const { data: focusedData, isLoading: focusedLoading } = useFocusedCoverageData(selectedSubcatId || null);

  // Supplier names for filter dropdown
  const { data: supplierNames } = useSupplierNames(focusedData?.supplierIds || []);

  // Subcategories for dropdown
  const subcategories = useMemo(() =>
    (portfolio?.subcategories || []).map(s => ({ id: s.id, name: s.name })),
    [portfolio]
  );

  // Enter focused mode
  const enterFocused = (subcatId: string) => {
    setSelectedSubcatId(subcatId);
    setMode('focused');
    setSelectedZone(null);
    setStatusFilter('all');
    setSupplierFilter('all');
  };

  // Back to portfolio
  const backToPortfolio = () => {
    setMode('portfolio');
    setSelectedSubcatId('');
    setSelectedZone(null);
  };

  // Filtered zones for focused mode
  const filteredZones = useMemo(() => {
    let zones = focusedData?.zones || [];

    // Status filter
    if (statusFilter !== 'all') {
      zones = zones.filter(z => z.status === statusFilter);
    }

    // Supplier filter
    if (supplierFilter !== 'all' && focusedData?.zoneSupplierMap) {
      zones = zones.filter(z => {
        const suppliers = focusedData.zoneSupplierMap.get(z.zoneCode);
        return suppliers && suppliers.has(supplierFilter);
      });
    }

    return zones;
  }, [focusedData, statusFilter, supplierFilter]);

  const coveredZoneCodes = useMemo(() => filteredZones.map(z => z.zoneCode), [filteredZones]);

  const coveredZoneColors = useMemo(() => {
    const map: Record<string, string> = {};
    filteredZones.forEach(z => { map[z.zoneCode] = STATUS_COLORS[z.status]; });
    return map;
  }, [filteredZones]);

  const stats = useMemo(() => {
    const zones = focusedData?.zones || [];
    return {
      total: zones.length,
      covered: zones.filter(z => z.status === 'covered_default').length,
      overridden: zones.filter(z => z.status === 'overridden_atom').length,
      partial: zones.filter(z => z.status === 'partial').length,
      uncovered: zones.filter(z => z.status === 'uncovered').length,
      review: zones.filter(z => z.status === 'review_needed').length,
      domains: focusedData?.domainCount || 0,
    };
  }, [focusedData]);

  return (
    <AppLayout>
      <TooltipProvider delayDuration={200}>
        <div className="space-y-6 p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mode === 'focused' && (
                <Button variant="ghost" size="sm" onClick={backToPortfolio} className="gap-1">
                  <ArrowLeft className="h-4 w-4" /> Portfolio
                </Button>
              )}
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <MapPin className="h-5 w-5" /> Supply Coverage
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {mode === 'portfolio'
                    ? 'Portfolio health across all subcategories — click a row to inspect.'
                    : `Focused view — ${subcategories.find(s => s.id === selectedSubcatId)?.name || ''}`
                  }
                </p>
              </div>
            </div>
            {mode === 'portfolio' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 bg-muted/40 px-2 py-1 rounded-md">
                    <Info className="h-3 w-3" />
                    Aggregated view — worst-case status per subcategory
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px] text-xs">
                  Portfolio mode shows aggregated coverage health. Each row reflects domain-level coverage for that subcategory. Click any row to see exact zone-level details.
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* ═══ PORTFOLIO MODE ═══ */}
          {mode === 'portfolio' && (
            <>
              {portfolioLoading ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
                  </div>
                  <Skeleton className="h-64 rounded-lg" />
                </div>
              ) : portfolio ? (
                <>
                  {/* Global KPIs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Subcategories</p>
                        <p className="text-2xl font-bold mt-1">{portfolio.totalSubcategories}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Avg. Coverage</p>
                        <p className="text-2xl font-bold mt-1">{portfolio.globalCoverage}%</p>
                      </CardContent>
                    </Card>
                    <Card className={cn(portfolio.totalUncovered > 0 && "border-destructive/30")}>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Uncovered Domains</p>
                        <p className="text-2xl font-bold mt-1 text-destructive">{portfolio.totalUncovered}</p>
                      </CardContent>
                    </Card>
                    <Card className={cn(portfolio.totalReview > 0 && "border-purple-500/30")}>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Review Flags</p>
                        <p className="text-2xl font-bold mt-1" style={{ color: '#a855f7' }}>{portfolio.totalReview}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Subcategory health table */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Subcategory Coverage Health</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {portfolio.subcategories.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">No subcategories with active domains found.</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Subcategory</TableHead>
                              <TableHead className="w-[80px] text-center">Zones</TableHead>
                              <TableHead className="w-[80px] text-center">Covered</TableHead>
                              <TableHead className="w-[80px] text-center">Uncovered</TableHead>
                              <TableHead className="w-[80px] text-center">Review</TableHead>
                              <TableHead className="w-[180px]">Health</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {portfolio.subcategories.map(sc => (
                              <TableRow
                                key={sc.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => enterFocused(sc.id)}
                              >
                                <TableCell className="font-medium text-sm">{sc.name}</TableCell>
                                <TableCell className="text-center text-sm tabular-nums">{sc.totalZones}</TableCell>
                                <TableCell className="text-center">
                                  <span className="text-sm tabular-nums" style={{ color: STATUS_COLORS.covered_default }}>{sc.covered}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  {sc.uncovered > 0 ? (
                                    <span className="text-sm tabular-nums" style={{ color: STATUS_COLORS.uncovered }}>{sc.uncovered}</span>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">0</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {sc.review > 0 ? (
                                    <Badge variant="destructive" className="text-[9px]">{sc.review}</Badge>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">0</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <PortfolioHealthBar value={sc.healthPct} />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </>
          )}

          {/* ═══ FOCUSED MODE ═══ */}
          {mode === 'focused' && (
            <>
              {/* Filters toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                <Select value={selectedSubcatId} onValueChange={(v) => { setSelectedSubcatId(v); setSelectedZone(null); setStatusFilter('all'); setSupplierFilter('all'); }}>
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Select subcategory…" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <ToggleGroup type="single" value={statusFilter} onValueChange={(v) => v && setStatusFilter(v as CoverageStatus | 'all')} className="bg-muted/40 rounded-lg p-0.5 gap-0">
                    <ToggleGroupItem value="all" className="text-[10px] px-2 h-6 rounded-md data-[state=on]:bg-card data-[state=on]:shadow-sm data-[state=on]:font-bold">All</ToggleGroupItem>
                    <ToggleGroupItem value="covered_default" className="text-[10px] px-2 h-6 rounded-md data-[state=on]:bg-card data-[state=on]:shadow-sm data-[state=on]:font-bold">Covered</ToggleGroupItem>
                    <ToggleGroupItem value="uncovered" className="text-[10px] px-2 h-6 rounded-md data-[state=on]:bg-card data-[state=on]:shadow-sm data-[state=on]:font-bold">Uncovered</ToggleGroupItem>
                    <ToggleGroupItem value="review_needed" className="text-[10px] px-2 h-6 rounded-md data-[state=on]:bg-card data-[state=on]:shadow-sm data-[state=on]:font-bold">Review</ToggleGroupItem>
                    <ToggleGroupItem value="partial" className="text-[10px] px-2 h-6 rounded-md data-[state=on]:bg-card data-[state=on]:shadow-sm data-[state=on]:font-bold">Partial</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {(focusedData?.supplierIds || []).length > 0 && (
                  <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="All Suppliers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Suppliers</SelectItem>
                      {(focusedData?.supplierIds || []).map(id => (
                        <SelectItem key={id} value={id}>
                          {supplierNames?.get(id) || id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {(statusFilter !== 'all' || supplierFilter !== 'all') && (
                  <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => { setStatusFilter('all'); setSupplierFilter('all'); }}>
                    Clear filters
                  </Button>
                )}
              </div>

              {focusedLoading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
                  </div>
                  <Skeleton className="h-[500px] rounded-lg" />
                </div>
              ) : focusedData ? (
                <>
                  {/* KPI cards — 5 statuses (always from unfiltered data) */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {([
                      { key: 'covered_default' as CoverageStatus, label: 'Covered', icon: CheckCircle2, sub: 'Domain default', count: stats.covered },
                      { key: 'overridden_atom' as CoverageStatus, label: 'Overridden', icon: ArrowUpDown, sub: 'Atom-level', count: stats.overridden },
                      { key: 'partial' as CoverageStatus, label: 'Partial', icon: AlertTriangle, sub: 'Missing target or supplier', count: stats.partial },
                      { key: 'uncovered' as CoverageStatus, label: 'Uncovered', icon: CircleDot, sub: 'No assignment', count: stats.uncovered },
                      { key: 'review_needed' as CoverageStatus, label: 'Review', icon: ShieldAlert, sub: 'Needs attention', count: stats.review },
                    ]).map(({ key, label, icon: Icon, sub, count }) => (
                      <Card key={key} className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/50",
                        statusFilter === key && "ring-2 ring-primary"
                      )} onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" style={{ color: STATUS_COLORS[key] }} />
                            <span className="text-xs text-muted-foreground">{label}</span>
                          </div>
                          <p className="text-2xl font-bold mt-1" style={{ color: STATUS_COLORS[key] }}>{count}</p>
                          <p className="text-[10px] text-muted-foreground">{sub}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Legend + counts */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    {Object.entries(STATUS_COLORS).map(([key, color]) => (
                      <span key={key} className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                        {STATUS_LABELS[key as CoverageStatus]}
                      </span>
                    ))}
                    <span className="ml-auto text-[10px]">
                      {filteredZones.length !== stats.total
                        ? `${filteredZones.length} of ${stats.total} zone(s) shown`
                        : `${stats.domains} domain(s) · ${stats.total} zone(s)`
                      }
                    </span>
                  </div>

                  {/* Map */}
                  <div className="rounded-lg border bg-card overflow-hidden">
                    <ZoneMapSelector
                      selectedZoneCodes={selectedZone ? [selectedZone] : []}
                      onSelectionChange={(codes) => {
                        if (codes.length > 0) setSelectedZone(codes[codes.length - 1]);
                      }}
                      coveredZoneCodes={coveredZoneCodes}
                      coveredZoneColors={coveredZoneColors}
                      showZoneGroups={false}
                      mapHeight="500px"
                      layout="compact"
                    />
                  </div>

                  {/* Zone detail grid */}
                  {filteredZones.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Zone Details — click a zone for supplier resolution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {filteredZones
                            .sort((a, b) => {
                              const order: Record<CoverageStatus, number> = { review_needed: 0, uncovered: 1, partial: 2, overridden_atom: 3, covered_default: 4 };
                              return order[a.status] - order[b.status];
                            })
                            .map(z => (
                              <button
                                key={z.zoneCode}
                                onClick={() => setSelectedZone(z.zoneCode)}
                                className={cn(
                                  "flex items-center justify-between rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/50",
                                  selectedZone === z.zoneCode && "ring-2 ring-primary"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[z.status] }} />
                                  <span className="text-sm font-mono">{z.zoneCode}</span>
                                </div>
                                <div className="flex gap-1">
                                  {z.hasTarget && <Badge variant="outline" className="text-[9px] px-1">T</Badge>}
                                  {z.hasSupplier && <Badge variant="outline" className="text-[9px] px-1">S</Badge>}
                                  {z.needsReview && <Badge variant="destructive" className="text-[9px] px-1">!</Badge>}
                                </div>
                              </button>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Zone detail side panel */}
                  {selectedZone && selectedSubcatId && (
                    <ZoneDetailPanel
                      zoneCode={selectedZone}
                      subcategoryId={selectedSubcatId}
                      onClose={() => setSelectedZone(null)}
                    />
                  )}
                </>
              ) : null}
            </>
          )}
        </div>
      </TooltipProvider>
    </AppLayout>
  );
}

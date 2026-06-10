import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseSpecsFromCode } from '@/lib/coding-system';

export interface DomainOverviewRow {
  id: string;
  label: string;
  subcategory_id: string;
  subcategory_name: string | null;
  area_id: string;
  area_name: string | null;
  zone_codes: string[];
  axis_value: string | null;
  material_count: number;
  suppliers_quoting: number;
  live_quotes: number;
  coverage_pct: number;
  selected_count: number;
  quality_count: number;
  backup_count: number;
  selected_names: string[];
  quality_names: string[];
  backup_names: string[];
  target_prices_set: number;
}

/**
 * Aggregates supply_domains with per-domain quote coverage stats.
 * Materials are filtered by the subcategory's `domain_axis` against each
 * domain's `axis_value` (parsed from the material `code`). When axis is null
 * on either side, all subcategory materials apply.
 */
export function useDomainsOverview() {
  return useQuery({
    queryKey: ['domains-overview-v2'],
    queryFn: async (): Promise<DomainOverviewRow[]> => {
      const [domainsRes, subcatsRes, areasRes, materialsRes, smRes, selectionsRes, targetsRes, accountsRes] = await Promise.all([
        supabase.from('supply_domains').select('*').eq('status', 'active'),
        supabase.from('material_subcategories').select('id, name_en, domain_axis, spec_definitions, variant_definitions'),
        supabase.from('subcategory_areas').select('id, name, zone_codes'),
        supabase.from('materials').select('id, code, subcategory_id').eq('status', 'active'),
        supabase.from('supplier_materials').select('material_id, supplier_account_id, status').eq('is_current', true),
        // NEW: read from supplier_selections (single source of truth)
        supabase.from('supplier_selections')
          .select('domain_id, supplier_id, role, material_code, zone_code')
          .eq('active', true),
        supabase.from('target_prices').select('scope_type, scope_id, material_id').eq('scope_type', 'area'),
        supabase.from('accounts').select('id, display_name'),
      ]);
      const errs = [domainsRes.error, subcatsRes.error, areasRes.error, materialsRes.error, smRes.error, selectionsRes.error, targetsRes.error, accountsRes.error].filter(Boolean);
      if (errs.length) throw errs[0];

      const subcatById = new Map((subcatsRes.data || []).map((s: any) => [s.id, s]));
      const areaMap = new Map((areasRes.data || []).map((a: any) => [a.id, { name: a.name, zone_codes: a.zone_codes || [] }]));

      // Materials by subcategory, with parsed axis spec cached per material
      const subcatMaterials = new Map<string, { id: string; code: string | null; axisValues: Record<string, string> }[]>();
      (materialsRes.data || []).forEach((m: any) => {
        if (!m.subcategory_id) return;
        const sc = subcatById.get(m.subcategory_id);
        const axisValues = sc ? parseSpecsFromCode(m.code, sc as any) : {};
        if (!subcatMaterials.has(m.subcategory_id)) subcatMaterials.set(m.subcategory_id, []);
        subcatMaterials.get(m.subcategory_id)!.push({ id: m.id, code: m.code, axisValues });
      });

      // group supplier_materials by material
      const quotesByMaterial = new Map<string, { supplier_account_id: string }[]>();
      (smRes.data || []).forEach((sm: any) => {
        if (!['submitted', 'under_review', 'approved'].includes(sm.status)) return;
        if (!quotesByMaterial.has(sm.material_id)) quotesByMaterial.set(sm.material_id, []);
        quotesByMaterial.get(sm.material_id)!.push({ supplier_account_id: sm.supplier_account_id });
      });

      const targetsByArea = new Map<string, Set<string>>();
      (targetsRes.data || []).forEach((t: any) => {
        if (!targetsByArea.has(t.scope_id)) targetsByArea.set(t.scope_id, new Set());
        targetsByArea.get(t.scope_id)!.add(t.material_id);
      });

      // Selections grouped by domain (column-scope = material_code IS NULL AND zone_code IS NULL)
      const selectionsByDomain = new Map<string, { supplier_account_id: string; role: string; material_id: string | null }[]>();
      (selectionsRes.data || []).forEach((s: any) => {
        if (!selectionsByDomain.has(s.domain_id)) selectionsByDomain.set(s.domain_id, []);
        selectionsByDomain.get(s.domain_id)!.push({
          supplier_account_id: s.supplier_id,
          role: s.role,
          material_id: s.material_code, // legacy field name; carries material_code now
        });
      });

      const rows: DomainOverviewRow[] = (domainsRes.data || []).map((d: any) => {
        const sc: any = subcatById.get(d.subcategory_id);
        const domainAxis: string | null = sc?.domain_axis || null;
        const allMats = subcatMaterials.get(d.subcategory_id) || [];
        const mats = (domainAxis && d.axis_value)
          ? allMats.filter(m => m.axisValues[domainAxis] === d.axis_value)
          : allMats;
        const matIds = mats.map(m => m.id);

        const area = areaMap.get(d.area_id);
        const suppliersSet = new Set<string>();
        let liveQuotes = 0;
        let coveredMaterials = 0;
        matIds.forEach(mid => {
          const qs = quotesByMaterial.get(mid) || [];
          if (qs.length > 0) coveredMaterials++;
          qs.forEach(q => suppliersSet.add(q.supplier_account_id));
          liveQuotes += qs.length;
        });
        const targets = targetsByArea.get(d.area_id) || new Set();
        const targetsForDomain = matIds.filter(m => targets.has(m)).length;
        const dirs = selectionsByDomain.get(d.id) || [];
        // Domain-scope rows only (material_code IS NULL); cell/zone scopes don't appear in list chips
        const colDirs = dirs.filter(x => x.material_id == null);
        const accountName = (id: string) => (accountsRes.data || []).find((a: any) => a.id === id)?.display_name || 'Unknown';
        const namesFor = (role: string) => [...new Set(colDirs.filter(x => x.role === role).map(x => accountName(x.supplier_account_id)))];
        const selectedNames = namesFor('selected');
        const qualityNames = namesFor('quality');
        const backupNames = namesFor('backup');

        return {
          id: d.id,
          label: d.label,
          subcategory_id: d.subcategory_id,
          subcategory_name: sc?.name_en || null,
          area_id: d.area_id,
          area_name: area?.name || null,
          zone_codes: area?.zone_codes || [],
          axis_value: d.axis_value,
          material_count: matIds.length,
          suppliers_quoting: suppliersSet.size,
          live_quotes: liveQuotes,
          coverage_pct: matIds.length ? Math.round((coveredMaterials / matIds.length) * 100) : 0,
          selected_count: selectedNames.length,
          quality_count: qualityNames.length,
          backup_count: backupNames.length,
          selected_names: selectedNames,
          quality_names: qualityNames,
          backup_names: backupNames,
          target_prices_set: targetsForDomain,
        };
      });

      rows.sort((a, b) =>
        b.live_quotes - a.live_quotes ||
        b.coverage_pct - a.coverage_pct ||
        a.label.localeCompare(b.label)
      );
      return rows;
    },
  });
}

export interface DomainDetail {
  id: string;
  label: string;
  subcategory_id: string;
  subcategory_name: string | null;
  domain_axis: string | null;
  spec_definitions: any[];
  variant_definitions: any;
  area_id: string;
  area_name: string | null;
  zone_codes: string[];
  axis_value: string | null;
}

export function useDomainDetail(domainId?: string) {
  return useQuery({
    queryKey: ['domain-detail-v2', domainId],
    enabled: !!domainId,
    queryFn: async (): Promise<DomainDetail | null> => {
      const { data: d, error } = await supabase.from('supply_domains').select('*').eq('id', domainId!).maybeSingle();
      if (error) throw error;
      if (!d) return null;
      const [{ data: sc }, { data: area }] = await Promise.all([
        supabase.from('material_subcategories')
          .select('name_en, domain_axis, spec_definitions, variant_definitions')
          .eq('id', (d as any).subcategory_id).maybeSingle(),
        supabase.from('subcategory_areas').select('name, zone_codes').eq('id', (d as any).area_id).maybeSingle(),
      ]);
      return {
        id: (d as any).id,
        label: (d as any).label,
        subcategory_id: (d as any).subcategory_id,
        subcategory_name: (sc as any)?.name_en || null,
        domain_axis: (sc as any)?.domain_axis || null,
        spec_definitions: (sc as any)?.spec_definitions || [],
        variant_definitions: (sc as any)?.variant_definitions || {},
        area_id: (d as any).area_id,
        area_name: (area as any)?.name || null,
        zone_codes: (area as any)?.zone_codes || [],
        axis_value: (d as any).axis_value,
      };
    },
  });
}

/**
 * Phase 2b — resolve UoM/MOQ defaults for a material via the cascading
 * inheritance pattern (Material → Subcategory → Category). The triggers
 * force-NULL `materials.uom` and `materials.default_moq`, so we MUST walk
 * the subcategory/category fallback for any sensible default.
 */
import { supabase } from '@/integrations/supabase/client';
import { resolveInherited } from '@/lib/resolve-inherited';

export interface MaterialDefaults {
  uom: string;
  moq: number | null;
}

const cache = new Map<string, MaterialDefaults>();

export async function resolveMaterialDefaults(materialId: string): Promise<MaterialDefaults> {
  if (cache.has(materialId)) return cache.get(materialId)!;

  const { data: m } = await supabase
    .from('materials')
    .select('id, uom, default_moq, subcategory_id')
    .eq('id', materialId)
    .maybeSingle();

  let sub: Record<string, unknown> | null = null;
  let cat: Record<string, unknown> | null = null;

  if (m?.subcategory_id) {
    const { data: s } = await supabase
      .from('material_subcategories')
      .select('id, default_uom, default_moq, category_id')
      .eq('id', m.subcategory_id)
      .maybeSingle();
    sub = (s ?? null) as Record<string, unknown> | null;

    if (s?.category_id) {
      const { data: c } = await supabase
        .from('material_categories')
        .select('id, default_uom, default_moq')
        .eq('id', s.category_id)
        .maybeSingle();
      cat = (c ?? null) as Record<string, unknown> | null;
    }
  }

  const result: MaterialDefaults = {
    uom: resolveInherited<string>('default_uom', [m as any, sub, cat], 'unit'),
    moq: resolveInherited<number | null>('default_moq', [m as any, sub, cat], null),
  };
  cache.set(materialId, result);
  return result;
}

/**
 * Supplier Selections — single source of truth.
 *
 * Writes go through `set_supplier_selection` RPC (versioned/append-only).
 * Reads use the `supplier_selections` table or the `resolve_supplier` RPC.
 *
 * The 3-level hierarchy is:
 *   Atom   (material_code + zone_code)
 *   Unit   (material_code + zone_code = NULL)
 *   Domain (material_code = NULL + zone_code = NULL)
 *
 * Roles: 'selected' | 'quality' | 'backup' | 'rejected'
 *   - 'rejected' is recorded for UX (explicit "do not use") but is NOT
 *     considered by the resolver.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SelectionRole = "selected" | "quality" | "backup" | "rejected";

export interface SupplierSelectionRow {
  id: string;
  domain_id: string;
  material_code: string | null;
  zone_code: string | null;
  supplier_id: string;
  role: SelectionRole;
  active: boolean;
  reason: string | null;
  created_at: string;
}

/** All active selections for a domain (any scope). */
export function useDomainSelections(domainId?: string) {
  return useQuery({
    queryKey: ["supplier-selections", "domain", domainId],
    enabled: !!domainId,
    queryFn: async (): Promise<SupplierSelectionRow[]> => {
      const { data, error } = await supabase
        .from("supplier_selections")
        .select("id, domain_id, material_code, zone_code, supplier_id, role, active, reason, created_at")
        .eq("domain_id", domainId!)
        .eq("active", true);
      if (error) throw error;
      return (data || []) as any;
    },
  });
}

/** Active selections across all domains (for list-view aggregation). */
export function useAllActiveSelections() {
  return useQuery({
    queryKey: ["supplier-selections", "all"],
    queryFn: async (): Promise<SupplierSelectionRow[]> => {
      const { data, error } = await supabase
        .from("supplier_selections")
        .select("id, domain_id, material_code, zone_code, supplier_id, role, active, reason, created_at")
        .eq("active", true);
      if (error) throw error;
      return (data || []) as any;
    },
  });
}

/** Write through the RPC (atomic deactivate-old + insert-new). */
export function useSetSupplierSelection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      domain_id: string;
      material_code: string | null;
      zone_code: string | null;
      supplier_id: string;
      role: SelectionRole;
      action?: "set" | "remove";
      reason?: string | null;
    }) => {
      const { error } = await supabase.rpc("set_supplier_selection" as any, {
        p_domain_id: input.domain_id,
        p_material_code: input.material_code,
        p_zone_code: input.zone_code,
        p_supplier_id: input.supplier_id,
        p_role: input.role,
        p_action: input.action || "set",
        p_reason: input.reason ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-selections"] });
      qc.invalidateQueries({ queryKey: ["domains-overview-v2"] });
    },
    onError: (e: Error) => toast.error("Selection write failed: " + e.message),
  });
}

// ── Resolver ────────────────────────────────────────────────────────

export interface ResolvedSelection {
  reason: "ok" | "not_found" | "no_domain";
  supplier_id?: string;
  role_used?: SelectionRole;
  scope_used?: "atom" | "unit" | "domain";
  was_fallback?: boolean;
  domain_id?: string;
}

export async function resolveSupplier(
  materialCode: string,
  zoneCode: string,
  role: SelectionRole = "selected",
): Promise<ResolvedSelection> {
  const { data, error } = await supabase.rpc("resolve_supplier" as any, {
    p_material_code: materialCode,
    p_zone_code: zoneCode,
    p_requested_role: role,
  } as any);
  if (error) throw error;
  return (data || { reason: "not_found" }) as ResolvedSelection;
}

/**
 * Resolve a batch of (material_code, zone_code, role) tuples in parallel.
 * Returned map keyed by material_code.
 */
export async function resolveSupplierBatch(
  items: { material_code: string; zone_code: string; role?: SelectionRole }[],
): Promise<Map<string, ResolvedSelection>> {
  const out = new Map<string, ResolvedSelection>();
  await Promise.all(
    items.map(async (it) => {
      try {
        const r = await resolveSupplier(it.material_code, it.zone_code, it.role || "selected");
        out.set(it.material_code, r);
      } catch {
        out.set(it.material_code, { reason: "not_found" });
      }
    }),
  );
  return out;
}

/** Convenience hook for a single (material_code, zone_code, role). */
export function useResolveSupplier(
  materialCode: string | undefined,
  zoneCode: string | undefined,
  role: SelectionRole = "selected",
) {
  return useQuery({
    queryKey: ["resolve-supplier", materialCode, zoneCode, role],
    enabled: !!materialCode && !!zoneCode,
    queryFn: () => resolveSupplier(materialCode!, zoneCode!, role),
  });
}

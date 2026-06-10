/**
 * Management action side effects — wired to the new `supplier_selections` model.
 *
 * - freeze / unfreeze        → toggles `suppliers.is_frozen` (resolver skips frozen)
 * - blacklist / unblacklist  → toggles `suppliers.is_blacklisted` (resolver skips)
 * - demote_to_backup         → rewrites every active non-backup selection for the
 *                              supplier to role='backup' through the
 *                              `set_supplier_selection` RPC (versioned)
 * - remove_from_unit         → removes the supplier from a specific supply unit's
 *                              (material_code, zone_code) atom and the
 *                              (material_code, NULL) unit scope, via
 *                              `set_supplier_selection` with action='remove'
 * - warning                  → audit-only
 *
 * Every action also writes a row into `supplier_actions` for audit.
 */
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SupplierActionType } from '@/hooks/useSupplierActions';

interface ActionSideEffectInput {
  supplier_account_id: string;
  action_type: SupplierActionType;
  reason?: string;
  supply_unit_id?: string; // for scoped actions
  performed_by?: string;
  issue_id?: string;
  affected_material_id?: string;
  affected_zone_code?: string;
}

async function rewriteSelectionsForSupplier(
  supplierId: string,
  mutator: (row: {
    domain_id: string;
    material_code: string | null;
    zone_code: string | null;
    role: 'selected' | 'quality' | 'backup' | 'rejected';
  }) => {
    role: 'selected' | 'quality' | 'backup' | 'rejected';
    action: 'set' | 'remove';
    reason?: string | null;
  } | null,
  predicate?: (row: {
    domain_id: string;
    material_code: string | null;
    zone_code: string | null;
    role: 'selected' | 'quality' | 'backup' | 'rejected';
  }) => boolean,
) {
  const { data, error } = await supabase
    .from('supplier_selections')
    .select('domain_id, material_code, zone_code, role')
    .eq('supplier_id', supplierId)
    .eq('active', true);
  if (error) throw error;
  const rows = (data || []) as any[];
  for (const row of rows) {
    if (predicate && !predicate(row)) continue;
    const next = mutator(row);
    if (!next) continue;
    const { error: rpcErr } = await supabase.rpc('set_supplier_selection' as any, {
      p_domain_id: row.domain_id,
      p_material_code: row.material_code,
      p_zone_code: row.zone_code,
      p_supplier_id: supplierId,
      p_role: next.role,
      p_action: next.action,
      p_reason: next.reason ?? null,
    } as any);
    if (rpcErr) throw rpcErr;
  }
}

async function applyActionSideEffects(input: ActionSideEffectInput) {
  const {
    supplier_account_id, action_type, reason,
    supply_unit_id, performed_by,
  } = input;
  const now = new Date().toISOString();

  // 1. Audit row
  const { error: actionErr } = await supabase.from('supplier_actions').insert({
    supplier_account_id,
    action_type,
    reason: reason || null,
    supply_unit_id: supply_unit_id || null,
    issue_id: input.issue_id || null,
    affected_material_id: input.affected_material_id || null,
    affected_zone_code: input.affected_zone_code || null,
    performed_by: performed_by || null,
  } as any);
  if (actionErr) throw actionErr;

  // 2. Side effects
  switch (action_type) {
    case 'freeze': {
      const { error } = await supabase.from('suppliers')
        .update({
          is_frozen: true,
          frozen_at: now,
          frozen_reason: reason || null,
        } as any)
        .eq('account_id', supplier_account_id);
      if (error) throw error;
      break;
    }
    case 'unfreeze': {
      const { error } = await supabase.from('suppliers')
        .update({
          is_frozen: false,
          frozen_at: null,
          frozen_reason: null,
        } as any)
        .eq('account_id', supplier_account_id);
      if (error) throw error;
      break;
    }
    case 'demote_to_backup': {
      await rewriteSelectionsForSupplier(
        supplier_account_id,
        () => ({ role: 'backup', action: 'set', reason: reason || 'demoted_to_backup' }),
        (row) => row.role === 'selected' || row.role === 'quality',
      );
      break;
    }
    case 'remove_from_unit': {
      // Look up the unit's (material_code, zone_code) and remove atom + unit-scope rows.
      let materialCode: string | null = input.affected_material_id ? null : null;
      let zoneCode: string | null = input.affected_zone_code || null;
      if (supply_unit_id) {
        const { data: unit, error: uErr } = await supabase
          .from('supply_units')
          .select('material_id, zone_code, materials:material_id(code)')
          .eq('id', supply_unit_id)
          .maybeSingle();
        if (uErr) throw uErr;
        materialCode = (unit as any)?.materials?.code ?? null;
        zoneCode = (unit as any)?.zone_code ?? zoneCode;
      }
      if (!materialCode) {
        // No specific unit context — nothing scoped to remove. Leave as audit-only.
        break;
      }
      await rewriteSelectionsForSupplier(
        supplier_account_id,
        (row) => ({ role: row.role, action: 'remove', reason: reason || 'removed_from_unit' }),
        (row) =>
          row.material_code === materialCode &&
          (row.zone_code === zoneCode || row.zone_code === null),
      );
      break;
    }
    case 'blacklist': {
      const { error: blErr } = await supabase.from('suppliers')
        .update({ is_blacklisted: true } as any)
        .eq('account_id', supplier_account_id);
      if (blErr) throw blErr;
      break;
    }
    case 'unblacklist': {
      const { error } = await supabase.from('suppliers')
        .update({ is_blacklisted: false } as any)
        .eq('account_id', supplier_account_id);
      if (error) throw error;
      break;
    }
    case 'warning':
      break;
  }
}

export function useManagementAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: applyActionSideEffects,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['supplier-selections'] });
      qc.invalidateQueries({ queryKey: ['supplier-actions'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['supplier-detail'] });
      qc.invalidateQueries({ queryKey: ['domains-overview-v2'] });
      qc.invalidateQueries({ queryKey: ['resolve-supplier'] });
      toast.success(`Action "${vars.action_type}" applied successfully`);
    },
    onError: (e: Error) => toast.error('Action failed: ' + e.message),
  });
}

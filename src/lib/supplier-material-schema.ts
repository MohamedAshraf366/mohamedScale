import { z } from 'zod';

export const supplierMaterialFormSchema = z.object({
  supplier_account_id: z.string().min(1, 'Supplier is required'),
  material_id: z.string().min(1, 'Material is required'),
  unit_price: z.number().nullable().optional(),
  delivery_price: z.number().nullable().optional(),
  moq: z.number().nullable().optional(),
  lead_time_days: z.number().nullable().optional(),
  price_valid_until: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export type SupplierMaterialFormData = z.infer<typeof supplierMaterialFormSchema>;

export function transformSupplierMaterialToPayload(
  data: SupplierMaterialFormData,
  actorUserId: string | null,
  staffPhone: string | null
) {
  const supplierMaterial: Record<string, unknown> = {
    supplier_account_id: data.supplier_account_id,
    material_id: data.material_id,
    status: 'submitted',
  };

  if (data.unit_price != null) supplierMaterial.unit_price = data.unit_price;
  if (data.delivery_price != null) supplierMaterial.delivery_price = data.delivery_price;
  if (data.moq != null) supplierMaterial.moq = data.moq;
  if (data.lead_time_days != null) supplierMaterial.lead_time_days = data.lead_time_days;
  if (data.price_valid_until) supplierMaterial.price_valid_until = data.price_valid_until;
  if (data.notes) supplierMaterial.notes = data.notes;

  return {
    channel: 'lovable',
    lang: 'en',
    action: 'plan',
    tool: 'add_supplier_material.v1',
    actor_user_id: actorUserId || '',
    staff_phone: staffPhone || '',
    input: {
      supplier_materials: supplierMaterial,
    },
  };
}

export function transformStatusUpdatePayload(
  id: string,
  status: string,
  actorUserId: string | null,
  staffPhone: string | null
) {
  return {
    channel: 'lovable',
    lang: 'en',
    action: 'plan',
    tool: 'update_supplier_material.v1',
    actor_user_id: actorUserId || '',
    staff_phone: staffPhone || '',
    input: {
      id,
      status,
    },
  };
}

export function transformDeletePayload(
  id: string,
  actorUserId: string | null,
  staffPhone: string | null
) {
  return {
    channel: 'lovable',
    lang: 'en',
    action: 'plan',
    tool: 'delete_supplier_material.v1',
    actor_user_id: actorUserId || '',
    staff_phone: staffPhone || '',
    input: {
      id,
    },
  };
}

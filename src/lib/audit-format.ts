/**
 * Helpers to turn raw activity_log rows into something a human can scan.
 */

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Name',
  display_name: 'Name',
  display_name_ar: 'Name (AR)',
  legal_name: 'Legal name',
  status: 'Status',
  notes: 'Notes',
  unit_price: 'Unit price',
  delivery_price: 'Delivery price',
  quantity: 'Quantity',
  moq: 'MOQ',
  uom: 'UOM',
  price_per_moq: 'Price per MOQ',
  zone_codes: 'Zones',
  is_default: 'Default rate',
  is_core: 'Core variant',
  customer_account_id: 'Customer',
  supplier_account_id: 'Supplier',
  material_id: 'Material',
  subcategory_id: 'Subcategory',
  category_id: 'Category',
  project_id: 'Project',
  opportunity_id: 'Opportunity',
  quotation_id: 'Quotation',
  order_id: 'Order',
  invoice_id: 'Invoice',
  contact_id: 'Contact',
  account_id: 'Account',
  location_id: 'Location',
  email: 'Email',
  phone: 'Phone',
  total: 'Total',
  subtotal: 'Subtotal',
  tax_total: 'Tax total',
  delivery_total: 'Delivery total',
  currency: 'Currency',
  valid_until: 'Valid until',
  est_delivery_date: 'Est. delivery',
  is_soft: 'Soft quote',
  quote_type: 'Quote type',
  version: 'Version',
  stage: 'Stage',
  priority: 'Priority',
  interest_level: 'Interest',
  lifecycle_stage: 'Lifecycle stage',
  customer_type: 'Customer type',
  payment_terms_days: 'Payment terms (days)',
  credit_limit: 'Credit limit',
};

// Fields we hide from human diffs (noise / system bookkeeping)
const HIDDEN_FIELDS = new Set([
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'deleted_at',
  'deleted_by',
  'metadata',
  'raw',
]);

export function labelField(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (value === '') return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length === 0 ? '(none)' : value.join(', ');
  if (typeof value === 'object') {
    try {
      const s = JSON.stringify(value);
      return s.length > 80 ? s.slice(0, 77) + '…' : s;
    } catch {
      return String(value);
    }
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.toLocaleString();
    } catch {}
  }
  return String(value);
}

export interface FieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

/**
 * Diff old_data vs new_data into a list of human-readable field changes.
 * Skips system/noise fields and entries where before === after.
 */
export function diffActivity(
  oldData: Record<string, any> | null | undefined,
  newData: Record<string, any> | null | undefined,
): FieldChange[] {
  const keys = new Set<string>([
    ...Object.keys(oldData ?? {}),
    ...Object.keys(newData ?? {}),
  ]);
  const changes: FieldChange[] = [];
  for (const k of keys) {
    if (HIDDEN_FIELDS.has(k)) continue;
    const a = oldData?.[k];
    const b = newData?.[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    changes.push({ field: k, label: labelField(k), before: a, after: b });
  }
  // Sort: meaningful business fields first (status / amount-like keys)
  const priority = (k: string) =>
    /status|stage|priority|total|price|amount|quantity/i.test(k) ? 0 : 1;
  changes.sort((x, y) => priority(x.field) - priority(y.field) || x.label.localeCompare(y.label));
  return changes;
}

/** Best-effort human label of the affected entity */
export function entityLabel(
  entityType: string,
  data: Record<string, any> | null | undefined,
): string | null {
  if (!data) return null;
  return (
    data.name ||
    data.display_name ||
    data.legal_name ||
    data.title ||
    data.code ||
    data.full_name ||
    data.invoice_number ||
    null
  );
}

/** A short, plain-English summary of what happened. */
export function summarizeActivity(
  action: string,
  entityType: string,
  oldData: Record<string, any> | null | undefined,
  newData: Record<string, any> | null | undefined,
): string {
  const label = entityLabel(entityType, newData ?? oldData);
  const niceTable = entityType.replace(/_/g, ' ');
  if (action === 'insert') {
    return label ? `Created ${niceTable} “${label}”` : `Created a new ${niceTable}`;
  }
  if (action === 'delete') {
    return label ? `Deleted ${niceTable} “${label}”` : `Deleted a ${niceTable}`;
  }
  if (action === 'update') {
    const changes = diffActivity(oldData, newData);
    if (changes.length === 0) return `Touched ${niceTable}${label ? ` “${label}”` : ''}`;
    if (changes.length === 1) {
      const c = changes[0];
      return `Changed ${c.label} on ${niceTable}${label ? ` “${label}”` : ''}: ${formatValue(c.before)} → ${formatValue(c.after)}`;
    }
    return `Updated ${changes.length} fields on ${niceTable}${label ? ` “${label}”` : ''}`;
  }
  return `${action} on ${niceTable}`;
}

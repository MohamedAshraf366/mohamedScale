// useOperations.ts — Upgraded with supplier confirmations, payment gates, multi-PO support

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/* ─── Re-export base types ──────────────────────────── */
export type OrderStatus = 'created' | 'confirmed' | 'in_progress' | 'delivered' | 'cancelled';
export type DeliveryStatus =
  | 'pending' | 'scheduled' | 'dispatched' | 'out_for_delivery' | 'delivered' | 'failed' | 'cancelled';
export type NotifChannel = 'whatsapp' | 'email' | 'both' | 'none';

export interface DeliveryRow {
  id: string;
  order_id: string;
  attempt_no: number;
  status: DeliveryStatus;
  scheduled_at: string | null;
  dispatched_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_plate: string | null;
  dropoff_address: string | null;
  notes: string | null;
  signed_by: string | null;
  pod_attachment_id: string | null;
  failure_reason: string | null;
  next_retry_date: string | null;
  created_at: string;
  updated_at: string;
  order_code: string | null;
  customer_name: string | null;
  preferred_channel: NotifChannel;
  events: DeliveryEvent[];
}

export interface DeliveryEvent {
  id: string;
  delivery_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  actor_name: string | null;
  created_at: string;
}

export interface TripMaterial {
  id?: string;
  trip_id?: string;
  material_id: string;
  material_name?: string;
  quantity: number;
  uom?: string;
  status: 'pending' | 'loaded' | 'delivered';
  received_at?: string | null;
}

export interface Trip {
  id: string;
  order_id: string;
  trip_number: number;
  status: 'pending' | 'loading' | 'in_transit' | 'delivered' | 'failed';
  scheduled_date: string;
  delivered_date: string | null;
  driver_id: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle_plate: string | null;
  notes?: string | null;
  materials: TripMaterial[];
  created_at: string;
  updated_at: string;
}

/* ─── SUPPLIER CONFIRMATION ─────────────────────────── */

// في useOperations.ts - تحديث الدالة

export function useConfirmPurchaseOrderBySupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      purchaseOrderId,
      orderId,
      notes,
    }: {
      purchaseOrderId: string;
      orderId: string;
      notes?: string;
    }) => {
      // 1. تحديث الـ PO
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'supplier_confirmed',
          confirmed_at: new Date().toISOString(),
          notes: notes ?? null,
        })
        .eq('id', purchaseOrderId);
      if (poError) throw poError;
      
      // 2. جلب جميع POs لهذا الـ order
      const { data: allPOs, error: fetchError } = await supabase
        .from('purchase_orders')
        .select('status')
        .eq('order_id', orderId);
      if (fetchError) throw fetchError;
      
      // 3. حساب حالة التأكيد الإجمالية
      const confirmedStatuses = ['supplier_confirmed', 'in_delivery', 'delivered', 'invoiced', 'paid'];
      const allConfirmed = allPOs?.every(po => confirmedStatuses.includes(po.status)) || false;
      const anyConfirmed = allPOs?.some(po => confirmedStatuses.includes(po.status)) || false;
      
      let supplierConfStatus = 'pending';
      let newLifecycleStage = null;
      
      if (allConfirmed) {
        supplierConfStatus = 'all_confirmed';
        newLifecycleStage = 'delivery'; // الانتقال إلى G5
      } else if (anyConfirmed) {
        supplierConfStatus = 'partial';
      }
      
      // 4. تحديث الـ order
      const updates: any = { supplier_confirmation_status: supplierConfStatus };
      if (newLifecycleStage) {
        updates.lifecycle_stage = newLifecycleStage;
      }
      
      const { error: orderError } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);
      if (orderError) throw orderError;
      
      return { success: true, supplierConfStatus, newLifecycleStage };
    },
    onSuccess: (result, vars) => {
      qc.invalidateQueries({ queryKey: ['order-detail', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['purchase-orders', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      
      if (result.supplierConfStatus === 'all_confirmed') {
        toast.success('🎉 All suppliers confirmed! Moving to delivery stage (G5 → G6)');
      } else {
        toast.success('✅ Supplier confirmed this PO');
      }
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to confirm PO'),
  });
}

/**
 * Mark a purchase order as rejected by supplier.
 */
export function useRejectPurchaseOrderBySupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      purchaseOrderId,
      orderId,
      reason,
    }: {
      purchaseOrderId: string;
      orderId: string;
      reason: string;
    }) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', purchaseOrderId);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order-detail', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['purchase-orders', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.warning('PO rejected — re-negotiation needed');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to reject PO'),
  });
}

/**
 * Close an order — validates customer has fully paid (or is partial with ops override).
 * Returns error if not paid and force=false.
 */
export function useCloseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      force = false,
      notes,
    }: {
      orderId: string;
      force?: boolean;
      notes?: string;
    }) => {
      // Check payment status first unless forced
      if (!force) {
        const { data: invoices } = await supabase
          .from('invoices')
          .select('id, total')
          .eq('order_id', orderId);

        if (invoices && invoices.length > 0) {
          const invoiceIds = invoices.map((i: any) => i.id);
          const { data: pmts } = await supabase
            .from('payments')
            .select('amount')
            .in('invoice_id', invoiceIds);

          const totalInvoiced = invoices.reduce((s: number, i: any) => s + (i.total ?? 0), 0);
          const totalPaid = (pmts ?? []).reduce((s: number, p: any) => s + (p.amount ?? 0), 0);

          if (totalPaid < totalInvoiced) {
            throw new Error(
              `Customer has not fully paid. Paid: ${totalPaid.toFixed(2)} / ${totalInvoiced.toFixed(2)} SAR. Use force close to override.`,
            );
          }
        }
      }

      const { error } = await supabase
        .from('orders')
        .update({
          lifecycle_stage: 'closed',
          status: 'delivered',
          notes: notes ? `[CLOSED] ${notes}` : undefined,
        })
        .eq('id', orderId);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order-detail', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order closed successfully');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to close order'),
  });
}

/**
 * Record a customer payment against an order.
 */
export function useRecordCustomerPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      amount,
      method,
      reference,
      notes,
    }: {
      orderId: string;
      amount: number;
      method: string;
      reference?: string;
      notes?: string;
    }) => {
      // Get or create an invoice for this order
      let invoiceId: string;
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

      if (existing) {
        invoiceId = existing.id;
      } else {
        // Get order total to create invoice
        const { data: ord } = await supabase
          .from('orders')
          .select('total, currency, customer_account_id, code')
          .eq('id', orderId)
          .single();

        const { data: inv, error: invErr } = await supabase
          .from('invoices')
          .insert({
            order_id: orderId,
            customer_account_id: ord?.customer_account_id,
            subtotal: ord?.total ?? 0,
            total: ord?.total ?? 0,
            currency: ord?.currency ?? 'SAR',
            status: 'draft',
            issued_at: new Date().toISOString(),
            due_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          })
          .select('id')
          .single();
        if (invErr) throw invErr;
        invoiceId = inv!.id;
      }

      const { error } = await supabase.from('payments').insert({
        invoice_id: invoiceId,
        amount,
        currency: 'SAR',
        method,
        reference: reference ?? null,
        paid_at: new Date().toISOString(),
        notes: notes ?? null,
      });
      if (error) throw error;

      // Update collection_status
      const { data: allPmts } = await supabase
        .from('payments')
        .select('amount')
        .eq('invoice_id', invoiceId);
      const { data: inv } = await supabase
        .from('invoices')
        .select('total')
        .eq('id', invoiceId)
        .single();
      const totalPaid = (allPmts ?? []).reduce((s: number, p: any) => s + p.amount, 0);
      const collStatus =
        totalPaid >= (inv?.total ?? 0) ? 'collected' : 'partially_collected';
      await supabase
        .from('orders')
        .update({ collection_status: collStatus })
        .eq('id', orderId);

      return { success: true };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order-detail', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Payment recorded successfully');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to record payment'),
  });
}

/* ─── AUTO GENERATE POs PER SUPPLIER ────────────────── */
/**
 * Groups order_items by supplier_account_id and creates one PO per supplier.
 * Uses the supplier price (unit_price on order_items) NOT the customer price.
 */
export function useReleaseProcurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      // Get order
      const { data: order, error: oErr } = await supabase
        .from('orders')
        .select('id, code, status')
        .eq('id', orderId)
        .single();
      if (oErr) throw oErr;

      // Get all items grouped by supplier
      const { data: items, error: iErr } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .is('purchase_order_id', null); // only unassigned items
      if (iErr) throw iErr;
      if (!items || items.length === 0) {
        throw new Error('No unassigned order items found to create POs from');
      }

      // Group by supplier_account_id
      const supplierGroups = new Map<string, any[]>();
      items.forEach((item: any) => {
        const sid = item.supplier_account_id ?? '__no_supplier__';
        if (!supplierGroups.has(sid)) supplierGroups.set(sid, []);
        supplierGroups.get(sid)!.push(item);
      });

      const createdPOs: any[] = [];

      for (const [supplierId, groupItems] of supplierGroups.entries()) {
        if (supplierId === '__no_supplier__') continue;

        // Get supplier code for PO number
        const { data: sup } = await supabase
          .from('suppliers')
          .select('supplier_code')
          .eq('account_id', supplierId)
          .maybeSingle();

        const supplierCode = sup?.supplier_code ?? supplierId.slice(0, 8);
        const poNumber = `${order.code ?? orderId.slice(0, 8)}-${supplierCode}`;

        // Total = sum of (quantity * unit_price) — SUPPLIER prices
        const totalAmount = groupItems.reduce(
          (s, i) => s + (i.quantity ?? 0) * (i.unit_price ?? 0),
          0,
        );

        const { data: po, error: poErr } = await supabase
          .from('purchase_orders')
          .insert({
            order_id: orderId,
            supplier_id: supplierId,
            po_number: poNumber,
            po_date: new Date().toISOString().split('T')[0],
            status: 'draft',
            total_amount: totalAmount,
            currency: 'SAR',
          })
          .select()
          .single();
        if (poErr) throw poErr;

        // Link items to this PO
        await supabase
          .from('order_items')
          .update({ purchase_order_id: po.id })
          .in('id', groupItems.map((i) => i.id));

        createdPOs.push(po);
      }

      // Update order lifecycle
      await supabase
        .from('orders')
        .update({
          lifecycle_stage: 'procurement',
          procurement_status: 'in_progress',
        })
        .eq('id', orderId);

      return { created: createdPOs.length };
    },
    onSuccess: (result, vars) => {
      qc.invalidateQueries({ queryKey: ['order-detail', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['purchase-orders', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Released procurement — ${result.created} PO(s) created`);
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to release procurement'),
  });
}

/* ─── FINANCE ────────────────────────────────────────── */

export function useSupplierInvoices(orderId: string | null) {
  return useQuery({
    queryKey: ['supplier-invoices', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select(`
          *,
          purchase_orders!inner(id, po_number, order_id),
          suppliers!inner(supplier_code, accounts(display_name))
        `)
        .eq('purchase_orders.order_id', orderId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useInvoiceMatching(orderId: string | null) {
  return useQuery({
    queryKey: ['invoice-matching', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('invoice_matching')
        .select('*, supplier_invoice:supplier_invoice_id(*)')
        .eq('order_id', orderId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useCreateSupplierInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      purchaseOrderId: string;
      supplierId: string;
      invoiceNumber: string;
      invoiceDate: string;
      totalAmount: number;
      currency?: string;
    }) => {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .insert({
          purchase_order_id: params.purchaseOrderId,
          supplier_id: params.supplierId,
          invoice_number: params.invoiceNumber,
          invoice_date: params.invoiceDate,
          total_amount: params.totalAmount,
          currency: params.currency ?? 'SAR',
          status: 'pending',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-invoices'] });
      toast.success('Supplier invoice created');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to create supplier invoice'),
  });
}

export function useUpdateCollectionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({ collection_status: status })
        .eq('id', orderId);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order-detail', vars.orderId] });
      toast.success('Collection status updated');
    },
  });
}

/* ─── PURCHASE ORDERS ─────────────────────────────────── */

export function usePurchaseOrders(orderId: string | null) {
  return useQuery({
    queryKey: ['purchase-orders', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return [];
      const { data: pos, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers!inner(
            account_id, supplier_code, supplier_type, rating,
            accounts!inner(id, display_name, display_name_ar)
          )
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!pos) return [];

      return await Promise.all(
        pos.map(async (po: any) => {
          const { data: receipts } = await supabase
            .from('purchase_receipts')
            .select('*')
            .eq('purchase_order_id', po.id)
            .order('receipt_date', { ascending: false });
          const { data: items } = await supabase
            .from('order_items')
            .select('*')
            .eq('purchase_order_id', po.id);
          let deliveryRate = 0;
          if (po.suppliers?.account_id) {
            const { data: dr } = await supabase
              .from('delivery_rates')
              .select('price_per_moq')
              .eq('supplier_account_id', po.suppliers.account_id)
              .maybeSingle();
            if (dr) deliveryRate = dr.price_per_moq;
          }
          const totalReceived = (receipts ?? []).reduce(
            (s: number, r: any) => s + (r.received_quantity || 0), 0,
          );
          return {
            ...po,
            items: items ?? [],
            purchase_receipts: receipts ?? [],
            total_received: totalReceived,
            progress_percent: po.total_amount > 0 ? (totalReceived / po.total_amount) * 100 : 0,
            delivery_rate: deliveryRate,
          };
        }),
      );
    },
  });
}

export function usePurchaseReceipts(purchaseOrderId: string | null) {
  return useQuery({
    queryKey: ['purchase-receipts', purchaseOrderId],
    enabled: !!purchaseOrderId,
    queryFn: async () => {
      if (!purchaseOrderId) return [];
      const { data, error } = await supabase
        .from('purchase_receipts')
        .select('*')
        .eq('purchase_order_id', purchaseOrderId)
        .order('receipt_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      orderId: string;
      supplierId: string;
      poNumber: string;
      poDate: string;
      totalAmount: number;
      currency?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert({
          order_id: params.orderId,
          supplier_id: params.supplierId,
          po_number: params.poNumber,
          po_date: params.poDate,
          total_amount: params.totalAmount,
          currency: params.currency ?? 'SAR',
          status: 'draft',
          notes: params.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['order-detail', vars.orderId] });
      toast.success('Purchase order created');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to create PO'),
  });
}

export function useUpdatePurchaseOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      purchaseOrderId,
      orderId,
      status,
      notes,
    }: {
      purchaseOrderId: string;
      orderId: string;
      status: string;
      notes?: string;
    }) => {
      const updates: any = { status };
      if (status === 'supplier_confirmed') updates.confirmed_at = new Date().toISOString();
      if (notes) updates.notes = notes;
      const { error } = await supabase
        .from('purchase_orders')
        .update(updates)
        .eq('id', purchaseOrderId);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order-detail', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['purchase-orders', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('PO status updated');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to update PO'),
  });
}

export function useRecordPurchaseReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      purchaseOrderId: string;
      receiptDate: string;
      receivedQuantity: number;
      deliveredBy?: string;
      receivedBy?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('purchase_receipts')
        .insert({
          purchase_order_id: params.purchaseOrderId,
          receipt_date: params.receiptDate,
          received_quantity: params.receivedQuantity,
          delivered_by: params.deliveredBy ?? null,
          received_by: params.receivedBy ?? null,
          notes: params.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['order-detail'] });
      qc.invalidateQueries({ queryKey: ['purchase-receipts', vars.purchaseOrderId] });
      toast.success('Receipt recorded');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to record receipt'),
  });
}

/* ─── SUPPLIERS ──────────────────────────────────────── */

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select(`
          account_id, supplier_code, supplier_type, rating, lead_time_days,
          accounts(id, display_name, display_name_ar, legal_name)
        `)
        .order('supplier_code');
      if (error) throw error;
      return ((data ?? []) as any[]).map((s) => ({
        account_id: s.account_id,
        supplier_code: s.supplier_code,
        supplier_type: s.supplier_type,
        rating: s.rating,
        lead_time_days: s.lead_time_days,
        name: s.accounts?.display_name || s.accounts?.legal_name || s.supplier_code,
        display_name_ar: s.accounts?.display_name_ar,
      }));
    },
  });
}

export function useDomainSuppliers(domainId: string | null) {
  return useQuery({
    queryKey: ['domain-suppliers', domainId],
    enabled: !!domainId,
    queryFn: async () => {
      if (!domainId) return [];
      const { data: selections } = await supabase
        .from('supplier_selections')
        .select('supplier_id, role')
        .eq('domain_id', domainId)
        .eq('active', true)
        .in('role', ['selected', 'quality', 'backup']);
      if (!selections || selections.length === 0) return [];
      const supplierIds = selections.map((s: any) => s.supplier_id);
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('account_id, supplier_code, supplier_type, rating')
        .in('account_id', supplierIds);
      const accountIds = suppliers?.map((s: any) => s.account_id) || [];
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, display_name')
        .in('id', accountIds);
      const accountMap = new Map(accounts?.map((a: any) => [a.id, a.display_name]) || []);
      return selections.map((sel: any) => ({
        supplier_id: sel.supplier_id,
        supplier_code: suppliers?.find((s: any) => s.account_id === sel.supplier_id)?.supplier_code ?? '',
        supplier_type: suppliers?.find((s: any) => s.account_id === sel.supplier_id)?.supplier_type ?? '',
        rating: suppliers?.find((s: any) => s.account_id === sel.supplier_id)?.rating ?? 0,
        role: sel.role,
        name: accountMap.get(sel.supplier_id) || '',
      }));
    },
  });
}

/* ─── DRIVERS ────────────────────────────────────────── */

export function useDrivers() {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, full_name, phone, plate_number')
        .order('full_name');
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

/* ─── TRIPS ──────────────────────────────────────────── */

export function useOrderTrips(orderId: string | null) {
  return useQuery({
    queryKey: ['order-trips', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return [];
      const { data: trips, error } = await supabase
        .from('order_trips')
        .select(`
          *,
          driver:driver_id(id, full_name, phone),
          materials:trip_materials(id, material_id, quantity, status, received_at)
        `)
        .eq('order_id', orderId)
        .order('trip_number', { ascending: true });
      if (error) throw error;
      if (!trips || trips.length === 0) return [];

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('id, material_id, custom_name, is_custom_item, quantity, uom')
        .eq('order_id', orderId);
      const materialMap = new Map<string, { name: string; uom: string }>();
      if (orderItems && orderItems.length > 0) {
        const materialIds = orderItems
          .filter((i: any) => i.material_id && !i.is_custom_item)
          .map((i: any) => i.material_id);
        if (materialIds.length > 0) {
          const { data: mats } = await supabase
            .from('materials')
            .select('id, name_en, name, uom')
            .in('id', materialIds);
          mats?.forEach((m: any) => materialMap.set(m.id, { name: m.name_en || m.name, uom: m.uom }));
        }
        orderItems.forEach((item: any) => {
          const name = item.is_custom_item
            ? (item.custom_name || 'Custom Item')
            : materialMap.get(item.material_id)?.name || `Item ${item.material_id?.slice(0, 6)}`;
          materialMap.set(item.material_id, { name, uom: item.uom || materialMap.get(item.material_id)?.uom || 'unit' });
        });
      }
      return trips.map((t: any) => ({
        ...t,
        driver_name: t.driver?.full_name,
        driver_phone: t.driver?.phone,
        materials: (t.materials || []).map((tm: any) => ({
          ...tm,
          material_name: materialMap.get(tm.material_id)?.name || `Material ${tm.material_id?.slice(0, 6)}`,
          uom: materialMap.get(tm.material_id)?.uom || 'unit',
        })),
      })) as Trip[];
    },
  });
}

export function useMaterialRemaining(orderId: string | null) {
  return useQuery({
    queryKey: ['material-remaining', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return [];
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
      if (!orderItems || orderItems.length === 0) return [];

      const materialIds = orderItems
        .filter((i: any) => i.material_id && !i.is_custom_item)
        .map((i: any) => i.material_id);
      if (materialIds.length > 0) {
        const { data: mats } = await supabase
          .from('materials')
          .select('id, name_en, name, uom')
          .in('id', materialIds);
        const mMap = new Map(mats?.map((m: any) => [m.id, m]) || []);
        orderItems.forEach((item: any) => {
          if (item.material_id && mMap.has(item.material_id)) {
            const m = mMap.get(item.material_id);
            item.material_name = m?.name_en || m?.name;
            if (!item.uom && m?.uom) item.uom = m.uom;
          }
        });
      }

      const { data: trips } = await supabase
        .from('order_trips')
        .select('id, status, materials:trip_materials(id, material_id, quantity, status)')
        .eq('order_id', orderId);

      const delivered: Record<string, number> = {};
      (trips ?? []).forEach((trip: any) => {
        (trip.materials ?? []).forEach((tm: any) => {
          if (tm.status === 'delivered') {
            delivered[tm.material_id] = (delivered[tm.material_id] || 0) + tm.quantity;
          }
        });
      });

      return orderItems.map((item: any) => {
        const materialName = item.is_custom_item
          ? (item.custom_name || 'Custom Item')
          : (item.material_name || `Material ${item.material_id?.slice(0, 6)}`);
        const dld = delivered[item.material_id] || 0;
        const remaining = Math.max(0, (item.quantity || 0) - dld);
        return {
          material_id: item.material_id,
          material_name: materialName,
          material_code: item.material_code,
          total_ordered: item.quantity,
          total_delivered_to_customer: dld,
          remaining,
          uom: item.uom || 'unit',
          unit_price: item.unit_price,
          line_total: item.line_total,
          is_custom_item: item.is_custom_item,
        };
      }).filter((m: any) => m.remaining > 0);
    },
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      orderId: string;
      scheduledDate: string;
      driverId?: string;
      vehiclePlate?: string;
      notes?: string;
      materials: { material_id: string; quantity: number }[];
    }) => {
      const { data: existing } = await supabase
        .from('order_trips')
        .select('trip_number')
        .eq('order_id', params.orderId)
        .order('trip_number', { ascending: false })
        .limit(1);
      const nextNum = (existing?.[0]?.trip_number || 0) + 1;
      const { data: trip, error } = await supabase
        .from('order_trips')
        .insert({
          order_id: params.orderId,
          trip_number: nextNum,
          scheduled_date: params.scheduledDate,
          driver_id: params.driverId || null,
          vehicle_plate: params.vehiclePlate || null,
          notes: params.notes || null,
          status: 'pending',
        })
        .select()
        .single();
      if (error) throw error;
      const { error: tmErr } = await supabase
        .from('trip_materials')
        .insert(params.materials.map((m) => ({ trip_id: trip.id, material_id: m.material_id, quantity: m.quantity, status: 'pending' })));
      if (tmErr) throw tmErr;
      return trip;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order-trips', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['material-remaining', vars.orderId] });
      toast.success('Trip created');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to create trip'),
  });
}

export function useUpdateTripStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tripId, status, deliveredDate, orderId,
    }: { tripId: string; status: string; deliveredDate?: string; orderId: string }) => {
      const updates: any = { status };
      if (status === 'delivered' && deliveredDate) updates.delivered_date = deliveredDate;
      const { error } = await supabase.from('order_trips').update(updates).eq('id', tripId);
      if (error) throw error;
      if (status === 'delivered') {
        await supabase
          .from('trip_materials')
          .update({ status: 'delivered', received_at: new Date().toISOString() })
          .eq('trip_id', tripId);
      }
      return { success: true, orderId };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order-trips', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['material-remaining', vars.orderId] });
      toast.success('Trip status updated');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to update trip'),
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, orderId }: { tripId: string; orderId: string }) => {
      await supabase.from('trip_materials').delete().eq('trip_id', tripId);
      const { error } = await supabase.from('order_trips').delete().eq('id', tripId);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order-trips', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['material-remaining', vars.orderId] });
      toast.success('Trip deleted');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to delete trip'),
  });
}

/* ─── NOTIFICATIONS ──────────────────────────────────── */

export function useNotificationLogs(orderId: string | null) {
  return useQuery({
    queryKey: ['notif-logs', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useManualNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      orderId: string;
      deliveryId?: string;
      eventKey: string;
      channel: 'whatsapp' | 'email' | 'both';
      recipient: string;
      customBody?: string;
    }) => {
      const message = params.customBody || 'لديك تحديث جديد بخصوص طلبك';
      await supabase.from('notification_logs').insert({
        order_id: params.orderId,
        delivery_id: params.deliveryId ?? null,
        event_key: params.eventKey,
        channel: params.channel,
        recipient: params.recipient,
        rendered_body: message,
        status: 'sent',
      });
      return { success: true };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['notif-logs', vars.orderId] });
      toast.success('Notification sent');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to send notification'),
  });
}

/* ─── ORDER STATUS ───────────────────────────────────── */

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, newStatus, reason }: { orderId: string; newStatus: string; reason?: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, cancelled_reason: reason ?? null })
        .eq('id', orderId);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order-detail', vars.orderId] });
      toast.success('Order status updated');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to update status'),
  });
}

export function useTrackingToken(orderId: string | null) {
  return useQuery({
    queryKey: ['tracking-token', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return null;
      const { data } = await supabase
        .from('order_tracking_tokens')
        .select('token, expires_at')
        .eq('order_id', orderId)
        .maybeSingle();
      return data ?? null;
    },
  });
}

export function useCreateDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      orderId: string;
      scheduledAt: string;
      driverId?: string;
      dropoff?: string;
      notes?: string;
      vehiclePlate?: string;
    }) => {
      const { data: existing } = await supabase
        .from('deliveries')
        .select('attempt_no')
        .eq('order_id', params.orderId)
        .order('attempt_no', { ascending: false })
        .limit(1);
      const nextAttempt = (existing?.[0]?.attempt_no || 0) + 1;
      const { data, error } = await supabase
        .from('deliveries')
        .insert({
          order_id: params.orderId,
          attempt_no: nextAttempt,
          status: 'scheduled',
          scheduled_at: params.scheduledAt,
          driver_id: params.driverId ?? null,
          dropoff_address: params.dropoff ?? null,
          notes: params.notes ?? null,
          vehicle_plate: params.vehiclePlate ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order-deliveries', vars.orderId] });
      toast.success('Delivery scheduled');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to schedule delivery'),
  });
}

export function useUpdateDeliveryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ deliveryId, newStatus, notes }: { deliveryId: string; newStatus: string; notes?: string }) => {
      const updates: any = { status: newStatus };
      if (newStatus === 'dispatched') updates.dispatched_at = new Date().toISOString();
      if (newStatus === 'out_for_delivery') updates.out_for_delivery_at = new Date().toISOString();
      if (newStatus === 'delivered') updates.delivered_at = new Date().toISOString();
      if (newStatus === 'failed') updates.failed_at = new Date().toISOString();
      if (notes) updates.notes = notes;
      const { error } = await supabase.from('deliveries').update(updates).eq('id', deliveryId);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order-deliveries'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Delivery status updated');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to update delivery'),
  });
}

export function useOrderWithDeliveries(orderId: string | null) {
  return useQuery({
    queryKey: ['order-deliveries', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return null;
      const { data: deliveries, error } = await supabase
        .from('deliveries')
        .select('*, drivers(full_name, phone)')
        .eq('order_id', orderId)
        .order('attempt_no');
      if (error) throw error;
      return (deliveries ?? []).map((d: any) => ({
        ...d,
        driver_name: d.drivers?.full_name ?? null,
        driver_phone: d.drivers?.phone ?? null,
        events: [],
      })) as DeliveryRow[];
    },
  });
}

export function useSalesInvoices(_orderId: string | null) {
  return useQuery({
    queryKey: ['sales-invoices', _orderId],
    enabled: !!_orderId,
    queryFn: async () => [],
  });
}

export function useIssueTrackingToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, ttlDays = 30 }: { orderId: string; ttlDays?: number }) => {
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + ttlDays * 86400000).toISOString();
      await supabase.from('order_tracking_tokens').upsert({ order_id: orderId, token, expires_at: expiresAt });
      return { token, expires_at: expiresAt };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tracking-token', vars.orderId] });
      toast.success('Tracking link generated');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to generate tracking link'),
  });
}

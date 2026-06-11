// useOperations.ts — النسخة النهائية بعد التعديلات (متوافقة مع delivery_trips)

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
  trip_number: string;
  status: string;
  scheduled_date: string | null;
  delivered_date: string | null;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_plate: string | null;
  notes?: string | null;
  materials: TripMaterial[];
  created_at: string;
  updated_at: string;
}

/* ─── Helper Functions ───────────────────────────────── */

async function logGateEvent(orderId: string, gateKey: string, payload?: any, notes?: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('order_gate_events').insert({
      order_id: orderId,
      gate_key: gateKey,
      actor_id: user?.id,
      acted_at: new Date().toISOString(),
      payload: payload || {},
      notes: notes || null,
    });
  } catch (err) {
    console.error('Error logging gate event:', err);
  }
}

/* ─── SUPPLIER CONFIRMATION ─────────────────────────── */

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
        newLifecycleStage = 'delivery';
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
        toast.success('🎉 All suppliers confirmed! Moving to delivery stage');
      } else {
        toast.success('✅ Supplier confirmed this PO');
      }
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to confirm PO'),
  });
}

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
      let invoiceId: string;
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

      if (existing) {
        invoiceId = existing.id;
      } else {
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
      const collStatus = totalPaid >= (inv?.total ?? 0) ? 'collected' : 'partially_collected';
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

export function useReleaseProcurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      const { data: order, error: oErr } = await supabase
        .from('orders')
        .select('id, code, status')
        .eq('id', orderId)
        .single();
      if (oErr) throw oErr;

      const { data: items, error: iErr } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .is('purchase_order_id', null);
      if (iErr) throw iErr;
      if (!items || items.length === 0) {
        throw new Error('No unassigned order items found to create POs from');
      }

      const supplierGroups = new Map<string, any[]>();
      items.forEach((item: any) => {
        const sid = item.supplier_account_id ?? '__no_supplier__';
        if (!supplierGroups.has(sid)) supplierGroups.set(sid, []);
        supplierGroups.get(sid)!.push(item);
      });

      const createdPOs: any[] = [];

      for (const [supplierId, groupItems] of supplierGroups.entries()) {
        if (supplierId === '__no_supplier__') continue;

        const { data: sup } = await supabase
          .from('suppliers')
          .select('supplier_code')
          .eq('account_id', supplierId)
          .maybeSingle();

        const supplierCode = sup?.supplier_code ?? supplierId.slice(0, 8);
        const poNumber = `${order.code ?? orderId.slice(0, 8)}-${supplierCode}`;

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

        await supabase
          .from('order_items')
          .update({ purchase_order_id: po.id })
          .in('id', groupItems.map((i) => i.id));

        createdPOs.push(po);
      }

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
        .select('id, full_name, phone, plate_number, status')
        .eq('status', 'active')
        .order('full_name');
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

/* ─── DELIVERY TRIPS (جدول واحد) ──────────────────────── */

export function useDeliveryTrips(orderId: string | null) {
  return useQuery({
    queryKey: ['delivery-trips', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('delivery_trips')
        .select('*')
        .eq('order_id', orderId)
        .order('scheduled_date', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(trip => ({
        ...trip,
        materials: trip.materials || [],
      })) as Trip[];
    },
  });
}

export function useCreateDeliveryTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      orderId: string;
      scheduledDate: string;
      driverId?: string;
      driverName?: string;
      driverPhone?: string;
      vehiclePlate?: string;
      notes?: string;
      materials: { material_id: string; material_name: string; quantity: number; uom: string }[];
    }) => {
      const tripNumber = `TRP-${String(Date.now()).slice(-8)}`;
      
      const { data, error } = await supabase
        .from('delivery_trips')
        .insert({
          order_id: params.orderId,
          trip_number: tripNumber,
          scheduled_date: new Date(params.scheduledDate).toISOString(),
          driver_id: params.driverId || null,
          driver_name: params.driverName || null,
          driver_phone: params.driverPhone || null,
          vehicle_plate: params.vehiclePlate || null,
          notes: params.notes || null,
          status: 'scheduled',
          materials: params.materials,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['delivery-trips', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['material-remaining', vars.orderId] });
      toast.success('Trip created successfully');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to create trip'),
  });
}

export function useUpdateDeliveryTripStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tripId,
      orderId,
      status,
      deliveredDate,
      notes,
    }: {
      tripId: string;
      orderId: string;
      status: string;
      deliveredDate?: string;
      notes?: string;
    }) => {
      const updateData: any = { status };
      if (status === 'delivered' && deliveredDate) {
        updateData.delivered_date = deliveredDate;
      } else if (status === 'delivered') {
        updateData.delivered_date = new Date().toISOString();
      }
      if (notes) updateData.notes = notes;
      
      const { error } = await supabase
        .from('delivery_trips')
        .update(updateData)
        .eq('id', tripId);
      
      if (error) throw error;
      return { success: true };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['delivery-trips', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['material-remaining', vars.orderId] });
      toast.success('Trip status updated');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to update trip'),
  });
}

export function useDeleteDeliveryTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, orderId }: { tripId: string; orderId: string }) => {
      const { error } = await supabase
        .from('delivery_trips')
        .delete()
        .eq('id', tripId);
      
      if (error) throw error;
      return { success: true };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['delivery-trips', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['material-remaining', vars.orderId] });
      toast.success('Trip deleted');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to delete trip'),
  });
}

/* ─── MATERIAL REMAINING ─────────────────────────────── */

export function useMaterialRemaining(orderId: string | null) {
  return useQuery({
    queryKey: ['material-remaining', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return [];
      
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          id,
          quantity,
          uom,
          material_id,
          material:material_id (
            id,
            name,
            code,
            uom
          )
        `)
        .eq('order_id', orderId);
      
      if (itemsError) throw itemsError;
      if (!orderItems || orderItems.length === 0) return [];
      
      const { data: trips, error: tripsError } = await supabase
        .from('delivery_trips')
        .select('materials')
        .eq('order_id', orderId);
      
      if (tripsError) console.error('Trips error:', tripsError);
      
      const scheduledMap = new Map<string, number>();
      trips?.forEach(trip => {
        const materials = trip.materials as { material_id: string; quantity: number }[] || [];
        materials.forEach(m => {
          const current = scheduledMap.get(m.material_id) || 0;
          scheduledMap.set(m.material_id, current + m.quantity);
        });
      });
      
      return orderItems.map(item => {
        const totalOrdered = item.quantity || 0;
        const totalScheduled = scheduledMap.get(item.material_id) || 0;
        return {
          material_id: item.material_id,
          material_name: item.material?.name || 'Unknown Material',
          material_code: item.material?.code,
          total_ordered: totalOrdered,
          total_scheduled: totalScheduled,
          remaining: Math.max(0, totalOrdered - totalScheduled),
          uom: item.uom || item.material?.uom || 'piece',
        };
      });
    },
  });
}

/* ─── TRIPS BY ORDER & MATERIAL TRIP STATUS ──────────── */

export type TripInfo = {
  id: string;
  trip_number: string;
  status: string;
  scheduled_date: string | null;
  delivered_date: string | null;
  materials: { material_id: string; quantity: number }[];
};

export function useTripsByOrder(orderId: string) {
  return useQuery({
    queryKey: ['order-trips-summary', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_trips')
        .select('id, trip_number, status, scheduled_date, delivered_date, materials')
        .eq('order_id', orderId)
        .order('scheduled_date', { ascending: false });
      
      if (error) throw error;
      return data as TripInfo[];
    },
    enabled: !!orderId,
  });
}

export function useMaterialTripStatus(orderId: string, materialIds: string[]) {
  return useQuery({
    queryKey: ['material-trip-status', orderId, materialIds],
    queryFn: async () => {
      if (!materialIds.length) return [];
      
      const { data, error } = await supabase
        .from('delivery_trips')
        .select('id, trip_number, status, scheduled_date, materials')
        .eq('order_id', orderId);
      
      if (error) throw error;
      
      const result: { material_id: string; trips: TripInfo[] }[] = [];
      
      materialIds.forEach(materialId => {
        const relatedTrips = data?.filter(trip => {
          const materials = trip.materials as any[];
          return materials?.some(m => m.material_id === materialId);
        }).map(trip => ({
          id: trip.id,
          trip_number: trip.trip_number,
          status: trip.status,
          scheduled_date: trip.scheduled_date,
          delivered_date: trip.delivered_date,
          materials: (trip.materials as any[])?.filter(m => m.material_id === materialId) || [],
        })) || [];
        
        result.push({ material_id: materialId, trips: relatedTrips });
      });
      
      return result;
    },
    enabled: !!orderId && materialIds.length > 0,
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

/* ─── CREATE ORDER FROM ACCEPTED QUOTATION ───────────── */

export function useCreateOrderFromQuotation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (quotationId: string) => {
      const { data: quotation, error: quoteError } = await supabase
        .from('quotations')
        .select(`
          *,
          quotation_items:quotation_items (
            id,
            material_id,
            quantity,
            uom,
            unit_price,
            line_total,
            custom_name,
            custom_description,
            is_custom_item
          ),
          project:project_id (
            id,
            name,
            customer_account_id
          )
        `)
        .eq('id', quotationId)
        .single();
      
      if (quoteError) throw quoteError;
      
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          quotation_id: quotationId,
          status: 'confirmed',
          lifecycle_stage: 'quotation',
          customer_confirmed: true,
          customer_account_id: quotation.project?.customer_account_id,
          project_id: quotation.project_id,
          currency: quotation.currency || 'SAR',
          subtotal: quotation.subtotal || 0,
          delivery_total: quotation.delivery_total || 0,
          total: quotation.total || 0,
          notes: `Order created from quotation ${quotation.code || quotationId}`,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (orderError) throw orderError;
      
      if (quotation.quotation_items && quotation.quotation_items.length > 0) {
        const orderItems = quotation.quotation_items.map((item: any) => ({
          order_id: newOrder.id,
          quotation_item_id: item.id,
          material_id: item.material_id,
          quantity: item.quantity,
          uom: item.uom,
          unit_price: item.unit_price,
          line_total: item.line_total,
          is_custom_item: item.is_custom_item || !item.material_id,
          custom_name: item.custom_name,
          custom_description: item.custom_description,
        }));
        
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);
        
        if (itemsError) throw itemsError;
      }
      
      await supabase
        .from('quotations')
        .update({ status: 'converted_to_order' })
        .eq('id', quotationId);
      
      await logGateEvent(newOrder.id, 'G2', { quotation_id: quotationId });
      
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['order', newOrder.id] });
      
      toast.success(`✅ Order created from quotation`);
      
      return newOrder;
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to create order from quotation');
    },
  });
}
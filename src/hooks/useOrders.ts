import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/* ─── Types ──────────────────────────────────────────── */

export interface OrderRow {
  id: string;
  code: string | null;
  status: string;
  currency: string;
  total: number | null;
  created_at: string;
  customer_name: string | null;
  project_name: string | null;
  opportunity_id: string | null;
  lifecycle_stage: string | null;
  procurement_status: string | null;
  finance_status: string | null;
  collection_status: string | null;
  total_purchase_orders_value: number | null;
  expected_delivery_date: string | null;
  supplier_confirmation_status: 'pending' | 'partial' | 'all_confirmed' | 'rejected' | null;
  customer_confirmed: boolean;
  payment_status: 'unpaid' | 'partial' | 'paid' | null;
}

export interface ProjectLocation {
  id: string;
  address_text: string | null;
  address_link: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  country: string | null;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  po_date: string;
  expected_delivery_date: string | null;
  status: string;
  total_amount: number;
  currency: string;
  notes: string | null;
  confirmed_at: string | null;
  rejection_reason: string | null;
  /** supplier details joined from suppliers + accounts */
  supplier: {
    account_id: string;
    supplier_code: string;
    supplier_type: string;
    rating: number | null;
    name: string | null;
    display_name_ar: string | null;
  } | null;
  /** items that belong to this PO (from order_items.purchase_order_id) */
  items: PurchaseOrderItem[];
  purchase_receipts: PurchaseReceipt[];
  delivery_rate?: number;
  total_received?: number;
  progress_percent?: number;
}

export interface PurchaseOrderItem {
  id: string;
  material_id: string | null;
  material_name?: string;
  material_code?: string;
  custom_name?: string | null;
  is_custom_item: boolean;
  quantity: number;
  uom: string | null;
  unit_price: number | null;
  delivery_price: number | null;
  line_total: number | null;
}

export interface PurchaseReceipt {
  id: string;
  receipt_date: string;
  received_quantity: number;
  attachment_url: string | null;
  delivered_by: string | null;
  received_by: string | null;
  notes: string | null;
}

export interface SupplierConfirmation {
  purchase_order_id: string;
  po_number: string;
  supplier_name: string | null;
  supplier_code: string;
  status: string;
  confirmed_at: string | null;
  rejection_reason: string | null;
  total_amount: number;
  items_count: number;
}

export interface Trip {
  id: string;
  trip_number: number;
  status: 'pending' | 'loading' | 'in_transit' | 'delivered' | 'failed';
  scheduled_date: string;
  delivered_date: string | null;
  driver_id: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle_plate: string | null;
  notes: string | null;
  materials: TripMaterial[];
}

export interface TripMaterial {
  id: string;
  material_id: string;
  material_name?: string;
  quantity: number;
  uom?: string;
  status: string;
  received_at: string | null;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  paid_at: string;
  notes: string | null;
  direction: 'in' | 'out';
}

export interface OrderDetail {
  id: string;
  code: string | null;
  status: string;
  currency: string;
  subtotal: number | null;
  delivery_total: number | null;
  total: number | null;
  created_at: string;
  customer_name: string | null;
  customer_account_id: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  project_name: string | null;
  project_id: string | null;
  project_location: ProjectLocation | null;  // ✅ أضف هذا السطر
  opportunity_id: string | null;
  opportunity_name?: string | null;
  opportunity_date?: string | null;
  notes: string | null;
  lifecycle_stage: string | null;
  procurement_status: string | null;
  finance_status: string | null;
  collection_status: string | null;
  total_purchase_orders_value: number | null;
  total_supplier_invoices_value: number | null;
  total_paid_to_suppliers: number | null;
  sales_invoice_number: string | null;
  sales_invoice_amount: number | null;
  sales_invoice_date: string | null;
  expected_delivery_date: string | null;
  delivery_location: string | null;
  guard_phone: string | null;
  domain_id: string | null;
  customer_confirmed: boolean;
  supplier_confirmation_status: 'pending' | 'partial' | 'all_confirmed' | 'rejected' | null;
  payment_status: 'unpaid' | 'partial' | 'paid' | null;
  total_paid_by_customer: number;
  items: any[];
  trips: Trip[];
  deliveries: any[];
  purchase_orders: PurchaseOrder[];
  supplier_confirmations: SupplierConfirmation[];
  payments: PaymentRecord[];
  invoice_matching: any[];
}

/* ─── useOrderDetail ─────────────────────────────────── */

export function useOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: ['order-detail', orderId],
    enabled: !!orderId,
    staleTime: 30_000,
    gcTime: 60_000,
    queryFn: async () => {
      if (!orderId) return null;

      /* 1. Order base */
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order) return null;

      /* 1.1 Opportunity via quotation */
      let opportunityName: string | null = null;
      let opportunityDate: string | null = null;
      if (order.quotation_id) {
        const { data: q } = await supabase
          .from('quotations')
          .select('opportunity_id')
          .eq('id', order.quotation_id)
          .maybeSingle();
        if (q?.opportunity_id) {
          const { data: opp } = await supabase
            .from('opportunities')
            .select('title, created_at')
            .eq('id', q.opportunity_id)
            .maybeSingle();
          if (opp) { opportunityName = opp.title; opportunityDate = opp.created_at; }
        }
      }

      /* 2. Customer info */
      let customerName: string | null = null;
      let customerPhone: string | null = null;
      let customerEmail: string | null = null;
      if (order.customer_account_id) {
        const { data: ci } = await supabase
          .from('customer_list_v1')
          .select('display_name, primary_contact_name, primary_contact_phone, primary_contact_email')
          .eq('customer_account_id', order.customer_account_id)
          .maybeSingle();
        if (ci) {
          customerName = ci.display_name || ci.primary_contact_name;
          customerPhone = ci.primary_contact_phone;
          customerEmail = ci.primary_contact_email;
        }
      }

      /* 2.1 Project with location - ✅ التعديل المهم هنا */
      let projectName: string | null = null;
      let projectLocation: ProjectLocation | null = null;
      
      if (order.project_id) {
        const { data: proj } = await supabase
          .from('projects')
          .select(`
            name,
            name_ar,
            location_id,
            locations (
              id,
              address_text,
              address_link,
              lat,
              lng,
              city,
              country
            )
          `)
          .eq('id', order.project_id)
          .maybeSingle();
        
        if (proj) {
          projectName = proj.name || proj.name_ar;
          
          if (proj.locations) {
            const loc = proj.locations;
            projectLocation = {
              id: loc.id,
              address_text: loc.address_text,
              address_link: loc.address_link,
              lat: loc.lat,
              lng: loc.lng,
              city: loc.city,
              country: loc.country,
            };
          }
        }
      }

      /* 3. Order items with material names and supplier names */
      const { data: items } = await supabase
        .from('order_items')
        .select(`
          *,
          supplier:supplier_account_id (
            account_id,
            supplier_code,
            accounts!inner (
              id,
              display_name,
              display_name_ar
            )
          )
        `)
        .eq('order_id', orderId);

      if (items && items.length > 0) {
        const materialIds = items
          .filter((i: any) => i.material_id && !i.is_custom_item)
          .map((i: any) => i.material_id);
        
        if (materialIds.length > 0) {
          const { data: materials } = await supabase
            .from('materials')
            .select('id, name, name_en, name_ar, code, uom')
            .in('id', materialIds);
          const mMap = new Map(materials?.map((m: any) => [m.id, m]) || []);
          
          items.forEach((item: any) => {
            if (item.material_id && mMap.has(item.material_id)) {
              const m = mMap.get(item.material_id);
              item.material_name = m?.name_en || m?.name;
              item.material_code = m?.code;
              if (!item.uom && m?.uom) item.uom = m.uom;
            }
          });
        }
        
        items.forEach((item: any) => {
          if (item.supplier?.accounts) {
            item.supplier_name = item.supplier.accounts.display_name || item.supplier.accounts.display_name_ar;
          }
        });
      }

      /* 4. Deliveries */
      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('*, drivers(full_name, phone)')
        .eq('order_id', orderId);
      const deliveriesWithDrivers = (deliveries ?? []).map((d: any) => ({
        ...d,
        driver_name: d.drivers?.full_name ?? null,
        driver_phone: d.drivers?.phone ?? null,
      }));

      /* 5. Trips */
      const { data: trips } = await supabase
        .from('order_trips')
        .select(`
          *,
          driver:driver_id(id, full_name, phone),
          materials:trip_materials(*, material:material_id(id, name, code, uom))
        `)
        .eq('order_id', orderId)
        .order('trip_number', { ascending: true });
      const formattedTrips: Trip[] = (trips ?? []).map((t: any) => ({
        ...t,
        driver_name: t.driver?.full_name,
        driver_phone: t.driver?.phone,
        materials: (t.materials ?? []).map((tm: any) => ({
          ...tm,
          material_name: tm.material?.name,
          uom: tm.material?.uom,
        })),
      }));

      /* 6. Purchase orders with items */
      const { data: posRaw } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      const purchaseOrders: PurchaseOrder[] = await Promise.all(
        (posRaw ?? []).map(async (po: any) => {
          let supplierData: PurchaseOrder['supplier'] = null;
          if (po.supplier_id) {
            const { data: sup } = await supabase
              .from('suppliers')
              .select('account_id, supplier_code, supplier_type, rating')
              .eq('account_id', po.supplier_id)
              .maybeSingle();
            if (sup) {
              const { data: acc } = await supabase
                .from('accounts')
                .select('display_name, display_name_ar')
                .eq('id', po.supplier_id)
                .maybeSingle();
              supplierData = {
                ...sup,
                name: acc?.display_name ?? null,
                display_name_ar: acc?.display_name_ar ?? null,
              };
            }
          }

          const { data: poItems } = await supabase
            .from('order_items')
            .select('*')
            .eq('purchase_order_id', po.id);

          const { data: receipts } = await supabase
            .from('purchase_receipts')
            .select('*')
            .eq('purchase_order_id', po.id);

          let deliveryRate = 0;
          if (po.supplier_id) {
            const { data: dr } = await supabase
              .from('delivery_rates')
              .select('price_per_moq')
              .eq('supplier_account_id', po.supplier_id)
              .maybeSingle();
            if (dr) deliveryRate = dr.price_per_moq;
          }

          const totalReceived = (receipts ?? []).reduce(
            (s: number, r: any) => s + (r.received_quantity || 0), 0,
          );

          return {
            ...po,
            supplier: supplierData,
            items: poItems ?? [],
            purchase_receipts: receipts ?? [],
            total_received: totalReceived,
            progress_percent: po.total_amount > 0 ? (totalReceived / po.total_amount) * 100 : 0,
            delivery_rate: deliveryRate,
          } as PurchaseOrder;
        }),
      );

      /* 6.1 Supplier confirmations summary */
      const supplierConfirmations: SupplierConfirmation[] = purchaseOrders.map((po) => ({
        purchase_order_id: po.id,
        po_number: po.po_number,
        supplier_name: po.supplier?.name ?? null,
        supplier_code: po.supplier?.supplier_code ?? '',
        status: po.status,
        confirmed_at: po.confirmed_at ?? null,
        rejection_reason: po.rejection_reason ?? null,
        total_amount: po.total_amount,
        items_count: po.items.length,
      }));

      /* 7. Invoice matching */
      const { data: matchingData } = await supabase
        .from('invoice_matching')
        .select('*')
        .eq('order_id', orderId);

      /* 8. Payments */
      let totalPaidByCustomer = 0;
      const paymentsOut: PaymentRecord[] = [];
      const paymentsIn: PaymentRecord[] = [];

      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, total, status')
        .eq('order_id', orderId);

      if (invoices && invoices.length > 0) {
        const invoiceIds = invoices.map((inv: any) => inv.id);
        const { data: pmts } = await supabase
          .from('payments')
          .select('*')
          .in('invoice_id', invoiceIds);
        (pmts ?? []).forEach((p: any) => {
          totalPaidByCustomer += p.amount || 0;
          paymentsIn.push({ ...p, direction: 'in' } as PaymentRecord);
        });
      }

      const orderTotal = order.total ?? 0;
      let paymentStatus: OrderDetail['payment_status'] = 'unpaid';
      if (totalPaidByCustomer >= orderTotal && orderTotal > 0) paymentStatus = 'paid';
      else if (totalPaidByCustomer > 0) paymentStatus = 'partial';

      const confirmed = supplierConfirmations.filter(
        (sc) => sc.status === 'supplier_confirmed' || sc.status === 'delivered' || sc.status === 'invoiced' || sc.status === 'paid',
      ).length;
      const rejected = supplierConfirmations.some((sc) => sc.status === 'rejected');
      let supplierConfStatus: OrderDetail['supplier_confirmation_status'] = null;
      if (supplierConfirmations.length === 0) supplierConfStatus = null;
      else if (rejected) supplierConfStatus = 'rejected';
      else if (confirmed === supplierConfirmations.length) supplierConfStatus = 'all_confirmed';
      else if (confirmed > 0) supplierConfStatus = 'partial';
      else supplierConfStatus = 'pending';

      const customerConfirmed = !['created', 'cancelled'].includes(order.status);

      return {
        ...order,
        customer_name: customerName,
        project_name: projectName,
        project_location: projectLocation,  // ✅ أضف هذا السطر
        contact_phone: customerPhone,
        contact_email: customerEmail,
        opportunity_name: opportunityName,
        opportunity_date: opportunityDate,
        customer_confirmed: customerConfirmed,
        supplier_confirmation_status: supplierConfStatus,
        payment_status: paymentStatus,
        total_paid_by_customer: totalPaidByCustomer,
        items: items ?? [],
        deliveries: deliveriesWithDrivers,
        trips: formattedTrips,
        purchase_orders: purchaseOrders,
        supplier_confirmations: supplierConfirmations,
        payments: [...paymentsIn, ...paymentsOut],
        invoice_matching: matchingData ?? [],
      } as OrderDetail;
    },
  });
}

/* ─── useOrders (list) ───────────────────────────────── */

export function useOrders() {
  return useQuery<OrderRow[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!orders) return [];

      const accountIds = [...new Set(orders.map((o: any) => o.customer_account_id).filter(Boolean))] as string[];
      const accountsMap = new Map<string, string>();
      if (accountIds.length > 0) {
        const { data: accs } = await supabase.from('accounts').select('id, display_name').in('id', accountIds);
        (accs ?? []).forEach((a: any) => accountsMap.set(a.id, a.display_name));
      }

      const projectIds = [...new Set(orders.map((o: any) => o.project_id).filter(Boolean))] as string[];
      const projectsMap = new Map<string, string>();
      if (projectIds.length > 0) {
        const { data: projs } = await supabase.from('projects').select('id, name').in('id', projectIds);
        (projs ?? []).forEach((p: any) => projectsMap.set(p.id, p.name));
      }

      const quotationIds = [...new Set(orders.map((o: any) => o.quotation_id).filter(Boolean))] as string[];
      const opportunityMap = new Map<string, string>();
      if (quotationIds.length > 0) {
        const { data: quots } = await supabase.from('quotations').select('id, opportunity_id').in('id', quotationIds);
        (quots ?? []).forEach((q: any) => opportunityMap.set(q.id, q.opportunity_id));
      }

      const orderIds = orders.map((o: any) => o.id);
      const { data: allPOs } = await supabase
        .from('purchase_orders')
        .select('order_id, status')
        .in('order_id', orderIds);

      const posByOrder = new Map<string, any[]>();
      (allPOs ?? []).forEach((po: any) => {
        if (!posByOrder.has(po.order_id)) posByOrder.set(po.order_id, []);
        posByOrder.get(po.order_id)!.push(po);
      });

      const { data: allInvoices } = await supabase
        .from('invoices')
        .select('id, order_id, total')
        .in('order_id', orderIds);

      const invoicesByOrder = new Map<string, any[]>();
      (allInvoices ?? []).forEach((inv: any) => {
        if (!invoicesByOrder.has(inv.order_id)) invoicesByOrder.set(inv.order_id, []);
        invoicesByOrder.get(inv.order_id)!.push(inv);
      });

      return orders.map((order: any) => {
        const pos = posByOrder.get(order.id) ?? [];
        const confirmed = pos.filter((p) =>
          ['supplier_confirmed', 'delivered', 'invoiced', 'paid'].includes(p.status),
        ).length;
        const rejected = pos.some((p) => p.status === 'rejected');
        let supplierConfStatus: OrderRow['supplier_confirmation_status'] = null;
        if (pos.length === 0) supplierConfStatus = null;
        else if (rejected) supplierConfStatus = 'rejected';
        else if (confirmed === pos.length) supplierConfStatus = 'all_confirmed';
        else if (confirmed > 0) supplierConfStatus = 'partial';
        else supplierConfStatus = 'pending';

        const orderTotal = order.total ?? 0;
        const collStatus = order.collection_status ?? 'not_collected';
        let payStatus: OrderRow['payment_status'] = 'unpaid';
        if (collStatus === 'collected') payStatus = 'paid';
        else if (collStatus === 'partially_collected') payStatus = 'partial';

        return {
          id: order.id,
          code: order.code,
          status: order.status,
          currency: order.currency,
          total: order.total,
          created_at: order.created_at,
          customer_name: accountsMap.get(order.customer_account_id) ?? null,
          project_name: projectsMap.get(order.project_id) ?? null,
          opportunity_id: opportunityMap.get(order.quotation_id) ?? null,
          lifecycle_stage: order.lifecycle_stage ?? 'quotation',
          procurement_status: order.procurement_status ?? 'pending_purchase_orders',
          finance_status: order.finance_status ?? 'pending_invoice_matching',
          collection_status: order.collection_status ?? 'not_collected',
          total_purchase_orders_value: order.total_purchase_orders_value ?? 0,
          expected_delivery_date: order.expected_delivery_date ?? null,
          supplier_confirmation_status: supplierConfStatus,
          customer_confirmed: !['created', 'cancelled'].includes(order.status),
          payment_status: payStatus,
        } as OrderRow;
      });
    },
  });
}
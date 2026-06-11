// src/hooks/useGateLogic.ts - النسخة المعدلة (G1 خارج الـ Order)

import { useMemo } from 'react';
import { CheckCircle2, ShoppingCart, SendHorizonal, ClipboardCheck, Bell, Truck, FileCheck, ReceiptText, Award, DollarSign, CreditCard, Lock, XCircle, Clock } from 'lucide-react';

export interface PendingAction {
  gate: string;
  title: string;
  description: string;
  action: string;
  actionType: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface GateInfo {
  id: string;
  label: string;
  requirement: string;
  icon: any;
  order: number;
}

export interface ProcurementStep {
  key: string;
  label: string;
  icon: any;
  completed: boolean;
  gateId: string;
}

// ✅ ترتيب الأبواب - G1 مش موجود هنا (لأنه خارج الـ Order)
export const GATES: GateInfo[] = [
  { id: 'G2', label: 'Release Procurement', requirement: 'Order must be confirmed and have no POs', icon: ShoppingCart, order: 2 },
  { id: 'G3', label: 'Send POs', requirement: 'Purchase orders must be created and sent to suppliers', icon: SendHorizonal, order: 3 },
  { id: 'G4', label: 'Supplier Confirm', requirement: 'Each supplier must confirm their PO', icon: ClipboardCheck, order: 4 },
  { id: 'G5', label: 'Notify Customer', requirement: 'Notify customer that delivery is being arranged', icon: Bell, order: 5 },
  { id: 'G6', label: 'Dispatch/Deliver', requirement: 'Trip must be dispatched and delivered', icon: Truck, order: 6 },
  { id: 'G7', label: 'Confirm POD', requirement: 'Customer must confirm receipt with POD', icon: CheckCircle2, order: 7 },
  { id: 'G7.5', label: 'Supplier Documentation', requirement: 'Upload supplier invoices, delivery notes, and certificates', icon: FileCheck, order: 7.5 },
  { id: 'G8', label: 'Close PO', requirement: 'PO must be closed with notes and attachments', icon: ReceiptText, order: 8 },
  { id: 'G9', label: 'Fulfilled', requirement: 'Order must be marked as fulfilled', icon: Award, order: 9 },
  { id: 'G10', label: 'Supplier Payment', requirement: 'Payment to supplier must be recorded', icon: DollarSign, order: 10 },
  { id: 'G11', label: 'Customer Payment', requirement: 'Customer must pay the invoice', icon: CreditCard, order: 11 },
  { id: 'G12', label: 'Close Order', requirement: 'Order must be closed after full payment', icon: Lock, order: 12 },
];

// خطوات Procurement
export const getProcurementSteps = (order: any): ProcurementStep[] => {
  const hasPOs = order.purchase_orders?.length > 0;
  const hasSentPOs = order.purchase_orders?.some((p: any) => p.status === 'sent');
  const hasConfirmedPOs = order.purchase_orders?.some((p: any) => p.status === 'supplier_confirmed');
  const hasInDeliveryPOs = order.purchase_orders?.some((p: any) => p.status === 'in_delivery');
  const hasDeliveredPOs = order.purchase_orders?.some((p: any) => p.status === 'delivered');
  const hasInvoicedPOs = order.purchase_orders?.some((p: any) => p.status === 'invoiced');
  const hasPaidPOs = order.purchase_orders?.some((p: any) => p.status === 'paid');
  
  return [
    { key: 'create_po', label: 'Create PO', icon: ShoppingCart, completed: hasPOs, gateId: 'G2' },
    { key: 'send_po', label: 'Send to Supplier', icon: SendHorizonal, completed: hasSentPOs, gateId: 'G3' },
    { key: 'supplier_confirm', label: 'Supplier Confirm', icon: CheckCircle2, completed: hasConfirmedPOs, gateId: 'G4' },
    { key: 'in_delivery', label: 'In Delivery', icon: Truck, completed: hasInDeliveryPOs, gateId: 'G6' },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2, completed: hasDeliveredPOs, gateId: 'G6' },
    { key: 'documentation', label: 'Documentation', icon: FileCheck, completed: hasDeliveredPOs || hasInvoicedPOs, gateId: 'G7.5' },
    { key: 'invoiced', label: 'Invoiced', icon: ReceiptText, completed: hasInvoicedPOs, gateId: 'G8' },
    { key: 'paid', label: 'Paid', icon: DollarSign, completed: hasPaidPOs, gateId: 'G10' },
  ];
};

export const getProcurementProgress = (order: any): number => {
  const steps = getProcurementSteps(order);
  const completedCount = steps.filter(step => step.completed).length;
  return (completedCount / steps.length) * 100;
};

function fmtCurrency(n: number | null, cur = 'SAR') {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: cur, minimumFractionDigits: 0 }).format(n);
}

export function useGateLogic(order: any) {
  // ✅ حساب الـ current gate (يبدأ من G2)
  const currentGate = useMemo(() => {
    if (!order) return 'G2';
    if (order.status === 'cancelled') return 'cancelled';
    if (order.lifecycle_stage === 'closed') return 'closed';
    
    // ✅ أول Gate في الـ Order هو G2 (Customer confirmed outside)
    if (order.lifecycle_stage === 'quotation' && order.status === 'confirmed') return 'G2';
    
    // G3 - Send POs
    const hasAnyPO = order.purchase_orders?.length > 0;
    const hasSentPOs = order.purchase_orders?.some((p: any) => p.status === 'sent');
    
    if (hasAnyPO && !hasSentPOs && order.supplier_confirmation_status === 'pending') return 'G3';
    
    // G4 - Supplier Confirmations
    if (order.supplier_confirmation_status === 'partial') return 'G4';
    if (order.supplier_confirmation_status === 'rejected') return 'G4';
    
    // G5 - Notify Customer
    if (order.supplier_confirmation_status === 'all_confirmed') return 'G5';
    
    // G6 - Dispatch/Deliver
    const hasTrips = order.trips?.length > 0;
    const hasDeliveredTrips = order.trips?.some((t: any) => t.status === 'delivered');
    if (hasTrips && !hasDeliveredTrips) return 'G6';
    
    // G7 - Confirm POD
    const hasUnconfirmedPOD = order.trips?.some((t: any) => t.status === 'delivered' && !t.pod_confirmed);
    if (hasUnconfirmedPOD) return 'G7';
    
    // G7.5 - Supplier Documentation
    const hasDeliveredPOs = order.purchase_orders?.some((p: any) => p.status === 'delivered');
    const hasDocuments = order.purchase_orders?.some((p: any) => p.has_documents);
    if (hasDeliveredPOs && !hasDocuments) return 'G7.5';
    
    // G8 - Close PO
    const allPOsDelivered = order.purchase_orders?.every((p: any) => p.status === 'delivered');
    if (allPOsDelivered && order.purchase_orders?.length > 0) return 'G8';
    
    // G9 - Fulfilled
    if (order.lifecycle_stage === 'fulfilled') return 'G9';
    
    // G10 - Supplier Payment
    const hasSupplierPayments = order.total_paid_to_suppliers > 0;
    if (!hasSupplierPayments && order.purchase_orders?.length > 0) return 'G10';
    
    // G11 - Customer Payment
    if (order.payment_status === 'partial') return 'G11';
    
    // G12 - Close Order
    if (order.payment_status === 'paid') return 'G12';
    
    return 'G2';
  }, [order]);

  // حساب status لكل Gate
  const getGateStatus = (gateId: string): 'completed' | 'current' | 'pending' | 'in_progress' => {
    if (!order) return 'pending';
    if (currentGate === 'cancelled') return 'pending';
    if (currentGate === 'closed') {
      const gate = GATES.find(g => g.id === gateId);
      if (gate && gate.order <= 12) return 'completed';
      return 'pending';
    }
    
    const currentGateInfo = GATES.find(g => g.id === currentGate);
    const targetGateInfo = GATES.find(g => g.id === gateId);
    
    if (!currentGateInfo || !targetGateInfo) return 'pending';
    
    if (targetGateInfo.order < currentGateInfo.order) return 'completed';
    if (gateId === currentGate) return 'current';
    
    // حالات خاصة
    if (gateId === 'G7.5' && order.purchase_orders?.some((p: any) => p.status === 'delivered' || p.status === 'invoiced')) {
      return 'completed';
    }
    if (gateId === 'G5' && order.supplier_confirmation_status === 'all_confirmed') {
      return 'completed';
    }
    if (gateId === 'G8' && order.purchase_orders?.every((p: any) => p.status === 'invoiced' || p.status === 'paid')) {
      return 'completed';
    }
    if (gateId === 'G11' && order.payment_status === 'paid') {
      return 'completed';
    }
    
    return 'pending';
  };

  // حساب الـ pending action (مفيش G1)
  const getPendingAction = (): PendingAction | null => {
    if (!order) return null;
    if (order.status === 'cancelled' || order.lifecycle_stage === 'closed') return null;
    
    switch (currentGate) {
      case 'G2':
        return {
          gate: 'G2',
          title: 'Release Procurement',
          description: 'Group items by supplier and create purchase orders automatically.',
          action: 'Release Procurement',
          actionType: 'release_procurement',
          urgency: 'high',
        };
      case 'G3':
        const unsentPOs = order.purchase_orders?.filter((p: any) => p.status === 'draft').length || 0;
        return {
          gate: 'G3',
          title: `Send POs to Suppliers (${unsentPOs} pending)`,
          description: 'Send purchase orders to each supplier for confirmation.',
          action: 'Send POs',
          actionType: 'send_pos',
          urgency: 'high',
        };
      case 'G4':
        const confirmed = order.purchase_orders?.filter((p: any) => 
          ['supplier_confirmed', 'in_delivery', 'delivered', 'invoiced', 'paid'].includes(p.status)
        ).length || 0;
        const total = order.purchase_orders?.length || 0;
        const pending = total - confirmed;
        return {
          gate: 'G4',
          title: `Awaiting Supplier Confirmations (${confirmed}/${total})`,
          description: pending === 1 
            ? `${pending} supplier has not confirmed yet. Follow up now.`
            : `${pending} suppliers have not confirmed yet. Follow up now.`,
          action: pending > 0 ? `Remind ${pending} Supplier${pending > 1 ? 's' : ''}` : 'Refresh',
          actionType: 'remind_suppliers',
          urgency: 'high',
        };
      case 'G5':
        return {
          gate: 'G5',
          title: 'Notify Customer',
          description: 'All suppliers confirmed. Notify customer that delivery is being arranged.',
          action: 'Notify via WhatsApp',
          actionType: 'notify_customer',
          urgency: 'medium',
        };
      case 'G6':
        const undeliveredTrips = order.trips?.filter((t: any) => t.status !== 'delivered').length || 0;
        return {
          gate: 'G6',
          title: undeliveredTrips > 0 ? 'Trip In Progress' : 'Schedule Delivery',
          description: undeliveredTrips > 0 
            ? `${undeliveredTrips} trip(s) are in progress. Track and update status.`
            : 'Schedule a delivery trip to dispatch materials to customer.',
          action: undeliveredTrips > 0 ? 'Update Trip Status' : 'Schedule Trip',
          actionType: undeliveredTrips > 0 ? 'update_trip' : 'schedule_trip',
          urgency: 'high',
        };
      case 'G7':
        return {
          gate: 'G7',
          title: 'Confirm Receipt (POD)',
          description: 'Customer has received the delivery. Confirm Proof of Delivery.',
          action: 'Confirm POD',
          actionType: 'confirm_pod',
          urgency: 'high',
        };
      case 'G7.5':
        const missingDocs = order.purchase_orders?.filter((p: any) => 
          p.status === 'delivered' && !p.has_documents
        ).length || 0;
        return {
          gate: 'G7.5',
          title: `Supplier Documentation Required (${missingDocs} PO${missingDocs > 1 ? 's' : ''})`,
          description: 'Upload supplier invoices, delivery notes, and certificates before closing POs.',
          action: 'Upload Documents',
          actionType: 'upload_documents',
          urgency: 'medium',
        };
      case 'G8':
        const unclosedPOs = order.purchase_orders?.filter((p: any) => p.status !== 'invoiced' && p.status !== 'paid').length || 0;
        return {
          gate: 'G8',
          title: `Close Purchase Orders (${unclosedPOs} remaining)`,
          description: 'Add closing notes and attachments to finalize purchase orders.',
          action: 'Close POs',
          actionType: 'close_pos',
          urgency: 'medium',
        };
      case 'G9':
        return {
          gate: 'G9',
          title: 'Order Fulfilled',
          description: 'All materials have been delivered. Mark order as fulfilled.',
          action: 'Mark Fulfilled',
          actionType: 'mark_fulfilled',
          urgency: 'low',
        };
      case 'G10':
        return {
          gate: 'G10',
          title: 'Supplier Payment',
          description: 'Record payment to suppliers for completed POs.',
          action: 'Record Payment',
          actionType: 'supplier_payment',
          urgency: 'medium',
        };
      case 'G11':
        const balance = (order.total || 0) - (order.total_paid_by_customer || 0);
        return {
          gate: 'G11',
          title: `Customer Payment Required (${fmtCurrency(balance)} remaining)`,
          description: `Customer has paid ${fmtCurrency(order.total_paid_by_customer)} of ${fmtCurrency(order.total)}. Collect remaining payment.`,
          action: 'Record Payment',
          actionType: 'customer_payment',
          urgency: 'high',
        };
      case 'G12':
        return {
          gate: 'G12',
          title: 'Ready to Close Order',
          description: 'Customer has fully paid. Close the order to complete.',
          action: 'Close Order',
          actionType: 'close_order',
          urgency: 'medium',
        };
      default:
        return null;
    }
  };

  // حساب عدد الأبواب المكتملة والنسبة
  const completedCount = GATES.filter(g => getGateStatus(g.id) === 'completed').length;
  const progressPercent = (completedCount / GATES.length) * 100;

  return {
    currentGate,
    getGateStatus,
    getPendingAction,
    getProcurementSteps: () => getProcurementSteps(order),
    getProcurementProgress: () => getProcurementProgress(order),
    completedCount,
    progressPercent,
    gates: GATES,
  };
}
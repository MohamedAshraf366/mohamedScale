// OrderDetail.tsx - النسخة النهائية بعد جميع التعديلات

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout';
import { useOrderDetail } from '@/hooks/useOrders';
import {
  usePurchaseOrders, useCreatePurchaseOrder, useRecordPurchaseReceipt,
  useSuppliers, useDomainSuppliers, useDrivers,
  useSupplierInvoices, useInvoiceMatching, useUpdateCollectionStatus,
  useCreateSupplierInvoice, useNotificationLogs, useManualNotification,
  useUpdateOrderStatus, useOrderWithDeliveries, useCreateDelivery,
  useUpdateDeliveryStatus, useTrackingToken, useIssueTrackingToken,
  useUpdatePurchaseOrderStatus,
  useConfirmPurchaseOrderBySupplier, useRejectPurchaseOrderBySupplier,
  useReleaseProcurement, useCloseOrder, useRecordCustomerPayment,
  type DeliveryRow,
} from '@/hooks/useOperations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Alert, AlertDescription, AlertTitle,
} from '@/components/ui/alert';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowLeft, Building2, MapPin, Phone, Mail, User, Package, Truck,
  FileText, CheckCircle2, XCircle, Clock, AlertCircle, Bell, Plus,
  ChevronDown, ChevronRight, ChevronLeft,
  RefreshCw, ShoppingCart, Search,
  DollarSign, CreditCard, Lock, Unlock, AlertTriangle, Star,
  ClipboardCheck, SendHorizonal, Ban, ReceiptText, Layers, CalendarClock,
  Trash2, Eye, Upload, File, Image as ImageIcon, FileArchive,
  TrendingUp, TrendingDown, Shield, Zap, Award, Users, TruckIcon,
  Minus, Maximize2, FileCheck, Download, ExternalLink, Edit2, Save, X, Navigation,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { OrderTripsTab } from '@/components/orders/OrderTripsTab';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useGateLogic, GATES } from '@/hooks/useGateLogic';

// ============================================================
// Types
// ============================================================
interface SupplierDocument {
  id: string;
  purchase_order_id: string;
  document_type: 'invoice' | 'delivery_note' | 'packing_list' | 'certificate' | 'other';
  file_name: string;
  file_url: string;
  uploaded_at: string;
  uploaded_by: string;
  notes: string | null;
}

// ============================================================
// Constants
// ============================================================
const ORDER_STATUS: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  created:     { label: 'Created',     class: 'bg-blue-100 text-blue-700 border-blue-200',    icon: Clock },
  confirmed:   { label: 'Confirmed',   class: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  in_progress: { label: 'In Progress', class: 'bg-amber-100 text-amber-700 border-amber-200', icon: Truck },
  delivered:   { label: 'Delivered',   class: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   class: 'bg-red-100 text-red-700 border-red-200',       icon: XCircle },
};

const LIFECYCLE_CONFIG: Record<string, { label: string; color: string }> = {
  quotation:   { label: 'Quotation',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  procurement: { label: 'Procurement', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  finance:     { label: 'Finance',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  closed:      { label: 'Closed',      color: 'bg-green-100 text-green-700 border-green-200' },
};

const PO_STATUS: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  draft:              { label: 'Draft',              class: 'bg-gray-100 text-gray-600 border-gray-200',      icon: Clock },
  sent:               { label: 'Sent',               class: 'bg-blue-100 text-blue-700 border-blue-200',         icon: SendHorizonal },
  supplier_confirmed: { label: 'Confirmed', class: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected:           { label: 'Rejected',           class: 'bg-red-100 text-red-700 border-red-200',            icon: XCircle },
  in_delivery:        { label: 'In Delivery',        class: 'bg-amber-100 text-amber-700 border-amber-200',      icon: Truck },
  delivered:          { label: 'Delivered',          class: 'bg-green-100 text-green-700 border-green-200',      icon: CheckCircle2 },
  invoiced:           { label: 'Invoiced',           class: 'bg-purple-100 text-purple-700 border-purple-200',   icon: ReceiptText },
  paid:               { label: 'Paid',               class: 'bg-emerald-100 text-emerald-800 border-emerald-200',      icon: DollarSign },
  cancelled:          { label: 'Cancelled',          class: 'bg-gray-100 text-gray-500 border-gray-200',      icon: Ban },
};

const SUPPLIER_CONF_STATUS: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  pending:       { label: 'Pending', class: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  partial:       { label: 'Partial',          class: 'bg-blue-100 text-blue-700 border-blue-200',    icon: AlertCircle },
  all_confirmed: { label: 'All Confirmed',      class: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected:      { label: 'Rejected',            class: 'bg-red-100 text-red-700 border-red-200',        icon: XCircle },
};

const PAYMENT_STATUS: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  unpaid:  { label: 'Unpaid',           class: 'bg-red-100 text-red-700 border-red-200',          icon: AlertCircle },
  partial: { label: 'Partial',   class: 'bg-amber-100 text-amber-700 border-amber-200',    icon: DollarSign },
  paid:    { label: 'Paid',       class: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
};

// ============================================================
// Formatters
// ============================================================
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return format(new Date(iso), 'd MMM yyyy');
}
function fmtCurrency(n: number | null, cur = 'SAR') {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: cur, minimumFractionDigits: 0 }).format(n);
}
function fmtAgo(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

async function logGateEvent(orderId: string, gateKey: string, payload?: any, notes?: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('order_gate_events').insert({
      order_id: orderId,
      gate_key: gateKey,
      actor_id: user?.id,
      acted_at: new Date().toISOString(),
      payload: payload || {},
      notes: notes || null,
    });
    if (error) console.error('Failed to log gate event:', error);
  } catch (err) {
    console.error('Error logging gate event:', err);
  }
}

// ============================================================
// Collapsible Section Components
// ============================================================
function CollapsibleSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = false,
  badge,
  className 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={cn("shadow-sm overflow-hidden transition-all duration-200", className)}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-primary/10 rounded-lg group-hover:bg-primary/15 transition-colors">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">{title}</span>
          {badge && <div className="ml-2">{badge}</div>}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          {isOpen ? (
            <Minus className="h-4 w-4 transition-transform duration-200" />
          ) : (
            <Plus className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
          )}
        </div>
      </div>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="border-t p-4">
          {children}
        </div>
      </div>
    </Card>
  );
}

// مخصص لـ Order Journey و Next Action
function CollapsibleGateSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = false,
  className 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={cn("shadow-sm overflow-hidden transition-all duration-200", className)}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-primary/10 rounded-lg group-hover:bg-primary/15 transition-colors">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          {isOpen ? (
            <Minus className="h-4 w-4 transition-transform duration-200" />
          ) : (
            <Plus className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
          )}
        </div>
      </div>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="border-t p-4">
          {children}
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Status Badge Component
// ============================================================
function StatusBadge({ status, type, size = 'sm' }: { status: string; type: 'order' | 'po' | 'payment' | 'supplier'; size?: 'sm' | 'md' }) {
  const configs = {
    order: {
      created: { label: 'Created', class: 'bg-blue-100 text-blue-700 border-blue-200' },
      confirmed: { label: 'Confirmed', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      in_progress: { label: 'In Progress', class: 'bg-amber-100 text-amber-700 border-amber-200' },
      delivered: { label: 'Delivered', class: 'bg-green-100 text-green-700 border-green-200' },
      cancelled: { label: 'Cancelled', class: 'bg-red-100 text-red-700 border-red-200' },
    },
    po: {
      draft: { label: 'Draft', class: 'bg-gray-100 text-gray-600 border-gray-200' },
      sent: { label: 'Sent', class: 'bg-blue-100 text-blue-700 border-blue-200' },
      supplier_confirmed: { label: 'Confirmed', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      rejected: { label: 'Rejected', class: 'bg-red-100 text-red-700 border-red-200' },
      in_delivery: { label: 'In Delivery', class: 'bg-amber-100 text-amber-700 border-amber-200' },
      delivered: { label: 'Delivered', class: 'bg-green-100 text-green-700 border-green-200' },
      invoiced: { label: 'Invoiced', class: 'bg-purple-100 text-purple-700 border-purple-200' },
      paid: { label: 'Paid', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    },
    payment: {
      unpaid: { label: 'Unpaid', class: 'bg-red-100 text-red-700 border-red-200' },
      partial: { label: 'Partial', class: 'bg-amber-100 text-amber-700 border-amber-200' },
      paid: { label: 'Paid', class: 'bg-green-100 text-green-700 border-green-200' },
    },
    supplier: {
      pending: { label: 'Pending', class: 'bg-amber-100 text-amber-700 border-amber-200' },
      partial: { label: 'Partial', class: 'bg-blue-100 text-blue-700 border-blue-200' },
      all_confirmed: { label: 'All Confirmed', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      rejected: { label: 'Rejected', class: 'bg-red-100 text-red-700 border-red-200' },
    },
  };
  
  const cfg = configs[type][status] || { label: status, class: 'bg-gray-100 text-gray-600' };
  const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  
  return (
    <span className={cn("rounded-full font-medium border", sizeClass, cfg.class)}>
      {cfg.label}
    </span>
  );
}

// ============================================================
// Metric Card Component
// ============================================================
function MetricCard({ title, value, icon: Icon, trend, color }: { title: string; value: string | number; icon: React.ElementType; trend?: { value: number; label: string }; color?: string }) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-all duration-200 border-0 bg-gradient-to-br from-white to-gray-50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <Icon className={cn("h-4 w-4", color || "text-primary")} />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend.value >= 0 ? (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span className={cn("text-xs", trend.value >= 0 ? "text-emerald-600" : "text-red-600")}>
              {Math.abs(trend.value)}% {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// GateTooltip Component
// ============================================================
function GateTooltip({ gate, children }: { gate: { id: string; label: string; requirement: string }; children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs font-semibold">{gate.id} - {gate.label}</p>
          <p className="text-xs text-muted-foreground mt-1">{gate.requirement}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================
// Quick Summary Sidebar Component
// ============================================================
function QuickSummary({ order }: { order: any }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-0 top-32 z-40 bg-primary text-white p-2 rounded-l-lg shadow-md hover:bg-primary/90 transition-all group"
      >
        <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
      </button>
    );
  }
  
  return (
    <div className="fixed right-0 top-24 z-40 w-80 animate-in slide-in-from-right duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-l-xl shadow-xl border-y border-l">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-semibold">Quick Summary</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center py-1">
              <span className="text-xs text-muted-foreground">Order Total</span>
              <span className="font-bold text-primary text-base tabular-nums">{fmtCurrency(order.total, order.currency)}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between text-sm">
              <span className="text-xs text-muted-foreground">Total Items</span>
              <span className="font-medium">{order.items?.length || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-xs text-muted-foreground">Suppliers</span>
              <span className="font-medium">{order.purchase_orders?.length || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-xs text-muted-foreground">Trips Scheduled</span>
              <span className="font-medium">{order.trips?.length || 0}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-xs text-muted-foreground">Payment Status</span>
              <StatusBadge status={order.payment_status || 'unpaid'} type="payment" size="sm" />
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Order Timeline
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{fmtDate(order.created_at)}</span>
              </div>
              {order.expected_delivery_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected Delivery</span>
                  <span className="font-medium text-amber-600">{fmtDate(order.expected_delivery_date)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// GateProgress Component
// ============================================================
function GateProgress({ order, onGateChange }: { order: any; onGateChange: (gateId: string) => void }) {
  const { getGateStatus, completedCount, progressPercent, gates } = useGateLogic(order);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary">{progressPercent.toFixed(0)}%</span>
          <span className="text-xs text-muted-foreground">{completedCount}/{gates.length} Gates</span>
        </div>
        <span className="text-xs text-muted-foreground">Order Journey Progress</span>
      </div>

      <Progress value={progressPercent} className="h-2.5 bg-muted rounded-full" />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 mt-3">
        {gates.map((gate) => {
          const Icon = gate.icon;
          const status = getGateStatus(gate.id);
          const isCompleted = status === 'completed';
          const isCurrent = status === 'current';
          const isInProgress = status === 'in_progress';

          return (
            <TooltipProvider key={gate.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onGateChange(gate.id)}
                    className={cn(
                      "flex flex-col items-center p-2 rounded-xl border transition-all duration-200",
                      isCompleted
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                        : isCurrent
                        ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200 shadow-md"
                        : isInProgress
                        ? "border-purple-500 bg-purple-50 text-purple-700 ring-2 ring-purple-200 shadow-md"
                        : "border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5 mb-1",
                      isCompleted ? "text-emerald-600" : 
                      isCurrent ? "text-blue-600" : 
                      isInProgress ? "text-purple-600" : 
                      "text-gray-400"
                    )} />
                    <span className="text-xs font-semibold">{gate.id}</span>
                    <span className="text-[10px] text-center mt-0.5 leading-tight">{gate.label}</span>
                    {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 animate-pulse" />}
                    {isCompleted && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 mt-1" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs font-semibold">{gate.id} - {gate.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{gate.requirement}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// GateSelector Component
// ============================================================
function GateSelector({ order, onStatusChange }: { order: any; onStatusChange: () => void }) {
  const updateOrderStatus = useUpdateOrderStatus();
  const releaseProcurement = useReleaseProcurement();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const currentGate = (() => {
    if (order.status === 'cancelled') return 'cancelled';
    if (order.lifecycle_stage === 'closed') return 'closed';
    if (order.lifecycle_stage === 'quotation' && order.status === 'created') return 'G1';
    if (order.lifecycle_stage === 'quotation' && order.status === 'confirmed') return 'G2';
    if (order.lifecycle_stage === 'procurement') {
      if (order.supplier_confirmation_status === 'pending') return 'G3';
      if (order.supplier_confirmation_status === 'partial') return 'G4';
      if (order.supplier_confirmation_status === 'all_confirmed') return 'G5';
    }
    if (order.lifecycle_stage === 'delivery') return 'G6';
    if (order.lifecycle_stage === 'pod_pending') return 'G7';
    if (order.lifecycle_stage === 'documentation') return 'G7.5';
    if (order.lifecycle_stage === 'fulfilled') return 'G9';
    if (order.lifecycle_stage === 'finance') return 'G11';
    return 'G1';
  })();

  const gates = [
    { id: 'G1', label: 'G1 - Customer Accepted Quote', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
    { id: 'G2', label: 'G2 - Release Procurement', color: 'text-blue-600', bg: 'bg-blue-50', icon: ShoppingCart },
    { id: 'G3', label: 'G3 - Send POs to Suppliers', color: 'text-indigo-600', bg: 'bg-indigo-50', icon: SendHorizonal },
    { id: 'G4', label: 'G4 - Awaiting Supplier Confirmations', color: 'text-amber-600', bg: 'bg-amber-50', icon: ClipboardCheck },
    { id: 'G5', label: 'G5 - All Suppliers Confirmed', color: 'text-purple-600', bg: 'bg-purple-50', icon: Bell },
    { id: 'G6', label: 'G6 - Dispatch / Out / Delivered', color: 'text-orange-600', bg: 'bg-orange-50', icon: Truck },
    { id: 'G7', label: 'G7 - Confirm Receipt (POD)', color: 'text-teal-600', bg: 'bg-teal-50', icon: CheckCircle2 },
    { id: 'G7.5', label: 'G7.5 - Supplier Documentation', color: 'text-purple-600', bg: 'bg-purple-50', icon: FileCheck },
    { id: 'G8', label: 'G8 - Close PO', color: 'text-cyan-600', bg: 'bg-cyan-50', icon: ReceiptText },
    { id: 'G9', label: 'G9 - Mark Order Fulfilled', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Award },
    { id: 'G10', label: 'G10 - Record Supplier Payment', color: 'text-rose-600', bg: 'bg-rose-50', icon: DollarSign },
    { id: 'G11', label: 'G11 - Finance / Payment', color: 'text-violet-600', bg: 'bg-violet-50', icon: CreditCard },
    { id: 'G12', label: 'G12 - Close Order', color: 'text-gray-600', bg: 'bg-gray-50', icon: Lock },
    { id: 'cancelled', label: '❌ Cancelled', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
  ];

  const handleGateChange = async (gateId: string) => {
    if (gateId === 'prev' || gateId === 'next') {
      const gateIds = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G7.5', 'G8', 'G9', 'G10', 'G11', 'G12'];
      const currentIndex = gateIds.indexOf(currentGate);
      if (gateId === 'prev' && currentIndex > 0) {
        await handleGateChange(gateIds[currentIndex - 1]);
      } else if (gateId === 'next' && currentIndex < gateIds.length - 1) {
        await handleGateChange(gateIds[currentIndex + 1]);
      }
      return;
    }
    
    const gate = gates.find(g => g.id === gateId);
    if (!gate) return;
    
    setIsLoading(true);
    try {
      if (gateId === 'G1') {
        await updateOrderStatus.mutateAsync({ orderId: order.id, newStatus: 'created' });
        await logGateEvent(order.id, 'G1');
      } else if (gateId === 'G2') {
        await updateOrderStatus.mutateAsync({ orderId: order.id, newStatus: 'confirmed' });
        await releaseProcurement.mutateAsync({ orderId: order.id });
        await logGateEvent(order.id, 'G2');
      } else if (gateId === 'G7.5') {
        await supabase.from('orders').update({ lifecycle_stage: 'documentation' }).eq('id', order.id);
        await logGateEvent(order.id, 'G7.5');
      } else if (gateId === 'G11') {
        await supabase.from('orders').update({ lifecycle_stage: 'finance', status: 'delivered' }).eq('id', order.id);
        await logGateEvent(order.id, 'G11');
      } else if (gateId === 'G12') {
        await supabase.from('orders').update({ lifecycle_stage: 'closed', status: 'delivered' }).eq('id', order.id);
        await logGateEvent(order.id, 'G12');
      } else if (gateId === 'cancelled') {
        await updateOrderStatus.mutateAsync({ orderId: order.id, newStatus: 'cancelled', reason: 'Manual cancellation' });
        await logGateEvent(order.id, 'cancelled');
      } else {
        await logGateEvent(order.id, gateId);
      }
      toast.success(`Moved to ${gate.label}`);
      onStatusChange();
    } catch (error) {
      toast.error('Failed to change gate');
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const currentGateConfig = gates.find(g => g.id === currentGate);
  const Icon = currentGateConfig?.icon || Layers;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 h-9 border-2 hover:bg-primary/5 transition-all"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
      >
        <Icon className={cn("h-3.5 w-3.5", currentGateConfig?.color)} />
        <span className="font-medium">{currentGate}</span>
        <ChevronDown className="h-3 w-3" />
      </Button>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border z-50 max-h-96 overflow-y-auto animate-in fade-in zoom-in duration-200">
          <div className="py-1">
            {gates.map((gate) => {
              const GateIcon = gate.icon;
              return (
                <button
                  key={gate.id}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-3",
                    currentGate === gate.id && "bg-primary/10 text-primary font-medium"
                  )}
                  onClick={() => handleGateChange(gate.id)}
                >
                  <div className={cn("p-1 rounded", gate.bg)}>
                    <GateIcon className={cn("h-3.5 w-3.5", gate.color)} />
                  </div>
                  <span>{gate.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// NextActionBanner
// ============================================================
function NextActionBanner({ order, onAction }: { order: any; onAction?: (actionType: string) => void }) {
  const { getPendingAction } = useGateLogic(order);
  const pending = getPendingAction();
  
  if (!pending) return null;
  
  const getIcon = (gate: string) => {
    const gateInfo = GATES.find(g => g.id === gate);
    return gateInfo?.icon || Clock;
  };
  
  const Icon = getIcon(pending.gate);
  
  const getColorClass = (gate: string) => {
    switch (gate) {
      case 'G1': return 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-white';
      case 'G2': return 'border-blue-200 bg-gradient-to-r from-blue-50 to-white';
      case 'G3': return 'border-indigo-200 bg-gradient-to-r from-indigo-50 to-white';
      case 'G4': return 'border-amber-200 bg-gradient-to-r from-amber-50 to-white';
      case 'G5': return 'border-purple-200 bg-gradient-to-r from-purple-50 to-white';
      case 'G6': return 'border-orange-200 bg-gradient-to-r from-orange-50 to-white';
      case 'G7': return 'border-teal-200 bg-gradient-to-r from-teal-50 to-white';
      case 'G7.5': return 'border-purple-200 bg-gradient-to-r from-purple-50 to-white';
      case 'G11': return 'border-red-200 bg-gradient-to-r from-red-50 to-white';
      case 'G12': return 'border-green-200 bg-gradient-to-r from-green-50 to-white';
      default: return 'border-gray-200 bg-gradient-to-r from-gray-50 to-white';
    }
  };
  
  const getIconBgClass = (gate: string) => {
    switch (gate) {
      case 'G1': return 'bg-emerald-100';
      case 'G2': return 'bg-blue-100';
      case 'G3': return 'bg-indigo-100';
      case 'G4': return 'bg-amber-100';
      case 'G5': return 'bg-purple-100';
      case 'G6': return 'bg-orange-100';
      case 'G7': return 'bg-teal-100';
      case 'G7.5': return 'bg-purple-100';
      case 'G11': return 'bg-red-100';
      case 'G12': return 'bg-green-100';
      default: return 'bg-gray-100';
    }
  };
  
  return (
    <Alert className={cn("shadow-sm", getColorClass(pending.gate))}>
      <div className="flex items-start gap-3">
        <div className={cn("p-1.5 rounded-full", getIconBgClass(pending.gate))}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <AlertTitle className="text-sm font-semibold">
            {pending.gate} — {pending.title}
          </AlertTitle>
          <AlertDescription className="text-sm mt-0.5">
            {pending.description}
          </AlertDescription>
        </div>
        <Button 
          size="sm" 
          className="shadow-sm"
          onClick={() => onAction?.(pending.actionType)}
        >
          {pending.action}
        </Button>
      </div>
    </Alert>
  );
}

// ============================================================
// Supplier Documentation Component (G7.5)
// ============================================================
function SupplierDocuments({ po, orderId, onRefresh }: { po: any; orderId: string; onRefresh?: () => void }) {
  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewDoc, setPreviewDoc] = useState<SupplierDocument | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<SupplierDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [uploadForm, setUploadForm] = useState({
    files: [] as File[],
    document_type: 'invoice' as SupplierDocument['document_type'],
    notes: '',
  });

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_documents')
        .select('*')
        .eq('purchase_order_id', po.id)
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [po.id]);

  const handleUpload = async () => {
    if (uploadForm.files.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < uploadForm.files.length; i++) {
      const file = uploadForm.files[i];
      try {
        const fileName = `${orderId}/${po.id}/${Date.now()}_${i}_${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('supplier-documents')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('supplier-documents')
          .getPublicUrl(fileName);
        
        const { error: insertError } = await supabase
          .from('supplier_documents')
          .insert({
            purchase_order_id: po.id,
            document_type: uploadForm.document_type,
            file_name: file.name,
            file_url: publicUrl,
            notes: uploadForm.notes || null,
          });
        
        if (insertError) throw insertError;
        
        successCount++;
        setUploadProgress(((i + 1) / uploadForm.files.length) * 100);
      } catch (error) {
        console.error('Upload error for file:', file.name, error);
        failCount++;
      }
    }

    await logGateEvent(orderId, 'G7.5', { 
      purchase_order_id: po.id, 
      document_type: uploadForm.document_type,
      file_count: successCount 
    });
    
    if (successCount > 0) {
      toast.success(`✅ Uploaded ${successCount} document(s) successfully`);
    }
    if (failCount > 0) {
      toast.error(`❌ Failed to upload ${failCount} document(s)`);
    }
    
    setShowUploadDialog(false);
    setUploadForm({ files: [], document_type: 'invoice', notes: '' });
    setUploadProgress(0);
    fetchDocuments();
    onRefresh?.();
    setUploading(false);
  };

  const handleDeleteClick = (doc: SupplierDocument) => {
    setDeletingDoc(doc);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingDoc) return;
    
    setIsDeleting(true);
    try {
      const filePath = deletingDoc.file_url.split('/').slice(-3).join('/');
      await supabase.storage.from('supplier-documents').remove([filePath]);
      
      const { error } = await supabase
        .from('supplier_documents')
        .delete()
        .eq('id', deletingDoc.id);
      
      if (error) throw error;
      
      toast.success('Document deleted successfully');
      setDeleteDialogOpen(false);
      setDeletingDoc(null);
      fetchDocuments();
      onRefresh?.();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete document');
    } finally {
      setIsDeleting(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="h-4 w-4 text-red-500" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon className="h-4 w-4 text-blue-500" />;
    if (ext === 'doc' || ext === 'docx') return <FileText className="h-4 w-4 text-blue-600" />;
    if (ext === 'xls' || ext === 'xlsx') return <FileText className="h-4 w-4 text-green-600" />;
    return <FileArchive className="h-4 w-4 text-gray-500" />;
  };

  const isImageFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  };

  const isPdfFile = (fileName: string) => {
    return fileName.toLowerCase().endsWith('.pdf');
  };

  const documentTypeLabels: Record<SupplierDocument['document_type'], { label: string; icon: React.ElementType; color: string; bg: string }> = {
    invoice: { label: 'Invoice', icon: FileText, color: 'text-blue-700', bg: 'bg-blue-50' },
    delivery_note: { label: 'Delivery Note', icon: Truck, color: 'text-green-700', bg: 'bg-green-50' },
    packing_list: { label: 'Packing List', icon: Package, color: 'text-amber-700', bg: 'bg-amber-50' },
    certificate: { label: 'Certificate', icon: Award, color: 'text-purple-700', bg: 'bg-purple-50' },
    other: { label: 'Other', icon: File, color: 'text-gray-600', bg: 'bg-gray-50' },
  };

  return (
    <div className="m-8 p-4 border-l-2 border-purple-300 space-y-4">
      <div className="bg-gradient-to-r from-purple-50 to-white rounded-xl p-4 border border-purple-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 rounded-xl shadow-sm">
              <FileCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-purple-800">Supplier Documentation</p>
                <Badge variant="outline" className="text-[10px] bg-purple-100 text-purple-700 border-purple-200">
                  G7.5
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {documents.length} document(s) uploaded
              </p>
            </div>
          </div>
          
          <Button 
            size="sm" 
            className="bg-purple-600 hover:bg-purple-700 shadow-sm gap-1.5"
            onClick={() => setShowUploadDialog(true)}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Documents
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-gradient-to-b from-gray-50 to-white border">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-50 flex items-center justify-center">
            <File className="h-8 w-8 text-purple-400" />
          </div>
          <p className="font-medium text-gray-600">No documents uploaded yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Upload supplier invoices, delivery notes, or certificates
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-4 border-purple-200 text-purple-600 hover:bg-purple-50"
            onClick={() => setShowUploadDialog(true)}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload First Document
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
          {documents.map((doc) => {
            const typeConfig = documentTypeLabels[doc.document_type];
            const TypeIcon = typeConfig.icon;
            const isImage = isImageFile(doc.file_name);
            const isPdf = isPdfFile(doc.file_name);
            
            return (
              <div 
                key={doc.id} 
                className="group bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {isImage && (
                  <div 
                    className="relative h-32 bg-gray-100 cursor-pointer overflow-hidden"
                    onClick={() => setPreviewDoc(doc)}
                  >
                    <img 
                      src={doc.file_url} 
                      alt={doc.file_name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Eye className="h-6 w-6 text-white drop-shadow-md" />
                    </div>
                  </div>
                )}
                
                <div className="p-3">
                  <div className="flex items-start gap-3">
                    {!isImage && (
                      <div className={cn("p-2 rounded-lg shrink-0", typeConfig.bg)}>
                        {getFileIcon(doc.file_name)}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate max-w-[180px]" title={doc.file_name}>
                          {doc.file_name}
                        </p>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", typeConfig.bg, typeConfig.color)}>
                          <TypeIcon className="h-2.5 w-2.5 inline mr-0.5" />
                          {typeConfig.label}
                        </span>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        Uploaded {fmtAgo(doc.uploaded_at)}
                      </p>
                      
                      {doc.notes && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 bg-gray-50 p-1.5 rounded">
                          📝 {doc.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t">
                    {(isImage || isPdf) && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs gap-1"
                        onClick={() => setPreviewDoc(doc)}
                      >
                        <Eye className="h-3 w-3" />
                        Preview
                      </Button>
                    )}
                    <a href={doc.file_url} download>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                    </a>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteClick(doc)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-2">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-center text-lg">Delete Document</DialogTitle>
            <p className="text-center text-sm text-muted-foreground pt-2">
              Are you sure you want to delete this document?<br />
              This action cannot be undone.
            </p>
          </DialogHeader>
          
          {deletingDoc && (
            <div className="bg-muted/30 rounded-lg p-3 my-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <File className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{deletingDoc.file_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {deletingDoc.document_type.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-3 sm:justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingDoc(null);
              }}
              disabled={isDeleting}
              className="min-w-[100px]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="min-w-[100px]"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 truncate">
              {previewDoc && getFileIcon(previewDoc.file_name)}
              <span className="truncate">{previewDoc?.file_name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {previewDoc && (
              <>
                {isImageFile(previewDoc.file_name) ? (
                  <img 
                    src={previewDoc.file_url} 
                    alt={previewDoc.file_name} 
                    className="max-w-full h-auto rounded-lg mx-auto"
                  />
                ) : isPdfFile(previewDoc.file_name) ? (
                  <iframe 
                    src={previewDoc.file_url} 
                    className="w-full h-[70vh] rounded-lg" 
                    title={previewDoc.file_name}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileArchive className="h-16 w-16 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Preview not available for this file type</p>
                    <a href={previewDoc.file_url} download className="text-primary underline mt-2 inline-block">
                      Download File
                    </a>
                  </div>
                )}
                {previewDoc.notes && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Notes:</p>
                    <p className="text-sm">{previewDoc.notes}</p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDoc(null)}>Close</Button>
            {previewDoc && (
              <a href={previewDoc.file_url} download>
                <Button>Download</Button>
              </a>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-full">
                <Upload className="h-4 w-4 text-purple-600" />
              </div>
              <DialogTitle>Upload Supplier Documents</DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground pl-9">
              Upload invoices, delivery notes, packing lists, or certificates
            </p>
          </DialogHeader>
          
          <div className="space-y-5 py-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Document Type *</Label>
              <Select 
                value={uploadForm.document_type} 
                onValueChange={(v) => setUploadForm(f => ({ ...f, document_type: v as any }))}
              >
                <SelectTrigger className="border-purple-200 focus:ring-purple-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">📄 Invoice</SelectItem>
                  <SelectItem value="delivery_note">🚚 Delivery Note</SelectItem>
                  <SelectItem value="packing_list">📦 Packing List</SelectItem>
                  <SelectItem value="certificate">🏆 Certificate / Warranty</SelectItem>
                  <SelectItem value="other">📁 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Files * (Multiple allowed)</Label>
              <div 
                className={cn(
                  "border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer",
                  uploadForm.files.length > 0 
                    ? "border-purple-400 bg-purple-50/30" 
                    : "border-gray-300 hover:border-purple-400 hover:bg-purple-50/20"
                )}
              >
                <Input 
                  type="file" 
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => setUploadForm(f => ({ ...f, files: Array.from(e.target.files || []) }))}
                  className="hidden" 
                  id="doc-files"
                />
                <label htmlFor="doc-files" className="cursor-pointer flex flex-col items-center">
                  <Upload className={cn(
                    "h-10 w-10 mb-2 transition-colors",
                    uploadForm.files.length > 0 ? "text-purple-500" : "text-muted-foreground"
                  )} />
                  <span className="text-sm font-medium">
                    {uploadForm.files.length > 0 ? `${uploadForm.files.length} file(s) selected` : 'Click to select files'}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    PDF, Images, Word, Excel (max 10 files)
                  </span>
                </label>
              </div>
              
              {uploadForm.files.length > 0 && (
                <div className="mt-3 space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
                  <p className="text-xs font-medium text-purple-600 mb-1">Selected files:</p>
                  {uploadForm.files.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs p-1.5 bg-purple-50 rounded">
                      {getFileIcon(file.name)}
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-muted-foreground text-[10px]">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Notes (Optional)</Label>
              <Textarea 
                rows={2} 
                placeholder="Add notes for all uploaded documents..."
                value={uploadForm.notes}
                onChange={(e) => setUploadForm(f => ({ ...f, notes: e.target.value }))}
                className="resize-none"
              />
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-purple-600">Uploading...</span>
                  <span className="font-medium">{uploadProgress.toFixed(0)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-1.5 bg-purple-100" />
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button 
              disabled={uploadForm.files.length === 0 || uploading}
              onClick={handleUpload}
              className="bg-purple-600 hover:bg-purple-700 min-w-[140px]"
            >
              {uploading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload {uploadForm.files.length} Document(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// SupplierConfirmationPanel Component
// ============================================================
function SupplierConfirmationPanel({ po, orderId, order, onRefresh }: { po: any; orderId: string; order: any; onRefresh?: () => void }) {
  const confirm = useConfirmPurchaseOrderBySupplier();
  const reject = useRejectPurchaseOrderBySupplier();
  const updateStatus = useUpdatePurchaseOrderStatus();
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirmedQuantities, setConfirmedQuantities] = useState<Record<string, number>>({});
  const [confirmedDeliveryDate, setConfirmedDeliveryDate] = useState('');
  const [confirmedPrices, setConfirmedPrices] = useState<Record<string, number>>({});
  const [showClosePODialog, setShowClosePODialog] = useState(false);
  const [closePONotes, setClosePONotes] = useState('');
  const [closePOAttachments, setClosePOAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const status = po.status;
  const canConfirm = ['draft', 'sent'].includes(status);
  const canReject = ['draft', 'sent', 'supplier_confirmed'].includes(status);
  const canClosePO = status === 'delivered';

  const poSteps = [
    { key: 'draft', label: 'Draft', icon: Clock, completed: status !== 'draft' },
    { key: 'sent', label: 'Sent', icon: SendHorizonal, completed: ['sent', 'supplier_confirmed', 'in_delivery', 'delivered', 'invoiced', 'paid'].includes(status) },
    { key: 'supplier_confirmed', label: 'Confirmed', icon: CheckCircle2, completed: ['supplier_confirmed', 'in_delivery', 'delivered', 'invoiced', 'paid'].includes(status) },
    { key: 'in_delivery', label: 'In Delivery', icon: Truck, completed: ['in_delivery', 'delivered', 'invoiced', 'paid'].includes(status) },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2, completed: ['delivered', 'invoiced', 'paid'].includes(status) },
    { key: 'invoiced', label: 'Invoiced', icon: ReceiptText, completed: ['invoiced', 'paid'].includes(status) },
    { key: 'paid', label: 'Paid', icon: DollarSign, completed: status === 'paid' },
  ];

  const currentStepIndex = poSteps.findIndex(step => step.key === status);
  const poProgressPercent = ((currentStepIndex + 1) / poSteps.length) * 100;

  const handleOpenConfirm = () => {
    const initialQuantities: Record<string, number> = {};
    const initialPrices: Record<string, number> = {};
    po.items?.forEach((item: any) => {
      initialQuantities[item.id] = item.quantity;
      initialPrices[item.id] = item.unit_price;
    });
    setConfirmedQuantities(initialQuantities);
    setConfirmedPrices(initialPrices);
    setConfirmedDeliveryDate(order.expected_delivery_date || '');
    setConfirmNotes('');
    setShowConfirmDialog(true);
  };

  const handleClosePO = async () => {
    if (!closePONotes.trim()) {
      toast.error('Please add notes before closing PO');
      return;
    }
    
    setUploading(true);
    let attachmentUrls: string[] = [];
    
    try {
      for (const file of closePOAttachments) {
        const fileName = `${orderId}/${po.id}/${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage
          .from('po-attachments')
          .upload(fileName, file);
        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage
            .from('po-attachments')
            .getPublicUrl(data.path);
          attachmentUrls.push(publicUrl);
        }
      }
      
      await updateStatus.mutateAsync({ 
        purchaseOrderId: po.id, 
        orderId, 
        status: 'invoiced',
        notes: JSON.stringify({
          closing_notes: closePONotes,
          attachments: attachmentUrls,
          closed_at: new Date().toISOString(),
        })
      });
      
      await logGateEvent(orderId, 'G8', { 
        purchase_order_id: po.id, 
        notes: closePONotes,
        attachments: attachmentUrls 
      });
      
      toast.success('PO closed successfully');
      setShowClosePODialog(false);
      setClosePONotes('');
      setClosePOAttachments([]);
      onRefresh?.();
    } catch (error) {
      toast.error('Failed to close PO');
    } finally {
      setUploading(false);
    }
  };

  const sendSupplierConfirmationRequest = () => {
    const supplierPhone = po.supplier?.contact?.phone || po.suppliers?.accounts?.contacts?.phone;
    const supplierName = po.suppliers?.accounts?.display_name || po.supplier?.name || 'المورد';
    const customerName = order.customer_name || 'العميل';
    const customerLocation = order.delivery_location || 'موقع التسليم';
    const requestedDate = order.expected_delivery_date ? fmtDate(order.expected_delivery_date) : 'غير محدد';
    
    let itemsMessage = '';
    po.items?.forEach((item: any) => {
      itemsMessage += `\n• ${item.material_name || 'مادة'}: ${item.quantity} ${item.uom || 'وحدة'} @ ${fmtCurrency(item.unit_price)}/${item.uom || 'وحدة'}`;
    });
    
    const message = `مرحباً ${supplierName}،

يرجى تأكيد إمكانية توريد المواد التالية للطلب رقم: ${order.code || order.id.slice(0, 8)}

المواد المطلوبة:${itemsMessage}

📍 موقع التسليم: ${customerLocation}
📅 التاريخ المطلوب: ${requestedDate}
👤 العميل: ${customerName}

الرجاء تأكيد:
✅ الكمية المتاحة
✅ السعر
✅ تاريخ التسليم المؤكد

شكراً لتعاونكم`;

    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = supplierPhone || '966555555555';
    window.open(`https://wa.me/${phoneNumber}?text=${encodedMessage}`, '_blank');
  };

  const totalConfirmedValue = po.items?.reduce((sum: number, item: any) => 
    sum + (confirmedQuantities[item.id] || item.quantity) * (confirmedPrices[item.id] || item.unit_price), 0
  ) || 0;

  let confirmationDetails = null;
  try {
    if (po.confirmed_at && po.notes) {
      confirmationDetails = JSON.parse(po.notes);
    }
  } catch (e) {}

  return (
    <Card className="shadow-sm hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/30 overflow-hidden">
      <CardContent className="p-0">
        <div 
          className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
            <div className="p-2 bg-primary/10 rounded-xl">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold font-mono">{po.po_number}</p>
                <StatusBadge status={status} type="po" size="sm" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {po.suppliers?.accounts?.display_name || po.supplier?.name || po.supplier_id?.slice(0, 8)}
                {po.po_date && ` · ${fmtDate(po.po_date)}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">{fmtCurrency(po.total_amount)}</p>
            <p className="text-xs text-muted-foreground">Total PO Value</p>
          </div>
        </div>

        {isOpen && (
          <>
            <div className="px-4 py-3 bg-muted/10 border-t">
              <div className="flex justify-between text-xs mb-2">
                <span className="font-medium text-muted-foreground">PO Progress</span>
                <span className="font-medium text-primary">{poProgressPercent.toFixed(0)}%</span>
              </div>
              <Progress value={poProgressPercent} className="h-1.5 mb-3" />
              <div className="flex justify-between">
                {poSteps.map((step) => {
                  const StepIcon = step.icon;
                  return (
                    <div key={step.key} className="flex flex-col items-center">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                        step.completed ? "bg-emerald-100 text-emerald-600" : 
                        step.key === status ? "bg-blue-100 text-blue-600 ring-2 ring-blue-200" : 
                        "bg-gray-100 text-gray-400"
                      )}>
                        <StepIcon className="h-3 w-3" />
                      </div>
                      <span className="text-[9px] mt-1 text-center">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                className="w-full flex items-center justify-between p-3 text-sm hover:bg-muted/30 transition-colors"
              >
                <span className="font-medium flex items-center gap-2">
                  <Package className="h-3.5 w-3.5" />
                  Items ({po.items?.length || 0})
                </span>
                <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
              </button>
              
              {expanded && po.items && po.items.length > 0 && (
                <div className="p-4 border-t bg-muted/10 space-y-2">
                  {po.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">
                          {item.is_custom_item ? (item.custom_name || 'Custom') : (item.material_name || 'Material')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity?.toLocaleString()} {item.uom}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-primary">
                          {item.unit_price ? fmtCurrency(item.unit_price) + '/unit' : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Total: {fmtCurrency(item.quantity * item.unit_price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {confirmationDetails && confirmationDetails.items ? (
              <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-200">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">Supplier Confirmation Details</span>
                </div>
                <div className="space-y-2">
                  {confirmationDetails.items.map((item: any, idx: number) => {
                    const materialName = po.items?.find((i: any) => i.material_id === item.material_id)?.material_name || `Material ${item.material_id?.slice(0, 8)}`;
                    const orderedQty = item.ordered_quantity;
                    const confirmedQty = item.confirmed_quantity;
                    const diff = confirmedQty - orderedQty;
                    return (
                      <div key={idx} className="bg-white rounded-lg p-3 shadow-sm border border-emerald-100">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{materialName}</p>
                            <div className="flex flex-wrap gap-3 mt-1 text-xs">
                              <span className="text-muted-foreground">📦 Ordered: <span className="font-medium">{orderedQty.toLocaleString()}</span></span>
                              <span className="text-emerald-600 font-medium">✅ Confirmed: <span className="font-bold">{confirmedQty.toLocaleString()}</span></span>
                              {item.unit_price && <span className="text-blue-600">💰 {fmtCurrency(item.unit_price)}/unit</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-emerald-600">
                              {fmtCurrency(confirmedQty * item.unit_price)}
                            </p>
                          </div>
                        </div>
                        {diff !== 0 && (
                          <div className={`mt-2 text-xs ${diff > 0 ? 'text-amber-600' : 'text-red-500'} bg-amber-50 p-1.5 rounded`}>
                            {diff > 0 
                              ? `⚠️ Supplier will provide +${diff.toLocaleString()} extra units` 
                              : `⚠️ Shortage: ${Math.abs(diff).toLocaleString()} units less than ordered`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {confirmationDetails.confirmed_delivery_date && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-white p-2 rounded-lg border border-emerald-100">
                      <CalendarClock className="h-3.5 w-3.5" />
                      <span className="font-medium">Confirmed Delivery Date:</span>
                      <span>{fmtDate(confirmationDetails.confirmed_delivery_date)}</span>
                    </div>
                  )}
                  {confirmationDetails.notes && (
                    <div className="text-xs text-muted-foreground bg-white p-2 rounded-lg border border-emerald-100 italic">
                      📝 "{confirmationDetails.notes}"
                    </div>
                  )}
                </div>
              </div>
            ) : po.confirmed_at ? (
              <div className="px-4 py-2 text-xs bg-emerald-50 border-t border-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span className="text-emerald-700">Confirmed by supplier {fmtAgo(po.confirmed_at)}</span>
                </div>
              </div>
            ) : null}

            {po.rejection_reason && (
              <div className="px-4 py-2 text-xs bg-red-50 border-t border-red-200">
                <div className="flex items-center gap-2">
                  <XCircle className="h-3 w-3 text-red-600" />
                  <span className="text-red-700">Rejected: {po.rejection_reason}</span>
                </div>
              </div>
            )}

            {po.purchase_receipts && po.purchase_receipts.length > 0 && (
              <div className="px-4 py-3 border-t bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <ReceiptText className="h-3 w-3" />
                  Receipts ({po.purchase_receipts.length})
                </p>
                <div className="space-y-1.5">
                  {po.purchase_receipts.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{r.received_quantity?.toLocaleString()} units</span>
                        <span className="text-muted-foreground">{fmtDate(r.receipt_date)}</span>
                        {r.received_by && <span className="text-muted-foreground">by {r.received_by}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        {r.attachment_url && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(r.attachment_url, '_blank')}>
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={async () => {
                          if (confirm('Delete this receipt?')) {
                            await supabase.from('purchase_receipts').delete().eq('id', r.id);
                            onRefresh?.();
                          }
                        }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 p-3 border-t bg-gray-50/50 flex-wrap">
              {status === 'draft' && (
                <>
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={async () => {
                    await updateStatus.mutateAsync({ purchaseOrderId: po.id, orderId, status: 'sent' });
                    await logGateEvent(orderId, 'G3', { purchase_order_id: po.id });
                    onRefresh?.();
                  }}>
                    <SendHorizonal className="h-3.5 w-3.5 mr-1.5" />
                    Send to Supplier (G3)
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-8 border-green-300 text-green-600 hover:bg-green-50" onClick={sendSupplierConfirmationRequest}>
                    <Bell className="h-3.5 w-3.5 mr-1.5" />
                    Request via WhatsApp
                  </Button>
                </>
              )}
              {canConfirm && (
                <Button size="sm" className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700" onClick={handleOpenConfirm}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Mark Supplier Confirmed (G4)
                </Button>
              )}
              {canReject && (
                <Button size="sm" variant="outline" className="text-xs h-8 border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowRejectDialog(true)}>
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Reject
                </Button>
              )}
              {status === 'supplier_confirmed' && (
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={async () => {
                  await updateStatus.mutateAsync({ purchaseOrderId: po.id, orderId, status: 'in_delivery' });
                  await logGateEvent(orderId, 'G6', { purchase_order_id: po.id });
                  onRefresh?.();
                }}>
                  <Truck className="h-3.5 w-3.5 mr-1.5" />
                  Mark In Delivery (G6)
                </Button>
              )}
              {status === 'in_delivery' && (
                <Button size="sm" variant="outline" className="text-xs h-8 border-green-300 text-green-700" onClick={async () => {
                  await updateStatus.mutateAsync({ purchaseOrderId: po.id, orderId, status: 'delivered' });
                  await logGateEvent(orderId, 'G6', { purchase_order_id: po.id });
                  onRefresh?.();
                }}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Mark Delivered (G6)
                </Button>
              )}
              {canClosePO && (
                <Button size="sm" variant="outline" className="text-xs h-8 border-purple-300 text-purple-700 hover:bg-purple-50" onClick={() => setShowClosePODialog(true)}>
                  <ReceiptText className="h-3.5 w-3.5 mr-1.5" />
                  Close PO (G8)
                </Button>
              )}
            </div>

            {(status === 'delivered' || status === 'invoiced') && (
              <SupplierDocuments po={po} orderId={orderId} onRefresh={onRefresh} />
            )}
          </>
        )}
      </CardContent>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Confirm Supplier Acceptance (G4)
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Confirm supplier can fulfill this PO</p>
          </DialogHeader>
          
          <div className="space-y-5 py-3">
            <Alert className="border-emerald-200 bg-emerald-50">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription>Supplier confirms: <strong>{po.po_number}</strong></AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Materials & Quantities</Label>
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {po.items?.map((item: any) => (
                  <div key={item.id} className="p-3 hover:bg-muted/30">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm">{item.material_name || 'Material'}</p>
                        {item.material_code && <p className="text-xs font-mono text-muted-foreground">{item.material_code}</p>}
                      </div>
                      <Badge variant="outline" className="text-blue-600">{item.supplier_name || po.supplier?.name || 'Supplier'}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Ordered</Label>
                        <p className="text-sm font-medium">{item.quantity.toLocaleString()} {item.uom}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Confirmed Qty *</Label>
                        <Input 
                          type="number" 
                          value={confirmedQuantities[item.id] || item.quantity} 
                          onChange={(e) => setConfirmedQuantities(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))} 
                          className="h-8 text-sm" 
                          min={0} 
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Unit Price</Label>
                        <p className="text-sm font-medium text-primary">{fmtCurrency(confirmedPrices[item.id] || item.unit_price)}/{item.uom}</p>
                      </div>
                    </div>
                    <div className="flex justify-end mt-2 pt-2 border-t text-xs">
                      <span className="text-muted-foreground">Line Total: </span>
                      <span className="font-semibold ml-2">{fmtCurrency((confirmedQuantities[item.id] || item.quantity) * (confirmedPrices[item.id] || item.unit_price))}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Delivery Date</Label>
              <div className="border rounded-lg p-3 bg-muted/20">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Requested</Label>
                    <p className="text-sm font-medium mt-1">{order.expected_delivery_date ? fmtDate(order.expected_delivery_date) : 'Not specified'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Confirmed Date *</Label>
                    <Input type="date" value={confirmedDeliveryDate} onChange={(e) => setConfirmedDeliveryDate(e.target.value)} className="h-9 mt-1" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Supplier Notes</Label>
              <Textarea rows={2} placeholder="Add any notes from the supplier..." value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} />
            </div>
            
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-emerald-800 mb-2">Confirmation Summary</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original Total:</span>
                  <span>{fmtCurrency(po.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confirmed Total:</span>
                  <span className="font-semibold text-emerald-700">{fmtCurrency(totalConfirmedValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confirmed Delivery:</span>
                  <span>{confirmedDeliveryDate ? fmtDate(confirmedDeliveryDate) : 'Not set'}</span>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={confirm.isPending || !confirmedDeliveryDate} onClick={async () => {
              const details = { 
                items: po.items.map((item: any) => ({ 
                  material_id: item.material_id, 
                  ordered_quantity: item.quantity, 
                  confirmed_quantity: confirmedQuantities[item.id] || item.quantity, 
                  unit_price: confirmedPrices[item.id] || item.unit_price 
                })), 
                confirmed_delivery_date: confirmedDeliveryDate, 
                notes: confirmNotes 
              };
              await confirm.mutateAsync({ purchaseOrderId: po.id, orderId, notes: JSON.stringify(details) });
              await logGateEvent(orderId, 'G4', { purchase_order_id: po.id });
              setShowConfirmDialog(false);
              onRefresh?.();
            }}>
              {confirm.isPending ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
              Confirm (G4)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClosePODialog} onOpenChange={setShowClosePODialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-purple-600" />
              Close Purchase Order (G8)
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Add closing notes and attachments before closing</p>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription>You cannot close PO without adding notes</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>Closing Notes <span className="text-red-500">*</span></Label>
              <Textarea rows={3} placeholder="Enter closing notes (required)..." value={closePONotes} onChange={(e) => setClosePONotes(e.target.value)} />
              {!closePONotes.trim() && <p className="text-xs text-red-500">Notes are required to close PO</p>}
            </div>
            <div className="space-y-2">
              <Label>Attachments (Optional)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors">
                <Input type="file" multiple onChange={(e) => setClosePOAttachments(Array.from(e.target.files || []))} className="hidden" id="po-attachments" />
                <label htmlFor="po-attachments" className="cursor-pointer flex flex-col items-center">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm">Click to upload files</span>
                  <span className="text-xs text-muted-foreground">PDF, Images, Word documents</span>
                </label>
              </div>
              {closePOAttachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium">Files to upload ({closePOAttachments.length}):</p>
                  {closePOAttachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs p-1 bg-muted/30 rounded">
                      {file.type.startsWith('image/') ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      <span>{file.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClosePODialog(false)}>Cancel</Button>
            <Button disabled={!closePONotes.trim() || uploading} onClick={handleClosePO}>
              {uploading ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
              Close PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Supplier Rejection
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription>This will mark the PO as rejected and trigger re-negotiation.</AlertDescription>
            </Alert>
            <div className="space-y-1">
              <Label>Rejection Reason <span className="text-red-500">*</span></Label>
              <Textarea rows={3} placeholder="Why did the supplier reject? (price too low, out of stock, etc.)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectReason} onClick={async () => {
              await reject.mutateAsync({ purchaseOrderId: po.id, orderId, reason: rejectReason });
              await logGateEvent(orderId, 'rejected', { purchase_order_id: po.id, reason: rejectReason });
              setShowRejectDialog(false);
              onRefresh?.();
            }}>Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// ProcurementTab Component
// ============================================================
function ProcurementTab({ order, onRefresh }: { order: any; onRefresh: () => void }) {
  const { data: purchaseOrders = [], isLoading, refetch } = usePurchaseOrders(order.id);
  const [showCreatePO, setShowCreatePO] = useState(false);
  const createPO = useCreatePurchaseOrder();
  const { data: suppliers = [] } = useSuppliers();

  const [poForm, setPoForm] = useState({
    supplierId: '', poNumber: '', poDate: '', totalAmount: '', currency: 'SAR', notes: '',
  });

  const { getProcurementSteps, getProcurementProgress } = useGateLogic(order);
  const procurementSteps = getProcurementSteps();
  const procurementProgressPercent = getProcurementProgress();

  const confirmedCount = purchaseOrders.filter((p: any) => 
    ['supplier_confirmed', 'delivered', 'invoiced', 'paid'].includes(p.status)
  ).length;

  if (isLoading) return (
    <div className="space-y-3">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard title="Total POs" value={purchaseOrders.length} icon={ShoppingCart} />
        <MetricCard title="Confirmed" value={`${confirmedCount}/${purchaseOrders.length}`} icon={CheckCircle2} color="text-emerald-600" />
        <MetricCard title="Total Value" value={fmtCurrency(purchaseOrders.reduce((s: number, p: any) => s + (p.total_amount || 0), 0))} icon={DollarSign} />
        <MetricCard title="Progress" value={purchaseOrders.length > 0 ? `${Math.round((confirmedCount / purchaseOrders.length) * 100)}%` : '0%'} icon={TrendingUp} />
      </div>



      <div className="space-y-3">
        {purchaseOrders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-40" />
              <p className="font-medium text-muted-foreground">No purchase orders yet</p>
              <p className="text-sm text-muted-foreground mt-1">Release procurement from the banner above or create POs manually.</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowCreatePO(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First PO
              </Button>
            </CardContent>
          </Card>
        ) : (
          purchaseOrders.map((po: any) => (
            <SupplierConfirmationPanel 
              key={po.id} 
              po={po} 
              orderId={order.id} 
              order={order} 
              onRefresh={() => { refetch(); onRefresh(); }} 
            />
          ))
        )}
      </div>

      <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setShowCreatePO(true)}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Create Purchase Order Manually
      </Button>

      <Dialog open={showCreatePO} onOpenChange={setShowCreatePO}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create Purchase Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Supplier <span className="text-red-500">*</span></Label>
              <Select value={poForm.supplierId} onValueChange={(v) => setPoForm((f) => ({ ...f, supplierId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select supplier…" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s: any) => (<SelectItem key={s.account_id} value={s.account_id}>{s.supplier_code} — {s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>PO Number <span className="text-red-500">*</span></Label><Input value={poForm.poNumber} onChange={(e) => setPoForm((f) => ({ ...f, poNumber: e.target.value }))} placeholder="PO-2025-001" /></div>
              <div><Label>PO Date <span className="text-red-500">*</span></Label><Input type="date" value={poForm.poDate} onChange={(e) => setPoForm((f) => ({ ...f, poDate: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Total Amount <span className="text-red-500">*</span></Label><Input type="number" value={poForm.totalAmount} onChange={(e) => setPoForm((f) => ({ ...f, totalAmount: e.target.value }))} placeholder="0.00" /></div>
              <div><Label>Currency</Label><Select value={poForm.currency} onValueChange={(v) => setPoForm((f) => ({ ...f, currency: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SAR">SAR</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="AED">AED</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={poForm.notes} onChange={(e) => setPoForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePO(false)}>Cancel</Button>
            <Button disabled={!poForm.supplierId || !poForm.poNumber || !poForm.poDate || !poForm.totalAmount} onClick={async () => {
              await createPO.mutateAsync({ orderId: order.id, supplierId: poForm.supplierId, poNumber: poForm.poNumber, poDate: poForm.poDate, totalAmount: parseFloat(poForm.totalAmount), currency: poForm.currency, notes: poForm.notes });
              setShowCreatePO(false);
              setPoForm({ supplierId: '', poNumber: '', poDate: '', totalAmount: '', currency: 'SAR', notes: '' });
              refetch();
            }}>Create PO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// FinanceTab Component
// ============================================================
function FinanceTab({ order, onRefresh }: { order: any; onRefresh: () => void }) {
  const recordPayment = useRecordCustomerPayment();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showSupplierPaymentDialog, setShowSupplierPaymentDialog] = useState(false);
  const [selectedPoForPayment, setSelectedPoForPayment] = useState<any>(null);
  const [supplierPaymentForm, setSupplierPaymentForm] = useState({ amount: '', reference: '', notes: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'bank_transfer', reference: '', notes: '' });

  const totalPaid = order.total_paid_by_customer ?? 0;
  const orderTotal = order.total ?? 0;
  const balance = orderTotal - totalPaid;
  const paymentPct = orderTotal > 0 ? Math.min(100, (totalPaid / orderTotal) * 100) : 0;

  const recordSupplierPayment = async (poId: string, amount: number) => {
    await logGateEvent(order.id, 'G10', { purchase_order_id: poId, amount });
    toast.success(`Supplier payment recorded: ${fmtCurrency(amount)}`);
    onRefresh();
    setShowSupplierPaymentDialog(false);
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-l-4 border-l-emerald-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex justify-between items-center">
            <span className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 rounded-lg">
                <CreditCard className="h-4 w-4 text-emerald-600" />
              </div>
              Customer Payment
            </span>
            <StatusBadge status={order.payment_status || 'unpaid'} type="payment" size="md" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Order Total</span>
              <span className="font-semibold text-lg">{fmtCurrency(orderTotal, order.currency)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Amount Paid</span>
              <span className="font-semibold text-emerald-600 text-lg">{fmtCurrency(totalPaid, order.currency)}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Balance Due</span>
              <span className={cn("font-bold text-xl", balance > 0 ? "text-red-600" : "text-emerald-600")}>
                {fmtCurrency(balance, order.currency)}
              </span>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Payment Progress</span>
              <span>{paymentPct.toFixed(0)}%</span>
            </div>
            <Progress value={paymentPct} className="h-2" />
          </div>
          
          <Button 
            size="sm" 
            className="w-full bg-emerald-600 hover:bg-emerald-700" 
            onClick={() => setShowPaymentDialog(true)} 
            disabled={order.payment_status === 'paid'}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Record Customer Payment (G11)
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
            Supplier Costs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total PO Value</span>
            <span className="font-medium">{fmtCurrency(order.total_purchase_orders_value, order.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Supplier Invoices</span>
            <span className="font-medium">{fmtCurrency(order.total_supplier_invoices_value, order.currency)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="text-muted-foreground">Paid to Suppliers</span>
            <span className="font-semibold text-emerald-600">{fmtCurrency(order.total_paid_to_suppliers, order.currency)}</span>
          </div>
          
          <Separator />
          
          <div className="pt-2">
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Supplier Payments (G10)
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {order.purchase_orders?.map((po: any) => (
                <div key={po.id} className="flex justify-between items-center p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-xs font-mono font-medium">{po.po_number}</p>
                    <p className="text-xs text-muted-foreground">{fmtCurrency(po.total_amount)}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedPoForPayment(po); setShowSupplierPaymentDialog(true); }}>
                    Record Payment
                  </Button>
                </div>
              ))}
            </div>
          </div>
          
          {orderTotal > 0 && order.total_purchase_orders_value > 0 && (
            <>
              <Separator />
              <div className="flex justify-between pt-2">
                <span className="font-semibold">Gross Margin</span>
                <span className={cn("font-bold", (orderTotal - order.total_purchase_orders_value) > 0 ? "text-emerald-600" : "text-red-600")}>
                  {fmtCurrency(orderTotal - order.total_purchase_orders_value, order.currency)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {order.sales_invoice_number && (
        <Card className="shadow-sm border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-purple-600" />
              Sales Invoice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Invoice #</span><span className="font-mono font-medium">{order.sales_invoice_number}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span>{fmtCurrency(order.sales_invoice_amount, order.currency)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{fmtDate(order.sales_invoice_date)}</span></div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Record Customer Payment (G11)</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertDescription>Balance due: <strong>{fmtCurrency(balance, order.currency)}</strong></AlertDescription>
            </Alert>
            <div><Label>Amount *</Label><Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm(f => ({ ...f, amount: e.target.value }))} placeholder={balance.toFixed(2)} /></div>
            <div><Label>Method</Label><Select value={paymentForm.method} onValueChange={(v) => setPaymentForm(f => ({ ...f, method: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="card">Card</SelectItem></SelectContent></Select></div>
            <div><Label>Reference</Label><Input value={paymentForm.reference} onChange={(e) => setPaymentForm(f => ({ ...f, reference: e.target.value }))} /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={paymentForm.notes} onChange={(e) => setPaymentForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button disabled={!paymentForm.amount} onClick={async () => {
              await recordPayment.mutateAsync({ orderId: order.id, amount: parseFloat(paymentForm.amount), method: paymentForm.method, reference: paymentForm.reference, notes: paymentForm.notes });
              await logGateEvent(order.id, 'G11', { amount: parseFloat(paymentForm.amount) });
              setShowPaymentDialog(false);
              onRefresh();
            }}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSupplierPaymentDialog} onOpenChange={setShowSupplierPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Record Supplier Payment (G10)</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Alert className="border-blue-200 bg-blue-50">
              <AlertDescription><strong>PO:</strong> {selectedPoForPayment?.po_number}<br /><strong>Total:</strong> {fmtCurrency(selectedPoForPayment?.total_amount)}</AlertDescription>
            </Alert>
            <div><Label>Amount *</Label><Input type="number" value={supplierPaymentForm.amount} onChange={(e) => setSupplierPaymentForm(f => ({ ...f, amount: e.target.value }))} placeholder={selectedPoForPayment?.total_amount?.toFixed(2)} /></div>
            <div><Label>Reference</Label><Input value={supplierPaymentForm.reference} onChange={(e) => setSupplierPaymentForm(f => ({ ...f, reference: e.target.value }))} /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={supplierPaymentForm.notes} onChange={(e) => setSupplierPaymentForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupplierPaymentDialog(false)}>Cancel</Button>
            <Button disabled={!supplierPaymentForm.amount} onClick={() => recordSupplierPayment(selectedPoForPayment?.id, parseFloat(supplierPaymentForm.amount))}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// OverviewTab Component
// ============================================================
function OverviewTab({ order, onRefresh }: { order: any; onRefresh?: () => void }) {
  const StatusIcon = ORDER_STATUS[order.status]?.icon ?? Clock;
  const lifecycle = LIFECYCLE_CONFIG[order.lifecycle_stage ?? 'quotation'];
  const suppConf = order.supplier_confirmation_status ? SUPPLIER_CONF_STATUS[order.supplier_confirmation_status] : null;
  const payCfg = PAYMENT_STATUS[order.payment_status ?? 'unpaid'];

  const subtotalExclVAT = order.subtotal ?? 0;
  const vatAmount = subtotalExclVAT * 0.15;
  const totalInclVAT = subtotalExclVAT + vatAmount;

  const projectLocation = order.project_location;
  const addressText = projectLocation?.address_text || order.delivery_location || '';
  const locationLat = projectLocation?.lat;
  const locationLng = projectLocation?.lng;
  const hasCoordinates = locationLat && locationLng;
  const region = projectLocation?.region || 'RYD';
  const zone = projectLocation?.zone_code || 'RYD.11083';
  const city = projectLocation?.city || 'Riyadh';

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  const overviewProgressSteps = [
    { label: 'Order Created', completed: true },
    { label: 'Customer Confirmed', completed: order.customer_confirmed || order.status !== 'created' },
    { label: 'POs Created', completed: order.purchase_orders?.length > 0 },
    { label: 'Suppliers Confirmed', completed: order.supplier_confirmation_status === 'all_confirmed' },
    { label: 'Delivery Arranged', completed: order.trips?.length > 0 },
    { label: 'Documents Collected', completed: order.purchase_orders?.some((p: any) => p.status === 'delivered' || p.status === 'invoiced') },
    { label: 'Payment Received', completed: order.payment_status === 'paid' },
    { label: 'Order Closed', completed: order.lifecycle_stage === 'closed' },
  ];
  const overviewProgressPercent = (overviewProgressSteps.filter(s => s.completed).length / overviewProgressSteps.length) * 100;

  const getStaticMapUrl = () => {
    if (hasCoordinates) {
      return `https://staticmap.openstreetmap.de/staticmap.php?center=${locationLat},${locationLng}&zoom=14&size=600x200&markers=${locationLat},${locationLng},marker-32`;
    }
    return `https://staticmap.openstreetmap.de/staticmap.php?center=24.8285,46.6509&zoom=12&size=600x200`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ring-1 ring-inset",
          ORDER_STATUS[order.status]?.class
        )}>
          <StatusIcon className="h-3 w-3" />
          {ORDER_STATUS[order.status]?.label ?? order.status}
        </div>
        {lifecycle && (
          <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-medium", lifecycle.color)}>
            {lifecycle.label}
          </span>
        )}
        {order.customer_confirmed && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Customer Confirmed
          </span>
        )}
        {suppConf && (
          <span className={cn("inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium", suppConf.class)}>
            <suppConf.icon className="h-3 w-3" />
            {suppConf.label}
          </span>
        )}
        {payCfg && (
          <span className={cn("inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium", payCfg.class)}>
            <payCfg.icon className="h-3 w-3" />
            {payCfg.label}
          </span>
        )}
      </div>

      <div className="bg-gradient-to-r from-slate-50 to-white rounded-xl p-4 border">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Order Progress
          </span>
          <span className="text-xs text-muted-foreground">{overviewProgressPercent.toFixed(0)}% Complete</span>
        </div>
        <Progress value={overviewProgressPercent} className="h-2" />
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
          {overviewProgressSteps.map((step, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full mb-1",
                step.completed ? "bg-emerald-500" : "bg-gray-300"
              )} />
              <span className="whitespace-nowrap">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      <CollapsibleSection title="Customer & Project Details" icon={Building2} defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {order.customer_name && (
            <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors">
              <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Customer</p>
                <Link to={`/sales/customers/${order.customer_account_id}`} className="font-medium hover:text-primary truncate block">
                  {order.customer_name}
                </Link>
              </div>
            </div>
          )}
          {order.project_name && (
            <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors">
              <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Project</p>
                <p className="font-medium truncate">{order.project_name}</p>
              </div>
            </div>
          )}
          {order.contact_phone && (
            <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors">
              <Phone className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Contact Phone</p>
                <a href={`tel:${order.contact_phone}`} className="font-medium hover:text-primary truncate block">
                  {order.contact_phone}
                </a>
              </div>
            </div>
          )}
          {order.contact_email && (
            <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors">
              <Mail className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <a href={`mailto:${order.contact_email}`} className="font-medium hover:text-primary truncate block">
                  {order.contact_email}
                </a>
              </div>
            </div>
          )}
          
          {order.expected_delivery_date && (
            <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Expected Delivery</p>
                <p className="font-medium text-amber-600">{fmtDate(order.expected_delivery_date)}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors">
            <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Order Date</p>
              <p className="font-medium">{fmtDate(order.created_at)}</p>
            </div>
          </div>
        </div>

        {addressText && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <MapPin className="h-4.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold">Delivery Location</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-muted/30 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Region</p>
                <p className="text-sm font-semibold">{region}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Zone</p>
                <p className="text-sm font-mono font-semibold">{zone}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2.5 col-span-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Full Address</p>
                <p className="text-sm font-medium">{addressText}</p>
              </div>
            </div>
            
            <div className="rounded-xl overflow-hidden border shadow-sm bg-muted/10 w-full">
              {hasCoordinates ? (
                <div className="relative w-full">
                  <iframe
                    src={`https://maps.google.com/maps?q=${locationLat},${locationLng}&z=15&output=embed`}
                    className="w-full h-[420px]"
                    loading="lazy"
                    title="Location Map"
                    onError={() => setMapError(true)}
                  />
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full">
                    📍 {locationLat.toFixed(6)}, {locationLng.toFixed(6)}
                  </div>
                </div>
              ) : (
                <div className="h-[220px] w-full flex flex-col items-center justify-center bg-muted/20">
                  <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Map preview not available</p>
                  <p className="text-xs text-muted-foreground mt-1">No coordinates available for this location</p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline mt-2 inline-flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open in Google Maps
                  </a>
                </div>
              )}
            </div>
            
            <div className="flex gap-2 mt-3">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Navigation className="h-3.5 w-3.5" />
                Get Directions
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Google Maps
              </a>
            </div>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Order Value Breakdown" icon={DollarSign} defaultOpen={false}>
        <div className="space-y-2">
          <div className="flex justify-between py-2 border-b border-border/40">
            <span className="text-muted-foreground">Subtotal (excl. VAT)</span>
            <span className="font-medium tabular-nums">{fmtCurrency(subtotalExclVAT, order.currency)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/40">
            <span className="text-muted-foreground">VAT (15%)</span>
            <span className="font-medium text-amber-600 tabular-nums">{fmtCurrency(vatAmount, order.currency)}</span>
          </div>
          <div className="flex justify-between py-2 font-bold text-base">
            <span>Total (incl. VAT)</span>
            <span className="text-primary text-lg tabular-nums">{fmtCurrency(totalInclVAT, order.currency)}</span>
          </div>
          
          {order.total_purchase_orders_value > 0 && (
            <>
              <div className="border-t border-dashed my-2" />
              <div className="flex justify-between py-1 text-xs">
                <span className="text-muted-foreground">Total PO Cost (Supplier)</span>
                <span className="tabular-nums">{fmtCurrency(order.total_purchase_orders_value, order.currency)}</span>
              </div>
              <div className="flex justify-between py-1 text-xs font-semibold">
                <span>Estimated Gross Margin</span>
                <span className={totalInclVAT - order.total_purchase_orders_value > 0 ? "text-emerald-600" : "text-red-600"}>
                  {fmtCurrency(totalInclVAT - order.total_purchase_orders_value, order.currency)}
                </span>
              </div>
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection 
        title="Order Items" 
        icon={Package} 
        defaultOpen={false}
        badge={<span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{order.items?.length || 0}</span>}
      >
        {order.items && order.items.length > 0 ? (
          <div className="space-y-2">
            {order.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-start py-3 border-b last:border-0 hover:bg-muted/20 -mx-2 px-2 rounded-lg transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {item.is_custom_item ? (item.custom_name || 'Custom Item') : (item.material_name || 'Material')}
                  </p>
                  {item.material_code && (
                    <p className="text-[10px] font-mono text-muted-foreground">{item.material_code}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">📦 {item.quantity?.toLocaleString()} {item.uom || 'unit'}</span>
                    {item.unit_price && (
                      <span className="inline-flex items-center gap-1 text-blue-600">💰 {fmtCurrency(item.unit_price)}/unit</span>
                    )}
                    {item.supplier_name && (
                      <span className="inline-flex items-center gap-1 text-purple-600">🏭 {item.supplier_name}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="font-semibold text-emerald-600 tabular-nums">{fmtCurrency(item.line_total, order.currency)}</p>
                  {item.unit_price && (
                    <p className="text-[10px] text-muted-foreground">Cost: {fmtCurrency(item.quantity * item.unit_price)}</p>
                  )}
                </div>
              </div>
            ))}
            <div className="pt-3 border-t mt-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total Value</span>
                <span className="font-bold text-primary text-lg tabular-nums">
                  {fmtCurrency(order.items.reduce((s: number, i: any) => s + (i.line_total ?? 0), 0), order.currency)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No items found</p>
          </div>
        )}
      </CollapsibleSection>

      {order.supplier_confirmations && order.supplier_confirmations.length > 0 && (
        <CollapsibleSection 
          title="Supplier Confirmations" 
          icon={ClipboardCheck} 
          defaultOpen={false}
          badge={<span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{order.supplier_confirmations.length}</span>}
        >
          <div className="space-y-2">
            {order.supplier_confirmations.map((sc: any) => {
              const cfg = PO_STATUS[sc.status] ?? PO_STATUS.draft;
              const Icon = cfg.icon;
              return (
                <div key={sc.purchase_order_id} className="flex justify-between items-center py-2 border-b last:border-0 hover:bg-muted/20 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{sc.supplier_name || sc.supplier_code}</p>
                    <p className="text-xs text-muted-foreground font-mono">{sc.po_number}</p>
                    {sc.confirmed_at && (
                      <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Confirmed {fmtAgo(sc.confirmed_at)}
                      </p>
                    )}
                    {sc.rejection_reason && (
                      <p className="text-[11px] text-red-600 flex items-center gap-1 mt-0.5">
                        <XCircle className="h-2.5 w-2.5" />
                        {sc.rejection_reason}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <Badge variant="outline" className={cn('text-[10px] gap-0.5', cfg.class)}>
                      <Icon className="h-2.5 w-2.5" />
                      {cfg.label}
                    </Badge>
                    <p className="text-xs font-medium tabular-nums mt-1">{fmtCurrency(sc.total_amount)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ============================================================
// Main Page - OrderDetailPage
// ============================================================
export default function OrderDetailPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const { data: order, isLoading, error, refetch } = useOrderDetail(orderId ?? null);
  const [tab, setTab] = useState('overview');
  
  const updateOrderStatus = useUpdateOrderStatus();
  const releaseProcurement = useReleaseProcurement();
  const closeOrder = useCloseOrder();

  const handleRefresh = () => refetch();

  const handleGateChange = (gateId: string) => {
    refetch();
  };

  const handlePendingAction = async (actionType: string) => {
    if (!order) return;
    
    switch (actionType) {
      case 'confirm_order':
        await updateOrderStatus.mutateAsync({ orderId: order.id, newStatus: 'confirmed' });
        await logGateEvent(order.id, 'G1');
        break;
      case 'release_procurement':
        await releaseProcurement.mutateAsync({ orderId: order.id });
        await logGateEvent(order.id, 'G2');
        break;
      case 'send_pos':
        setTab('procurement');
        toast.info('Go to Procurement tab to send POs');
        break;
      case 'remind_suppliers':
        setTab('procurement');
        toast.info('Go to Procurement tab to remind suppliers');
        break;
      case 'notify_customer':
        await logGateEvent(order.id, 'G5');
        toast.success('Customer notified via WhatsApp');
        break;
      case 'schedule_trip':
        setTab('trips');
        toast.info('Go to Trips tab to schedule delivery');
        break;
      case 'confirm_pod':
        setTab('trips');
        toast.info('Go to Trips tab to confirm POD');
        break;
      case 'upload_documents':
        setTab('procurement');
        toast.info('Go to Procurement tab to upload supplier documents');
        break;
      case 'customer_payment':
      case 'record_payment':
        setTab('finance');
        toast.info('Go to Finance tab to record payment');
        break;
      case 'close_order':
        await closeOrder.mutateAsync({ orderId: order.id });
        await logGateEvent(order.id, 'G12');
        break;
      default:
        break;
    }
    handleRefresh();
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="p-6 space-y-4 max-w-4xl mx-auto">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
            <div className="grid grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (error || !order) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="p-6 text-center text-muted-foreground">Order not found or error loading.</div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <Link to="/orders" className="mt-1 p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {order.code && (
                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-md">
                    {order.code}
                  </span>
                )}
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset",
                  ORDER_STATUS[order.status]?.class
                )}>
                  {React.createElement(ORDER_STATUS[order.status]?.icon || Clock, { className: "h-2.5 w-2.5" })}
                  {ORDER_STATUS[order.status]?.label ?? order.status}
                </div>
              </div>
              <h1 className="text-2xl font-bold mt-1.5 truncate">
                {order.project_name ?? order.customer_name ?? 'Order'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {order.customer_name && order.project_name ? order.customer_name : ''}
                {order.created_at && ` · Created ${fmtDate(order.created_at)}`}
              </p>
            </div>
            <GateSelector order={order} onStatusChange={handleRefresh} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard title="Order Value" value={fmtCurrency(order.total, order.currency)} icon={DollarSign} color="text-emerald-600" />
            <MetricCard title="Items" value={order.items?.length || 0} icon={Package} />
            <MetricCard title="Suppliers" value={order.purchase_orders?.length || 0} icon={Users} />
            <MetricCard title="Trips" value={order.trips?.length || 0} icon={TruckIcon} />
            <MetricCard title="Progress" value={`${order.purchase_orders?.filter((p: any) => p.status === 'supplier_confirmed').length || 0}/${order.purchase_orders?.length || 0}`} icon={TrendingUp} />
          </div>

          <CollapsibleGateSection 
            title="Order Journey & Next Action" 
            icon={Zap} 
            defaultOpen={false}
          >
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Gates Progress
              </h3>
              <GateProgress order={order} onGateChange={handleGateChange} />
            </div>
            
            <Separator className="my-4" />
            
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                Pending Action
              </h3>
              <NextActionBanner order={order} onAction={handlePendingAction} />
            </div>
          </CollapsibleGateSection>

          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="w-full grid grid-cols-4 h-10 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="overview" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Package className="h-3.5 w-3.5 mr-1.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="procurement" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                Procurement
              </TabsTrigger>
              <TabsTrigger value="trips" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Truck className="h-3.5 w-3.5 mr-1.5" />
                Trips
              </TabsTrigger>
              <TabsTrigger value="finance" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                Finance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <OverviewTab order={order} />
            </TabsContent>

            <TabsContent value="procurement" className="mt-4">
              <ProcurementTab order={order} onRefresh={handleRefresh} />
            </TabsContent>

            <TabsContent value="trips" className="mt-4">
              <OrderTripsTab orderId={order.id} orderItems={order.items} onRefresh={handleRefresh} />
            </TabsContent>

            <TabsContent value="finance" className="mt-4">
              <FinanceTab order={order} onRefresh={handleRefresh} />
            </TabsContent>
          </Tabs>
        </div>

        <QuickSummary order={order} />
      </AppLayout>
    </ProtectedRoute>
  );
}
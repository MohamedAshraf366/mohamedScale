import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout';
import { useOrders, type OrderRow } from '@/hooks/useOrders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Loader2, PackageOpen, ExternalLink, Search, Building2,
  Package, Truck, FileText, CircleDollarSign,
  ClipboardList, CheckCircle2, XCircle, Clock, AlertCircle,
  DollarSign, CreditCard, AlertTriangle, ShoppingCart,
  ClipboardCheck, SendHorizonal, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

/* ─── Status configs ─────────────────────────────────── */

const ORDER_STATUS_CFG: Record<string, { label: string; class: string }> = {
  created:     { label: 'Created',     class: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  confirmed:   { label: 'Confirmed',   class: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  in_progress: { label: 'In Progress', class: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  delivered:   { label: 'Delivered',   class: 'bg-green-500/10 text-green-700 border-green-500/20' },
  cancelled:   { label: 'Cancelled',   class: 'bg-red-500/10 text-red-700 border-red-500/20' },
};

const LIFECYCLE_CFG: Record<string, { label: string; class: string }> = {
  quotation:   { label: 'Quotation',   class: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
  procurement: { label: 'Procurement', class: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  finance:     { label: 'Finance',     class: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  closed:      { label: 'Closed',      class: 'bg-green-500/10 text-green-700 border-green-500/20' },
};

const SUPPLIER_CONF_CFG: Record<string, { label: string; class: string; icon: any; short: string }> = {
  pending:       { label: 'Pending Supplier Conf.',  class: 'bg-amber-500/10 text-amber-700 border-amber-500/20',      icon: Clock,         short: 'Pending' },
  partial:       { label: 'Partially Confirmed',     class: 'bg-blue-500/10 text-blue-700 border-blue-500/20',         icon: AlertCircle,   short: 'Partial' },
  all_confirmed: { label: 'All Suppliers Confirmed', class: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20', icon: CheckCircle2,  short: '✓ All OK' },
  rejected:      { label: 'Supplier Rejected',       class: 'bg-red-500/10 text-red-700 border-red-500/20',            icon: XCircle,       short: '✗ Rejected' },
};

const PAYMENT_CFG: Record<string, { label: string; class: string; icon: any }> = {
  unpaid:  { label: 'Unpaid',        class: 'bg-red-500/10 text-red-700 border-red-500/20',           icon: AlertCircle },
  partial: { label: 'Partial',       class: 'bg-amber-500/10 text-amber-700 border-amber-500/20',     icon: DollarSign },
  paid:    { label: 'Fully Paid',    class: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20', icon: CheckCircle2 },
};

/** Next pending ops gate label for this order */
function getNextAction(order: OrderRow): { label: string; class: string; icon: any } | null {
  if (order.status === 'cancelled' || order.lifecycle_stage === 'closed') return null;

  // ✅ العميل أكد خلاص (لأن الـ Order موجود أصلاً)
  // أول خطوة هي Release Procurement
  if (order.lifecycle_stage === 'quotation' && order.status === 'confirmed') {
    return { 
      label: 'Release Procurement', 
      class: 'bg-blue-500/10 text-blue-700 border-blue-500/20', 
      icon: ShoppingCart 
    };
  }
  
  // G3/G4: Send / confirm POs
  if (order.supplier_confirmation_status === 'pending') {
    return { 
      label: 'Send POs to Suppliers', 
      class: 'bg-amber-500/10 text-amber-700 border-amber-500/20', 
      icon: SendHorizonal 
    };
  }
  if (order.supplier_confirmation_status === 'partial') {
    return { 
      label: 'Awaiting Supplier Confirmation', 
      class: 'bg-amber-500/10 text-amber-700 border-amber-500/20', 
      icon: ClipboardCheck 
    };
  }
  if (order.supplier_confirmation_status === 'rejected') {
    return { 
      label: 'Re-negotiate Supplier', 
      class: 'bg-red-500/10 text-red-700 border-red-500/20', 
      icon: AlertTriangle 
    };
  }
  
  // بعد تأكيد الموردين
  if (order.supplier_confirmation_status === 'all_confirmed') {
    // G6: Schedule delivery
    if ((order.trips?.length || 0) === 0) {
      return { 
        label: 'Schedule Delivery', 
        class: 'bg-orange-500/10 text-orange-700 border-orange-500/20', 
        icon: Truck 
      };
    }
    // G11: Collect payment
    if (order.payment_status !== 'paid') {
      return { 
        label: 'Collect Payment', 
        class: 'bg-amber-500/10 text-amber-700 border-amber-500/20', 
        icon: CreditCard 
      };
    }
    // G12: Ready to close
    if (order.payment_status === 'paid') {
      return { 
        label: 'Ready to Close', 
        class: 'bg-green-500/10 text-green-700 border-green-500/20', 
        icon: CheckCircle2 
      };
    }
  }
  
  return null;
}


/* ─── Formatters ─────────────────────────────────────── */
function fmtCurrency(n: number | null, cur = 'SAR') {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-SA', {
    style: 'currency', currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}
function fmtDate(iso: string) {
  return format(new Date(iso), 'd MMM yy');
}

/* ─── Summary Cards ──────────────────────────────────── */
function SummaryCards({ orders }: { orders: OrderRow[] }) {
  const total = orders.length;
  const active = orders.filter((o) => !['cancelled', 'closed'].includes(o.lifecycle_stage ?? '') && o.status !== 'cancelled').length;
  const awaitingSupplier = orders.filter((o) =>
    o.supplier_confirmation_status === 'pending' || o.supplier_confirmation_status === 'partial',
  ).length;
  const totalValue = orders.reduce((s, o) => s + (o.total ?? 0), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {[
        { label: 'Total Orders',          value: total,                       icon: ClipboardList,  color: 'text-foreground' },
        { label: 'Active',                value: active,                      icon: Package,        color: 'text-emerald-600' },
        { label: 'Awaiting Supplier',     value: awaitingSupplier,            icon: ClipboardCheck, color: 'text-amber-600' },
        { label: 'Total Value',           value: fmtCurrency(totalValue),     icon: CircleDollarSign, color: 'text-primary' },
      ].map(({ label, value, icon: Icon, color }) => (
        <Card key={label} className="shadow-none">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className={cn('h-4 w-4', color)} />
            </div>
            <p className={cn('text-xl font-semibold mt-1', color)}>{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Orders Table ───────────────────────────────────── */
function OrdersTable({ orders }: { orders: OrderRow[] }) {
  const navigate = useNavigate();

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <PackageOpen className="h-12 w-12 mb-3 opacity-30" />
        <p className="font-medium">No orders found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs font-semibold w-[120px]">Order</TableHead>
            <TableHead className="text-xs font-semibold">Customer / Project</TableHead>
            <TableHead className="text-xs font-semibold hidden md:table-cell">Lifecycle</TableHead>
            <TableHead className="text-xs font-semibold hidden lg:table-cell">Supplier</TableHead>
            <TableHead className="text-xs font-semibold hidden lg:table-cell">Payment</TableHead>
            <TableHead className="text-xs font-semibold text-right">Value</TableHead>
            <TableHead className="text-xs font-semibold hidden xl:table-cell">Next Action</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const statusCfg = ORDER_STATUS_CFG[order.status];
            const lifecycleCfg = LIFECYCLE_CFG[order.lifecycle_stage ?? 'quotation'];
            const supplierCfg = order.supplier_confirmation_status
              ? SUPPLIER_CONF_CFG[order.supplier_confirmation_status]
              : null;
            const payCfg = order.payment_status ? PAYMENT_CFG[order.payment_status] : null;
            const nextAction = getNextAction(order);
            const NextIcon = nextAction?.icon;

            return (
              <TableRow
                key={order.id}
                className="cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                {/* Code + Date */}
                <TableCell className="py-3">
                  <div className="space-y-1">
                    <p className="text-xs font-mono font-semibold text-foreground">
                      {order.code ?? order.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtDate(order.created_at)}</p>
                    {statusCfg && (
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', statusCfg.class)}>
                        {statusCfg.label}
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* Lifecycle */}
                <TableCell className="py-3 hidden md:table-cell">
                  {lifecycleCfg && (
                    <Badge variant="outline" className={cn('text-xs', lifecycleCfg.class)}>
                      {lifecycleCfg.label}
                    </Badge>
                  )}
                  {order.customer_confirmed && (
                    <div className="mt-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                        ✓ Customer
                      </Badge>
                    </div>
                  )}
                </TableCell>

                {/* Supplier confirmation */}
                <TableCell className="py-3 hidden lg:table-cell">
                  {supplierCfg ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className={cn('text-xs gap-1 cursor-default', supplierCfg.class)}>
                            <supplierCfg.icon className="h-3 w-3" />
                            {supplierCfg.short}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent><p>{supplierCfg.label}</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Payment */}
                <TableCell className="py-3 hidden lg:table-cell">
                  {payCfg ? (
                    <Badge variant="outline" className={cn('text-xs gap-1', payCfg.class)}>
                      <payCfg.icon className="h-3 w-3" />
                      {payCfg.label}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Value */}
                <TableCell className="py-3 text-right">
                  <p className="text-sm font-semibold">{fmtCurrency(order.total, order.currency)}</p>
                  {(order.total_purchase_orders_value ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      PO: {fmtCurrency(order.total_purchase_orders_value)}
                    </p>
                  )}
                </TableCell>

                {/* Next Action */}
                <TableCell className="py-3 hidden xl:table-cell">
                  {nextAction && NextIcon ? (
                    <Badge variant="outline" className={cn('text-[10px] gap-1 whitespace-nowrap', nextAction.class)}>
                      <NextIcon className="h-3 w-3" />
                      {nextAction.label}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Open link */}
                <TableCell className="py-3">
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────── */

export default function OrdersPage() {
  const { data: orders, isLoading } = useOrders();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLifecycle, setFilterLifecycle] = useState('all');
  const [filterSupplierConf, setFilterSupplierConf] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');

  const filtered = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      if (filterStatus !== 'all' && o.status !== filterStatus) return false;
      if (filterLifecycle !== 'all' && (o.lifecycle_stage ?? 'quotation') !== filterLifecycle) return false;
      if (filterSupplierConf !== 'all' && o.supplier_confirmation_status !== filterSupplierConf) return false;
      if (filterPayment !== 'all' && o.payment_status !== filterPayment) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          o.code?.toLowerCase().includes(q) ||
          o.customer_name?.toLowerCase().includes(q) ||
          o.project_name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, search, filterStatus, filterLifecycle, filterSupplierConf, filterPayment]);

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Orders</h1>
              <p className="text-sm text-muted-foreground">Manage orders, supplier confirmations, and deliveries</p>
            </div>
          </div>

          {/* Summary */}
          {orders && <SummaryCards orders={orders} />}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Search orders…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterLifecycle} onValueChange={setFilterLifecycle}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Lifecycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="quotation">Quotation</SelectItem>
                <SelectItem value="procurement">Procurement</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterSupplierConf} onValueChange={setFilterSupplierConf}>
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue placeholder="Supplier Conf." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Supplier Statuses</SelectItem>
                <SelectItem value="pending">Pending Confirmation</SelectItem>
                <SelectItem value="partial">Partially Confirmed</SelectItem>
                <SelectItem value="all_confirmed">All Confirmed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Fully Paid</SelectItem>
              </SelectContent>
            </Select>

            {(filterStatus !== 'all' || filterLifecycle !== 'all' || filterSupplierConf !== 'all' || filterPayment !== 'all' || search) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => {
                  setSearch('');
                  setFilterStatus('all');
                  setFilterLifecycle('all');
                  setFilterSupplierConf('all');
                  setFilterPayment('all');
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <OrdersTable orders={filtered} />
          )}

          {/* Count */}
          {!isLoading && filtered.length > 0 && (
            <p className="text-xs text-muted-foreground text-center pb-2">
              Showing {filtered.length} of {orders?.length ?? 0} orders
            </p>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

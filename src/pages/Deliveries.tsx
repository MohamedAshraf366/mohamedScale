import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout';
import { useDeliveriesList, useUpdateDeliveryStatus, type DeliveryRow } from '@/hooks/useOperations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Truck, Search, CheckCircle2, Clock, AlertCircle, Navigation,
  CalendarClock, XCircle, ChevronRight, User, Phone, Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

/* ─── Config ─────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  pending:          { label: 'Pending',          class: 'bg-slate-500/10 text-slate-600 border-slate-400/20',        icon: Clock },
  scheduled:        { label: 'Scheduled',        class: 'bg-blue-500/10 text-blue-700 border-blue-500/20',           icon: CalendarClock },
  dispatched:       { label: 'Dispatched',       class: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20',     icon: Navigation },
  out_for_delivery: { label: 'Out for Delivery', class: 'bg-amber-500/10 text-amber-700 border-amber-500/20',        icon: Truck },
  delivered:        { label: 'Delivered',        class: 'bg-green-500/10 text-green-700 border-green-500/20',        icon: CheckCircle2 },
  failed:           { label: 'Failed',           class: 'bg-red-500/10 text-red-700 border-red-500/20',              icon: AlertCircle },
  cancelled:        { label: 'Cancelled',        class: 'bg-slate-500/10 text-slate-500 border-slate-400/20',        icon: XCircle },
};

const TRANSITIONS: Record<string, string[]> = {
  pending:          ['scheduled', 'cancelled'],
  scheduled:        ['dispatched', 'failed', 'cancelled'],
  dispatched:       ['out_for_delivery', 'failed'],
  out_for_delivery: ['delivered', 'failed'],
  delivered:        [],
  failed:           ['scheduled'],
  cancelled:        [],
};

const EVENT_LABELS: Record<string, string> = {
  created: 'Created', scheduled: 'Scheduled', dispatched: 'Dispatched',
  out_for_delivery: 'Out for delivery', arrived: 'Arrived', delivered: 'Delivered ✓',
  failed: 'Failed', cancelled: 'Cancelled', pod_uploaded: 'POD uploaded', note_added: 'Note',
};

function fmtDate(s: string | null) { return s ? format(new Date(s), 'd MMM yyyy') : '—'; }
function fmtDatetime(s: string) { return format(new Date(s), 'd MMM, h:mm a'); }
function fmtAgo(s: string) { return formatDistanceToNow(new Date(s), { addSuffix: true }); }

/* ─── Summary Cards ──────────────────────────────────── */
function SummaryCards({ rows }: { rows: DeliveryRow[] }) {
  const stats = [
    { label: 'Total', value: rows.length, color: 'text-foreground', icon: Hash },
    { label: 'Active', value: rows.filter(r => ['dispatched','out_for_delivery'].includes(r.status)).length, color: 'text-amber-600', icon: Truck },
    { label: 'Scheduled', value: rows.filter(r => r.status === 'scheduled').length, color: 'text-blue-600', icon: CalendarClock },
    { label: 'Delivered', value: rows.filter(r => r.status === 'delivered').length, color: 'text-green-600', icon: CheckCircle2 },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ label, value, color, icon: Icon }) => (
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

/* ─── Detail Sheet ───────────────────────────────────── */
function DeliveryDetailSheet({ row, open, onClose }: { row: DeliveryRow | null; open: boolean; onClose: () => void }) {
  const updateStatus = useUpdateDeliveryStatus();
  const navigate = useNavigate();
  if (!row) return null;
  const cfg = STATUS_CFG[row.status];
  const Icon = cfg?.icon ?? Clock;
  const nextStatuses = TRANSITIONS[row.status] ?? [];

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" side="right">
        <div className="p-6 space-y-5">
          <SheetHeader className="p-0 space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('gap-1 text-xs', cfg?.class)}>
                <Icon className="h-3 w-3" />{cfg?.label ?? row.status}
              </Badge>
              <span className="text-xs text-muted-foreground">Attempt #{row.attempt_no}</span>
            </div>
            <SheetTitle className="text-base">
              {row.customer_name ?? 'Delivery'}
              {row.order_code && <span className="text-muted-foreground font-normal text-sm ml-2">· {row.order_code}</span>}
            </SheetTitle>
          </SheetHeader>

          {/* Quick actions */}
          {nextStatuses.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {nextStatuses.map(s => (
                <Button key={s} size="sm" variant="outline" className="h-7 text-xs"
                  disabled={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ deliveryId: row.id, newStatus: s })}>
                  → {STATUS_CFG[s]?.label ?? s}
                </Button>
              ))}
            </div>
          )}

          {/* Info grid */}
          <Card className="shadow-none">
            <CardContent className="pt-4 pb-4 px-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {row.scheduled_at && <><span className="text-muted-foreground">Scheduled</span><span>{fmtDate(row.scheduled_at)}</span></>}
              {row.delivered_at && <><span className="text-muted-foreground">Delivered</span><span className="text-green-600">{fmtDatetime(row.delivered_at)}</span></>}
              {/* {row.failed_at && <><span className="text-muted-foreground">Failed at</span><span className="text-red-500">{fmtDatetime(row.failed_at)}</span></>} */}
              {row.driver_name && <><span className="text-muted-foreground">Driver</span><span>{row.driver_name}</span></>}
              {row.driver_phone && <><span className="text-muted-foreground">Phone</span><span>+{row.driver_phone}</span></>}
              {row.vehicle_plate && <><span className="text-muted-foreground">Vehicle</span><span className="font-mono">{row.vehicle_plate}</span></>}
              {row.dropoff_address && <><span className="text-muted-foreground">Address</span><span>{row.dropoff_address}</span></>}
              {row.signed_by && <><span className="text-muted-foreground">Signed by</span><span>{row.signed_by}</span></>}
              {row.failure_reason && <><span className="text-muted-foreground">Failure</span><span className="text-red-600 col-span-1">{row.failure_reason}</span></>}
            </CardContent>
          </Card>

          {/* Timeline */}
          {row.events.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Event Timeline</p>
              <div className="relative pl-6">
                <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
                <div className="space-y-3">
                  {row.events.map(evt => (
                    <div key={evt.id} className="relative">
                      <div className="absolute -left-4 top-1.5 h-2 w-2 rounded-full bg-primary border-2 border-background" />
                      <p className="text-sm font-medium">{EVENT_LABELS[evt.event_type] ?? evt.event_type}</p>
                      <p className="text-xs text-muted-foreground">{fmtAgo(evt.created_at)}</p>
                      {evt.actor_name && <p className="text-xs text-muted-foreground">{evt.actor_name}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {row.notes && (
            <Card className="shadow-none">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm">{row.notes}</p>
              </CardContent>
            </Card>
          )}

          <Button variant="outline" size="sm" className="text-xs w-fit"
            onClick={() => { onClose(); navigate(`/orders/${row.order_id}`); }}>
            <ChevronRight className="h-3.5 w-3.5 mr-1" />View Full Order
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Main ───────────────────────────────────────────── */
function DeliveriesContent() {
  const { data: rows, isLoading, error } = useDeliveriesList();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<DeliveryRow | null>(null);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter(r => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        r.order_code?.toLowerCase().includes(q) ||
        r.customer_name?.toLowerCase().includes(q) ||
        r.driver_name?.toLowerCase().includes(q) ||
        r.vehicle_plate?.toLowerCase().includes(q);
      return matchSearch && (!statusFilter || r.status === statusFilter);
    });
  }, [rows, search, statusFilter]);

  if (isLoading) return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i=><Skeleton key={i} className="h-20"/>)}</div>
      <Skeleton className="h-10 w-full"/>
      {[1,2,3,4,5].map(i=><Skeleton key={i} className="h-12 w-full"/>)}
    </div>
  );

  if (error) return (
    <div className="p-4 text-center text-destructive py-20">Failed to load deliveries. Please try again.</div>
  );

  return (
    <div className="p-4 space-y-4">
      {rows?.length ? <SummaryCards rows={rows} /> : null}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"/>
          <Input className="pl-8 h-8 text-sm" placeholder="Search order, customer, driver…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant={!statusFilter ? 'secondary' : 'ghost'} className="h-8 text-xs"
            onClick={() => setStatusFilter('')}>All</Button>
          {Object.entries(STATUS_CFG).map(([s, c]) => (
            <Button key={s} size="sm" variant={statusFilter === s ? 'secondary' : 'ghost'} className="h-8 text-xs"
              onClick={() => setStatusFilter(p => p === s ? '' : s)}>{c.label}</Button>
          ))}
        </div>
      </div>

      {/* Empty */}
      {!filtered.length && (
        <Card className="shadow-none">
          <CardContent className="py-12 text-center">
            <Truck className="h-8 w-8 mx-auto text-muted-foreground mb-3"/>
            <p className="font-medium">{search || statusFilter ? 'No deliveries match' : 'No deliveries yet'}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search || statusFilter ? 'Try adjusting filters.' : 'Schedule deliveries from the Order Detail page.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <Card className="shadow-none overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Scheduled</TableHead>
                <TableHead className="hidden lg:table-cell">Attempt</TableHead>
                <TableHead className="w-8"/>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(row => {
                const cfg = STATUS_CFG[row.status];
                const Icon = cfg?.icon ?? Clock;
                return (
                  <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelected(row)}>
                    <TableCell>
                      <span className="font-mono text-xs font-medium">
                        {row.order_code ?? row.order_id?.slice(0,8).toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{row.customer_name ?? <span className="text-muted-foreground">—</span>}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {row.driver_name
                        ? <div>
                            <p className="text-sm">{row.driver_name}</p>
                            {row.vehicle_plate && <p className="text-xs font-mono text-muted-foreground">{row.vehicle_plate}</p>}
                          </div>
                        : <span className="text-sm text-muted-foreground">Unassigned</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('gap-1 text-xs', cfg?.class)}>
                        <Icon className="h-3 w-3"/>{cfg?.label ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {fmtDate(row.scheduled_at)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground text-center">
                      #{row.attempt_no}
                    </TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground"/></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <DeliveryDetailSheet row={selected} open={!!selected} onClose={() => setSelected(null)}/>
    </div>
  );
}

const Deliveries = () => (
  <ProtectedRoute>
    <AppLayout title="Deliveries">
      <DeliveriesContent/>
    </AppLayout>
  </ProtectedRoute>
);

export default Deliveries;

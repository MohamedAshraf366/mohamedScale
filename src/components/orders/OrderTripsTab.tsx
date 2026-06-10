// OrderTripsTab.tsx - نسخة محدثة مع G6 و G7

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Truck, Package, User, Phone, CalendarClock, CheckCircle2,
  Clock, AlertCircle, Plus, Trash2, Edit2, XCircle, CheckCheck,
  TrendingUp, TrendingDown, SendHorizonal, Bell, ReceiptText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useOrderTrips, useMaterialRemaining, useCreateTrip, useUpdateTripStatus, useDeleteTrip } from '@/hooks/useOperations';
import { useDrivers } from '@/hooks/useOperations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/* ─── Constants ──────────────────────────────────────── */

// دالة تسجيل أحداث الـ Gate
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

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return format(new Date(iso), 'dd MMM yyyy');
}

interface OrderTripsTabProps {
  orderId: string;
  orderItems?: any[];
  onRefresh?: () => void;
}

// مكون إنشاء رحلة جديدة
function CreateTripDialog({
  orderId,
  open,
  onClose,
  onSuccess,
}: {
  orderId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { data: remainingMaterials, isLoading: loadingMaterials, refetch: refetchRemaining } = useMaterialRemaining(orderId);
  const { data: drivers } = useDrivers();
  const createTrip = useCreateTrip();
  
  const [form, setForm] = useState({
    scheduledDate: '',
    driverId: '',
    vehiclePlate: '',
    notes: '',
    selectedMaterials: [] as { material_id: string; quantity: number; name: string; maxQty: number }[],
  });
  
  const availableMaterials = useMemo(() => {
    return (remainingMaterials || []).filter(m => m.remaining > 0);
  }, [remainingMaterials]);
  
  const hasRemaining = availableMaterials.length > 0;
  
  const toggleMaterial = (material: any) => {
    const existing = form.selectedMaterials.find(s => s.material_id === material.material_id);
    if (existing) {
      setForm(f => ({
        ...f,
        selectedMaterials: f.selectedMaterials.filter(s => s.material_id !== material.material_id),
      }));
    } else {
      setForm(f => ({
        ...f,
        selectedMaterials: [...f.selectedMaterials, {
          material_id: material.material_id,
          quantity: material.remaining,
          name: material.material_name,
          maxQty: material.remaining,
        }],
      }));
    }
  };
  
  const updateQuantity = (materialId: string, quantity: number, maxQty: number) => {
    const qty = Math.min(Math.max(quantity, 1), maxQty);
    setForm(f => ({
      ...f,
      selectedMaterials: f.selectedMaterials.map(s =>
        s.material_id === materialId ? { ...s, quantity: qty } : s
      ),
    }));
  };
  
  async function submit() {
    if (!form.scheduledDate || form.selectedMaterials.length === 0) return;
    
    await createTrip.mutateAsync({
      orderId,
      scheduledDate: new Date(form.scheduledDate).toISOString(),
      driverId: form.driverId || undefined,
      vehiclePlate: form.vehiclePlate || undefined,
      notes: form.notes || undefined,
      materials: form.selectedMaterials.map(m => ({
        material_id: m.material_id,
        quantity: m.quantity,
      })),
    });
    
    onClose();
    onSuccess?.();
    await refetchRemaining();
    setForm({
      scheduledDate: '',
      driverId: '',
      vehiclePlate: '',
      notes: '',
      selectedMaterials: [],
    });
  }
  
  const totalQuantity = form.selectedMaterials.reduce((sum, m) => sum + m.quantity, 0);
  const totalDeliveredSoFar = (remainingMaterials || []).reduce((sum, m) => sum + m.total_delivered_to_customer, 0);
  const totalOrdered = (remainingMaterials || []).reduce((sum, m) => sum + m.total_ordered, 0);
  const deliveryPercentage = totalOrdered > 0 ? (totalDeliveredSoFar / totalOrdered) * 100 : 0;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Schedule New Delivery Trip (G6)</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select materials to deliver in this trip
          </p>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Overall Delivery Progress</span>
              <span className="text-sm font-bold text-primary">{deliveryPercentage.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${deliveryPercentage}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>Delivered: {totalDeliveredSoFar.toLocaleString()} units</span>
              <span>Remaining: {(totalOrdered - totalDeliveredSoFar).toLocaleString()} units</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Trip Details</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Scheduled Date *</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduledDate}
                  onChange={(e) => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Vehicle Plate</Label>
                <Input
                  placeholder="e.g., ABC 1234"
                  value={form.vehiclePlate}
                  onChange={(e) => setForm(f => ({ ...f, vehiclePlate: e.target.value }))}
                  className="h-9 mt-1"
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Driver Assignment</Label>
            <Select value={form.driverId} onValueChange={(v) => setForm(f => ({ ...f, driverId: v }))}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select driver (optional)" />
              </SelectTrigger>
              <SelectContent>
                {(drivers ?? []).map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.full_name} — {d.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold">Materials to Deliver *</Label>
              <Badge variant="outline" className="text-xs">
                {form.selectedMaterials.length} item(s) selected
              </Badge>
            </div>
            
            {loadingMaterials ? (
              <Skeleton className="h-60 w-full" />
            ) : !hasRemaining ? (
              <div className="border rounded-lg p-8 text-center bg-green-50/30">
                <CheckCheck className="h-12 w-12 mx-auto text-green-600 mb-3" />
                <p className="font-semibold text-green-800">All Materials Delivered! ✅</p>
                <p className="text-sm text-green-700 mt-1">
                  Total {totalDeliveredSoFar.toLocaleString()} units delivered successfully
                </p>
              </div>
            ) : (
              <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                {availableMaterials.map(material => {
                  const selected = form.selectedMaterials.find(s => s.material_id === material.material_id);
                  const maxQty = material.remaining;
                  const materialProgress = (material.total_delivered_to_customer / material.total_ordered) * 100;
                  
                  return (
                    <div key={material.material_id} className="p-4 hover:bg-muted/30">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {material.material_name !== 'Unknown Material' ? material.material_name : `Material ID: ${material.material_id}`}
                            </p>
                            {material.material_code && (
                              <span className="text-xs font-mono text-muted-foreground">
                                ({material.material_code})
                              </span>
                            )}
                          </div>
                          
                          <div className="mt-1">
                            <p className="text-xs text-muted-foreground">
                              Ordered: {material.total_ordered.toLocaleString()} {material.uom}
                            </p>
                          </div>
                          
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Delivery Status</span>
                              <span>{material.total_delivered_to_customer.toLocaleString()} / {material.total_ordered.toLocaleString()} {material.uom}</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${materialProgress}%` }}
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="outline" className="text-amber-600 text-xs">
                              Remaining: {material.remaining.toLocaleString()} {material.uom}
                            </Badge>
                          </div>
                        </div>
                        
                        <Button
                          size="sm"
                          variant={selected ? "destructive" : "default"}
                          onClick={() => toggleMaterial(material)}
                          className="h-8 px-3 ml-3"
                        >
                          {selected ? "Remove" : "Add to Trip"}
                        </Button>
                      </div>
                      
                      {selected && (
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t">
                          <Label className="text-xs font-medium">Quantity to deliver:</Label>
                          <Input
                            type="number"
                            value={selected.quantity}
                            onChange={(e) => updateQuantity(material.material_id, parseFloat(e.target.value) || 1, maxQty)}
                            className="w-28 h-8 text-sm"
                            max={maxQty}
                            min={1}
                            step="1"
                          />
                          <span className="text-sm text-muted-foreground">{material.uom}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {((selected.quantity / maxQty) * 100).toFixed(0)}% of remaining
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Notes</Label>
            <Textarea
              placeholder="Additional instructions or notes for driver..."
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="text-sm"
            />
          </div>
          
          {form.selectedMaterials.length > 0 && (
            <div className="bg-primary/5 rounded-lg p-4">
              <p className="text-xs font-semibold text-primary mb-2">Trip Summary</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Materials:</span>
                  <span className="font-medium">{form.selectedMaterials.length} item(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total quantity:</span>
                  <span className="font-medium">{totalQuantity.toLocaleString()} units</span>
                </div>
                <div className="flex justify-between pt-1 border-t mt-1">
                  <span className="text-muted-foreground">After this trip:</span>
                  <span className="font-medium text-green-600">
                    {(availableMaterials.reduce((sum, m) => {
                      const selectedQty = form.selectedMaterials.find(s => s.material_id === m.material_id)?.quantity || 0;
                      return sum + (m.remaining - selectedQty);
                    }, 0)).toLocaleString()} units remaining
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={submit} 
            disabled={!hasRemaining || !form.scheduledDate || form.selectedMaterials.length === 0 || createTrip.isPending}
            className="min-w-[120px]"
          >
            {createTrip.isPending ? 'Creating...' : `Create Trip (${form.selectedMaterials.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// مكون تحديث حالة الرحلة (G6 & G7)
function UpdateTripDialog({
  trip,
  orderId,
  open,
  onClose,
  onSuccess,
}: {
  trip: any;
  orderId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const updateStatus = useUpdateTripStatus();
  const [status, setStatus] = useState(trip.status);
  const [deliveredDate, setDeliveredDate] = useState('');
  const [isConfirmingPod, setIsConfirmingPod] = useState(false);

  const statusOptions = [
    { value: 'pending', label: 'Pending', icon: Clock, color: 'text-gray-600', gateKey: null },
    { value: 'scheduled', label: 'Scheduled', icon: CalendarClock, color: 'text-blue-600', gateKey: 'G6' },
    { value: 'dispatched', label: 'Dispatched', icon: Truck, color: 'text-amber-600', gateKey: 'G6' },
    { value: 'out_for_delivery', label: 'Out for Delivery', icon: SendHorizonal, color: 'text-purple-600', gateKey: 'G6' },
    { value: 'delivered', label: 'Delivered', icon: CheckCircle2, color: 'text-green-600', gateKey: 'G6' },
    { value: 'failed', label: 'Failed', icon: AlertCircle, color: 'text-red-600', gateKey: null },
  ];

  // دالة تأكيد استلام (POD) - G7
  const confirmPod = async () => {
    setIsConfirmingPod(true);
    try {
      await updateStatus.mutateAsync({
        tripId: trip.id,
        status: 'delivered',
        deliveredDate: deliveredDate || new Date().toISOString(),
        orderId,
      });
      await logGateEvent(orderId, 'G7', { trip_id: trip.id });
      toast.success('Receipt confirmed (POD) - G7 completed');
      onClose();
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to confirm receipt');
    } finally {
      setIsConfirmingPod(false);
    }
  };
  
  async function submit() {
    const selectedOption = statusOptions.find(opt => opt.value === status);
    
    await updateStatus.mutateAsync({
      tripId: trip.id,
      status,
      deliveredDate: status === 'delivered' ? deliveredDate || new Date().toISOString() : undefined,
      orderId,
    });
    
    if (selectedOption?.gateKey) {
      await logGateEvent(orderId, selectedOption.gateKey, { trip_id: trip.id, status, delivered_date: deliveredDate });
      
      // إرسال إشعار واتساب حسب الحالة
      const whatsappMessages: Record<string, string> = {
        dispatched: 'تم تجهيز طلبك للتوصيل (G6)',
        out_for_delivery: 'طلبك في طريقه إليك للتوصيل (G6)',
        delivered: 'تم توصيل طلبك بنجاح (G6)',
      };
      if (whatsappMessages[status]) {
        toast.info(`📱 WhatsApp: ${whatsappMessages[status]}`);
      }
    }
    
    onClose();
    onSuccess?.();
  }
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Trip Status (G6/G7)</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Trip #{trip.trip_number} - {fmtDate(trip.scheduled_date)}
          </p>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <opt.icon className={cn("h-3.5 w-3.5", opt.color)} />
                      {opt.label} {opt.gateKey && `(${opt.gateKey})`}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {status === 'delivered' && (
            <div className="space-y-2">
              <Label>Delivered Date</Label>
              <Input
                type="datetime-local"
                value={deliveredDate}
                onChange={(e) => setDeliveredDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave empty to use current time</p>
              
              <Button 
                variant="outline" 
                className="w-full mt-2 border-green-500 text-green-600"
                onClick={confirmPod}
                disabled={isConfirmingPod}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Confirm Receipt (G7 - POD)
              </Button>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={updateStatus.isPending}>
            {updateStatus.isPending ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// مكون بطاقة الرحلة
function TripCard({ trip, orderId, onRefresh }: { trip: any; orderId: string; onRefresh: () => void }) {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const deleteTrip = useDeleteTrip();
  
  const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType; gateKey?: string }> = {
    pending: { label: 'Pending', color: 'bg-gray-500/10 text-gray-700 border-gray-500/20', icon: Clock },
    scheduled: { label: 'Scheduled', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20', icon: CalendarClock, gateKey: 'G6' },
    dispatched: { label: 'Dispatched', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20', icon: Truck, gateKey: 'G6' },
    out_for_delivery: { label: 'Out for Delivery', color: 'bg-purple-500/10 text-purple-700 border-purple-500/20', icon: SendHorizonal, gateKey: 'G6' },
    delivered: { label: 'Delivered', color: 'bg-green-500/10 text-green-700 border-green-500/20', icon: CheckCircle2, gateKey: 'G6' },
    failed: { label: 'Failed', color: 'bg-red-500/10 text-red-700 border-red-500/20', icon: XCircle },
  };
  
  const cfg = statusConfig[trip.status] || statusConfig.pending;
  const StatusIcon = cfg.icon;
  
  const totalQuantity = trip.materials?.reduce((sum: number, m: any) => sum + m.quantity, 0) || 0;
  const allDelivered = trip.materials?.every((m: any) => m.status === 'delivered') || false;
  
  // دالة للتحديث مع تسجيل الحدث
  const handleStatusUpdate = async (newStatus: string, gateKey: string) => {
    await logGateEvent(orderId, gateKey, { trip_id: trip.id, status: newStatus });
    toast.info(`Status updated to ${newStatus} - ${gateKey}`);
    onRefresh();
  };
  
  return (
    <>
      <Card className="shadow-sm hover:shadow-md transition-all">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn("gap-1", cfg.color)}>
                <StatusIcon className="h-3 w-3" />
                {cfg.label} {cfg.gateKey && `(${cfg.gateKey})`}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                Trip #{trip.trip_number}
              </span>
              {allDelivered && (
                <Badge className="bg-green-100 text-green-700 text-xs gap-1">
                  <CheckCheck className="h-3 w-3" />
                  Complete
                </Badge>
              )}
            </div>
            <div className="flex gap-1">
              {trip.status !== 'delivered' && trip.status !== 'failed' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setShowUpdateDialog(true)}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => deleteTrip.mutate({ tripId: trip.id, orderId })}
                disabled={deleteTrip.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex items-center gap-2 text-sm">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <span>Scheduled: {fmtDate(trip.scheduled_date)}</span>
            </div>
            {trip.delivered_date && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Delivered: {fmtDate(trip.delivered_date)}</span>
              </div>
            )}
          </div>
          
          {trip.driver_name && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3 flex-wrap">
              <User className="h-3.5 w-3.5" />
              <span>{trip.driver_name}</span>
              <Phone className="h-3.5 w-3.5" />
              <span>{trip.driver_phone}</span>
              {trip.vehicle_plate && (
                <>
                  <Truck className="h-3.5 w-3.5" />
                  <span className="font-mono">{trip.vehicle_plate}</span>
                </>
              )}
            </div>
          )}
          
          <div className="border-t pt-3 mt-2">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Materials in this trip ({trip.materials?.length || 0} items, {totalQuantity} units)
            </p>
            <div className="space-y-2">
              {trip.materials?.map((tm: any, idx: number) => (
                <div key={tm.id || idx} className="flex justify-between text-sm items-center p-2 bg-muted/20 rounded">
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {tm.material_name && tm.material_name !== 'Unknown' 
                        ? tm.material_name 
                        : `Item ${idx + 1}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Material ID: {tm.material_id?.slice(0, 8)}...
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {tm.quantity.toLocaleString()} {tm.uom}
                    </Badge>
                    {tm.status === 'delivered' && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {trip.notes && (
            <div className="border-t pt-2 mt-2">
              <p className="text-xs text-muted-foreground">Notes: {trip.notes}</p>
            </div>
          )}
          
          {/* G6 Quick Actions */}
          {trip.status === 'scheduled' && (
            <div className="flex gap-2 mt-3 pt-2 border-t">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => handleStatusUpdate('dispatched', 'G6')}>
                <Truck className="h-3 w-3 mr-1" />
                Dispatch (G6)
              </Button>
            </div>
          )}
          {trip.status === 'dispatched' && (
            <div className="flex gap-2 mt-3 pt-2 border-t">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => handleStatusUpdate('out_for_delivery', 'G6')}>
                <SendHorizonal className="h-3 w-3 mr-1" />
                Out for Delivery (G6)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      <UpdateTripDialog
        trip={trip}
        orderId={orderId}
        open={showUpdateDialog}
        onClose={() => setShowUpdateDialog(false)}
        onSuccess={onRefresh}
      />
    </>
  );
}

// المكون الرئيسي
export function OrderTripsTab({ orderId, orderItems, onRefresh }: OrderTripsTabProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { data: trips, isLoading, error, refetch: refetchTrips } = useOrderTrips(orderId);
  const { data: remainingMaterials, refetch: refetchRemaining } = useMaterialRemaining(orderId);
  
  const handleRefresh = async () => {
    await Promise.all([refetchTrips(), refetchRemaining()]);
    setRefreshKey(prev => prev + 1);
    onRefresh?.();
  };
  
  // حساب الإحصائيات
  const stats = useMemo(() => {
    const totalOrdered = (remainingMaterials || []).reduce((sum, m) => sum + m.total_ordered, 0);
    const totalDelivered = (remainingMaterials || []).reduce((sum, m) => sum + m.total_delivered_to_customer, 0);
    const remainingCount = (remainingMaterials || []).filter(m => m.remaining > 0).length;
    const hasRemaining = remainingCount > 0;
    const deliveryPercentage = totalOrdered > 0 ? (totalDelivered / totalOrdered) * 100 : 0;
    const isFullyDelivered = !hasRemaining && totalOrdered > 0;
    
    return {
      totalOrdered,
      totalDelivered,
      remainingCount,
      hasRemaining,
      deliveryPercentage,
      isFullyDelivered,
    };
  }, [remainingMaterials]);
  
  const totalTrips = trips?.length || 0;
  const deliveredTrips = trips?.filter(t => t.status === 'delivered').length || 0;
  
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  
  if (error) {
    return (
      <Card className="shadow-none border-destructive/50">
        <CardContent className="py-8 text-center text-destructive">
          Failed to load trips. Please try again.
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4" key={refreshKey}>
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{totalTrips}</p>
            <p className="text-xs text-muted-foreground">Total Trips</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{deliveredTrips}</p>
            <p className="text-xs text-muted-foreground">Delivered Trips</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.deliveryPercentage.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Delivery Rate</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {(stats.totalOrdered - stats.totalDelivered).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Units Remaining</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Full Delivery Message */}
      {stats.isFullyDelivered && (
        <Card className="shadow-sm border-green-500/30 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 rounded-full p-2">
                <CheckCheck className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-green-800">All Materials Fully Delivered! ✅</p>
                <p className="text-sm text-green-700 mt-0.5">
                  Total {stats.totalDelivered.toLocaleString()} units delivered across {deliveredTrips} trip(s)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Remaining Materials Summary */}
      {stats.hasRemaining && (
        <Card className="shadow-sm border-amber-500/30 bg-amber-50/30">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Materials Still Need Delivery
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  {stats.remainingCount} material(s) remaining | {(stats.totalOrdered - stats.totalDelivered).toLocaleString()} units left to deliver
                </p>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-amber-700 mb-1">
                    <span>Overall Progress</span>
                    <span>{stats.deliveryPercentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 w-full bg-amber-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${stats.deliveryPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                New Trip (G6)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Remaining Materials Details */}
      {stats.hasRemaining && remainingMaterials && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Remaining Materials Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {remainingMaterials.filter(m => m.remaining > 0).map(material => (
              <div key={material.material_id} className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{material.material_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Ordered: {material.total_ordered.toLocaleString()} {material.uom} | 
                    Delivered: {material.total_delivered_to_customer.toLocaleString()} {material.uom}
                  </p>
                </div>
                <Badge variant="outline" className="text-amber-600">
                  {material.remaining.toLocaleString()} {material.uom} left
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Trips List */}
      {!trips?.length ? (
        <Card className="shadow-sm border-dashed">
          <CardContent className="py-10 text-center">
            <Truck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No delivery trips scheduled yet</p>
            {stats.hasRemaining ? (
              <Button 
                className="mt-3"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Schedule First Trip (G6)
              </Button>
            ) : (
              <p className="text-xs text-green-600 mt-2">✓ All materials have been delivered</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {trips.map((trip: any) => (
            <TripCard key={trip.id} trip={trip} orderId={orderId} onRefresh={handleRefresh} />
          ))}
        </div>
      )}
      
      {/* Create Trip Dialog */}
      {stats.hasRemaining && (
        <CreateTripDialog
          orderId={orderId}
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
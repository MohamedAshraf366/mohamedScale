// OrderTripsTab.tsx - النسخة المعدلة مع منع العمليات قبل G4

import React, { useState, useMemo, useEffect } from 'react';
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
  TrendingUp, SendHorizonal, RefreshCw, Ban, AlertTriangle, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Alert, AlertDescription, AlertTitle,
} from '@/components/ui/alert';

// ============================================================
// Types
// ============================================================

interface TripMaterial {
  material_id: string;
  material_name: string;
  quantity: number;
  uom: string;
}

export interface Trip {
  id: string;
  order_id: string;
  trip_number: string;
  scheduled_date: string | null;
  delivered_date: string | null;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_plate: string | null;
  status: string;
  notes: string | null;
  materials: TripMaterial[];
  created_at: string;
}

interface RemainingMaterial {
  material_id: string;
  material_name: string;
  total_ordered: number;
  total_scheduled: number;
  remaining: number;
  uom: string;
}

interface OrderTripsTabProps {
  orderId: string;
  orderItems?: any[];
  onRefresh?: () => void;
  highlightTripId?: string | null;
  isProcurementReleased?: boolean; // ✅ إضافة prop جديد
}

// ============================================================
// Utilities
// ============================================================

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'dd MMM yyyy');
  } catch {
    return iso;
  }
}

// ============================================================
// Hooks
// ============================================================

function useOrderTrips(orderId: string) {
  return useQuery({
    queryKey: ['order-trips', orderId],
    queryFn: async (): Promise<Trip[]> => {
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
    enabled: !!orderId,
  });
}

function useMaterialRemaining(orderId: string) {
  return useQuery({
    queryKey: ['material-remaining', orderId],
    queryFn: async (): Promise<RemainingMaterial[]> => {
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
        const materials = trip.materials as TripMaterial[] || [];
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
          total_ordered: totalOrdered,
          total_scheduled: totalScheduled,
          remaining: Math.max(0, totalOrdered - totalScheduled),
          uom: item.uom || item.material?.uom || 'piece',
        };
      });
    },
    enabled: !!orderId,
  });
}

function useDrivers() {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, full_name, phone, status')
        .eq('status', 'active');
      if (error) return [];
      return data || [];
    },
  });
}

// ============================================================
// CreateTripDialog Component
// ============================================================

function CreateTripDialog({
  orderId,
  open,
  onClose,
  onSuccess,
  isProcurementReleased, // ✅ استقبال prop
}: {
  orderId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isProcurementReleased?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: remainingMaterials = [], isLoading: loadingMaterials, refetch: refetchRemaining } = useMaterialRemaining(orderId);
  const { data: drivers = [] } = useDrivers();
  const [isCreating, setIsCreating] = useState(false);
  
  const [form, setForm] = useState({
    scheduledDate: '',
    driverId: '',
    driverName: '',
    driverPhone: '',
    vehiclePlate: '',
    notes: '',
    selectedMaterials: [] as { material_id: string; quantity: number; name: string; maxQty: number; uom: string }[],
  });
  
  const availableMaterials = useMemo(() => {
    return remainingMaterials.filter(m => m.remaining > 0);
  }, [remainingMaterials]);
  
  const toggleMaterial = (material: RemainingMaterial) => {
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
          uom: material.uom,
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
    if (!isProcurementReleased) {
      toast.error('Cannot create trips until suppliers confirm (G4)');
      return;
    }
    
    if (!form.scheduledDate || form.selectedMaterials.length === 0) {
      toast.error('Please select materials and scheduled date');
      return;
    }
    
    setIsCreating(true);
    
    try {
      const tripNumber = `TRP-${String(Date.now()).slice(-8)}`;
      
      let driverName = form.driverName;
      let driverPhone = form.driverPhone;
      
      if (form.driverId) {
        const selectedDriver = drivers.find(d => d.id === form.driverId);
        if (selectedDriver) {
          driverName = selectedDriver.full_name;
          driverPhone = selectedDriver.phone;
        }
      }
      
      const materialsJSON = form.selectedMaterials.map(m => ({
        material_id: m.material_id,
        material_name: m.name,
        quantity: m.quantity,
        uom: m.uom,
      }));
      
      const { error: tripError } = await supabase
        .from('delivery_trips')
        .insert({
          order_id: orderId,
          trip_number: tripNumber,
          scheduled_date: new Date(form.scheduledDate).toISOString(),
          driver_id: form.driverId || null,
          driver_name: driverName || null,
          driver_phone: driverPhone || null,
          vehicle_plate: form.vehiclePlate || null,
          notes: form.notes || null,
          status: 'scheduled',
          materials: materialsJSON,
        });
      
      if (tripError) throw tripError;
      
      await queryClient.invalidateQueries({ queryKey: ['order-trips', orderId] });
      await queryClient.invalidateQueries({ queryKey: ['material-remaining', orderId] });
      await refetchRemaining();
      
      toast.success(`✅ Trip created! ${form.selectedMaterials.length} material(s) scheduled`);
      
      setForm({
        scheduledDate: '',
        driverId: '',
        driverName: '',
        driverPhone: '',
        vehiclePlate: '',
        notes: '',
        selectedMaterials: [],
      });
      onClose();
      onSuccess?.();
      
    } catch (error: any) {
      console.error('Create trip error:', error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  }
  
  const totalQuantity = form.selectedMaterials.reduce((sum, m) => sum + m.quantity, 0);
  const totalOrdered = remainingMaterials.reduce((sum, m) => sum + m.total_ordered, 0);
  const totalScheduled = remainingMaterials.reduce((sum, m) => sum + m.total_scheduled, 0);
  const progressPercent = totalOrdered > 0 ? (totalScheduled / totalOrdered) * 100 : 0;
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        onClose();
        setTimeout(() => {
          refetchRemaining();
          onSuccess?.();
        }, 100);
      }
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Schedule New Delivery Trip (G6)
          </DialogTitle>
        </DialogHeader>
        
        {/* ✅ رسالة تحذير إذا لم يتم إطلاق المشتريات */}
        {!isProcurementReleased && (
          <Alert className="border-amber-200 bg-amber-50">
            <Lock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              ⚠️ Procurement not released yet. Please complete G2 (Release Procurement) and G4 (Supplier Confirmations) before creating trips.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-6 py-4">
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Overall Delivery Progress</span>
              <span className="text-sm font-bold text-primary">{progressPercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>✅ Scheduled: {totalScheduled.toLocaleString()} units</span>
              <span>📦 Remaining: {(totalOrdered - totalScheduled).toLocaleString()} units</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Scheduled Date *</Label>
              <Input 
                type="datetime-local" 
                value={form.scheduledDate} 
                onChange={(e) => setForm(f => ({ ...f, scheduledDate: e.target.value }))} 
                className="h-9 mt-1"
                disabled={!isProcurementReleased}
              />
            </div>
            <div>
              <Label className="text-xs">Vehicle Plate</Label>
              <Input 
                placeholder="e.g., ABC 1234" 
                value={form.vehiclePlate} 
                onChange={(e) => setForm(f => ({ ...f, vehiclePlate: e.target.value }))} 
                className="h-9 mt-1"
                disabled={!isProcurementReleased}
              />
            </div>
          </div>
          
          <div>
            <Label className="text-sm">Driver</Label>
            <Select 
              value={form.driverId} 
              onValueChange={(v) => {
                const driver = drivers.find(d => d.id === v);
                setForm(f => ({ 
                  ...f, 
                  driverId: v,
                  driverName: driver?.full_name || '',
                  driverPhone: driver?.phone || '',
                }));
              }}
              disabled={!isProcurementReleased}
            >
              <SelectTrigger className="h-9 mt-1">
                <SelectValue placeholder="Select driver (optional)" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.full_name} — {d.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label className="text-sm font-semibold">Materials *</Label>
              <Badge variant="outline">{form.selectedMaterials.length} selected</Badge>
            </div>
            
            {loadingMaterials ? (
              <Skeleton className="h-60 w-full" />
            ) : availableMaterials.length === 0 ? (
              <div className="border rounded-lg p-8 text-center bg-green-50/30">
                <CheckCheck className="h-12 w-12 mx-auto text-green-600 mb-3" />
                <p className="font-semibold text-green-800">All Materials Scheduled! ✅</p>
              </div>
            ) : (
              <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                {availableMaterials.map(material => {
                  const selected = form.selectedMaterials.find(s => s.material_id === material.material_id);
                  return (
                    <div key={material.material_id} className="p-3">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">{material.material_name}</p>
                          <p className="text-xs text-muted-foreground">Ordered: {material.total_ordered} {material.uom}</p>
                          <Badge variant="outline" className="text-amber-600 text-xs mt-1">Remaining: {material.remaining} {material.uom}</Badge>
                        </div>
                        <Button 
                          size="sm" 
                          variant={selected ? "destructive" : "default"} 
                          onClick={() => toggleMaterial(material)}
                          disabled={!isProcurementReleased}
                        >
                          {selected ? "Remove" : "Add"}
                        </Button>
                      </div>
                      {selected && (
                        <div className="flex items-center gap-3 mt-3 pt-2 border-t">
                          <Label className="text-xs">Quantity:</Label>
                          <Input 
                            type="number" 
                            value={selected.quantity} 
                            onChange={(e) => updateQuantity(material.material_id, parseFloat(e.target.value) || 1, material.remaining)} 
                            className="w-24 h-8" 
                            min={1} 
                            max={material.remaining}
                            disabled={!isProcurementReleased}
                          />
                          <span className="text-sm">{material.uom}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <Textarea 
            placeholder="Additional notes..." 
            value={form.notes} 
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} 
            rows={2}
            disabled={!isProcurementReleased}
          />
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={submit} 
            disabled={!isProcurementReleased || availableMaterials.length === 0 || !form.scheduledDate || form.selectedMaterials.length === 0 || isCreating}
          >
            {isCreating ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Creating...</> : <>Create Trip ({form.selectedMaterials.length})</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// UpdateTripDialog Component
// ============================================================

function UpdateTripDialog({
  trip,
  orderId,
  open,
  onClose,
  onSuccess,
  isProcurementReleased,
}: {
  trip: Trip;
  orderId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isProcurementReleased?: boolean;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(trip.status);
  const [failReason, setFailReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const statusOptions = [
    { value: 'scheduled', label: 'Scheduled', icon: CalendarClock, color: 'text-blue-600', needsReason: false },
    { value: 'dispatched', label: 'Dispatched', icon: Truck, color: 'text-amber-600', needsReason: false },
    { value: 'out_for_delivery', label: 'Out for Delivery', icon: SendHorizonal, color: 'text-purple-600', needsReason: false },
    { value: 'delivered', label: 'Delivered', icon: CheckCircle2, color: 'text-green-600', needsReason: false },
    { value: 'failed', label: 'Failed', icon: XCircle, color: 'text-red-600', needsReason: true },
    { value: 'cancelled', label: 'Cancelled', icon: Ban, color: 'text-gray-600', needsReason: true },
  ];
  
  const selectedOption = statusOptions.find(opt => opt.value === status);
  const needsReason = selectedOption?.needsReason || false;
  
  async function handleUpdate() {
    // التحقق من وجود سبب إذا كان مطلوب
    if (needsReason) {
      if (status === 'failed' && !failReason.trim()) {
        toast.error('Please provide a reason for delivery failure');
        return;
      }
      if (status === 'cancelled' && !cancelReason.trim()) {
        toast.error('Please provide a reason for cancellation');
        return;
      }
    }
    
    setIsUpdating(true);
    try {
      const updateData: any = { status };
      
      if (status === 'delivered') {
        updateData.delivered_date = new Date().toISOString();
      }
      
      // إضافة سبب الفشل أو الإلغاء إلى notes
      if (status === 'failed' && failReason.trim()) {
        const existingNotes = trip.notes || '';
        updateData.notes = existingNotes 
          ? `${existingNotes}\n[Failed] ${failReason}`
          : `[Failed] ${failReason}`;
      }
      
      if (status === 'cancelled' && cancelReason.trim()) {
        const existingNotes = trip.notes || '';
        updateData.notes = existingNotes 
          ? `${existingNotes}\n[Cancelled] ${cancelReason}`
          : `[Cancelled] ${cancelReason}`;
      }
      
      await supabase.from('delivery_trips').update(updateData).eq('id', trip.id);
      
      await queryClient.invalidateQueries({ queryKey: ['order-trips', orderId] });
      await queryClient.invalidateQueries({ queryKey: ['material-remaining', orderId] });
      
      if (status === 'failed') {
        toast.error(`Trip marked as failed: ${failReason}`);
      } else if (status === 'cancelled') {
        toast.warning(`Trip cancelled: ${cancelReason}`);
      } else {
        toast.success(`Trip status updated to ${status}`);
      }
      
      onClose();
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to update');
    } finally {
      setIsUpdating(false);
    }
  }
  
  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    setFailReason('');
    setCancelReason('');
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Trip Status</DialogTitle>
          <p className="text-sm text-muted-foreground">Trip #{trip.trip_number}</p>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={handleStatusChange} disabled={!isProcurementReleased}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <opt.icon className={cn("h-3.5 w-3.5", opt.color)} />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {status === 'failed' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label className="text-sm font-semibold">
                Failure Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea 
                rows={3}
                placeholder="e.g., Customer not available, Wrong address, Damaged items, Vehicle breakdown, etc."
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                className="resize-none"
                disabled={!isProcurementReleased}
              />
            </div>
          )}
          
          {status === 'cancelled' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label className="text-sm font-semibold">
                Cancellation Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea 
                rows={3}
                placeholder="e.g., Order cancelled by customer, Supplier issue, Consolidation with another trip, etc."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="resize-none"
                disabled={!isProcurementReleased}
              />
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleUpdate} 
            disabled={!isProcurementReleased || isUpdating || (status === 'failed' && !failReason.trim()) || (status === 'cancelled' && !cancelReason.trim())}
          >
            {isUpdating ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// TripCard Component
// ============================================================

function TripCard({ trip, orderId, onRefresh, isHighlighted, isProcurementReleased }: { 
  trip: Trip; 
  orderId: string; 
  onRefresh: () => void; 
  isHighlighted?: boolean;
  isProcurementReleased?: boolean;
}) {
  const queryClient = useQueryClient();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    scheduled: { label: 'Scheduled', color: 'bg-blue-500/10 text-blue-700', icon: CalendarClock },
    dispatched: { label: 'Dispatched', color: 'bg-amber-500/10 text-amber-700', icon: Truck },
    out_for_delivery: { label: 'Out for Delivery', color: 'bg-purple-500/10 text-purple-700', icon: SendHorizonal },
    delivered: { label: 'Delivered', color: 'bg-green-500/10 text-green-700', icon: CheckCircle2 },
    failed: { label: 'Failed', color: 'bg-red-500/10 text-red-700', icon: XCircle },
    cancelled: { label: 'Cancelled', color: 'bg-gray-500/10 text-gray-700', icon: Ban },
  };
  
  const cfg = statusConfig[trip.status] || { label: trip.status, color: 'bg-gray-500/10 text-gray-700', icon: Clock };
  const StatusIcon = cfg.icon;
  const totalQuantity = trip.materials?.reduce((sum, m) => sum + m.quantity, 0) || 0;
  
  const handleDelete = async () => {
    if (!isProcurementReleased) {
      toast.error('Cannot delete trips before supplier confirmation (G4)');
      return;
    }
    
    setIsDeleting(true);
    try {
      await supabase.from('delivery_trips').delete().eq('id', trip.id);
      await queryClient.invalidateQueries({ queryKey: ['order-trips', orderId] });
      await queryClient.invalidateQueries({ queryKey: ['material-remaining', orderId] });
      toast.success('Trip deleted');
      onRefresh();
    } catch (error) {
      toast.error('Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <>
      <Card id={`trip-${trip.id}`} className={cn("shadow-sm hover:shadow-md transition-all", isHighlighted && "ring-2 ring-primary ring-offset-2")}>
        <CardContent className="p-4">
          <div className="flex justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("gap-1", cfg.color)}>
                <StatusIcon className="h-3 w-3" />
                {cfg.label}
              </Badge>
              <span className="text-xs font-mono">#{trip.trip_number}</span>
            </div>
            <div className="flex gap-1">
              {(trip.status !== 'delivered' && trip.status !== 'failed' && trip.status !== 'cancelled') && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 w-7" 
                  onClick={() => setShowUpdateDialog(true)}
                  disabled={!isProcurementReleased}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 text-destructive" 
                onClick={handleDelete} 
                disabled={isDeleting || !isProcurementReleased}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm mb-3">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <span>Scheduled: {fmtDate(trip.scheduled_date)}</span>
          </div>
          
          {trip.delivered_date && (
            <div className="flex items-center gap-2 text-sm text-green-600 mb-3">
              <CheckCircle2 className="h-4 w-4" />
              <span>Delivered: {fmtDate(trip.delivered_date)}</span>
            </div>
          )}
          
          {trip.driver_name && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
              <User className="h-3.5 w-3.5" />
              <span>{trip.driver_name}</span>
              <Phone className="h-3.5 w-3.5" />
              <span>{trip.driver_phone}</span>
            </div>
          )}
          
          <div className="border-t pt-3">
            <p className="text-xs font-semibold mb-2">{trip.materials?.length || 0} items, {totalQuantity} units</p>
            <div className="space-y-1">
              {trip.materials?.slice(0, 2).map((m, i) => (
                <div key={i} className="flex justify-between text-sm p-2 bg-muted/20 rounded">
                  <span>{m.material_name}</span>
                  <Badge variant="outline">{m.quantity} {m.uom}</Badge>
                </div>
              ))}
              {(trip.materials?.length || 0) > 2 && (
                <p className="text-xs text-center text-muted-foreground">+ {trip.materials!.length - 2} more</p>
              )}
            </div>
          </div>
          
          {trip.notes && (
            <div className="border-t pt-2 mt-2">
              <p className="text-xs text-muted-foreground">Notes: {trip.notes}</p>
            </div>
          )}
        </CardContent>
        
        <UpdateTripDialog 
          trip={trip} 
          orderId={orderId} 
          open={showUpdateDialog} 
          onClose={() => setShowUpdateDialog(false)} 
          onSuccess={onRefresh}
          isProcurementReleased={isProcurementReleased}
        />
      </Card>
    </>
  );
}

// ============================================================
// Main Component - OrderTripsTab
// ============================================================

export function OrderTripsTab({ orderId, onRefresh, highlightTripId, isProcurementReleased = false }: OrderTripsTabProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { data: trips = [], isLoading, error, refetch: refetchTrips } = useOrderTrips(orderId);
  const { data: remainingMaterials = [], refetch: refetchRemaining } = useMaterialRemaining(orderId);
  
  const handleRefresh = async () => {
    await Promise.all([refetchTrips(), refetchRemaining()]);
    setRefreshKey(prev => prev + 1);
    onRefresh?.();
  };
  
  const stats = {
    totalTrips: trips.length,
    deliveredTrips: trips.filter(t => t.status === 'delivered').length,
    totalOrdered: remainingMaterials.reduce((s, m) => s + m.total_ordered, 0),
    totalScheduled: remainingMaterials.reduce((s, m) => s + m.total_scheduled, 0),
    hasRemaining: remainingMaterials.some(m => m.remaining > 0),
    progressPercent: remainingMaterials.reduce((s, m) => s + m.total_ordered, 0) > 0 
      ? (remainingMaterials.reduce((s, m) => s + m.total_scheduled, 0) / remainingMaterials.reduce((s, m) => s + m.total_ordered, 0)) * 100 
      : 0,
  };
  
  if (isLoading) return <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-40 w-full" /></div>;
  if (error) return <Card className="border-destructive/50"><CardContent className="py-8 text-center text-destructive">Failed to load trips. <Button variant="link" onClick={() => { refetchTrips(); refetchRemaining(); }}>Try again</Button></CardContent></Card>;
  
  return (
    <div className="space-y-4" key={refreshKey}>
      {/* ✅ رسالة تحذير إذا لم يتم إطلاق المشتريات */}
      {!isProcurementReleased && (
        <Alert className="border-amber-200 bg-amber-50">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 text-sm font-semibold">Procurement Not Released</AlertTitle>
          <AlertDescription className="text-amber-700 text-sm">
            You cannot create or modify trips until suppliers confirm (G4). Please complete G2 (Release Procurement) and G4 (Supplier Confirmations) first.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-primary">{stats.totalTrips}</p><p className="text-xs">Total Trips</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-green-600">{stats.deliveredTrips}</p><p className="text-xs">Delivered</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-blue-600">{stats.progressPercent.toFixed(0)}%</p><p className="text-xs">Progress</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-amber-600">{(stats.totalOrdered - stats.totalScheduled).toLocaleString()}</p><p className="text-xs">Remaining</p></CardContent></Card>
      </div>
      
      {stats.hasRemaining ? (
        <Card className="border-amber-500/30 bg-amber-50/30">
          <CardContent className="p-4 flex justify-between items-center">
            <div><p className="text-sm font-semibold text-amber-800">⚠️ {(stats.totalOrdered - stats.totalScheduled).toLocaleString()} units remaining</p></div>
            <Button 
              size="sm" 
              onClick={() => setShowCreateDialog(true)}
              disabled={!isProcurementReleased}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />New Trip (G6)
            </Button>
          </CardContent>
        </Card>
      ) : stats.totalOrdered > 0 ? (
        <Card className="border-green-500/30 bg-green-50/50">
          <CardContent className="p-4"><div className="flex items-center gap-2"><CheckCheck className="h-5 w-5 text-green-600" /><p className="text-sm font-semibold text-green-800">All materials scheduled! ✅</p></div></CardContent>
        </Card>
      ) : null}
      
      {stats.hasRemaining && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Remaining Materials</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {remainingMaterials.filter(m => m.remaining > 0).map(m => (
              <div key={m.material_id} className="flex justify-between p-2 bg-muted/30 rounded">
                <div><p className="font-medium">{m.material_name}</p><p className="text-xs text-muted-foreground">Ordered: {m.total_ordered} | Scheduled: {m.total_scheduled}</p></div>
                <Badge variant="outline" className="text-amber-600">{m.remaining} {m.uom} left</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {trips.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Truck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No delivery trips yet</p>
            {stats.hasRemaining && (
              <Button 
                className="mt-3" 
                onClick={() => setShowCreateDialog(true)}
                disabled={!isProcurementReleased}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />Schedule First Trip
              </Button>
            )}
            {!isProcurementReleased && stats.hasRemaining && (
              <p className="text-xs text-amber-600 mt-2">⚠️ Complete supplier confirmations (G4) first</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {trips.map(trip => (
            <TripCard 
              key={trip.id} 
              trip={trip} 
              orderId={orderId} 
              onRefresh={handleRefresh}
              isHighlighted={highlightTripId === trip.id}
              isProcurementReleased={isProcurementReleased}
            />
          ))}
        </div>
      )}
      
      <CreateTripDialog 
        orderId={orderId} 
        open={showCreateDialog} 
        onClose={() => setShowCreateDialog(false)} 
        onSuccess={handleRefresh}
        isProcurementReleased={isProcurementReleased}
      />
    </div>
  );
}
import { useParams, useNavigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PageGuidance } from '@/components/supply/PageGuidance';
import { SUPPLIER_DETAIL_GUIDANCE } from '@/components/supply/guidance-content';
import { AppLayout } from '@/components/layout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupplierMaterials } from '@/hooks/useSupplierMaterials';
import { useDeliveryRates, useDeleteDeliveryRate } from '@/hooks/useDeliveryRates';
import { useSupplierIssues, useCreateSupplierIssue, useUpdateSupplierIssue, type IssueType, type IssueSeverity } from '@/hooks/useSupplierIssues';
import { useSupplierActions, useCreateSupplierAction, type SupplierActionType } from '@/hooks/useSupplierActions';
import { useManagementAction } from '@/hooks/useManagementActions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Package, Truck, MapPin, Star, Trash2, Plus, Pencil, Upload, ShieldAlert, Gavel, Layers, ListTodo, LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import { EditSupplierSheet } from '@/components/suppliers/EditSupplierSheet';
import { AddQuoteSheet } from '@/components/suppliers/AddQuoteSheet';
import { SupplierRatingDisplay } from '@/components/suppliers/SupplierRatingInput';
import { EditSupplierMaterialSheet } from '@/components/suppliers/EditSupplierMaterialSheet';
import { SupplierMaterialActions } from '@/components/suppliers/SupplierMaterialActions';
import { DeliveryRateMapDialog } from '@/components/suppliers/DeliveryRateMapDialog';

import { DeliveryRateMapView } from '@/components/suppliers/DeliveryRateMapView';
import type { SupplierMaterial, SupplierMaterialStatus } from '@/hooks/useSupplierMaterials';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { SupplyUnitAssignments } from '@/components/suppliers/SupplyUnitAssignments';
import { SupplierTasksTab } from '@/components/suppliers/SupplierTasksTab';
import { EditDeliveryRateSheet } from '@/components/suppliers/EditDeliveryRateSheet';
import { SupplierOverviewTab } from '@/components/suppliers/SupplierOverviewTab';
import type { DeliveryRate } from '@/hooks/useDeliveryRates';

function useSupplierDetail(accountId?: string) {
  return useQuery({
    queryKey: ['supplier-detail', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data: supplier, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('account_id', accountId!)
        .single();
      if (error) throw error;

      const { data: account } = await supabase
        .from('accounts')
        .select('*, locations:location_id(id, city, address_text, address_link, place_name, place_id, lat, lng, zone_code, country)')
        .eq('id', accountId!).is('deleted_at', null)
        .single();

      return { ...supplier, account };
    },
  });
}

const SupplierDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const isManagementOrAdmin = roles?.includes('management') || roles?.includes('admin');
  const queryClient = useQueryClient();
  const { data: supplier, isLoading } = useSupplierDetail(id);
  const { data: allMaterials, isLoading: materialsLoading } = useSupplierMaterials('all');
  const { data: deliveryRates, isLoading: ratesLoading } = useDeliveryRates(id);
  const deleteRate = useDeleteDeliveryRate();
  const { data: supplierIssues = [] } = useSupplierIssues({ supplierId: id });
  const { data: supplierActions = [] } = useSupplierActions({ supplierId: id });
  const createIssue = useCreateSupplierIssue();
  const updateIssue = useUpdateSupplierIssue();
  const createAction = useCreateSupplierAction();
  const managementAction = useManagementAction();

  const [editSupplierOpen, setEditSupplierOpen] = useState(false);
  const [addMaterialOpen, setAddMaterialOpen] = useState(false);
  const [addQuoteMode, setAddQuoteMode] = useState<'manual' | 'ai-upload'>('manual');
  const [editMaterial, setEditMaterial] = useState<SupplierMaterial | null>(null);
  
  const [deliveryMapOpen, setDeliveryMapOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<DeliveryRate | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Issue creation state
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [newIssue, setNewIssue] = useState({ issue_type: 'delay' as IssueType, severity: 'minor' as IssueSeverity, description: '' });

  // Action creation state
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [newAction, setNewAction] = useState({ action_type: 'warning' as SupplierActionType, reason: '' });

  const supplierMaterials = allMaterials?.filter(sm => sm.supplier_account_id === id) || [];

  const statusColor = (s: string) => {
    switch (s) {
      case 'approved': return 'default';
      case 'submitted': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const supplierLocation = supplier?.account?.locations
    ? {
        lat: (supplier.account as any).locations.lat as number,
        lng: (supplier.account as any).locations.lng as number,
        zone_code: (supplier.account as any).locations.zone_code as string | null,
      }
    : null;

  const handleStatusChange = async (smId: string, newStatus: SupplierMaterialStatus) => {
    try {
      const { error } = await supabase
        .from('supplier_materials')
        .update({ status: newStatus, updated_by: user?.id || null })
        .eq('id', smId);
      if (error) throw error;
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['supplier-materials'] });
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteClick = (smId: string) => {
    setItemToDelete(smId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setDeleteConfirmOpen(false);
    try {
      const { error } = await supabase
        .from('supplier_materials')
        .delete()
        .eq('id', itemToDelete);
      if (error) throw error;
      toast.success('Material deleted');
      queryClient.invalidateQueries({ queryKey: ['supplier-materials'] });
    } catch {
      toast.error('Failed to delete');
    } finally {
      setItemToDelete(null);
    }
  };

  return (
    <ProtectedRoute>
      <AppLayout title={supplier?.account?.display_name || 'Supplier'}>
        <div className="space-y-6 p-6">
          <PageGuidance {...SUPPLIER_DETAIL_GUIDANCE} />
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/suppliers')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {isLoading ? (
              <Skeleton className="h-8 w-60" />
            ) : (
              <div className="flex-1">
                <h1 className="text-2xl font-semibold">
                  {supplier?.account?.display_name || 'Supplier'}
                </h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                  {supplier?.supplier_code && <span>{supplier.supplier_code}</span>}
                  {(supplier?.account as any)?.locations?.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {(supplier.account as any).locations.city}
                    </span>
                  )}
                  {supplierLocation?.zone_code && (
                    <Badge variant="outline" className="text-xs">
                      {supplierLocation.zone_code}
                    </Badge>
                  )}
                  {supplier && (
                    <SupplierRatingDisplay
                      overallRating={supplier.rating}
                      qualityGrade={(supplier as any).quality_grade}
                      compact
                    />
                  )}
                </div>
              </div>
            )}
            <Button variant="outline" className="gap-2" onClick={() => setEditSupplierOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="overview" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="materials" className="gap-2">
                <Package className="h-4 w-4" />
                Materials & Pricing
              </TabsTrigger>
              <TabsTrigger value="delivery" className="gap-2">
                <Truck className="h-4 w-4" />
                Delivery Rates
              </TabsTrigger>
              <TabsTrigger value="issues" className="gap-2">
                <ShieldAlert className="h-4 w-4" />
                Issues {supplierIssues.length > 0 && `(${supplierIssues.length})`}
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-2">
                <Gavel className="h-4 w-4" />
                Actions {supplierActions.length > 0 && `(${supplierActions.length})`}
              </TabsTrigger>
              <TabsTrigger value="units" className="gap-2">
                <Layers className="h-4 w-4" />
                Supply Units
              </TabsTrigger>
              <TabsTrigger value="followups" className="gap-2">
                <ListTodo className="h-4 w-4" />
                Follow-ups
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-4">
              <SupplierOverviewTab
                supplier={supplier}
                supplierMaterials={supplierMaterials}
                deliveryRates={deliveryRates || []}
                supplierIssues={supplierIssues}
                supplierActions={supplierActions}
                supplierAccountId={id!}
                onTabChange={setActiveTab}
              />
            </TabsContent>

            {/* Materials Tab */}
            <TabsContent value="materials" className="mt-4 space-y-4">
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2" onClick={() => { setAddQuoteMode('ai-upload'); setAddMaterialOpen(true); }}>
                  <Upload className="h-4 w-4" />
                  Upload Quote File
                </Button>
                <Button className="gap-2" onClick={() => { setAddQuoteMode('manual'); setAddMaterialOpen(true); }}>
                  <Plus className="h-4 w-4" />
                  Add Material Quote
                </Button>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">Unit Price (pre-tax)</TableHead>
                      <TableHead className="text-right">MOQ</TableHead>
                      <TableHead>Lead Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialsLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 7 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : supplierMaterials.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No materials quoted yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      supplierMaterials.map(sm => (
                        <TableRow key={sm.id}>
                          <TableCell className="font-medium">{sm.material_name || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{sm.material_code || '—'}</TableCell>
                          <TableCell className="text-right font-mono">
                            {sm.unit_price != null ? `${sm.unit_price.toLocaleString()} SAR` : '—'}
                          </TableCell>
                          <TableCell className="text-right">{sm.moq ?? '—'}</TableCell>
                          <TableCell>{sm.lead_time_days ? `${sm.lead_time_days}d` : '—'}</TableCell>
                          <TableCell>
                            <Badge variant={statusColor(sm.status)}>{sm.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <SupplierMaterialActions
                              currentStatus={sm.status}
                              onStatusChange={(status) => handleStatusChange(sm.id, status)}
                              onEdit={() => setEditMaterial(sm)}
                              onDelete={() => handleDeleteClick(sm.id)}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Delivery Rates Tab */}
            <TabsContent value="delivery" className="mt-4 space-y-6">
              {/* Inline Map View */}
              <DeliveryRateMapView
                supplierLocation={supplierLocation && supplierLocation.lat ? supplierLocation : null}
                deliveryRates={deliveryRates || []}
              />

              {/* Rates Table */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Delivery price per MOQ to each zone (pre-tax)
                  </p>
                  <Button className="gap-2" onClick={() => setDeliveryMapOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Add Delivery Rate
                  </Button>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Materials</TableHead>
                        <TableHead>Zones</TableHead>
                        <TableHead className="text-right">Price / MOQ (pre-tax)</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ratesLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 5 }).map((_, j) => (
                              <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : !deliveryRates?.length ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No delivery rates configured
                          </TableCell>
                        </TableRow>
                      ) : (
                        deliveryRates.map(rate => (
                          <TableRow key={rate.id}>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {rate.material_names.map(m => (
                                  <Badge key={m.id} variant="secondary" className="text-xs">
                                    {m.name}
                                  </Badge>
                                ))}
                                {rate.material_names.length === 0 && <span className="text-muted-foreground">—</span>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {rate.zone_names.map(z => (
                                  <Badge key={z.id} variant="outline" className="text-xs gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {z.name || z.code || z.id.slice(0, 8)}
                                  </Badge>
                                ))}
                                {rate.zone_names.length === 0 && <span className="text-muted-foreground">—</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {rate.price_per_moq.toLocaleString()} SAR
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {rate.notes || '—'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => deleteRate.mutate({ id: rate.id, supplierAccountId: id! })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditRate(rate)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* Issues Tab */}
            <TabsContent value="issues" className="mt-4 space-y-4">
              <div className="flex justify-end">
                <Button className="gap-2" onClick={() => setIssueDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Report Issue
                </Button>
              </div>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierIssues.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No issues reported
                        </TableCell>
                      </TableRow>
                    ) : (
                      supplierIssues.map(issue => (
                        <TableRow key={issue.id}>
                          <TableCell className="capitalize text-sm">{issue.issue_type}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{issue.severity}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{issue.status}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {issue.description || '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(issue.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {issue.status !== 'resolved' && issue.status !== 'closed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => updateIssue.mutate({
                                  id: issue.id,
                                  status: 'resolved',
                                  resolved_at: new Date().toISOString(),
                                })}
                              >
                                Resolve
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Actions Tab */}
            <TabsContent value="actions" className="mt-4 space-y-4">
              {isManagementOrAdmin && (
                <div className="flex justify-end">
                  <Button className="gap-2" onClick={() => setActionDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Record Action
                  </Button>
                </div>
              )}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierActions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No actions recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      supplierActions.map(action => (
                        <TableRow key={action.id}>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {action.action_type.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                            {action.reason || '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(action.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Supply Units Tab */}
            <TabsContent value="units" className="mt-4">
              {id && <SupplyUnitAssignments supplierAccountId={id} isBlacklisted={!!(supplier as any)?.is_blacklisted} />}
            </TabsContent>

            {/* Follow-ups Tab */}
            <TabsContent value="followups" className="mt-4">
              {id && <SupplierTasksTab supplierAccountId={id} />}
            </TabsContent>
          </Tabs>
        </div>

        {/* Issue Dialog */}
        <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report Issue</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Select value={newIssue.issue_type} onValueChange={(v) => setNewIssue(prev => ({ ...prev, issue_type: v as IssueType }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['delay', 'quality', 'pricing', 'communication', 'documentation', 'coverage', 'validity', 'other'] as IssueType[]).map(t => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Severity</label>
                  <Select value={newIssue.severity} onValueChange={(v) => setNewIssue(prev => ({ ...prev, severity: v as IssueSeverity }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['minor', 'major', 'critical'] as IssueSeverity[]).map(s => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                placeholder="Describe the issue..."
                value={newIssue.description}
                onChange={(e) => setNewIssue(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  if (!id) return;
                  await createIssue.mutateAsync({
                    supplier_account_id: id,
                    ...newIssue,
                    reported_by: user?.id,
                  });
                  setIssueDialogOpen(false);
                  setNewIssue({ issue_type: 'delay', severity: 'minor', description: '' });
                }}
                disabled={createIssue.isPending}
              >
                Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Action Dialog */}
        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Action</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Action Type</label>
                <Select value={newAction.action_type} onValueChange={(v) => setNewAction(prev => ({ ...prev, action_type: v as SupplierActionType }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['warning', 'freeze', 'unfreeze', 'demote_to_backup', 'remove_from_unit', 'blacklist', 'unblacklist'] as SupplierActionType[]).map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="Reason..."
                value={newAction.reason}
                onChange={(e) => setNewAction(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  if (!id) return;
                  // Use management action to record + apply side effects
                  await managementAction.mutateAsync({
                    supplier_account_id: id,
                    action_type: newAction.action_type,
                    reason: newAction.reason,
                    performed_by: user?.id,
                  });
                  setActionDialogOpen(false);
                  setNewAction({ action_type: 'warning', reason: '' });
                }}
                disabled={managementAction.isPending}
              >
                Record
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Supplier Sheet */}
        <EditSupplierSheet
          open={editSupplierOpen}
          onOpenChange={setEditSupplierOpen}
          supplier={supplier ? {
            account_id: supplier.account_id,
            supplier_type: supplier.supplier_type,
            supplier_code: supplier.supplier_code,
            lead_time_days: supplier.lead_time_days,
            rating: supplier.rating,
            rating_price: (supplier as any).rating_price ?? null,
            rating_quality: (supplier as any).rating_quality ?? null,
            rating_delivery: (supplier as any).rating_delivery ?? null,
            rating_responsiveness: (supplier as any).rating_responsiveness ?? null,
            bank_name: supplier.bank_name,
            iban: supplier.iban,
            notes: supplier.notes,
            account: supplier.account ? {
              display_name: supplier.account.display_name,
              legal_name: supplier.account.legal_name,
              tax_number: supplier.account.tax_number,
              website: supplier.account.website,
              status: supplier.account.status,
              notes: supplier.account.notes,
              location_id: supplier.account.location_id,
              location: (supplier.account as any).locations ? {
                id: (supplier.account as any).locations.id,
                address_text: (supplier.account as any).locations.address_text,
                city: (supplier.account as any).locations.city,
                country: 'SA',
                address_link: (supplier.account as any).locations.address_link || null,
                place_name: (supplier.account as any).locations.place_name || null,
                place_id: (supplier.account as any).locations.place_id || null,
                lat: (supplier.account as any).locations.lat,
                lng: (supplier.account as any).locations.lng,
                zone_code: (supplier.account as any).locations.zone_code || null,
              } : null,
            } : null,
          } : null}
        />

        {/* Add Material Quote Sheet */}
        {id && (
          <AddQuoteSheet
            open={addMaterialOpen}
            onOpenChange={(o) => { setAddMaterialOpen(o); if (!o) setAddQuoteMode('manual'); }}
            supplierAccountId={id}
            supplierName={supplier?.account?.display_name || undefined}
            mode={addQuoteMode}
          />
        )}

        {/* Edit Material Quote Sheet */}
        <EditSupplierMaterialSheet
          open={!!editMaterial}
          onOpenChange={(o) => !o && setEditMaterial(null)}
          material={editMaterial}
        />

        {/* Delivery Rate Map Dialog */}
        {id && (
          <DeliveryRateMapDialog
            open={deliveryMapOpen}
            onOpenChange={setDeliveryMapOpen}
            supplierAccountId={id}
            supplierMaterials={supplierMaterials}
            supplierLocation={supplierLocation && supplierLocation.lat ? supplierLocation : null}
          />
        )}


        {/* Edit Delivery Rate Sheet */}
        <EditDeliveryRateSheet
          open={!!editRate}
          onOpenChange={(o) => !o && setEditRate(null)}
          rate={editRate}
        />

        {/* Delete confirmation */}
        <DeleteConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          onConfirm={handleDeleteConfirm}
          title="Delete Supplier Material"
          description="Are you sure you want to delete this material quote? This action cannot be undone."
        />
      </AppLayout>
    </ProtectedRoute>
  );
};

export default SupplierDetail;

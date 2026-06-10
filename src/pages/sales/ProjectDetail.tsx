import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, FolderKanban, MapPin, User, Phone, Mail,
  Pencil, FileText, Target, Building2, Calendar, Download, Plus,
  ExternalLink, MessageSquarePlus, Trash2, TrendingUp, ShoppingCart, Hash, Truck,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PhaseIndicator } from "@/components/shared/PhaseIndicator";
import {
  StageBadge, InterestBadge, DateCell, CodeCell, OrderStatusBadge, CurrencyCell,
} from "@/components/shared/TableCellRenderers";
import { GlobalActivitySheet, type GlobalActivityContext } from "@/components/global/GlobalActivitySheet";
import { EntityTimeline } from "@/components/global/EntityTimeline";
import { SmartDeleteDialog } from "@/components/shared/SmartDeleteDialog";
import { useZoneDeliveryAvailability } from "@/hooks/useZoneDeliveryAvailability";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icon
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showActivity, setShowActivity] = useState(false);
  const [activityContext, setActivityContext] = useState<GlobalActivityContext | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project-detail", id],
    queryFn: async () => {
      if (!id) throw new Error("Missing project ID");
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          location:locations(*),
          poc_contact:contacts!projects_poc_fkey(id, full_name, phone, email),
          customer:customers!projects_customer_account_id_fkey(
            account:accounts!customers_account_id_fkey(id, display_name, legal_name, poc_contact_id)
          )
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fallback: fetch customer's primary contact if project has no POC
  const customerAccountId = project?.customer_account_id;
  const customerPocContactId = (project?.customer as any)?.account?.poc_contact_id;
  const needsCustomerPoc = !project?.poc_contact && !!customerAccountId;

  const { data: customerPrimaryContact } = useQuery({
    queryKey: ["customer-primary-contact", customerAccountId],
    queryFn: async () => {
      // Try account's poc_contact_id first, then fall back to is_primary
      if (customerPocContactId) {
        const { data, error } = await supabase
          .from("contacts")
          .select("id, full_name, phone, email")
          .eq("id", customerPocContactId)
          .single();
        if (!error && data) return data;
      }
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name, phone, email")
        .eq("account_id", customerAccountId!)
        .eq("is_primary", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: needsCustomerPoc,
  });

  const { data: opportunities } = useQuery({
    queryKey: ["project-opportunities", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, title, code, stage, interest_level, created_at")
        .eq("project_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: attachments } = useQuery({
    queryKey: ["project-attachments", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("entity_type", "project")
        .eq("entity_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: orders } = useQuery({
    queryKey: ["project-orders", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, code, status, total, currency, created_at")
        .eq("project_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Zone delivery coverage
  const projectZoneCode = project?.location?.zone_code || null;
  const zoneDelivery = useZoneDeliveryAvailability(projectZoneCode);

  // Count how many materials in the registry have suppliers delivering to this zone
  const { data: totalMaterialsWithSuppliers } = useQuery({
    queryKey: ['materials-with-suppliers-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_materials')
        .select('material_id')
        .eq('is_current', true)
        .eq('status', 'approved');
      if (error) throw error;
      return new Set((data || []).map(d => d.material_id)).size;
    },
    staleTime: 60_000,
  });

  const zoneCoveredMaterials = useMemo(() => {
    if (!zoneDelivery.data) return 0;
    // Count unique material_ids that have at least one supplier_material delivering to this zone
    // We need to cross-reference supplier_material_ids with actual material_ids
    return zoneDelivery.data.supplierMaterialIds.length;
  }, [zoneDelivery.data]);

  const softDeleteMutation = useMutation({
    mutationFn: async (reason: string) => {
      const { error } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString(), deleted_reason: reason } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project deleted");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate(-1);
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete"),
  });

  const statusChangeMutation = useMutation({
    mutationFn: async (phase: string) => {
      const { error } = await supabase
        .from("projects")
        .update({ current_phase: phase })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project status updated");
      queryClient.invalidateQueries({ queryKey: ["project-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status"),
  });

  const customerName =
    (project?.customer as any)?.account?.display_name ||
    (project?.customer as any)?.account?.legal_name ||
    "Customer";

  const downloadFile = async (storagePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("project-files")
      .createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) return;
    window.open(data.signedUrl, "_blank");
  };

  // Resolve POC: project-specific or inherited from customer
  const pocContact = project?.poc_contact || customerPrimaryContact || null;
  const pocIsInherited = !project?.poc_contact && !!customerPrimaryContact;

  // Summary metrics
  const oppCount = opportunities?.length || 0;
  const wonCount = opportunities?.filter(o => o.stage === "won").length || 0;
  const orderCount = orders?.length || 0;
  const orderVolume = orders?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">
          <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Project not found</p>
          <Button variant="link" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </AppLayout>
    );
  }

  const openActivity = (action: 'create' | 'edit' | 'update', entityType: 'customer' | 'project' | 'opportunity') => {
    setActivityContext({ action, entityType, customerId: project.customer_account_id, customerName, projectId: project.id, projectName: project.name, projectCode: project.code || undefined });
    setShowActivity(true);
  };

  const hasLocation = project.location && project.location.lat && project.location.lng;
  const lat = hasLocation ? Number(project.location!.lat) : 0;
  const lng = hasLocation ? Number(project.location!.lng) : 0;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{project.name}</h1>
                <PhaseIndicator phase={project.current_phase} />
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {project.code && (
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{project.code}</span>
                )}
                <button
                  className="flex items-center gap-1 hover:text-primary"
                  onClick={() => navigate(`/sales/customers/${project.customer_account_id}`)}
                >
                  <Building2 className="h-3.5 w-3.5" />{customerName}
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => openActivity('update', 'project')}>
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              Add Update
            </Button>
            <Button variant="outline" onClick={() => openActivity('edit', 'project')}>
              <Pencil className="h-4 w-4 mr-2" />Edit
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowDelete(true)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Summary Metrics Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Target className="h-3.5 w-3.5" />Opportunities
            </div>
            <p className="text-2xl font-semibold">{oppCount}</p>
            {wonCount > 0 && <p className="text-xs text-green-600 dark:text-green-400">{wonCount} won</p>}
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ShoppingCart className="h-3.5 w-3.5" />Orders
            </div>
            <p className="text-2xl font-semibold">{orderCount}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" />Volume
            </div>
            <p className="text-2xl font-semibold">
              {orderVolume > 0 ? `${(orderVolume / 1000).toFixed(orderVolume >= 10000 ? 0 : 1)}K` : "—"}
            </p>
            {orderVolume > 0 && <p className="text-xs text-muted-foreground">SAR</p>}
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileText className="h-3.5 w-3.5" />Files
            </div>
            <p className="text-2xl font-semibold">{attachments?.length || 0}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Truck className="h-3.5 w-3.5" />Zone Coverage
            </div>
            {projectZoneCode ? (
              zoneDelivery.isFetched ? (
                <>
                  <p className="text-2xl font-semibold">{zoneCoveredMaterials}</p>
                  <p className="text-xs text-muted-foreground">
                    materials covered{totalMaterialsWithSuppliers ? ` of ${totalMaterialsWithSuppliers}` : ""}
                  </p>
                </>
              ) : (
                <Skeleton className="h-8 w-16" />
              )
            ) : (
              <>
                <p className="text-2xl font-semibold text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground">No zone set</p>
              </>
            )}
          </Card>
        </div>

        {/* No Zone Warning */}
        {project.location && !project.location.zone_code && (
          <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <MapPin className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-sm text-amber-800 dark:text-amber-300">No delivery zone assigned</AlertTitle>
            <AlertDescription className="text-xs mt-1 text-amber-700 dark:text-amber-400">
              This project has a location but no delivery zone could be detected. This is usually because the location lacks GPS coordinates. Update the location with a Google Maps link to auto-detect the zone, or contact an admin to assign it manually.
            </AlertDescription>
          </Alert>
        )}
        {!project.location && (
          <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <MapPin className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-sm text-amber-800 dark:text-amber-300">No location set</AlertTitle>
            <AlertDescription className="text-xs mt-1 text-amber-700 dark:text-amber-400">
              This project has no location. Add a location via Edit to enable delivery zone detection and cost calculations.
            </AlertDescription>
          </Alert>
        )}

        {/* Map + Info Cards Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Location & Map — takes 2 cols */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.location ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {project.location.region_code && (
                      <Badge variant="outline" className="text-xs font-mono">
                        Region: {project.location.region_code}
                      </Badge>
                    )}
                    {project.location.zone_code && (
                      <Badge variant="secondary" className="text-xs font-mono">
                        Zone: {project.location.zone_code}
                      </Badge>
                    )}
                    {project.location.city && <span className="font-medium">{project.location.city}</span>}
                    {project.location.address_text && <span className="text-muted-foreground">· {project.location.address_text}</span>}
                    {(project.location.address_link || hasLocation) && (
                      <a
                        href={project.location.address_link || `https://www.google.com/maps?q=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        <ExternalLink className="h-3 w-3" />Open
                      </a>
                    )}
                  </div>
                  {hasLocation && (
                    <div className="rounded-lg overflow-hidden border z-0 h-[250px]">
                      <MapContainer
                        center={[lat, lng]}
                        zoom={14}
                        scrollWheelZoom={false}
                        className="h-full w-full z-0"
                        attributionControl={false}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[lat, lng]} icon={defaultIcon} />
                      </MapContainer>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>No location set — add one via Edit to enable delivery zone detection.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right column: Details + POC */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {project.project_type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{project.project_type}</span>
                  </div>
                )}
                {project.project_size && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size</span>
                    <span className="font-medium">{project.project_size}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{format(new Date(project.created_at), "MMM d, yyyy")}</span>
                </div>
                {project.notes && (
                  <>
                    <Separator />
                    <p className="text-muted-foreground">{project.notes}</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />Point of Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {pocContact ? (
                  <>
                    {pocIsInherited && (
                      <Badge variant="outline" className="text-[10px] mb-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
                        <Building2 className="h-2.5 w-2.5 mr-1" />From Customer
                      </Badge>
                    )}
                    <p className="font-medium">{pocContact.full_name}</p>
                    {pocContact.phone && (
                      <a href={`tel:${pocContact.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
                        <Phone className="h-3.5 w-3.5" />{pocContact.phone}
                      </a>
                    )}
                    {pocContact.email && (
                      <a href={`mailto:${pocContact.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
                        <Mail className="h-3.5 w-3.5" />{pocContact.email}
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">No POC assigned</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <EntityTimeline
              entityType="project"
              entityId={project.id}
              entityCreatedAt={project.created_at}
            />
          </CardContent>
        </Card>

        {/* Opportunities */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />Opportunities
                {oppCount > 0 && <Badge variant="secondary" className="text-xs">{oppCount}</Badge>}
              </CardTitle>
              <Button size="sm" onClick={() => {
                setActivityContext({
                  action: 'create',
                  entityType: 'opportunity',
                  customerId: project.customer_account_id,
                  customerName,
                  projectId: project.id,
                  projectName: project.name,
                  projectCode: project.code || undefined,
                });
                setShowActivity(true);
              }}>
                <Plus className="h-4 w-4 mr-1" />Add Opportunity
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!opportunities || opportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No opportunities yet</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Interest</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {opportunities.map((opp) => (
                      <TableRow key={opp.id} className="cursor-pointer" onClick={() => navigate(`/sales/opportunities/${opp.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <span className="font-medium">{opp.title}</span>
                              {opp.code && <CodeCell code={opp.code} />}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><StageBadge stage={opp.stage} /></TableCell>
                        <TableCell><InterestBadge level={opp.interest_level} /></TableCell>
                        <TableCell><DateCell date={opp.created_at} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders */}
        {orders && orders.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />Orders
                <Badge variant="secondary" className="text-xs">{orders.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell><CodeCell code={order.code || order.id.slice(0, 8)} /></TableCell>
                        <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                        <TableCell className="text-right"><CurrencyCell value={order.total} currency={order.currency || "SAR"} /></TableCell>
                        <TableCell><DateCell date={order.created_at} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attachments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />Files
              {attachments && attachments.length > 0 && <Badge variant="secondary" className="text-xs">{attachments.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!attachments || attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files attached</p>
            ) : (
              <div className="space-y-2">
                {attachments.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-2 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{file.file_name || "Unnamed file"}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.notes && <span className="mr-2">{file.notes}</span>}
                          {file.size_bytes && `${(file.size_bytes / 1024).toFixed(0)} KB`}
                        </p>
                      </div>
                    </div>
                    {file.storage_path && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => downloadFile(file.storage_path!, file.file_name || "file")}>
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <GlobalActivitySheet
        open={showActivity}
        onOpenChange={setShowActivity}
        context={activityContext || { action: "update", entityType: "project", customerId: project?.customer_account_id, projectId: project?.id, projectName: project?.name, projectCode: project?.code || undefined }}
      />

      <SmartDeleteDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        entityType="project"
        entityName={project.name}
        onConfirm={(reason) => softDeleteMutation.mutate(reason)}
        onStatusChange={(phase) => statusChangeMutation.mutate(phase)}
        isLoading={softDeleteMutation.isPending}
      />
    </AppLayout>
  );
}

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Building2,
  MapPin,
  MessageSquarePlus,
  FileText,
  Send,
  Package,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  User,
  Phone,
  Mail,
  Copy,
  Trash2,
  Trophy,
  XCircle,
  MessageCircle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, formatDistanceToNow } from "date-fns";
import { EntityTimeline } from "@/components/global/EntityTimeline";
import { GlobalActivitySheet, type GlobalActivityContext } from "@/components/global/GlobalActivitySheet";
import { SendQuoteSheet } from "@/components/sales/SendQuoteSheet";
import { QuotationDocument } from "@/components/sales/QuotationDocument";
import { SmartDeleteDialog } from "@/components/shared/SmartDeleteDialog";
import {
  useOpportunityQuotation,
  quotationItemsToBuilderFormat,
} from "@/hooks/useOpportunityQuotation";
import { useQuotationDelivery } from "@/hooks/useQuotationDelivery";
import { useCreateOrder } from "@/hooks/useCreateOrder";

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  discovery: { label: "Discovery", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  rfp: { label: "RFP", color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  negotiation: { label: "Negotiation", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  won: { label: "Won", color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
  lost: { label: "Lost", color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createOrder = useCreateOrder();
  const [activityContext, setActivityContext] = useState<GlobalActivityContext | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [sendDocumentType, setSendDocumentType] = useState<"quotation" | "pricelist" | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [previewMode, setPreviewMode] = useState<"quotation" | "pricelist">("quotation");
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [lostReason, setLostReason] = useState("");
  
  const { data: opportunity, isLoading } = useQuery({
    queryKey: ["opportunity", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select(`
          *,
          customer:customers!opportunities_customer_account_id_fkey(
            account:accounts!customers_account_id_fkey(
              id,
              display_name,
              display_name_ar,
              legal_name,
              location:locations(address_text, city),
              poc_contact:contacts!accounts_poc_contact_id_fkey(
                id, full_name, full_name_ar, role_title, phone, email, prefers_whatsapp
              )
            )
          ),
          project:projects(
            id, name, name_ar,
            location:locations(id, address_text, city, lat, lng, zone_code),
            site_contact:contacts(id, full_name, full_name_ar, role_title, phone, email, prefers_whatsapp)
          )
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: nextAction } = useQuery({
    queryKey: ["opportunity-next-action", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_at, status, channel")
        .eq("opportunity_id", id)
        .in("status", ["open", "in_progress"])
        .is("deleted_at", null)
        .order("due_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: quotationData } = useOpportunityQuotation(id);

  // Resolve zone for delivery rate calculation - must be before early returns
  const projectZoneCode = (opportunity?.project?.location as any)?.zone_code || null;
  const projectZoneName = null; // zone name lookup removed; uses code

  // Build items for delivery calculation — quotation_items is the only source (audit C4).
  const deliveryCalcItems = useMemo(() => {
    if (!opportunity || !quotationData) return [];
    return quotationData.items.map(i => ({
      material_id: i.material_id,
      name: i.material_name,
      name_ar: i.material_name_ar ?? undefined,
      quantity: i.quantity ?? undefined,
      supplier_material_id: i.supplier_material_id ?? undefined,
      supplier_name: i.supplier_name ?? undefined,
    }));
  }, [quotationData, opportunity]);

  const { data: deliveryData } = useQuotationDelivery(deliveryCalcItems, projectZoneCode);

  const softDeleteMutation = useMutation({
    mutationFn: async (reason: string) => {
      const { error } = await supabase
        .from("opportunities")
        .update({ deleted_at: new Date().toISOString(), deleted_reason: reason } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opportunity deleted");
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      navigate(-1);
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete"),
  });

  const markWonMutation = useMutation({
    mutationFn: async () => {
      if (!quotationData?.sent_at) throw new Error("Quotation must be sent before marking as Won");
      if (!quotationData?.id) throw new Error("No quotation found");
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("opportunities")
        .update({ stage: "won", won_at: now, status: "closed" })
        .eq("id", id);
      if (error) throw error;

      // Create order with provenance from the quotation (SSOT §11.1)
      try {
        await createOrder.mutateAsync({
          quotationId: quotationData.id,
          customerAccountId: opportunity!.customer_account_id,
          projectId: opportunity!.project_id,
        });
      } catch (orderErr: any) {
        console.error("Order creation failed (opportunity still marked won):", orderErr);
      }

      // Log communication for timeline visibility
      await supabase.from("communications").insert({
        opportunity_id: id,
        project_id: opportunity?.project_id,
        account_id: opportunity?.customer_account_id,
        channel: "internal",
        summary: "Opportunity marked as Won 🎉 — Order created",
        outcome: "Won",
        occurred_at: now,
        metadata: { type: "status_change", new_stage: "won" },
      });
    },
    onSuccess: () => {
      toast.success("🎉 Opportunity marked as Won! Order created.");
      queryClient.invalidateQueries({ queryKey: ["opportunity", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["entity-timeline"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to mark as won"),
  });

  const markLostMutation = useMutation({
    mutationFn: async (reason: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("opportunities")
        .update({ stage: "lost", lost_at: now, lost_reason: reason, status: "closed" })
        .eq("id", id);
      if (error) throw error;
      // Log communication for timeline visibility
      await supabase.from("communications").insert({
        opportunity_id: id,
        project_id: opportunity?.project_id,
        account_id: opportunity?.customer_account_id,
        channel: "internal",
        summary: `Opportunity marked as Lost — ${reason}`,
        outcome: "Lost",
        occurred_at: now,
        metadata: { type: "status_change", new_stage: "lost", lost_reason: reason },
      });
    },
    onSuccess: () => {
      toast.success("Opportunity marked as Lost");
      setShowLostDialog(false);
      setLostReason("");
      queryClient.invalidateQueries({ queryKey: ["opportunity", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["entity-timeline"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to mark as lost"),
  });

  const statusChangeMutation = useMutation({
    mutationFn: async (status: string) => {
      const updates: any = {};
      if (status === "lost") {
        updates.stage = "lost";
        updates.lost_at = new Date().toISOString();
        updates.status = "closed";
      } else if (status === "on_hold") {
        updates.status = "on_hold";
      }
      const { error } = await supabase
        .from("opportunities")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opportunity status updated");
      queryClient.invalidateQueries({ queryKey: ["opportunity", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status"),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-48 col-span-2" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!opportunity) {
    return (
      <AppLayout>
        <div className="p-6">
          <p className="text-muted-foreground">Opportunity not found</p>
          <Button variant="ghost" onClick={() => navigate("/sales/pipeline")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Pipeline
          </Button>
        </div>
      </AppLayout>
    );
  }

  const customerName =
    opportunity.customer?.account?.display_name ||
    opportunity.customer?.account?.legal_name ||
    "Unknown Customer";

  const customerLocation =
    opportunity.customer?.account?.location?.city ||
    opportunity.customer?.account?.location?.address_text;

  const projectLocation =
    opportunity.project?.location?.address_text ||
    opportunity.project?.location?.city;

  const contact =
    opportunity.project?.site_contact ||
    opportunity.customer?.account?.poc_contact;

  const stageConfig = STAGE_CONFIG[opportunity.stage] || STAGE_CONFIG.discovery;

  const isOverdue = nextAction?.due_at && isPast(new Date(nextAction.due_at));
  const isDueToday = nextAction?.due_at && isToday(new Date(nextAction.due_at));


  const hasItems = quotationData?.items && quotationData.items.length > 0;
  const hasSupplierMaterials = quotationData?.items?.some(item => item.supplier_material_id);
  const hasAllQuantities = quotationData?.items?.every(item => item.quantity && item.quantity > 0);
  const hasDeliveryBlockers = deliveryData?.hasBlockers || false;
  const hasNoZone = !projectZoneCode;

  const canSendQuotation = hasItems && hasSupplierMaterials && hasAllQuantities && !hasDeliveryBlockers && !hasNoZone;
  const canSendPriceList = hasItems && hasSupplierMaterials && !hasDeliveryBlockers && !hasNoZone;

  const quotationDisabledReason = !hasItems ? "Add materials first" : !hasSupplierMaterials ? "Select supplier prices first" : !hasAllQuantities ? "Add quantities to all items" : hasNoZone ? "Project has no delivery zone — set a location first" : hasDeliveryBlockers ? "Missing delivery rates for some items" : null;
  const priceListDisabledReason = !hasItems ? "Add materials first" : !hasSupplierMaterials ? "Select supplier prices first" : hasNoZone ? "Project has no delivery zone — set a location first" : hasDeliveryBlockers ? "Missing delivery rates for some items" : null;

  const openActivity = (action: 'create' | 'edit' | 'update', entityType: 'customer' | 'project' | 'opportunity') => {
    setActivityContext({ action, entityType, customerId: opportunity.customer_account_id, customerName, projectId: opportunity.project_id, projectName: opportunity.project?.name, opportunityId: opportunity.id, opportunityName: opportunity.title, opportunityCode: opportunity.code || undefined });
    setShowActivity(true);
  };

  const handleDuplicate = () => {
    const meta = opportunity.metadata as any;
    setActivityContext({
      action: "create",
      entityType: "opportunity",
      customerId: opportunity.customer_account_id,
      customerName,
      projectId: opportunity.project_id,
      projectName: opportunity.project?.name,
      opportunityPrefill: {
        title: `${opportunity.title} (copy)`,
        interestLevel: opportunity.interest_level || "Medium",
        contactId: opportunity.contact_id || "",
        notes: opportunity.notes || "",
        materialCategoryIds: meta?.material_category_ids || [],
      },
    });
    setShowActivity(true);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header with Next Action */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/sales/pipeline")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">{opportunity.title}</h1>
                <Badge className={cn("text-xs", stageConfig.color)}>{stageConfig.label}</Badge>
                {opportunity.interest_level && (
                  <Badge variant="outline" className={cn("text-xs", {
                    "border-green-300 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-400 dark:bg-green-950": opportunity.interest_level === "High",
                    "border-yellow-300 text-yellow-700 bg-yellow-50 dark:border-yellow-700 dark:text-yellow-400 dark:bg-yellow-950": opportunity.interest_level === "Medium",
                    "border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:bg-orange-950": opportunity.interest_level === "Low",
                    "border-red-300 text-red-600 bg-red-50 dark:border-red-700 dark:text-red-400 dark:bg-red-950": opportunity.interest_level === "Not interested",
                  })}>
                    {opportunity.interest_level}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {opportunity.code && (
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {opportunity.code}
                  </span>
                )}
                <span className="text-muted-foreground">
                  {customerName}
                  {opportunity.project && ` • ${opportunity.project.name}`}
                </span>
              </div>
            </div>
          </div>

          {nextAction && opportunity.stage !== "won" && opportunity.stage !== "lost" ? (
            <div className={cn(
              "flex items-center gap-3 px-4 py-2 rounded-lg border",
              isOverdue && "bg-destructive/10 border-destructive/30",
              isDueToday && !isOverdue && "bg-warning/10 border-warning/30",
              !isOverdue && !isDueToday && "bg-primary/10 border-primary/30"
            )}>
              {isOverdue ? <AlertCircle className="h-4 w-4 text-destructive" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
              <div className="text-sm">
                <span className="font-medium">{nextAction.title}</span>
                <span className="text-muted-foreground ml-2">
                  {nextAction.due_at && (
                    isOverdue
                      ? `Overdue by ${formatDistanceToNow(new Date(nextAction.due_at))}`
                      : isDueToday ? "Due today"
                      : `Due ${format(new Date(nextAction.due_at), "MMM d")}`
                  )}
                </span>
              </div>
            </div>
          ) : opportunity.stage === "won" || opportunity.stage === "lost" ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Closed {opportunity.stage === "won" ? "Won" : "Lost"}
              </span>
            </div>
          ) : null}
        </div>

        {/* No Zone Alert */}
        {hasNoZone && (
          <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-sm text-amber-800 dark:text-amber-300">⚠ No delivery zone assigned to this project</AlertTitle>
            <AlertDescription className="text-xs mt-1 text-amber-700 dark:text-amber-400">
              Delivery costs cannot be calculated and quotations cannot be sent without a delivery zone.
              Update the project location with a Google Maps link to auto-detect the zone.
            </AlertDescription>
          </Alert>
        )}

        {/* Delivery Blockers Banner */}
        {hasDeliveryBlockers && deliveryData && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">
              {deliveryData.missingRateItems.length} item(s) missing delivery rates{projectZoneName ? ` for zone "${projectZoneName}"` : ""}
            </AlertTitle>
            <AlertDescription className="text-xs mt-1">
              {deliveryData.missingRateItems.map(i => i.material_name).join(", ")} — configure rates on the supplier page before sending.
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Quote Document */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => openActivity('update', 'opportunity')}>
                    <MessageSquarePlus className="h-4 w-4 mr-2" />
                    Add Update
                  </Button>

                  {opportunity.stage !== "won" && opportunity.stage !== "lost" && (
                    <>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0}>
                              <Button
                                variant="default"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => markWonMutation.mutate()}
                                disabled={!quotationData?.sent_at || markWonMutation.isPending}
                              >
                                <Trophy className="h-4 w-4 mr-2" />
                                Mark Won
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {!quotationData?.sent_at && (
                            <TooltipContent><p>Quotation must be sent first</p></TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>

                      <Button
                        variant="outline"
                        className="border-destructive/50 text-destructive hover:bg-destructive/10"
                        onClick={() => setShowLostDialog(true)}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Mark Lost
                      </Button>
                    </>
                  )}
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button variant="outline" onClick={() => setSendDocumentType("pricelist")} disabled={!canSendPriceList}>
                            <FileText className="h-4 w-4 mr-2" />
                            Send Price List
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {priceListDisabledReason && <TooltipContent><p>{priceListDisabledReason}</p></TooltipContent>}
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button variant="secondary" onClick={() => setSendDocumentType("quotation")} disabled={!canSendQuotation}>
                            <Send className="h-4 w-4 mr-2" />
                            Send Quotation
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {quotationDisabledReason && <TooltipContent><p>{quotationDisabledReason}</p></TooltipContent>}
                    </Tooltip>
                  </TooltipProvider>
                  
                  <Button variant="ghost" onClick={handleDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </Button>

                  <Button variant="ghost" onClick={() => setShowDelete(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as "quotation" | "pricelist")} className="mb-3">
              <TabsList className="h-8">
                <TabsTrigger value="quotation" className="text-xs px-3 h-6">Quotation</TabsTrigger>
                <TabsTrigger value="pricelist" className="text-xs px-3 h-6">Price List</TabsTrigger>
              </TabsList>
            </Tabs>

            {(() => {
              // Use the same shared shape as the builder/sent PDF so the readonly preview
              // preserves margin snapshot + custom item identity (M1 fix).
              type ItemType = {
                line_id?: string;
                material_id?: string;
                name: string;
                name_ar?: string;
                quantity?: number;
                uom?: string;
                uom_ar?: string;
                supplier_material_id?: string;
                unit_price?: number;
                delivery_price?: number;
                supplier_name?: string;
                supplier_name_ar?: string;
                effective_margin_pct?: number | null;
                margin_pct?: number;
                is_custom_item?: boolean;
                custom_name?: string;
                custom_description?: string;
                item_kind?: "material" | "addon";
                parent_line_id?: string | null;
              };
              let quotationItems: ItemType[];
              let estDeliveryDate: Date | null = null;

              if (quotationData && quotationData.items.length > 0) {
                quotationItems = quotationItemsToBuilderFormat(quotationData.items) as ItemType[];
                estDeliveryDate = quotationData.est_delivery_date ? new Date(quotationData.est_delivery_date) : null;
              } else {
                // No quotation yet — render an empty preview (audit C4: no materials_interest fallback).
                quotationItems = [];
                const metadata = opportunity.metadata as any;
                estDeliveryDate = metadata?.est_delivery_date ? new Date(metadata.est_delivery_date) : null;
              }

              return (
                <QuotationDocument
                  items={quotationItems}
                  deliveryDate={estDeliveryDate}
                  deliveryLocation={projectLocation}
                  customerName={customerName}
                  customerNameAr={(opportunity.customer?.account as any)?.display_name_ar || undefined}
                  projectName={opportunity.project?.name}
                  projectNameAr={(opportunity.project as any)?.name_ar || undefined}
                  contactName={contact?.full_name}
                  contactNameAr={(contact as any)?.full_name_ar || undefined}
                  contactPhone={contact?.phone || undefined}
                  quoteDate={quotationData?.created_at ? new Date(quotationData.created_at) : new Date(opportunity.created_at)}
                  version={quotationData?.version || 1}
                  quotationCode={quotationData?.code || null}
                  readOnly={true}
                  onEdit={() => openActivity('edit', 'opportunity')}
                  mode={previewMode}
                  isDraft={true}
                  deliveryLines={deliveryData?.deliveryLines}
                  deliveryTotal={deliveryData?.deliveryTotal}
                  deliveryMode={quotationData?.delivery_mode || "embedded"}
                  globalMargin={0}
                />
              );
            })()}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Deal Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Customer</p>
                    <p className="font-medium">{customerName}</p>
                    {customerLocation && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />{customerLocation}
                      </p>
                    )}
                  </div>
                </div>

                {opportunity.project && (
                  <div className="flex items-start gap-3">
                    <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Project</p>
                      <p className="font-medium">{opportunity.project.name}</p>
                      {projectLocation && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />{projectLocation}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 pt-2 border-t">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Stage</p>
                    <Badge className={cn("text-xs", stageConfig.color)}>{stageConfig.label}</Badge>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Created {new Date(opportunity.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

{contact && (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-sm flex items-center gap-2">
        <User className="h-4 w-4" />Contact
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      <p className="font-medium">{contact.full_name}</p>
      {contact.role_title && <p className="text-xs text-muted-foreground">{contact.role_title}</p>}
      <div className="space-y-1.5 pt-2">
        {/* زر WhatsApp المباشر */}
        {contact.phone && (
  <Button 
    variant="ghost" 
    size="sm"
    className="bg-white hover:bg-gray-50 focus:outline-none focus:ring-0 focus:ring-offset-0"
    onClick={() => {
      let cleanNumber = contact.phone
      if (cleanNumber.startsWith("0")) {
        cleanNumber = `${cleanNumber.substring(1)}`;
      }
      window.open(`https://wa.me/${cleanNumber}`, "_blank");
    }}
  >
    <a
      href={`tel:${contact.phone}`}
      className="text-xs text-primary flex items-center gap-1.5 no-underline"
      onClick={(e) => e.preventDefault()}
    >
      <Phone className="h-3 w-3" />{contact.phone}
    </a>
  </Button>
)}
       
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="text-xs text-primary hover:underline flex items-center gap-1.5">
            <Mail className="h-3 w-3" />{contact.email}
          </a>
        )}
      </div>
    </CardContent>
  </Card>
)}

            {/* Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <EntityTimeline
                  entityType="opportunity"
                  entityId={opportunity.id}
                  entityCreatedAt={opportunity.created_at}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <GlobalActivitySheet
          open={showActivity}
          onOpenChange={setShowActivity}
          context={activityContext || undefined}
        />

        {quotationData?.id && sendDocumentType && (
          <SendQuoteSheet
            open={!!sendDocumentType}
            onOpenChange={(open) => !open && setSendDocumentType(null)}
            opportunityId={opportunity.id}
            customerAccountId={opportunity.customer_account_id}
            quotationId={quotationData.id}
            customerName={customerName}
            customerNameAr={(opportunity.customer?.account as any)?.display_name_ar || undefined}
            contactName={contact?.full_name}
            contactNameAr={(contact as any)?.full_name_ar || undefined}
            contactPhone={contact?.phone || undefined}
            projectName={opportunity.project?.name}
            projectNameAr={(opportunity.project as any)?.name_ar || undefined}
            deliveryLocation={projectLocation}
            documentType={sendDocumentType}
          />
        )}

        <SmartDeleteDialog
          open={showDelete}
          onOpenChange={setShowDelete}
          entityType="opportunity"
          entityName={opportunity.title}
          onConfirm={(reason) => softDeleteMutation.mutate(reason)}
          onStatusChange={(status) => statusChangeMutation.mutate(status)}
          isLoading={softDeleteMutation.isPending}
        />

        {/* Mark Lost Dialog */}
        <Dialog open={showLostDialog} onOpenChange={setShowLostDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark Opportunity as Lost</DialogTitle>
              <DialogDescription>
                This will close the opportunity. Please provide a reason.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Select value={lostReason || ""} onValueChange={(v) => setLostReason(v)}>
                  <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                  <SelectContent>
                    {[
                      "Price too high",
                      "Payment terms",
                      "Already has a supplier",
                      "Project delayed / on hold",
                      "Project cancelled",
                      "No budget",
                      "Bad past experience",
                      "Competitor won the deal",
                      "Materials not available",
                      "Location not serviced",
                      "No response / unreachable",
                      "Other",
                    ].map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {lostReason === "Other" && (
                <Textarea
                  placeholder="Describe the reason..."
                  value={lostReason === "Other" ? "" : lostReason}
                  onChange={(e) => setLostReason(e.target.value || "Other")}
                  rows={2}
                />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowLostDialog(false); setLostReason(""); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!lostReason.trim() || markLostMutation.isPending}
                onClick={() => markLostMutation.mutate(lostReason.trim())}
              >
                {markLostMutation.isPending ? "Saving..." : "Confirm Lost"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

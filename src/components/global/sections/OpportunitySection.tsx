import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Target, CalendarIcon, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InterestLevelSelector } from "@/components/sales/form-sections/InterestLevelSelector";
import { useQuotationDelivery } from "@/hooks/useQuotationDelivery";
import { QuotationBuilder, type QuotationItem } from "@/components/sales/QuotationBuilder";
import { useOpportunityQuotation, quotationItemsToBuilderFormat } from "@/hooks/useOpportunityQuotation";
import { useReviseQuotation } from "@/hooks/useReviseQuotation";
import { useZoneGate } from "@/components/sales/ProjectZoneGate";
import { Lock, RotateCcw } from "lucide-react";
import type { DeliveryMode } from "@/lib/quotation-commercial";

/**
 * Back-compat alias. Older call sites still reference `QuotationItemData`;
 * after the builder consolidation they're the same shape as the builder line.
 */
export type QuotationItemData = QuotationItem;

export interface OpportunityData {
  mode: "chip" | "none" | "select" | "create" | "edit";
  selectedId: string;
  selectedName: string;
  selectedCode: string;
  title: string;
  interestLevel: string;
  notInterestedReason?: string;
  estOrderDate: Date | null;
  contactId: string;
  priority?: string; // deprecated — kept for backward compat
  notes?: string;
  materialCategoryIds?: string[];
  quotationItems?: QuotationItem[];
  deliveryDate?: Date | null;
  deliveryMode?: DeliveryMode;
  globalMargin?: number;
  stage?: string;
  /** Populated by OpportunitySection — read by validator to block "Save" when the
   * quote has unresolved gaps (missing zone, missing supplier, missing price, no rate). */
  _quoteBlockers?: string[];
}

interface OpportunitySectionProps {
  data: OpportunityData;
  onChange: (data: OpportunityData) => void;
  projectId: string;
  customerAccountId: string;
}

function MaterialCategoriesSelector({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const { data: categories } = useQuery({
    queryKey: ["material-categories-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("material_categories").select("id, name_en, name_ar").eq("status", "active").order("name_en");
      if (error) throw error;
      return data;
    },
  });
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
  };
  if (!categories?.length) return null;
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Material Categories of Interest</Label>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const selected = selectedIds.includes(cat.id);
          return (
            <Badge key={cat.id} variant="outline" className={cn("cursor-pointer transition-all px-3 py-1", selected ? "border-primary bg-primary/10 text-primary" : "bg-background hover:bg-muted")} onClick={() => toggle(cat.id)}>
              {selected && <Check className="h-3 w-3 mr-1" />}
              {cat.name_en}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

export function OpportunitySection({ data, onChange, projectId, customerAccountId }: OpportunitySectionProps) {
  const isForm = data.mode === "create" || data.mode === "edit";

  // Zone via shared hook (single source of truth for "where is this project?")
  const { zoneCode: projectZoneCode } = useZoneGate({
    projectId: isForm ? projectId : undefined,
  });

  // Existing quotation (edit mode) — load via the same hook the rich builder uses,
  // so both surfaces start from identical line shapes (line_id, margin, addons…).
  const { data: existingQuotation } = useOpportunityQuotation(
    data.mode === "edit" ? data.selectedId : undefined,
  );

  // Full opportunity for field hydration in edit mode
  const { data: fullOpp } = useQuery({
    queryKey: ["opp-edit-global", data.selectedId],
    queryFn: async () => {
      const { data: opp, error } = await supabase.from("opportunities").select("*").eq("id", data.selectedId).single();
      if (error) throw error;
      return opp;
    },
    enabled: data.mode === "edit" && !!data.selectedId,
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-for-opp", customerAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id, full_name, phone, is_primary").eq("account_id", customerAccountId);
      if (error) throw error;
      return data;
    },
    enabled: isForm && !!customerAccountId,
  });

  const qItems: QuotationItem[] = data.quotationItems || [];
  const deliveryMode: DeliveryMode = data.deliveryMode ?? "embedded";
  const globalMargin = data.globalMargin ?? 0;

  // Delivery resolution — same hook the rich builder uses.
  const deliveryCalcItems = useMemo(
    () =>
      qItems
        .filter(i => i.item_kind !== "addon" && !i.is_custom_item && i.material_id)
        .map(i => ({
          material_id: i.material_id!,
          name: i.name,
          name_ar: i.name_ar,
          quantity: i.quantity,
          supplier_material_id: i.supplier_material_id,
          supplier_name: i.supplier_name,
        })),
    [qItems],
  );
  const { data: deliveryData } = useQuotationDelivery(deliveryCalcItems, projectZoneCode);

  // Compute "send" blockers and publish them on the data object so the
  // parent sheet's validator can refuse a save with a clear reason.
  // Saving an opportunity is always allowed — pricing gaps, missing delivery
  // rates, and missing zones are surfaced as warnings in the builder itself
  // and gate the "Send quote" / order conversion flows downstream, not save.
  const blockers = useMemo<string[]>(() => [], []);

  // Keep blockers on the data object without triggering a render loop.
  const blockerKey = blockers.join("|");
  const lastBlockerKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastBlockerKey.current !== blockerKey) {
      lastBlockerKey.current = blockerKey;
      onChange({ ...data, _quoteBlockers: blockers });
    }
  }, [blockerKey]);

  // Track populated ids so we hydrate once per edit-target
  const populatedIdRef = useRef<string | null>(null);
  const populatedQuoteRef = useRef<string | null>(null);

  useEffect(() => {
    if (data.mode !== "edit") { populatedIdRef.current = null; populatedQuoteRef.current = null; }
  }, [data.mode]);

  // Hydrate opportunity scalar fields
  useEffect(() => {
    if (data.mode === "edit" && fullOpp && data.selectedId && populatedIdRef.current !== data.selectedId) {
      populatedIdRef.current = data.selectedId;
      onChange({
        ...data,
        title: fullOpp.title || "",
        interestLevel: fullOpp.interest_level || "Medium",
        estOrderDate: fullOpp.expected_close_date ? new Date(fullOpp.expected_close_date) : null,
        contactId: fullOpp.contact_id || "",
        priority: fullOpp.priority || "medium",
        notes: fullOpp.notes || "",
        materialCategoryIds: (fullOpp.metadata as any)?.material_category_ids || [],
        stage: fullOpp.stage || "discovery",
      });
    }
  }, [fullOpp, data.mode, data.selectedId]);

  // Hydrate quotation lines, delivery date & delivery mode from the live quotation
  useEffect(() => {
    if (data.mode === "edit" && existingQuotation && data.selectedId && populatedQuoteRef.current !== data.selectedId) {
      populatedQuoteRef.current = data.selectedId;
      onChange({
        ...data,
        quotationItems: quotationItemsToBuilderFormat(existingQuotation.items),
        deliveryDate: existingQuotation.est_delivery_date ? new Date(existingQuotation.est_delivery_date) : null,
        deliveryMode: existingQuotation.delivery_mode,
      });
    }
  }, [existingQuotation, data.mode, data.selectedId]);

  if (data.mode === "chip" || data.mode === "none") return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-sm">{data.mode === "edit" ? "Edit Opportunity" : "New Opportunity"}</h3>
      </div>

      {/* Fields */}
      <div className="space-y-3 p-3 rounded-lg border bg-background/50">
        <div className="space-y-2">
          <Label className="text-xs">Title *</Label>
          <Input value={data.title} onChange={e => onChange({ ...data, title: e.target.value })} placeholder="e.g., Cement supply for Phase 1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InterestLevelSelector value={data.interestLevel} onChange={v => onChange({ ...data, interestLevel: v })} />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Est. Order Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !data.estOrderDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data.estOrderDate ? format(data.estOrderDate, "PPP") : "Select"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={data.estOrderDate || undefined} onSelect={d => onChange({ ...data, estOrderDate: d || null })} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Contact</Label>
          <Select value={data.contactId || "none"} onValueChange={v => onChange({ ...data, contactId: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {contacts?.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Manual Stage Override (edit mode only, hidden if closed) */}
        {data.mode === "edit" && data.stage && data.stage !== "won" && data.stage !== "lost" && data.interestLevel !== "Not interested" && (
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              Pipeline Stage
              <span className="text-[10px] text-muted-foreground font-normal">(auto-progresses; override if needed)</span>
            </Label>
            <Select value={data.stage} onValueChange={v => onChange({ ...data, stage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="discovery">Discovery</SelectItem>
                <SelectItem value="rfp">RFP</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <MaterialCategoriesSelector
          selectedIds={data.materialCategoryIds || []}
          onChange={(ids) => onChange({ ...data, materialCategoryIds: ids })}
        />

        {data.interestLevel === "Not interested" && (
          <div className="space-y-2">
            <Label className="text-xs text-destructive">Reason for not interested *</Label>
            <Select value={data.notInterestedReason || ""} onValueChange={v => onChange({ ...data, notInterestedReason: v })}>
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
                ].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs">Notes</Label>
          <Textarea rows={2} value={data.notes || ""} onChange={e => onChange({ ...data, notes: e.target.value })} />
        </div>
      </div>

      {/* Sent-document lock + Revise action.
          Sent quotations/price lists are immutable in the DB. To make changes,
          the user creates a new draft via Revise; the previous document stays
          as read-only history with its original official code. */}
      {existingQuotation && existingQuotation.status !== "draft" && (
        <SentDocumentLock
          quotationId={existingQuotation.id}
          code={existingQuotation.code}
          status={existingQuotation.status}
        />
      )}

      {/* Single unified quotation builder — Global Activity / OpportunitySection is the
          ONLY live builder surface (legacy AddUpdateSheet retired). */}
      <QuotationBuilder
        items={qItems}
        onChange={(items) => onChange({ ...data, quotationItems: items })}
        deliveryDate={data.deliveryDate || null}
        onDeliveryDateChange={(d) => onChange({ ...data, deliveryDate: d })}
        zoneCode={projectZoneCode}
        deliveryMode={deliveryMode}
        onDeliveryModeChange={(m) => onChange({ ...data, deliveryMode: m })}
        // globalMargin removed: sales no longer controls margin.
        // Backend `compute_quotation_totals` resolves margin via subcategory → system default.

        deliveryLines={deliveryData?.deliveryLines || []}
        missingRateItems={deliveryData?.missingRateItems || []}
        deliveryTotal={deliveryData?.deliveryTotal || 0}
        readOnly={!!existingQuotation && existingQuotation.status !== "draft"}
      />
    </div>
  );
}

function SentDocumentLock({
  quotationId,
  code,
  status,
}: {
  quotationId: string;
  code: string | null;
  status: string;
}) {
  const revise = useReviseQuotation();
  const isSoft = (code || "").includes("_PL.");
  return (
    <Alert className="border-primary/30 bg-primary/5">
      <Lock className="h-4 w-4" />
      <AlertTitle className="text-sm flex items-center justify-between gap-3">
        <span>
          {isSoft ? "Price list" : "Quotation"} {code || ""}{" "}
          <Badge variant="secondary" className="ml-1 uppercase">{status}</Badge>
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => revise.mutate(quotationId)}
          disabled={revise.isPending}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          {revise.isPending ? "Creating draft…" : "Revise"}
        </Button>
      </AlertTitle>
      <AlertDescription className="text-xs mt-1 text-muted-foreground">
        This document is sent and locked. Use Revise to create a new draft with a fresh
        official code; cloned items will be ready to edit. The current document remains
        as read-only history.
      </AlertDescription>
    </Alert>
  );
}

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarIcon, Package, Trash2, Edit2, Truck, MapPin, AlertTriangle, Zap, Shield, PenLine, Plus, CornerDownRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSupplierPrices } from "@/hooks/useSupplierPrices";
import { MaterialStepPicker, type PickedMaterial } from "@/components/shared/MaterialStepPicker";
import { MaterialAutocompleteCell } from "@/components/suppliers/MaterialAutocompleteCell";
import { AddonPicker, type AddonSelection } from "./AddonPicker";
import { useMaterialSubcategoryMap, resolveAddonUom } from "@/hooks/useAddonDefinitions";
import { useSubcategoryMargins } from "@/hooks/useSubcategoryMargins";
import type { DeliveryLineItem, MissingRateItem } from "@/hooks/useQuotationDelivery";
// Legacy: useEffectiveSupplier removed from the live flow. Both supplier roles
// (Selected/Quality) now resolve via resolve_line_pricing → resolve_supplier.
import { resolveLinePricing, resolveLinePricingBatch } from "@/hooks/useLinePricing";
import { ProjectZoneGate, useZoneGate } from "./ProjectZoneGate";

import { useQuoteStaleness } from "@/hooks/useQuoteStaleness";
import { useToast } from "@/hooks/use-toast";
import {
  type DeliveryMode,
  resolveMarginHierarchy,
  computeCommercialTotals,
} from "@/lib/quotation-commercial";

export type { QuoteLine, QuotationItem } from "@/types/quote";
import type { QuoteLine as QuotationItem } from "@/types/quote";

interface QuotationBuilderProps {
  items: QuotationItem[];
  onChange?: (items: QuotationItem[]) => void;
  deliveryDate?: Date | null;
  onDeliveryDateChange?: (date: Date | null) => void;
  deliveryLocation?: string | null;
  readOnly?: boolean;
  onEdit?: () => void;
  quoteType?: "general" | "official";
  deliveryLines?: DeliveryLineItem[];
  missingRateItems?: MissingRateItem[];
  deliveryTotal?: number;
  zoneName?: string | null;
  zoneCode?: string | null;
  deliveryMode?: DeliveryMode;
  onDeliveryModeChange?: (mode: DeliveryMode) => void;
  /** Controlled global margin — if provided, parent owns it and is notified via onGlobalMarginChange */
  globalMargin?: number;
  onGlobalMarginChange?: (margin: number) => void;
}

export function QuotationBuilder({
  items,
  onChange,
  deliveryDate,
  onDeliveryDateChange,
  deliveryLocation,
  readOnly = false,
  onEdit,
  quoteType = "official",
  deliveryLines = [],
  missingRateItems = [],
  deliveryTotal = 0,
  zoneName,
  zoneCode,
  deliveryMode = "embedded",
  onDeliveryModeChange,
  globalMargin: globalMarginProp,
  onGlobalMarginChange,
}: QuotationBuilderProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [supplierRole, setSupplierRole] = useState<"selected" | "quality">("selected");
  const { toast } = useToast();

  // Margin is no longer salesperson-controlled. It resolves automatically through the hierarchy:
  //   per-line override → subcategory_margin_defaults (admin) → 0
  // The legacy globalMargin prop is accepted for back-compat but always normalized to 0 in the UI.
  void globalMarginProp;
  void onGlobalMarginChange;
  const globalMargin = 0;

  // Fetch supplier prices for all materials in the quote (registry items only — add-ons & custom excluded)
  const materialIds = useMemo(
    () => items.filter(i => i.item_kind !== "addon" && !i.is_custom_item && i.material_id).map((i) => i.material_id!),
    [items]
  );
  const { data: supplierPrices } = useSupplierPrices(materialIds);
  const { data: subcategoryMap } = useMaterialSubcategoryMap(materialIds);
  const { data: subcategoryMargins } = useSubcategoryMargins();
  const { data: stalenessFlags } = useQuoteStaleness(
    items.filter(i => i.item_kind !== "addon" && !i.is_custom_item) as any,
    !readOnly
  );

  // Material → subcategory map for the margin hierarchy resolver
  const materialSubMap = useMemo(() => {
    const m = new Map<string, string>();
    if (subcategoryMap) for (const [k, v] of subcategoryMap.entries()) if (v) m.set(k, v);
    return m;
  }, [subcategoryMap]);

  // Per-item resolved margin via hierarchy (NOT shown in UI — used for totals + line preview)
  const resolveMargin = useCallback(
    (item: QuotationItem) =>
      resolveMarginHierarchy(
        item,
        subcategoryMargins ?? new Map(),
        materialSubMap,
        0,
      ),
    [subcategoryMargins, materialSubMap],
  );

  // Sales display: unit_price on saved lines is ALREADY the customer-facing
  // selling price (backend `compute_quotation_totals` stamps `final_unit_price`
  // into `unit_price`). The UI must not re-apply margin here.
  const computeLineSell = useCallback(
    (item: QuotationItem) => item.unit_price || 0,
    [],
  );

  // Totals are display-only. Backend is authoritative for persisted totals.
  // Sum qty * unit_price across material + custom + addon lines.
  const totals = useMemo(() => {
    let sellingTotal = 0;
    for (const i of items) {
      sellingTotal += (i.quantity || 0) * (i.unit_price || 0);
    }
    const preTax = sellingTotal + (deliveryMode === "separate" ? deliveryTotal : 0);
    const vat = preTax * 0.15;
    return {
      sellingTotal,
      deliveryAddition: deliveryMode === "separate" ? deliveryTotal : 0,
      preTax,
      vat,
      grandTotal: preTax + vat,
    };
  }, [items, deliveryTotal, deliveryMode]);


  const excludeIds = useMemo(() => items.filter(i => i.material_id).map(i => i.material_id!), [items]);

  // Async resolver patches need the latest items snapshot, not the one captured
  // when the callback was created. Keep a live ref.
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const currentItemsGetter = useRef(() => itemsRef.current);

  // Single-line resolver — fires the RPC for one row right after a material is
  // picked, so the user doesn't see "Unpriced" while we wait for the batch.
  // Stamps the row with landed_unit_price (cost + delivery + margin) so the
  // selling price is visible during draft editing.
  const resolveLineForMaterial = useCallback(
    async (lineId: string, materialId: string, qty?: number) => {
      if (!onChange || !zoneCode) return;
      try {
        const res = await resolveLinePricing({
          materialId,
          zoneCode,
          qty: qty && qty > 0 ? qty : 1,
          globalMargin,
          requestedRole: supplierRole,
        });
        onChange(
          (currentItemsGetter.current() || []).map((m) => {
            if (m.line_id !== lineId) return m;
            if (!res.supplier_account_id) {
              return { ...m, resolving: false };
            }
            return {
              ...m,
              resolving: false,
              supplier_material_id: res.supplier_material_id ?? m.supplier_material_id,
              supplier_account_id: res.supplier_account_id ?? (m as any).supplier_account_id,
              supplier_name: m.supplier_name,
              unit_price: res.landed_unit_price ?? res.unit_price ?? undefined,
              quality_fallback:
                supplierRole === "quality" && res.was_fallback ? true : undefined,
              resolved_role: (res.role_used as any) ?? supplierRole,
            };
          }),
        );
      } catch (err) {
        console.error("resolveLineForMaterial failed", err);
        onChange(
          (currentItemsGetter.current() || []).map((m) =>
            m.line_id === lineId ? { ...m, resolving: false } : m,
          ),
        );
      }
    },
    [onChange, zoneCode, globalMargin, supplierRole],
  );

  const addMaterial = (picked: PickedMaterial) => {
    if (!onChange) return;
    const lineId = crypto.randomUUID();
    onChange([
      ...items,
      { line_id: lineId, material_id: picked.id, name: picked.name, uom: picked.uom, quantity: undefined, resolving: !!zoneCode },
    ]);
    if (zoneCode) {
      // Fire-and-forget — UI shows Resolving… until this returns.
      void resolveLineForMaterial(lineId, picked.id);
    }
  };

  const addCustomItem = () => {
    if (!onChange) return;
    onChange([
      ...items,
      {
        line_id: crypto.randomUUID(),
        name: "",
        is_custom_item: true,
        custom_name: "",
        uom: "unit",
        quantity: undefined,
      },
    ]);
  };

  const removeMaterial = (lineId: string) => {
    if (!onChange) return;
    // Cascade: remove the line and any add-on children attached to it
    onChange(items.filter((m) => m.line_id !== lineId && m.parent_line_id !== lineId));
  };

  const buildAddonRow = (
    parentLineId: string | null,
    sel: AddonSelection,
  ): QuotationItem => {
    const def = sel.custom ? null : sel.definition;
    // Resolve UoM from the parent line (for scoped add-ons), so the add-on
    // inherits the parent's effective unit. Global add-ons keep their own UoM.
    const parentRow = parentLineId
      ? items.find((i) => i.line_id === parentLineId)
      : null;
    const parentMaterial = parentRow?.uom ? { uom: parentRow.uom } : null;
    const resolvedUom = resolveAddonUom(def, parentMaterial, null, null)
      || parentRow?.uom
      || "unit";
    return {
      line_id: crypto.randomUUID(),
      name: def?.name ?? "",
      name_ar: def?.name_ar ?? undefined,
      item_kind: "addon",
      parent_line_id: parentLineId,
      addon_definition_id: def?.id ?? null,
      is_custom_item: true,
      custom_name: def?.name ?? "",
      uom: resolvedUom,
      quantity: 1,
      unit_price: def?.default_price ?? undefined,
      margin_pct: def?.default_margin_pct ?? undefined,
      delivery_price: 0,
    };
  };

  const addItemAddon = (parentLineId: string, sel: AddonSelection) => {
    if (!onChange) return;
    // Insert a new addon row directly after its parent for predictable ordering
    const parentIdx = items.findIndex((m) => m.line_id === parentLineId);
    const newAddon = buildAddonRow(parentLineId, sel);
    let insertIdx = parentIdx + 1;
    while (insertIdx < items.length && items[insertIdx].parent_line_id === parentLineId) {
      insertIdx++;
    }
    const next = [...items];
    next.splice(insertIdx, 0, newAddon);
    onChange(next);
  };

  const addQuotationAddon = (sel: AddonSelection) => {
    if (!onChange) return;
    onChange([...items, buildAddonRow(null, sel)]);
  };

  const updateItem = (lineId: string, updates: Partial<QuotationItem>) => {
    if (!onChange) return;
    onChange(
      items.map((m) => {
        if (m.line_id !== lineId) return m;
        const updated = { ...m, ...updates };
        // Sync custom_name ↔ name for custom items
        if (updated.is_custom_item && updates.custom_name !== undefined) {
          updated.name = updates.custom_name;
        }
        return updated;
      })
    );
  };

  // Supplier is auto-resolved via handleAutoFill — no per-line manual selection.

  // Unified auto-fill — both "selected" and "quality" go through resolve_line_pricing,
  // which delegates supplier choice to resolve_supplier (built-in fallback chain).
  const handleAutoFill = useCallback(async (role: "selected" | "quality") => {
    if (!onChange || !zoneCode || items.length === 0) return;
    const registryItems = items.filter(i => !i.is_custom_item && i.material_id);
    if (registryItems.length === 0) return;
    setAutoFilling(true);
    try {
      const lineResults = await resolveLinePricingBatch(
        zoneCode,
        registryItems.map(i => ({ materialId: i.material_id!, qty: i.quantity || 1 })),
        globalMargin,
        role,
      );

      let filled = 0;
      let fallbackCount = 0;
      const fallbackNames: string[] = [];

      const updatedItems = items.map(item => {
        if (item.is_custom_item || !item.material_id) return item;
        const res = lineResults.get(item.material_id);
        if (!res || !res.supplier_account_id) {
          return { ...item, quality_fallback: undefined, resolved_role: undefined };
        }
        const priceOptions = supplierPrices?.[item.material_id] || [];
        const match = priceOptions.find(p => p.supplier_account_id === res.supplier_account_id);
        if (!match) return { ...item, quality_fallback: undefined, resolved_role: undefined };
        filled++;
        const isFallback = !!res.was_fallback;
        if (isFallback) { fallbackCount++; fallbackNames.push(item.name); }
        return {
          ...item,
          supplier_material_id: res.supplier_material_id ?? match.id,
          unit_price: res.landed_unit_price ?? res.unit_price ?? match.unit_price ?? undefined,
          supplier_name: match.supplier_name,
          quality_fallback: role === "quality" && isFallback ? true : undefined,
          resolved_role: (res.role_used as any) ?? role,
        };
      });
      onChange(updatedItems);

      if (fallbackCount > 0) {
        toast({
          title: `${role === "quality" ? "Quality" : "Selected"} auto-fill — ${filled} filled, ${fallbackCount} via fallback`,
          description: `${fallbackNames.slice(0, 3).join(', ')}${fallbackNames.length > 3 ? ` and ${fallbackNames.length - 3} more` : ''} used a fallback supplier.`,
        });
      } else {
        toast({
          title: `${role === "quality" ? "Quality" : "Selected"} auto-fill`,
          description: `Filled ${filled} of ${registryItems.length} items via unified resolver.`,
        });
      }
    } catch (err) {
      console.error("Auto-fill failed:", err);
      toast({
        title: "Auto-fill failed",
        description: "Could not resolve effective suppliers.",
        variant: "destructive",
      });
    } finally {
      setAutoFilling(false);
    }
  }, [onChange, zoneCode, items, supplierPrices, globalMargin, toast]);

  // Switching supplier-role toggle re-resolves every line via the right pipeline.
  const handleRoleChange = useCallback(
    (role: "selected" | "quality") => {
      setSupplierRole(role);
      if (!zoneCode || items.length === 0) return;
      handleAutoFill(role);
    },
    [handleAutoFill, zoneCode, items.length],
  );

  // Auto-resolve suppliers when registry rows are added without a supplier yet.
  // Salesperson never picks a supplier per-line — it resolves via the chosen role.
  const resolvingRef = useRef(false);
  useEffect(() => {
    if (readOnly || !zoneCode || autoFilling || resolvingRef.current) return;
    const unresolved = items.some(
      (i) =>
        i.item_kind !== "addon" &&
        !i.is_custom_item &&
        i.material_id &&
        !i.supplier_material_id &&
        !i.resolving,
    );
    if (!unresolved) return;
    // Wait until we have supplier price options for those materials.
    const needIds = items
      .filter((i) => i.item_kind !== "addon" && !i.is_custom_item && i.material_id && !i.supplier_material_id && !i.resolving)
      .map((i) => i.material_id!);
    if (!supplierPrices || needIds.some((id) => supplierPrices[id] === undefined)) return;
    resolvingRef.current = true;
    handleAutoFill(supplierRole).finally(() => {
      resolvingRef.current = false;
    });
  }, [items, zoneCode, readOnly, autoFilling, supplierPrices, supplierRole, handleAutoFill]);

  // Re-price a line when its quantity changes (delivery-per-unit depends on qty).
  // Debounced per-line so rapid typing doesn't spam the RPC.
  const lastQtyRef = useRef<Map<string, number>>(new Map());
  const qtyTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    if (readOnly || !zoneCode) return;
    for (const it of items) {
      if (it.is_custom_item || it.item_kind === "addon" || !it.material_id) continue;
      const qty = it.quantity || 0;
      const prev = lastQtyRef.current.get(it.line_id);
      lastQtyRef.current.set(it.line_id, qty);
      if (prev === undefined) continue; // first observation — initial resolve already fired
      if (prev === qty) continue;
      if (qty <= 0) continue;
      const existing = qtyTimersRef.current.get(it.line_id);
      if (existing) clearTimeout(existing);
      const lineId = it.line_id;
      const materialId = it.material_id;
      const t = setTimeout(() => {
        const current = (itemsRef.current || []).find((m) => m.line_id === lineId);
        if (!current || !current.material_id) return;
        // mark resolving so the price cell shows a spinner during the round-trip
        onChange?.(
          (itemsRef.current || []).map((m) =>
            m.line_id === lineId ? { ...m, resolving: true } : m,
          ),
        );
        void resolveLineForMaterial(lineId, materialId, current.quantity || qty);
      }, 350);
      qtyTimersRef.current.set(lineId, t);
    }
    return () => {
      // do not clear timers on every render; only on unmount
    };
  }, [items, zoneCode, readOnly, onChange, resolveLineForMaterial]);
  useEffect(() => () => {
    qtyTimersRef.current.forEach((t) => clearTimeout(t));
    qtyTimersRef.current.clear();
  }, []);

  const zoneGate = useZoneGate(zoneCode);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Zone gate — hard block when project has no resolved zone */}
      {zoneGate.blocked && (
        <div className="p-4 border-b bg-destructive/5">
          <ProjectZoneGate zoneCode={zoneCode} context="quotation" />
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-muted/30 border-b">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-sm">Draft Quotation</h3>
        </div>
        <div className="flex items-center gap-3">
          {!readOnly && (
            <div className="inline-flex rounded-md border bg-background p-0.5">
              <button
                type="button"
                onClick={() => handleRoleChange("selected")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-sm transition-colors",
                  supplierRole === "selected"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                disabled={autoFilling}
                title="Resolve using the Selected (best-price) supplier for the zone"
              >
                <Zap className="h-3 w-3" />
                Selected
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange("quality")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-sm transition-colors",
                  supplierRole === "quality"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                disabled={autoFilling}
                title="Resolve using the Quality supplier (falls back to Selected if none)"
              >
                <Shield className="h-3 w-3" />
                Quality
              </button>
            </div>
          )}
          {readOnly && onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit2 className="h-3.5 w-3.5 mr-1" />
              Edit Quote
            </Button>
          )}
          <Badge variant="secondary" className="text-xs">
            DRAFT
          </Badge>
        </div>
      </div>



      {/* No Zone Warning */}
      {!zoneCode && items.length > 0 && (
        <div className="p-3 border-b">
          <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-sm text-amber-800 dark:text-amber-300">⚠ No delivery zone</AlertTitle>
            <AlertDescription className="text-xs mt-1 text-amber-700 dark:text-amber-400">
              The project has no assigned delivery zone. Delivery costs cannot be calculated. Update the project location with GPS coordinates to auto-detect the zone.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Staleness Warning */}
      {stalenessFlags && stalenessFlags.length > 0 && (
        <div className="p-3 border-b">
          <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-sm text-amber-800 dark:text-amber-300">⚠ Supply prices changed</AlertTitle>
            <AlertDescription className="text-xs mt-1 text-amber-700 dark:text-amber-400">
              <ul className="list-disc list-inside space-y-0.5">
                {stalenessFlags.map((flag) => (
                  <li key={flag.material_id}>
                    <span className="font-medium">{flag.material_name}</span>
                    {flag.reason === "price_changed" && (
                      <span> — price changed from {flag.saved_price?.toFixed(2)} to {flag.current_price?.toFixed(2)} SAR</span>
                    )}
                    {flag.reason === "quote_expired" && <span> — supplier quote expired</span>}
                    {flag.reason === "quote_not_approved" && <span> — supplier quote no longer approved</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 font-medium">Review and update prices before sending this quotation.</p>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Missing Delivery Rates Alert */}
      {missingRateItems.length > 0 && (
        <div className="p-3 border-b">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">Missing delivery rates</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              <ul className="list-disc list-inside space-y-0.5">
                {missingRateItems.map((item) => (
                  <li key={item.supplier_material_id}>
                    <span className="font-medium">{item.material_name}</span>
                    <span className="text-muted-foreground"> via {item.supplier_name}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 font-medium">
                This quotation cannot be sent until delivery rates are configured for these items in {zoneName ? `zone "${zoneName}"` : "this zone"}.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Items Table — sales view: no supplier, no cost, no margin */}
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20">
            <TableHead className="font-semibold text-xs w-10">#</TableHead>
            <TableHead className="font-semibold text-xs">ITEM DESCRIPTION</TableHead>
            <TableHead className="font-semibold text-xs w-20 text-center">QTY</TableHead>
            <TableHead className="font-semibold text-xs w-14 text-center">UOM</TableHead>
            <TableHead className="font-semibold text-xs w-28 text-right">UNIT PRICE</TableHead>
            <TableHead className="font-semibold text-xs w-28 text-right">LINE TOTAL</TableHead>
            {!readOnly && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={readOnly ? 6 : 7} className="text-center py-8">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">No items in quote</p>
                {!readOnly && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Click "+ Add Line" below — then type the material name in the row.
                  </p>
                )}
              </TableCell>
            </TableRow>

          ) : (
            (() => {
              // Order rows so add-on children render directly under their parent.
              // Quotation-level add-ons (parent_line_id == null && item_kind === 'addon')
              // render in their own "Additional Services" block at the bottom.
              const mainRows = items.filter(
                (i) => i.item_kind !== "addon" || i.parent_line_id == null,
              );
              const childrenOf = (parentId: string) =>
                items.filter(
                  (i) => i.item_kind === "addon" && i.parent_line_id === parentId,
                );
              const quotationAddons = items.filter(
                (i) => i.item_kind === "addon" && i.parent_line_id == null,
              );
              const parentRows = mainRows.filter((i) => i.item_kind !== "addon");

              const ordered: { item: QuotationItem; isAddon: boolean; mainIndex?: number }[] = [];
              let mainIndex = 0;
              for (const row of parentRows) {
                mainIndex++;
                ordered.push({ item: row, isAddon: false, mainIndex });
                for (const child of childrenOf(row.line_id)) {
                  ordered.push({ item: child, isAddon: true });
                }
              }
              for (const qa of quotationAddons) {
                ordered.push({ item: qa, isAddon: true });
              }

              return ordered.map(({ item, isAddon, mainIndex }) => {
                const isCustom = !!item.is_custom_item;
                const isEmptyMaterialRow =
                  !isAddon && !isCustom && !item.material_id;
                const priceOptions = !isAddon && !isCustom && item.material_id ? (supplierPrices?.[item.material_id] || []) : [];
                const sellingPrice = computeLineSell(item);
                const lineTotal = (item.quantity || 0) * sellingPrice;

                return (
                  <TableRow key={item.line_id} className={cn("group", isAddon && "bg-muted/10")}>
                    <TableCell className="py-3 text-muted-foreground text-sm">
                      {isAddon ? (
                        <CornerDownRight className="h-3.5 w-3.5 opacity-50" />
                      ) : (
                        mainIndex
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className={cn("flex items-center gap-1.5", isAddon && "pl-4")}>
                        {(isCustom || isAddon) && !readOnly ? (
                          <Input
                            type="text"
                            placeholder={isAddon ? "Add-on name…" : "Custom item name..."}
                            value={item.custom_name || ""}
                            onChange={(e) => updateItem(item.line_id, { custom_name: e.target.value })}
                            className="h-8 text-sm w-48"
                          />
                        ) : isEmptyMaterialRow && !readOnly ? (
                          <div className="w-72">
                            <MaterialAutocompleteCell
                              autoFocus
                              placeholder="Type to search materials…"
                              showStatus
                              zoneCode={zoneCode}
                              onPick={(picked) => {
                                updateItem(item.line_id, {
                                  material_id: picked.id,
                                  name: picked.name,
                                  uom: picked.uom,
                                  resolving: !!zoneCode,
                                });
                                if (zoneCode) {
                                  void resolveLineForMaterial(item.line_id, picked.id);
                                }
                              }}
                              onOpenCatalog={() => setShowPicker(true)}
                            />
                          </div>
                        ) : (
                          <span className="text-sm font-medium">{item.name || item.custom_name || "—"}</span>
                        )}
                        {isAddon ? (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-sky-500/50 text-sky-600 bg-sky-500/10 shrink-0">
                            Add-on
                          </Badge>
                        ) : isCustom ? (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-purple-500/50 text-purple-600 bg-purple-500/10 shrink-0">
                            Custom
                          </Badge>
                        ) : null}
                        {!isAddon && !isCustom && item.quality_fallback && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/50 text-amber-600 bg-amber-500/10 shrink-0">
                                No quality
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px]">
                              <p className="text-xs">Quality supplier was requested but none is available for this material. Using best-price supplier instead.</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {!isAddon && !isCustom && item.resolved_role && !item.quality_fallback && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] px-1.5 py-0 shrink-0",
                              item.resolved_role === "quality" && "border-blue-500/50 text-blue-600 bg-blue-500/10",
                              item.resolved_role === "selected" && "border-emerald-500/50 text-emerald-600 bg-emerald-500/10",
                              item.resolved_role === "backup" && "border-orange-500/50 text-orange-600 bg-orange-500/10",
                            )}
                          >
                            {item.resolved_role === "quality" ? "Quality" : item.resolved_role === "backup" ? "Backup" : "Selected"}
                          </Badge>
                        )}
                        {!isAddon && !isCustom && item.material_id && !readOnly && item.parent_line_id == null && (
                          <AddonPicker
                            parentMaterialId={item.material_id ?? null}
                            parentSubcategoryId={item.material_id ? subcategoryMap?.get(item.material_id) ?? null : null}
                            onSelect={(sel) => addItemAddon(item.line_id, sel)}
                            trigger={
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Plus className="h-3 w-3 mr-0.5" />
                                Add-on
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      {readOnly ? (
                        <span className="text-sm font-medium tabular-nums text-center block">
                          {item.quantity ?? "—"}
                        </span>
                      ) : (
                        <Input
                          type="number"
                          placeholder="0"
                          value={item.quantity || ""}
                          onChange={(e) =>
                            updateItem(item.line_id, {
                              quantity: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="h-8 text-sm text-center w-20"
                          disabled={isEmptyMaterialRow}
                        />
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-center">
                      {(isCustom || isAddon) && !readOnly ? (
                        <Input
                          type="text"
                          value={item.uom || ""}
                          onChange={(e) => updateItem(item.line_id, { uom: e.target.value })}
                          className="h-7 w-14 text-xs text-center"
                          placeholder="unit"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">{item.uom || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      {(isCustom || isAddon) && !readOnly ? (
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={item.unit_price || ""}
                          onChange={(e) =>
                            updateItem(item.line_id, {
                              unit_price: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="h-8 text-sm text-right w-24"
                        />
                      ) : isEmptyMaterialRow ? (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      ) : item.resolving ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="h-3 w-3 inline-block rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                          Resolving…
                        </span>
                      ) : item.unit_price ? (
                        <span className="text-sm tabular-nums font-medium">
                          {item.unit_price.toFixed(2)}
                        </span>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/50 text-destructive bg-destructive/10">
                              Unpriced
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px]">
                            <p className="text-xs">Pricing engine could not produce a price for this material. Check warnings or contact Supply.</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>

                    <TableCell className="py-3 text-right">
                      <span className="text-sm font-medium tabular-nums">
                        {lineTotal > 0 ? `${lineTotal.toFixed(2)} SAR` : "—"}
                      </span>
                    </TableCell>
                    {!readOnly && (
                      <TableCell className="py-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeMaterial(item.line_id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              });
            })()
          )}
        </TableBody>
      </Table>


      {/* Add material picker */}
      {!readOnly && (
        <div className="p-3 border-t space-y-2">
          {showPicker ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Select Material</span>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowPicker(false)}>
                  Close
                </Button>
              </div>
              <MaterialStepPicker
                excludeIds={excludeIds}
                onSelect={(m) => addMaterial(m)}
                onBulkSelect={(picked) => {
                  if (!onChange) return;
                  const newItems = picked
                    .filter(p => !items.some(i => i.material_id === p.id))
                    .map(p => ({ line_id: crypto.randomUUID(), material_id: p.id, name: p.name, uom: p.uom, quantity: undefined }));
                  onChange([...items, ...newItems]);
                }}
                zoneCode={zoneCode}
                multi
              />
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 border-dashed text-xs"
                onClick={() => {
                  if (!onChange) return;
                  onChange([
                    ...items,
                    { line_id: crypto.randomUUID(), name: "", quantity: undefined },
                  ]);
                }}
              >
                + Add Line
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-dashed text-xs"
                onClick={addCustomItem}
              >
                <PenLine className="h-3.5 w-3.5 mr-1" />
                Custom Item
              </Button>
              <AddonPicker
                globalOnly
                onSelect={(sel) => addQuotationAddon(sel)}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-dashed text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Quotation Add-on
                  </Button>
                }
              />
            </div>
          )}
        </div>
      )}

      {/* Footer with Delivery & Totals */}
      {items.length > 0 && (
        <div className="p-4 border-t bg-muted/10 space-y-4">
          {/* Delivery Breakdown Table */}
          {deliveryMode === "separate" && deliveryLines.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Truck className="h-3.5 w-3.5" />
                Delivery Charges
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="font-semibold text-xs">SUPPLIER</TableHead>
                    <TableHead className="font-semibold text-xs">MATERIALS</TableHead>
                    <TableHead className="font-semibold text-xs w-16 text-center">QTY</TableHead>
                    <TableHead className="font-semibold text-xs w-16 text-center">TRIPS</TableHead>
                    <TableHead className="font-semibold text-xs w-24 text-right">RATE/TRIP</TableHead>
                    <TableHead className="font-semibold text-xs w-24 text-right">COST</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryLines.map((line) => (
                    <TableRow key={line.delivery_rate_id}>
                      <TableCell className="py-2 text-sm">{line.supplier_name}</TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {line.material_names.join(", ")}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-center tabular-nums">{line.total_quantity}</TableCell>
                      <TableCell className="py-2 text-sm text-center tabular-nums">{line.trips}</TableCell>
                      <TableCell className="py-2 text-sm text-right tabular-nums">{line.price_per_trip.toFixed(2)} SAR</TableCell>
                      <TableCell className="py-2 text-sm text-right font-medium tabular-nums">{line.total_cost.toFixed(2)} SAR</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {zoneName && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  Delivery to: <span className="font-medium text-foreground">{zoneName}</span>
                </div>
              )}
            </div>
          )}

          {/* Delivery Details Row */}
          <div className="flex items-center justify-between gap-4 pb-3 border-b">
            <div className="flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Delivery:</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm">
              {deliveryLocation && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{deliveryLocation}</span>
                </div>
              )}
              
              {!readOnly && onDeliveryDateChange ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-40 justify-start text-sm",
                        !deliveryDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {deliveryDate ? format(deliveryDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={deliveryDate || undefined}
                      onSelect={(date) => onDeliveryDateChange(date || null)}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              ) : deliveryDate ? (
                <span className="font-medium">{format(deliveryDate, "PPP")}</span>
              ) : null}
            </div>
          </div>

          {/* Totals Row — hidden when project zone is missing */}
          {zoneGate.blocked ? (
            <div className="flex justify-end">
              <div className="text-right w-72 text-sm text-muted-foreground italic">
                Totals hidden — add a project location with a zone to enable pricing.
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <div className="text-right space-y-1 w-72">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal (items):</span>
                  <span className="tabular-nums font-medium">{totals.sellingTotal.toFixed(2)} SAR</span>
                </div>
                {totals.deliveryAddition > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery:</span>
                    <span className="tabular-nums font-medium">{totals.deliveryAddition.toFixed(2)} SAR</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-1 border-t">
                  <span className="text-muted-foreground">Total (pre-tax):</span>
                  <span className="tabular-nums font-medium">{totals.preTax.toFixed(2)} SAR</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">VAT (15%):</span>
                  <span className="tabular-nums font-medium">{totals.vat.toFixed(2)} SAR</span>
                </div>
                <div className="flex justify-between text-base font-semibold pt-1 border-t border-primary/30">
                  <span>Total (incl. VAT):</span>
                  <span className="tabular-nums">
                    {totals.grandTotal.toFixed(2)} SAR
                    {missingRateItems.length > 0 && (
                      <AlertTriangle className="inline h-3.5 w-3.5 text-destructive ml-1" />
                    )}
                  </span>
                </div>
              </div>
            </div>

          )}
        </div>
      )}
    </div>
  );
}

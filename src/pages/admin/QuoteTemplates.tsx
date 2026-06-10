import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, ChevronDown, Palette, Type, Eye, FileText, Languages, Download, Loader2 } from "lucide-react";
import { buildQuoteHtml, DEFAULT_SETTINGS, type TemplateSettings, type QuoteItem } from "@/lib/quote-html-builder";
import { printQuoteIframe } from "@/components/sales/QuotationDocument";

// ── Fetch actual data from DB ────────────────────────────────────────────────

function useActualSampleData() {
  return useQuery({
    queryKey: ["quote-template-sample-data"],
    queryFn: async () => {
      // Get a recent quotation with items
      const { data: quotation } = await supabase
        .from("quotations")
        .select(`
          id, code, version, currency, est_delivery_date,
          customer_account_id, project_id,
          quotation_items (
            material_id, quantity, unit_price, delivery_price, uom,
            supplier_account_id
          )
        `)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let customer = { name: "Sample Customer", name_ar: "", contact: "Contact Person", contact_ar: "", phone: "+966 55 000 0000" };
      let project = { name: "Sample Project", name_ar: "", location: "Riyadh" };
      let items: QuoteItem[] = [];
      let deliveryDate = new Date(Date.now() + 14 * 86400000).toISOString();
      let version = 1;
      let quotationCode = "QT-0000";
      let currency = "SAR";

      if (quotation) {
        // Fetch customer
        const { data: account } = await supabase
          .from("accounts")
          .select("display_name, display_name_ar, poc_contact_id")
          .eq("id", quotation.customer_account_id)
          .maybeSingle();

        if (account) {
          customer.name = (account as any).display_name || "Customer";
          customer.name_ar = (account as any).display_name_ar || "";
          if (account.poc_contact_id) {
            const { data: contact } = await supabase
              .from("contacts")
              .select("full_name, full_name_ar, phone")
              .eq("id", account.poc_contact_id)
              .maybeSingle();
            if (contact) {
              customer.contact = contact.full_name || "";
              customer.contact_ar = (contact as any).full_name_ar || "";
              customer.phone = contact.phone || "";
            }
          }
        }

        // Fetch project
        if (quotation.project_id) {
          const { data: proj } = await supabase
            .from("projects")
            .select("name, name_ar, location_id")
            .eq("id", quotation.project_id)
            .maybeSingle();
          if (proj) {
            project.name = proj.name;
            project.name_ar = (proj as any).name_ar || "";
            if (proj.location_id) {
              const { data: loc } = await supabase
                .from("locations")
                .select("city, address_text")
                .eq("id", proj.location_id)
                .maybeSingle();
              if (loc) project.location = loc.city || loc.address_text || "";
            }
          }
        }

        // Fetch material details and supplier names
        const qiArr = quotation.quotation_items || [];
        const materialIds = qiArr.map((qi: any) => qi.material_id).filter(Boolean);
        const supplierIds = qiArr.map((qi: any) => qi.supplier_account_id).filter(Boolean);

        let materialMap: Record<string, { name: string; name_ar: string; uom: string }> = {};
        if (materialIds.length > 0) {
          const { data: mats } = await supabase.from("materials").select("id, name, name_ar, uom").in("id", materialIds);
          if (mats) materialMap = Object.fromEntries(mats.map((m) => [m.id, { name: m.name, name_ar: m.name_ar || "", uom: m.uom }]));
        }

        let supplierMap: Record<string, { name: string; name_ar: string }> = {};
        if (supplierIds.length > 0) {
          const { data: sups } = await supabase.from("accounts").select("id, display_name, display_name_ar").in("id", supplierIds);
          if (sups) supplierMap = Object.fromEntries(sups.map((s: any) => [s.id, { name: s.display_name || "", name_ar: s.display_name_ar || "" }]));
        }

        items = qiArr.map((qi: any) => {
          const mat = materialMap[qi.material_id];
          const sup = qi.supplier_account_id ? supplierMap[qi.supplier_account_id] : undefined;
          return {
            material_id: qi.material_id,
            name: mat?.name || "Material",
            name_ar: mat?.name_ar || "",
            quantity: qi.quantity,
            uom: qi.uom || mat?.uom || "unit",
            unit_price: qi.unit_price,
            delivery_price: qi.delivery_price,
            supplier_name: sup?.name || "",
            supplier_name_ar: sup?.name_ar || "",
          };
        });

        deliveryDate = quotation.est_delivery_date || deliveryDate;
        version = quotation.version || 1;
        quotationCode = quotation.code || "QT-0000";
        currency = quotation.currency || "SAR";
      }

      // Fallback: use materials registry if no quotation found
      if (items.length === 0) {
        const { data: materials } = await supabase
          .from("materials")
          .select("id, name, name_ar, uom")
          .eq("status", "active")
          .limit(5);

        // Also fetch a sample supplier price for these materials
        let smMap: Record<string, { price: number; delivery: number; supplier_name: string; supplier_name_ar: string }> = {};
        if (materials && materials.length > 0) {
          const matIds = materials.map((m) => m.id);
          const { data: smRows } = await supabase
            .from("supplier_materials")
            .select("material_id, unit_price, delivery_price, supplier_account_id")
            .in("material_id", matIds)
            .eq("is_current", true)
            .eq("status", "approved")
            .limit(10);
          if (smRows && smRows.length > 0) {
            const supIds = [...new Set(smRows.map((r: any) => r.supplier_account_id).filter(Boolean))];
            let supNames: Record<string, { name: string; name_ar: string }> = {};
            if (supIds.length > 0) {
              const { data: sups } = await supabase.from("accounts").select("id, display_name, display_name_ar").in("id", supIds);
              if (sups) supNames = Object.fromEntries(sups.map((s: any) => [s.id, { name: s.display_name || "", name_ar: s.display_name_ar || "" }]));
            }
            for (const row of smRows as any[]) {
              if (!smMap[row.material_id]) {
                const sup = supNames[row.supplier_account_id] || { name: "", name_ar: "" };
                smMap[row.material_id] = {
                  price: row.unit_price || 50,
                  delivery: row.delivery_price || 5,
                  supplier_name: sup.name,
                  supplier_name_ar: sup.name_ar,
                };
              }
            }
          }
        }

        if (materials) {
          items = materials.map((m) => {
            const sm = smMap[m.id];
            return {
              material_id: m.id,
              name: m.name,
              name_ar: m.name_ar || "",
              quantity: 100,
              uom: m.uom,
              unit_price: sm?.price || 50,
              delivery_price: sm?.delivery || 5,
              supplier_name: sm?.supplier_name || "",
              supplier_name_ar: sm?.supplier_name_ar || "",
            };
          });
        }
      }

      return { customer, project, items, deliveryDate, version, quotationCode, currency };
    },
  });
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function QuoteTemplates() {
  const queryClient = useQueryClient();
  const [templateKey, setTemplateKey] = useState<"quotation" | "pricelist">("quotation");
  const [previewLang, setPreviewLang] = useState<"en" | "ar">("en");
  const [settings, setSettings] = useState<TemplateSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { data: sampleData } = useActualSampleData();

  // Fetch template from DB
  const { data: dbTemplate } = useQuery({
    queryKey: ["pdf-template", templateKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdf_templates")
        .select("*")
        .eq("template_key", templateKey)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Load settings when template changes
  useEffect(() => {
    if (dbTemplate?.settings) {
      const merged = { ...DEFAULT_SETTINGS, ...(dbTemplate.settings as unknown as TemplateSettings) };
      setSettings(merged);
      setHasChanges(false);
    }
  }, [dbTemplate]);

  const updateSetting = <K extends keyof TemplateSettings>(key: K, value: TemplateSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateLabel = (lang: "en" | "ar", key: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      labels: { ...prev.labels, [lang]: { ...prev.labels[lang], [key]: value } },
    }));
    setHasChanges(true);
  };

  const updateColumn = (lang: "en" | "ar", key: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      columns: { ...prev.columns, [lang]: { ...prev.columns[lang], [key]: value } },
    }));
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("pdf_templates")
        .update({ settings: settings as any, updated_at: new Date().toISOString() })
        .eq("template_key", templateKey);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template saved");
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["pdf-template"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to save"),
  });

  // Use actual data for preview
  const previewData = useMemo(() => {
    if (!sampleData) return null;
    return sampleData;
  }, [sampleData]);

  // Live preview HTML
  const previewHtml = useMemo(() => {
    if (!previewData) return "<html><body style='display:flex;align-items:center;justify-content:center;height:100vh;color:#aaa;font-family:sans-serif;'>Loading data...</body></html>";
    return buildQuoteHtml({
      mode: templateKey,
      lang: previewLang,
      items: previewData.items,
      customer: previewData.customer,
      project: previewData.project,
      deliveryDate: previewData.deliveryDate,
      version: previewData.version,
      quotationCode: previewData.quotationCode,
      currency: previewData.currency,
      settings,
    });
  }, [templateKey, previewLang, settings, previewData]);

  const handleDownloadPdf = () => {
    setIsDownloading(true);
    printQuoteIframe(iframeRef.current);
    setIsDownloading(false);
  };

  const labelKeys = Object.keys(settings.labels.en);
  const columnKeys = Object.keys(settings.columns.en);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Quote Templates</h1>
            <p className="text-sm text-muted-foreground">
              Customize layout, labels, and branding. Both Quotation and Price List render the same <code>quotation_items</code> data — only column visibility differs.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloading}>
              {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {isDownloading ? "Generating..." : "Download PDF"}
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Template + Language Toggles */}
        <div className="flex gap-3 flex-wrap">
          <Tabs value={templateKey} onValueChange={(v) => setTemplateKey(v as any)}>
            <TabsList>
              <TabsTrigger value="quotation"><FileText className="h-4 w-4 mr-1.5" />Quotation</TabsTrigger>
              <TabsTrigger value="pricelist"><FileText className="h-4 w-4 mr-1.5" />Price List</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={previewLang} onValueChange={(v) => setPreviewLang(v as any)}>
            <TabsList>
              <TabsTrigger value="en"><Languages className="h-4 w-4 mr-1.5" />English</TabsTrigger>
              <TabsTrigger value="ar"><Languages className="h-4 w-4 mr-1.5" />Arabic</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: "calc(100vh - 220px)" }}>
          {/* Left: Settings Form */}
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="space-y-3 pr-2">
              <CollapsibleSection icon={Palette} title="Branding">
                <div className="space-y-3">
                  <FieldRow label="Company Name">
                    <Input value={settings.company_name} onChange={(e) => updateSetting("company_name", e.target.value)} />
                  </FieldRow>
                  <FieldRow label="Tagline (EN)">
                    <Input value={settings.tagline} onChange={(e) => updateSetting("tagline", e.target.value)} />
                  </FieldRow>
                  <FieldRow label="Tagline (AR)">
                    <Input value={settings.tagline_ar} onChange={(e) => updateSetting("tagline_ar", e.target.value)} dir="rtl" />
                  </FieldRow>
                  <FieldRow label="Primary Color">
                    <div className="flex gap-2 items-center">
                      <input type="color" value={settings.primary_color} onChange={(e) => updateSetting("primary_color", e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                      <Input value={settings.primary_color} onChange={(e) => updateSetting("primary_color", e.target.value)} className="w-28 font-mono text-sm" />
                    </div>
                  </FieldRow>
                </div>
              </CollapsibleSection>

              <CollapsibleSection icon={Type} title={`Info Labels (${previewLang.toUpperCase()})`}>
                <div className="space-y-2">
                  {labelKeys.map((key) => (
                    <FieldRow key={key} label={key.replace(/_/g, " ")}>
                      <Input value={settings.labels[previewLang]?.[key] || ""} onChange={(e) => updateLabel(previewLang, key, e.target.value)} dir={previewLang === "ar" ? "rtl" : "ltr"} />
                    </FieldRow>
                  ))}
                </div>
              </CollapsibleSection>

              <CollapsibleSection icon={Type} title={`Column Labels (${previewLang.toUpperCase()})`}>
                <div className="space-y-2">
                  {columnKeys.map((key) => (
                    <FieldRow key={key} label={key.replace(/_/g, " ")}>
                      <Input value={settings.columns[previewLang]?.[key] || ""} onChange={(e) => updateColumn(previewLang, key, e.target.value)} dir={previewLang === "ar" ? "rtl" : "ltr"} />
                    </FieldRow>
                  ))}
                </div>
              </CollapsibleSection>

              <CollapsibleSection icon={Eye} title="Visibility Toggles">
                <div className="space-y-3">
                  <SwitchRow label="Show Supplier Name" checked={settings.show_supplier_name} onChange={(v) => updateSetting("show_supplier_name", v)} />
                  <SwitchRow label="Show Delivery Column" checked={settings.show_delivery_column} onChange={(v) => updateSetting("show_delivery_column", v)} />
                  <SwitchRow label="Show Contact Phone" checked={settings.show_contact_phone} onChange={(v) => updateSetting("show_contact_phone", v)} />
                  <SwitchRow label="Show Delivery Section" checked={settings.show_delivery_section} onChange={(v) => updateSetting("show_delivery_section", v)} />
                </div>
              </CollapsibleSection>

              <CollapsibleSection icon={FileText} title="Footer and Terms">
                <div className="space-y-3">
                  <FieldRow label="Footer Left">
                    <Input value={settings.footer_left} onChange={(e) => updateSetting("footer_left", e.target.value)} placeholder="Generated {{date}}" />
                  </FieldRow>
                  <FieldRow label="Footer Right">
                    <Input value={settings.footer_right} onChange={(e) => updateSetting("footer_right", e.target.value)} />
                  </FieldRow>
                  <FieldRow label="Price List Note">
                    <Textarea value={settings.pricelist_note} onChange={(e) => updateSetting("pricelist_note", e.target.value)} rows={2} />
                  </FieldRow>
                  <FieldRow label="Terms">
                    <Textarea value={settings.terms_text} onChange={(e) => updateSetting("terms_text", e.target.value)} rows={4} placeholder="Optional terms text..." />
                  </FieldRow>
                </div>
              </CollapsibleSection>
            </div>
          </ScrollArea>

          {/* Right: Live Preview */}
          <Card className="overflow-hidden">
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Live Preview (A4)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <iframe
                ref={iframeRef}
                srcDoc={previewHtml}
                title="Quote Preview"
                className="w-full border-0"
                style={{ height: "calc(100vh - 280px)", minHeight: 600 }}
                sandbox="allow-same-origin allow-modals"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

// ── Helper Components ────────────────────────────────────────────────────────

function CollapsibleSection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
      <Label className="text-xs text-muted-foreground capitalize truncate">{label}</Label>
      {children}
    </div>
  );
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

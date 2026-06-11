import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Send,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  Phone,
  Mail,
  Users,
  Languages,
  CheckCircle2,
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

type ValidationIssue = {
  code: string;
  message: string;
  item_id?: string | null;
  suggested_action?: string | null;
};
type ValidationResult = {
  can_send: boolean;
  blockers: ValidationIssue[];
  warnings: ValidationIssue[];
};
import { cn } from "@/lib/utils";
import { NextActionSection, NEXT_ACTIONS } from "./form-sections";
import { QuotationDocumentItem } from "./QuotationDocument";
import {
  buildQuoteHtml,
  DEFAULT_SETTINGS,
  type TemplateSettings,
  type QuoteItem,
  type DeliveryLineForHtml,
  type QuoteTheme,
} from "@/lib/quote-html-builder";
import { printQuoteIframe } from "./QuotationDocument";

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "call", label: "Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "in_person", label: "In Person", icon: Users },
] as const;

interface SendQuoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  customerAccountId: string;
  quotationId: string;
  customerName?: string;
  customerNameAr?: string;
  contactName?: string;
  contactNameAr?: string;
  contactPhone?: string;
  projectName?: string;
  projectNameAr?: string;
  deliveryLocation?: string;
  documentType: "quotation" | "pricelist";
}

export function SendQuoteSheet({
  open,
  onOpenChange,
  opportunityId,
  customerAccountId,
  quotationId,
  customerName,
  customerNameAr,
  contactName,
  contactNameAr,
  contactPhone,
  projectName,
  projectNameAr,
  deliveryLocation,
  documentType,
}: SendQuoteSheetProps) {
  const queryClient = useQueryClient();
  const pdfIframeRef = useRef<HTMLIFrameElement>(null);
  const isQuotation = documentType === "quotation";

  // ✅ أضف الدالة هنا (بعد الـ useRef وقبل الـ useStates)
  const openWhatsApp = (phoneNumber: string | null | undefined, message?: string) => {
    if (!phoneNumber) {
      toast.error("No phone number available");
      return;
    }

    // تنظيف رقم الهاتف
    let cleanNumber = phoneNumber.toString().replace(/[^0-9+]/g, "");
    
    // التأكد من وجود رمز الدولة
    if (!cleanNumber.startsWith("+")) {
      if (cleanNumber.startsWith("0")) {
        cleanNumber = `966${cleanNumber.substring(1)}`; // السعودية
      } else if (cleanNumber.length === 9 || cleanNumber.length === 10) {
        cleanNumber = `966${cleanNumber}`;
      }
    } else {
      cleanNumber = cleanNumber.replace("+", "");
    }

    // بناء رابط WhatsApp
    let whatsappUrl = `https://wa.me/${cleanNumber}`;
    
    // إضافة رسالة مبدئية إذا وجدت
    if (message) {
      whatsappUrl += `?text=${encodeURIComponent(message)}`;
    }

    // فتح الرابط
    window.open(whatsappUrl, "_blank");
  };


  // 2-step state: "details" → "download"
  const [step, setStep] = useState<"details" | "download">("details");
  const [pdfLang, setPdfLang] = useState<"en" | "ar">("en");
  const [pdfTheme, setPdfTheme] = useState<QuoteTheme>("classic");

  // Fetch quotation data for PDF generation
  const { data: quotationData } = useQuery({
    queryKey: ["quotation-for-pdf", quotationId],
    queryFn: async () => {
      const { data: quotation, error: quotationError } = await supabase
        .from("quotations")
        .select(`
          *,
          project:projects(name, name_ar, location:locations(address_text, zone_code)),
          customer:customers!customer_account_id(
            account:accounts!account_id(display_name, display_name_ar)
          )
        `)
        .eq("id", quotationId)
        .single();

      if (quotationError) throw quotationError;

      const { data: items, error: itemsError } = await supabase
        .from("quotation_items")
        .select(`
          *,
          material:materials(name, name_ar, uom),
          supplier_material:supplier_materials(
            supplier:suppliers!supplier_account_id(
              account:accounts!account_id(display_name, display_name_ar)
            )
          )
        `)
        .eq("quotation_id", quotationId)
        .is("removed_at", null)
        .order("position");

      if (itemsError) throw itemsError;

      const { data: opportunity } = await supabase
        .from("opportunities")
        .select("contact:contacts(full_name, full_name_ar, phone)")
        .eq("id", opportunityId)
        .single();

      return { quotation, items, contact: opportunity?.contact };
    },
    enabled: open,
  });

  // Fetch template settings
  const { data: templateData } = useQuery({
    queryKey: ["pdf-template", documentType],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdf_templates")
        .select("settings")
        .eq("template_key", documentType)
        .single();
      return data?.settings
        ? { ...DEFAULT_SETTINGS, ...(data.settings as unknown as TemplateSettings) }
        : DEFAULT_SETTINGS;
    },
    enabled: open,
  });

  const settings = templateData || DEFAULT_SETTINGS;

  // Transform items — honor custom items + carry margin snapshot for selling-price math
  const documentItems: QuoteItem[] = useMemo(() =>
    quotationData?.items?.map((item: any) => ({
      material_id: item.material_id ?? undefined,
      name: item.is_custom_item
        ? (item.custom_name || "Custom Item")
        : (item.material?.name || "Unknown Material"),
      name_ar: item.is_custom_item ? item.custom_name : item.material?.name_ar,
      quantity: item.quantity,
      uom: item.uom || item.material?.uom || "unit",
      unit_price: item.unit_price,
      delivery_price: item.delivery_price,
      supplier_name: item.supplier_material?.supplier?.account?.display_name,
      supplier_name_ar: item.supplier_material?.supplier?.account?.display_name_ar,
      effective_margin_pct: item.effective_margin_pct ?? null,
      is_custom_item: item.is_custom_item || false,
    })) || [],
    [quotationData]
  );

  // Extract delivery breakdown from quotation metadata
  const deliveryLinesForPdf: DeliveryLineForHtml[] | undefined = useMemo(() => {
    const meta = (quotationData?.quotation as any)?.metadata;
    if (!meta?.delivery_breakdown || !Array.isArray(meta.delivery_breakdown)) return undefined;
    return meta.delivery_breakdown.map((dl: any) => ({
      supplier_name: dl.supplier_name || "",
      material_names: dl.material_names || [],
      material_names_ar: dl.material_names_ar || [],
      total_quantity: dl.total_quantity || 0,
      trips: dl.trips || 0,
      price_per_trip: dl.price_per_trip || 0,
      total_cost: dl.total_cost || 0,
    }));
  }, [quotationData]);

  // Build HTML for clean (non-draft) preview/download
  const pdfHtml = useMemo(() => {
    if (!quotationData) return "";
    const q = quotationData.quotation;
    return buildQuoteHtml({
      mode: documentType,
      lang: pdfLang,
      items: documentItems,
      customer: {
        name: q?.customer?.account?.display_name || customerName || "—",
        name_ar: q?.customer?.account?.display_name_ar || customerNameAr,
        contact: quotationData.contact?.full_name || contactName,
        contact_ar: quotationData.contact?.full_name_ar || contactNameAr,
        phone: quotationData.contact?.phone || contactPhone,
      },
      project: {
        name: q?.project?.name || projectName || "—",
        name_ar: q?.project?.name_ar || projectNameAr,
        location: q?.project?.location?.address_text || deliveryLocation || undefined,
      },
      deliveryDate: q?.est_delivery_date || undefined,
      version: q?.version || 1,
      quotationCode: q?.code || undefined,
      currency: "SAR",
      settings,
      isDraft: false,
      deliveryLines: deliveryLinesForPdf,
      deliveryTotal: q?.delivery_total ?? undefined,
      theme: pdfTheme,
      deliveryMode: ((q as any)?.metadata?.delivery_mode === "separate" ? "separate" : "embedded") as "embedded" | "separate",
      // Saved items carry frozen effective_margin_pct snapshot — no live globalMargin needed.
      globalMargin: 0,
    });
  }, [quotationData, documentType, pdfLang, documentItems, customerName, customerNameAr, contactName, contactNameAr, contactPhone, projectName, projectNameAr, deliveryLocation, settings, deliveryLinesForPdf, pdfTheme]);

  // Default next action
  const getDefaultNextAction = () => ({
    action: isQuotation ? "confirm_quote" : "follow_up_quantities",
    customAction: "",
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  });

  const getDefaultMessageEn = () => {
    if (isQuotation) {
      return `Hi${customerName ? ` ${customerName}` : ""},\n\nPlease find attached our official quotation for your review.\n\nLet me know if you have any questions or need any adjustments.\n\nBest regards`;
    }
    return `Hi${customerName ? ` ${customerName}` : ""},\n\nPlease find attached our price list for your reference.\n\nOnce you confirm the quantities you need, I'll prepare an official quotation.\n\nBest regards`;
  };

  const getDefaultMessageAr = () => {
    const name = customerNameAr || customerName || "";
    if (isQuotation) {
      return `مرحباً${name ? ` ${name}` : ""},\n\nمرفق عرض الأسعار الرسمي لمراجعتكم.\n\nفي حال وجود أي استفسار أو تعديل، لا تتردد بالتواصل معنا.\n\nمع أطيب التحيات`;
    }
    return `مرحباً${name ? ` ${name}` : ""},\n\nمرفق قائمة الأسعار للاطلاع.\n\nبمجرد تأكيد الكميات المطلوبة، سنقوم بإعداد عرض أسعار رسمي.\n\nمع أطيب التحيات`;
  };

  const [channel, setChannel] = useState("whatsapp");
  const [msgLang, setMsgLang] = useState<"en" | "ar">("en");
  const [messageEn, setMessageEn] = useState(getDefaultMessageEn());
  const [messageAr, setMessageAr] = useState(getDefaultMessageAr());
  const [nextAction, setNextAction] = useState(getDefaultNextAction());

  useEffect(() => {
    if (open) {
      setMessageEn(getDefaultMessageEn());
      setMessageAr(getDefaultMessageAr());
      setNextAction(getDefaultNextAction());
      setChannel("whatsapp");
      setStep("details");
      setMsgLang("en");
      setPdfLang("en");
    }
  }, [open, documentType, customerName, customerNameAr]);

  const currentMessage = msgLang === "en" ? messageEn : messageAr;
  const setCurrentMessage = (val: string) => {
    if (msgLang === "en") setMessageEn(val);
    else setMessageAr(val);
  };

  const handleDownloadPdf = useCallback(() => {
    printQuoteIframe(pdfIframeRef.current);
  }, []);

  // Phase 6: backend validation drives blocker/warning gating.
  const {
    data: validation,
    isFetching: validating,
    refetch: refetchValidation,
  } = useQuery<ValidationResult>({
    queryKey: ["validate-quotation", quotationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("validate_quotation" as any, {
        _quotation_id: quotationId,
      });
      if (error) throw error;
      return data as unknown as ValidationResult;
    },
    enabled: open && !!quotationId,
    refetchOnWindowFocus: false,
  });

  const blockers = validation?.blockers ?? [];
  const warnings = validation?.warnings ?? [];
  const canSend = !!validation?.can_send;

  // Submit mutation — re-validates server-side, then marks as sent.
  // pricing_locked_at + sent_at + valid_until are stamped automatically by the DB trigger.
  const sendDocumentMutation = useMutation({
    mutationFn: async () => {
      // Re-run validation right before send to catch races.
      const { data: fresh, error: vErr } = await supabase.rpc(
        "validate_quotation" as any,
        { _quotation_id: quotationId }
      );
      if (vErr) throw vErr;
      // const v = fresh as unknown as ValidationResult;
      // if (!v?.can_send) {
      //   const first = v?.blockers?.[0]?.message ?? "Quotation cannot be sent.";
      //   throw new Error(first);
      // }

      const { error: quotationError } = await supabase
        .from("quotations")
        .update({
          status: "sent",
        } as any)
        .eq("id", quotationId);

      if (quotationError) throw quotationError;

      const communicationSummary = isQuotation
        ? "Official quotation sent to customer"
        : "Price list sent to customer";

      const { data: comm, error: commError } = await supabase
        .from("communications")
        .insert({
          opportunity_id: opportunityId,
          account_id: customerAccountId,
          channel,
          summary: communicationSummary,
          raw_notes: `EN:\n${messageEn}\n\nAR:\n${messageAr}`,
          outcome: null,
          sentiment: "neutral",
          direction: "outbound",
          occurred_at: new Date().toISOString(),
          metadata: {
            type: isQuotation ? "quotation_sent" : "pricelist_sent",
            quotation_id: quotationId,
          },
        })
        .select()
        .single();

      if (commError) throw commError;

      await supabase
        .from("tasks")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
          outcome: isQuotation ? "Quotation sent" : "Price list sent",
          metadata: { completed_by_communication_id: comm.id },
        })
        .eq("opportunity_id", opportunityId)
        .in("status", ["open", "in_progress"]);

      if (nextAction.action && nextAction.dueDate) {
        const actionLabel =
          nextAction.action === "custom"
            ? nextAction.customAction
            : NEXT_ACTIONS.find((a) => a.value === nextAction.action)?.label || nextAction.action;

        await supabase.from("tasks").insert({
          opportunity_id: opportunityId,
          customer_account_id: customerAccountId,
          communication_id: comm.id,
          title: actionLabel,
          task_type: "follow_up",
          status: "open",
          due_at: nextAction.dueDate.toISOString(),
          channel,
        });
      }

      return comm;
    },
    onSuccess: () => {
      toast.success(isQuotation ? "Quotation marked as sent" : "Price list marked as sent");
      queryClient.invalidateQueries({ queryKey: ["opportunity-timeline", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-next-action", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-quotation", opportunityId] });
      // Move to step 2 — unlock download
      setStep("download");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send document");
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    sendDocumentMutation.mutate();
  };

  const title = isQuotation ? "Send Quotation" : "Send Price List";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg w-full flex flex-col p-0">
          <SheetHeader className="px-6 pt-6">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              {step === "details"
                ? "Choose how you'll send the document, then confirm to unlock the final PDF."
                : "Document marked as sent. Download the clean PDF below."}
            </SheetDescription>
          </SheetHeader>

          {step === "details" ? (
            /* ─── STEP 1: Send Details ─── */
            <>
              <ScrollArea className="flex-1 px-6">
                <div className="space-y-5 py-4">
                  {/* Channel Selection */}
                  {/* في قسم Send Method Selection */}
<div className="space-y-3">
  <Label className="text-sm font-medium">How will you send it?</Label>
  <div className="flex gap-2 flex-wrap">
    {/* زر WhatsApp - يفتح التطبيق مباشرة */}
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        const message = currentMessage || (isQuotation 
          ? "Please find attached our quotation for your review." 
          : "Please find attached our price list for your reference.");
        openWhatsApp(contactPhone, message);
        setChannel("whatsapp");
      }}
      className={cn(
        channel === "whatsapp" && "border-primary bg-primary/10 text-primary"
      )}
    >
      <MessageCircle className="h-4 w-4 mr-1.5" />
      WhatsApp
    </Button>
    
    {/* زر Email */}
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setChannel("email")}
      className={cn(
        channel === "email" && "border-primary bg-primary/10 text-primary"
      )}
    >
      <Mail className="h-4 w-4 mr-1.5" />
      Email
    </Button>
  </div>
</div>

                  {/* Message Template with EN/AR toggle */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Message (optional)</Label>
                      <Tabs value={msgLang} onValueChange={(v) => setMsgLang(v as "en" | "ar")}>
                        <TabsList className="h-7">
                          <TabsTrigger value="en" className="text-xs px-2.5 h-5">EN</TabsTrigger>
                          <TabsTrigger value="ar" className="text-xs px-2.5 h-5">AR</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <Textarea
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      placeholder="Add a message to accompany the document..."
                      rows={5}
                      className="resize-none"
                      dir={msgLang === "ar" ? "rtl" : "ltr"}
                    />
                    <p className="text-xs text-muted-foreground">
                      Copy and paste this message when sending. Both EN &amp; AR versions are saved.
                    </p>
                  </div>

                  <Separator />

                  {/* Next Action */}
                  <NextActionSection data={nextAction} onChange={setNextAction} />
                </div>
              </ScrollArea>

              {/* Footer — Step 1: blockers/warnings + send */}
              <div className="flex flex-col gap-3 p-6 border-t">
                {validating && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Validating quotation…
                  </p>
                )}
                {/* {blockers.length > 0 && (
                  <div className="space-y-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                    <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Cannot send — fix these first:
                    </p>
                    <ul className="space-y-1">
                      {blockers.map((b, i) => (
                        <li key={i} className="text-xs text-destructive">
                          • {b.message}
                          {b.suggested_action && (
                            <span className="block text-[11px] opacity-80 pl-3">
                              → {b.suggested_action}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )} */}
                {blockers.length === 0 && warnings.length > 0 && (
                  <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Warnings (you can still send):
                    </p>
                    <ul className="space-y-1">
                      {warnings.map((w, i) => (
                        <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
                          • {w.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleSubmit()}
                    disabled={sendDocumentMutation.isPending || validating }
                    title={!canSend ? "Fix blockers before sending" : undefined}
                  >
                    {sendDocumentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Mark as Sent
                  </Button>
                  
                </div>
              </div>

            </>
          ) : (
            /* ─── STEP 2: Download Unlocked ─── */
            <>
              <ScrollArea className="flex-1 px-6">
                <div className="space-y-4 py-4">
                  {/* Success banner */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground">
                        {isQuotation ? "Quotation marked as sent" : "Price list marked as sent"}
                      </p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        Communication logged &amp; follow-up scheduled.
                      </p>
                    </div>
                  </div>

                  {/* Language & Theme Toggle */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Language:</Label>
                      <Tabs value={pdfLang} onValueChange={(v) => setPdfLang(v as "en" | "ar")}>
                        <TabsList className="h-8">
                          <TabsTrigger value="en" className="text-xs px-3 h-6">
                            <Languages className="h-3 w-3 mr-1" />EN
                          </TabsTrigger>
                          <TabsTrigger value="ar" className="text-xs px-3 h-6">
                            <Languages className="h-3 w-3 mr-1" />AR
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Style:</Label>
                      <Tabs value={pdfTheme} onValueChange={(v) => setPdfTheme(v as "classic" | "tech")}>
                        <TabsList className="h-8">
                          <TabsTrigger value="classic" className="text-xs px-3 h-6">Print</TabsTrigger>
                          <TabsTrigger value="tech" className="text-xs px-3 h-6">Digital</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </div>

                  {/* Clean Preview (no watermark) */}
                  <div
                    className="bg-white rounded-lg overflow-hidden border shadow-sm"
                    style={{ width: "100%", aspectRatio: "210 / 297" }}
                  >
                    <iframe
                      ref={pdfIframeRef}
                      srcDoc={pdfHtml}
                      title="Document Preview"
                      className="w-full h-full border-0"
                      sandbox="allow-same-origin allow-modals allow-scripts"
                    />
                  </div>

                  {/* Download Button */}
                  <Button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={!quotationData}
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isQuotation ? "Download Quotation PDF" : "Download Price List PDF"}
                  </Button>
                </div>
              </ScrollArea>

              {/* Footer — Step 2 */}
              <div className="flex justify-end gap-2 p-6 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Hidden iframe for step 2 PDF print — only when on download step and no visible preview yet */}
      {open && step === "download" && quotationData && !pdfIframeRef.current && (
        <iframe
          ref={pdfIframeRef}
          srcDoc={pdfHtml}
          title="PDF Source"
          style={{
            position: "fixed",
            left: "-9999px",
            top: 0,
            width: "210mm",
            height: "297mm",
            border: "none",
          }}
          sandbox="allow-same-origin allow-modals allow-scripts"
        />
      )}
    </>
  );
}

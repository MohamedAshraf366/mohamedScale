import { useMemo, forwardRef, useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Edit2, Download, Loader2, Monitor, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  buildQuoteHtml,
  DEFAULT_SETTINGS,
  type TemplateSettings,
  type QuoteItem,
  type DeliveryLineForHtml,
  type QuoteTheme,
} from "@/lib/quote-html-builder";
import type { DeliveryLineItem } from "@/hooks/useQuotationDelivery";

export interface QuotationDocumentItem {
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
  margin_pct?: number;
  effective_margin_pct?: number | null;
  is_custom_item?: boolean;
  custom_name?: string;
  item_kind?: "material" | "addon";
  parent_line_id?: string | null;
}

interface QuotationDocumentProps {
  items: QuotationDocumentItem[];
  deliveryDate?: Date | null;
  deliveryLocation?: string | null;
  customerName?: string;
  customerNameAr?: string;
  projectName?: string;
  projectNameAr?: string;
  contactName?: string;
  contactNameAr?: string;
  contactPhone?: string;
  quoteDate?: Date;
  version?: number;
  readOnly?: boolean;
  onEdit?: () => void;
  mode?: "quotation" | "pricelist";
  forPdfExport?: boolean;
  quotationCode?: string | null;
  lang?: "en" | "ar";
  isDraft?: boolean;
  deliveryLines?: DeliveryLineItem[];
  deliveryTotal?: number;
  theme?: QuoteTheme;
  deliveryMode?: "embedded" | "separate";
  globalMargin?: number;
}

/** Print an iframe's content using the browser's native print dialog */
export function printQuoteIframe(
  iframe: HTMLIFrameElement | null,
  isTech = false,
  opts?: { mode?: string; quotationCode?: string; customerName?: string; lang?: string; isDraft?: boolean }
) {
  if (!iframe?.contentWindow) {
    toast.error("Preview not ready");
    return;
  }
  try {
    const doc = iframe.contentDocument;
    if (doc && !doc.getElementById("__print_style")) {
      const style = doc.createElement("style");
      style.id = "__print_style";
      if (isTech) {
        style.textContent = `@page { size: 169mm auto; margin: 0; } @media print { html,body { width:169mm; background:#020203!important; -webkit-print-color-adjust:exact; print-color-adjust:exact; } }`;
      } else {
        style.textContent = `@page { size: A4; margin: 0; } @media print { html,body { width:210mm; height:297mm; overflow:hidden; } .page { padding:14mm 12mm 10mm 12mm; width:210mm; min-height:297mm; box-sizing:border-box; } }`;
      }
      doc.head.appendChild(style);
    }
    // Set document title for the suggested PDF filename
    if (doc && opts) {
      const docType = opts.mode === "pricelist" ? "PriceList" : "Quotation";
      const parts = [docType];
      if (opts.quotationCode) parts[0] = opts.quotationCode;
      if (opts.customerName && opts.customerName !== "—") parts.push(opts.customerName);
      if (opts.lang) parts.push(opts.lang.toUpperCase());
      if (opts.isDraft) parts.push("DRAFT");
      doc.title = parts.join(" - ");
    }
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } catch (err: any) {
    toast.error("Failed to open print dialog");
  }
}

export const QuotationDocument = forwardRef<HTMLDivElement, QuotationDocumentProps>(
  function QuotationDocument(
    {
      items,
      deliveryDate,
      deliveryLocation,
      customerName = "—",
      customerNameAr,
      projectName = "—",
      projectNameAr,
      contactName,
      contactNameAr,
      contactPhone,
      quoteDate = new Date(),
      version = 1,
      readOnly = true,
      onEdit,
      mode = "quotation",
      forPdfExport = false,
      quotationCode,
      lang: initialLang = "en",
      isDraft = true,
      deliveryLines,
      deliveryTotal,
      theme: initialTheme = "classic",
      deliveryMode = "embedded",
      globalMargin = 0,
    },
    ref
  ) {
    const [settings, setSettings] = useState<TemplateSettings>(DEFAULT_SETTINGS);
    const [lang, setLang] = useState<"en" | "ar">(initialLang);
    const [theme, setTheme] = useState<QuoteTheme>(initialTheme);
    const [isDownloading, setIsDownloading] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [techHeight, setTechHeight] = useState<number>(600);

    // Auto-resize iframe for tech theme
    useEffect(() => {
      if (theme !== "tech") return;
      const handler = (e: MessageEvent) => {
        if (e.data?.type === "tech-resize" && typeof e.data.height === "number") {
          setTechHeight(e.data.height);
        }
      };
      window.addEventListener("message", handler);
      return () => window.removeEventListener("message", handler);
    }, [theme]);

    // Fetch template settings
    useEffect(() => {
      supabase
        .from("pdf_templates")
        .select("settings")
        .eq("template_key", mode)
        .single()
        .then(({ data }) => {
          if (data?.settings) {
            const db = data.settings as unknown as Partial<TemplateSettings>;
            setSettings({
              ...DEFAULT_SETTINGS,
              ...db,
              labels: {
                en: { ...DEFAULT_SETTINGS.labels.en, ...(db.labels?.en || {}) },
                ar: { ...DEFAULT_SETTINGS.labels.ar, ...(db.labels?.ar || {}) },
              },
              columns: {
                en: { ...DEFAULT_SETTINGS.columns.en, ...(db.columns?.en || {}) },
                ar: { ...DEFAULT_SETTINGS.columns.ar, ...(db.columns?.ar || {}) },
              },
            });
          }
        });
    }, [mode]);

    // Map items to QuoteItem format
    const quoteItems: QuoteItem[] = useMemo(
      () =>
        items.map((item) => ({
          line_id: item.line_id,
          material_id: item.material_id,
          name: (item.is_custom_item || item.item_kind === "addon")
            ? (item.custom_name || item.name || (item.item_kind === "addon" ? "Add-on" : "Custom Item"))
            : item.name,
          name_ar: item.name_ar,
          quantity: item.quantity,
          uom: item.uom,
          uom_ar: item.uom_ar,
          unit_price: item.unit_price,
          delivery_price: item.delivery_price,
          supplier_name: item.supplier_name,
          supplier_name_ar: item.supplier_name_ar,
          margin_pct: item.margin_pct,
          effective_margin_pct: item.effective_margin_pct,
          is_custom_item: item.is_custom_item,
          item_kind: item.item_kind,
          parent_line_id: item.parent_line_id,
        })),
      [items]
    );

    // Map delivery lines for HTML builder
    const htmlDeliveryLines: DeliveryLineForHtml[] | undefined = useMemo(() => {
      if (!deliveryLines || deliveryLines.length === 0) return undefined;
      return deliveryLines.map((l) => ({
        supplier_name: l.supplier_name,
        material_names: l.material_names,
        material_names_ar: l.material_names_ar,
        total_quantity: l.total_quantity,
        trips: l.trips,
        price_per_trip: l.price_per_trip,
        total_cost: l.total_cost,
      }));
    }, [deliveryLines]);

    // Build HTML using the shared builder
    const html = useMemo(
      () =>
        buildQuoteHtml({
          mode,
          lang,
          items: quoteItems,
          customer: { name: customerName, name_ar: customerNameAr, contact: contactName, contact_ar: contactNameAr, phone: contactPhone },
          project: { name: projectName, name_ar: projectNameAr, location: deliveryLocation || undefined },
          deliveryDate: deliveryDate ? deliveryDate.toISOString() : undefined,
          version,
          quotationCode: quotationCode || undefined,
          currency: "SAR",
          settings,
          isDraft,
          deliveryLines: htmlDeliveryLines,
          deliveryTotal,
          theme,
          deliveryMode,
          globalMargin,
        }),
      [mode, lang, quoteItems, customerName, customerNameAr, contactName, contactNameAr, contactPhone, projectName, projectNameAr, deliveryLocation, deliveryDate, version, quotationCode, settings, isDraft, htmlDeliveryLines, deliveryTotal, theme, deliveryMode, globalMargin]
    );

    const handleDownloadPdf = useCallback(async () => {
      if (theme === "tech") {
        setIsDownloading(true);
        try {
          const iframe = iframeRef.current;
          if (!iframe?.contentDocument?.body) { toast.error("Preview not ready"); return; }
          const iframeDoc = iframe.contentDocument;
          const iframeBody = iframeDoc.body;

          // Use foreignObjectRendering: true so the BROWSER's native text
          // renderer handles Arabic shaping — html2canvas's own text parser
          // breaks Arabic ligatures and encoding. Since the iframe is same-origin
          // (srcDoc), there are no CORS restrictions on foreignObject.
          const canvas = await html2canvas(iframeBody, {
            scale: 2,
            width: 480,
            height: iframeBody.scrollHeight,
            windowWidth: 480,
            windowHeight: iframeBody.scrollHeight,
            backgroundColor: "#020203",
            useCORS: true,
            logging: false,
            foreignObjectRendering: true,
          });

          // Convert canvas to PNG and download
          const dataUrl = canvas.toDataURL("image/png");
          const code = quotationCode || (mode === "quotation" ? "Quotation" : "PriceList");
          const draftSuffix = isDraft ? "-DRAFT" : "";
          const filename = `${code}-${lang.toUpperCase()}${draftSuffix}.png`;
          const link = document.createElement("a");
          link.download = filename;
          link.href = dataUrl;
          link.click();
        } catch (err) {
          console.error("PNG export error:", err);
          toast.error("Failed to generate image");
        } finally {
          setIsDownloading(false);
        }
      } else {
        // Classic / Print theme → html2canvas + jsPDF for pixel-perfect A4 with controlled filename
        setIsDownloading(true);
        try {
          const iframe = iframeRef.current;
          if (!iframe?.contentDocument?.body) { toast.error("Preview not ready"); return; }
          const iframeBody = iframe.contentDocument.body;

          // A4 dimensions: 210mm × 297mm
          const a4WidthPx = 794; // 210mm at 96dpi
          const canvas = await html2canvas(iframeBody, {
            scale: 2,
            width: a4WidthPx,
            windowWidth: a4WidthPx,
            backgroundColor: "#ffffff",
            useCORS: true,
            logging: false,
            foreignObjectRendering: true,
          });

          const imgData = canvas.toDataURL("image/png");
          const pdfWidthMm = 210;
          const pdfHeightMm = (canvas.height * pdfWidthMm) / canvas.width;

          const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: [pdfWidthMm, Math.max(pdfHeightMm, 297)],
          });
          pdf.addImage(imgData, "PNG", 0, 0, pdfWidthMm, pdfHeightMm);

          const code = quotationCode || (mode === "quotation" ? "Quotation" : "PriceList");
          const draftSuffix = isDraft ? "-DRAFT" : "";
          const filename = `${code}-${lang.toUpperCase()}${draftSuffix}.pdf`;
          pdf.save(filename);
        } catch (err) {
          console.error("PDF export error:", err);
          toast.error("Failed to generate PDF");
        } finally {
          setIsDownloading(false);
        }
      }
    }, [theme, mode, lang, quotationCode, isDraft, customerName]);

    return (
      <div className="relative" ref={ref}>
        {/* Controls bar */}
        {!forPdfExport && (
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <Button
                variant={lang === "en" ? "default" : "outline"}
                size="sm"
                onClick={() => setLang("en")}
                className="text-xs h-7 px-2"
              >
                EN
              </Button>
              <Button
                variant={lang === "ar" ? "default" : "outline"}
                size="sm"
                onClick={() => setLang("ar")}
                className="text-xs h-7 px-2"
              >
                AR
              </Button>
              <div className="w-px h-5 bg-border mx-1" />
              <Button
                variant={theme === "classic" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("classic")}
                className="text-xs h-7 px-2"
              >
                <FileText className="h-3 w-3 mr-1" />
                Print
              </Button>
              <Button
                variant={theme === "tech" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("tech")}
                className="text-xs h-7 px-2"
              >
                <Monitor className="h-3 w-3 mr-1" />
                Digital
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isDownloading} className="text-xs h-7">
                {isDownloading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                {theme === "tech" ? "PNG" : "PDF"}
              </Button>
              {readOnly && onEdit && (
                <Button variant="secondary" size="sm" onClick={onEdit} className="text-xs h-7">
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        )}

        <div
          className={cn(
            "rounded-lg overflow-hidden",
            theme === "tech" ? "bg-[#020203]" : "bg-white",
            !forPdfExport && "border shadow-sm",
            !forPdfExport && theme !== "tech" && "dark:bg-zinc-950"
          )}
          style={
            forPdfExport
              ? { width: theme === "tech" ? "480px" : "210mm", minHeight: theme === "tech" ? "auto" : "297mm" }
              : { width: theme === "tech" ? "480px" : "100%", maxWidth: "100%", margin: theme === "tech" ? "0 auto" : undefined, ...(theme !== "tech" ? { aspectRatio: "210 / 297" } : {}) }
          }
        >
          <iframe
            ref={iframeRef}
            srcDoc={html}
            title={mode === "quotation" ? "Quotation Preview" : "Price List Preview"}
            className="w-full border-0"
            style={{
              height: theme === "tech" ? `${techHeight}px` : "100%",
              minHeight: forPdfExport && theme !== "tech" ? "297mm" : undefined,
            }}
            sandbox="allow-same-origin allow-modals allow-scripts"
          />
        </div>
      </div>
    );
  }
);

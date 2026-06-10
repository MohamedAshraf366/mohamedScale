/**
 * Unified HTML builder for quotation & price list documents.
 * Returns a complete, self-contained HTML string (inline CSS, no external deps).
 * Used by both the in-app preview (iframe srcDoc) and PDF generation.
 * Supports "classic" (white/print) and "tech" (dark/digital) themes.
 *
 * Pricing is routed through src/lib/quotation-commercial.ts so the sent PDF
 * uses the SAME selling-price/total formula as the builder and order conversion.
 */

import { getSellingPrice as commercialSellingPrice, DEFAULT_DELIVERY_MODE, VAT_RATE } from "./quotation-commercial";


export interface QuoteItem {
  /** Stable line identity — used to match add-on children to their parent line. */
  line_id?: string;
  material_id?: string;
  name: string;
  name_ar?: string;
  quantity?: number;
  uom?: string;
  uom_ar?: string;
  unit_price?: number;
  delivery_price?: number;
  supplier_name?: string;
  supplier_name_ar?: string;
  /** Per-line margin override (percent). Used if effective_margin_pct is null. */
  margin_pct?: number;
  /** Frozen snapshot of resolved margin (percent) — wins over margin_pct/global. */
  effective_margin_pct?: number | null;
  /** True for free-text custom items — name comes from custom_name, not registry. */
  is_custom_item?: boolean;
  /** 'material' (default) or 'addon'. Add-ons render indented or in their own block. */
  item_kind?: "material" | "addon";
  /** When set, this row is an item-level add-on attached to the parent line_id. */
  parent_line_id?: string | null;
}

export interface DeliveryLineForHtml {
  supplier_name: string;
  material_names: string[];
  material_names_ar?: string[];
  total_quantity: number;
  trips: number;
  price_per_trip: number;
  total_cost: number;
}

export type QuoteTheme = "classic" | "tech";

export interface TemplateSettings {
  company_name: string;
  tagline: string;
  tagline_ar: string;
  primary_color: string;
  footer_left: string;
  footer_left_ar?: string;
  footer_right: string;
  footer_right_ar?: string;
  pricelist_note: string;
  terms_text: string;
  show_supplier_name: boolean;
  show_delivery_column: boolean;
  show_contact_phone: boolean;
  show_delivery_section: boolean;
  labels: {
    en: Record<string, string>;
    ar: Record<string, string>;
  };
  columns: {
    en: Record<string, string>;
    ar: Record<string, string>;
  };
}

export interface QuoteHtmlOptions {
  mode: "quotation" | "pricelist";
  lang: "en" | "ar";
  items: QuoteItem[];
  customer: { name: string; name_ar?: string; contact?: string; contact_ar?: string; phone?: string };
  project: { name: string; name_ar?: string; location?: string };
  deliveryDate?: string;
  version: number;
  quotationCode?: string;
  currency?: string;
  settings: TemplateSettings;
  isDraft?: boolean;
  deliveryLines?: DeliveryLineForHtml[];
  deliveryTotal?: number;
  theme?: QuoteTheme;
  deliveryMode?: "embedded" | "separate";
  /** Global default margin (percent). Used only when item has no effective_margin_pct/margin_pct. */
  globalMargin?: number;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: TemplateSettings = {
  company_name: "SCALE",
  tagline: "Your Construction Procurement Partner",
  tagline_ar: "شريكك في توريد مواد البناء",
  primary_color: "#f15625",
  footer_left: "Generated {{date}}",
  footer_left_ar: "تاريخ الإنشاء {{date}}",
  footer_right: "Prices valid for 7 days from issue date",
  footer_right_ar: "الأسعار صالحة لمدة 7 أيام من تاريخ الإصدار",
  pricelist_note: "* Prices are per unit. Final total depends on confirmed quantities.",
  terms_text: "",
  show_supplier_name: true,
  show_delivery_column: true,
  show_contact_phone: true,
  show_delivery_section: true,
  labels: {
    en: {
      document_title: "QUOTATION",
      customer: "Customer",
      contact: "Contact",
      date: "Date",
      project: "Project",
      delivery_location: "Delivery Location",
      delivery_details: "DELIVERY DETAILS",
      est_delivery: "Est. Delivery",
      subtotal: "Subtotal",
      delivery: "Delivery",
      total: "Total (pre-tax)",
      vat: "VAT (15%)",
      total_with_vat: "Total (incl. VAT)",
    },
    ar: {
      document_title: "\u0639\u0631\u0636 \u0633\u0639\u0631",
      customer: "\u0627\u0644\u0639\u0645\u064a\u0644",
      contact: "\u062c\u0647\u0629 \u0627\u0644\u0627\u062a\u0635\u0627\u0644",
      date: "\u0627\u0644\u062a\u0627\u0631\u064a\u062e",
      project: "\u0627\u0644\u0645\u0634\u0631\u0648\u0639",
      delivery_location: "\u0645\u0648\u0642\u0639 \u0627\u0644\u062a\u0633\u0644\u064a\u0645",
      delivery_details: "\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u062a\u0633\u0644\u064a\u0645",
      est_delivery: "\u0627\u0644\u062a\u0633\u0644\u064a\u0645 \u0627\u0644\u0645\u062a\u0648\u0642\u0639",
      subtotal: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a",
      delivery: "\u0627\u0644\u062a\u0648\u0635\u064a\u0644",
      total: "\u0627\u0644\u0645\u062c\u0645\u0648\u0639 \u0642\u0628\u0644 \u0627\u0644\u0636\u0631\u064a\u0628\u0629",
      vat: "\u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629 (%15)",
      total_with_vat: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a \u0634\u0627\u0645\u0644 \u0627\u0644\u0636\u0631\u064a\u0628\u0629",
    },
  },
  columns: {
    en: { num: "#", item: "Item Description", uom: "UOM", qty: "QTY", unit_price: "Unit Price", total: "Total", delivery: "Delivery", supplier: "Supplier" },
    ar: {
      num: "#",
      item: "\u0648\u0635\u0641 \u0627\u0644\u0645\u0627\u062f\u0629",
      uom: "\u0627\u0644\u0648\u062d\u062f\u0629",
      qty: "\u0627\u0644\u0643\u0645\u064a\u0629",
      unit_price: "\u0633\u0639\u0631 \u0627\u0644\u0648\u062d\u062f\u0629",
      total: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a",
      delivery: "\u0627\u0644\u062a\u0648\u0635\u064a\u0644",
      supplier: "\u0627\u0644\u0645\u0648\u0631\u062f",
    },
  },
};

// ── Scale logos as inline SVG (EN + AR) ──────────────────────────────────────

const SCALE_LOGO_EN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 353.76 97.45" height="38">
  <g>
    <path fill="{{COLOR}}" d="M1.3,68.47l4.9-5.49c.24-.27.05-.71-.32-.71h-2.9c-1.65,0-2.98-1.33-2.98-2.98v-22.28c0-1.46.54-2.87,1.51-3.97L29.42,1.71c.97-1.09,2.36-1.71,3.82-1.71h41.26c1.65,0,2.98,1.33,2.98,2.98v22.49c0,1.24-.45,2.44-1.27,3.37l-4.94,5.63c-.24.28-.05.71.32.71h2.91c1.65,0,2.98,1.33,2.98,2.98v22.47c0,1.25-.46,2.46-1.29,3.4l-28,31.42c-1.13,1.27-2.75,2-4.45,2H2.98c-1.65,0-2.98-1.33-2.98-2.98v-22.6c0-1.26.46-2.47,1.3-3.4Z"/>
    <path fill="{{COLOR}}" d="M351.23,10.99c1.68,1.66,2.53,3.8,2.53,6.42s-.85,4.77-2.56,6.45c-1.71,1.69-3.89,2.53-6.55,2.53s-4.83-.83-6.52-2.49c-1.69-1.66-2.53-3.82-2.53-6.48s.84-4.75,2.53-6.42c1.68-1.66,3.86-2.49,6.52-2.49s4.9.83,6.58,2.49ZM349.97,22.63c1.33-1.31,1.99-3.05,1.99-5.22s-.66-3.91-1.99-5.22c-1.33-1.31-3.1-1.96-5.32-1.96s-3.92.66-5.25,1.99c-1.33,1.33-1.99,3.06-1.99,5.19s.66,3.91,1.99,5.22c1.33,1.31,3.08,1.96,5.25,1.96s3.99-.65,5.32-1.96ZM348.14,17.67c-.38.53-.88.91-1.5,1.13l2.13,3.19h-1.93l-1.93-2.93h-2.06v2.93h-1.53v-9.37h3.92c1.02,0,1.85.3,2.49.9.64.6.96,1.36.96,2.29,0,.71-.19,1.33-.57,1.86ZM346.65,14.58c-.35-.29-.84-.43-1.46-.43h-2.33v3.39h2.33c.62,0,1.11-.15,1.46-.47.35-.31.53-.73.53-1.26s-.18-.94-.53-1.23Z"/>
    <g>
      <path fill="{{COLOR}}" d="M126.31,56.18c-.81-5.57-3.83-7.54-10.67-7.54-5.68,0-8.93,1.39-8.93,4.75s3.13,4.75,9.28,6.49c6.49,1.85,12.64,3.13,17.04,4.87,6.03,2.44,9.39,6.38,9.39,13.8,0,11.83-8.7,18.9-24.93,18.9-17.51,0-27.25-8.23-27.48-19.83h15.54c0,5.33,4.52,8.46,11.83,8.46,5.33,0,10.09-1.62,10.09-5.91,0-4.06-4.29-5.33-9.16-6.49-9.62-2.32-14.96-3.94-19.02-6.49-5.33-3.36-7.19-7.77-7.19-12.87,0-9.62,6.61-16.93,24-16.93,16.46,0,23.89,6.49,24.7,18.78h-14.49Z"/>
      <path fill="{{COLOR}}" d="M198.09,75.31c-1.62,13.22-12.41,22.15-26.21,22.15-15.54,0-26.21-10.32-26.21-30.73s10.67-29.34,26.67-29.34c14.84,0,24.93,8.46,25.86,21.92h-15.19c-.81-5.91-5.1-9.39-10.78-9.39-6.38,0-11.6,4.06-11.6,16.47s5.22,18.44,11.13,18.44,10.55-3.36,11.13-9.51h15.19Z"/>
      <path fill="{{COLOR}}" d="M238.21,95.95c-.46-1.39-.81-3.36-.93-5.1-3.59,3.94-9.62,6.61-17.28,6.61-12.99,0-19.02-6.38-19.02-15.65,0-16.46,11.02-18.32,26.21-20.41,7.54-1.04,9.62-2.55,9.62-6.49,0-3.71-3.71-5.91-9.62-5.91-6.84,0-9.62,3.36-10.32,8.46h-14.03c.23-11.83,6.73-20.06,25.05-20.06s24.35,8.12,24.35,22.5v36.06h-14.03ZM237.16,68c-1.51,1.51-4.17,2.32-9.74,3.36-8.58,1.62-11.36,4.06-11.36,8.93,0,4.29,2.55,6.38,7.31,6.38,7.77,0,13.57-5.68,13.68-12.41l.12-6.26Z"/>
      <path fill="{{COLOR}}" d="M258.85,95.95V18.03h15.07v77.92h-15.07Z"/>
      <path fill="{{COLOR}}" d="M294.1,71.36c.46,8.58,5.33,14.15,12.75,14.15,4.87,0,9.16-2.44,10.2-6.38h15.54c-3.48,11.71-12.87,18.32-25.05,18.32-19.02,0-28.52-10.44-28.52-31.08,0-17.62,10.09-28.99,27.6-28.99s26.78,11.36,26.78,33.97h-39.31ZM317.87,61.86c-.23-8.46-5.8-12.52-11.71-12.52s-11.02,4.64-11.6,12.52h23.31Z"/>
    </g>
  </g>
</svg>`;

const SCALE_LOGO_AR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330.6 116.89" height="42">
  <g>
    <path fill="{{COLOR}}" d="M1.3,68.47l4.9-5.49c.24-.27.05-.71-.32-.71h-2.9c-1.65,0-2.98-1.33-2.98-2.98v-22.28c0-1.46.54-2.87,1.51-3.97L29.42,1.71c.97-1.09,2.36-1.71,3.82-1.71h41.26c1.65,0,2.98,1.33,2.98,2.98v22.49c0,1.24-.45,2.44-1.27,3.37l-4.94,5.63c-.24.28-.05.71.32.71h2.91c1.65,0,2.98,1.33,2.98,2.98v22.47c0,1.25-.46,2.46-1.29,3.4l-28,31.42c-1.13,1.27-2.75,2-4.45,2H2.98c-1.65,0-2.98-1.33-2.98-2.98v-22.6c0-1.26.46-2.47,1.3-3.4Z"/>
    <path fill="{{COLOR}}" d="M328.07,24.89c1.68,1.66,2.53,3.8,2.53,6.42s-.85,4.77-2.56,6.45c-1.71,1.69-3.89,2.53-6.55,2.53s-4.83-.83-6.52-2.49c-1.69-1.66-2.53-3.82-2.53-6.48s.84-4.75,2.53-6.42c1.68-1.66,3.86-2.49,6.52-2.49s4.9.83,6.58,2.49ZM326.81,36.52c1.33-1.31,1.99-3.05,1.99-5.22s-.66-3.91-1.99-5.22c-1.33-1.31-3.1-1.96-5.32-1.96s-3.92.66-5.25,1.99c-1.33,1.33-1.99,3.06-1.99,5.19s.66,3.91,1.99,5.22c1.33,1.31,3.08,1.96,5.25,1.96s3.99-.65,5.32-1.96ZM324.98,31.57c-.38.53-.88.91-1.5,1.13l2.13,3.19h-1.93l-1.93-2.93h-2.06v2.93h-1.53v-9.37h3.92c1.02,0,1.85.3,2.49.9.64.6.96,1.36.96,2.29,0,.71-.19,1.33-.57,1.86ZM323.49,28.48c-.35-.29-.84-.43-1.46-.43h-2.33v3.39h2.33c.62,0,1.11-.15,1.46-.47.35-.31.53-.73.53-1.26s-.18-.94-.53-1.23Z"/>
    <g>
      <path fill="{{COLOR}}" d="M176.5,107.75c0,1.83-.61,3.36-1.83,4.62-1.22,1.26-2.67,1.87-4.38,1.87s-3.26-.61-4.52-1.87c-.59-.6-1.04-1.26-1.36-1.97-.01-.04-.01-.09-.04-.11-.03-.09-.06-.16-.07-.23-.24-.5-.76-.86-1.36-.86-.56,0-1.06.31-1.3.79-.07.13-.13.27-.16.41h0c-.3.73-.74,1.39-1.32,1.97-1.22,1.26-2.7,1.87-4.46,1.87s-3.17-.61-4.42-1.87c-1.26-1.26-1.89-2.79-1.89-4.62s.63-3.26,1.89-4.52c1.24-1.24,2.72-1.87,4.42-1.87s3.25.63,4.46,1.87c.57.59,1.02,1.24,1.32,1.94.03.17.09.34.19.49.24.44.73.74,1.27.74.57,0,1.07-.33,1.33-.8.06-.11.11-.24.14-.39h0c.31-.73.76-1.39,1.36-1.99,1.26-1.24,2.76-1.87,4.52-1.87s3.16.63,4.38,1.87c1.22,1.26,1.83,2.76,1.83,4.52Z"/>
      <path fill="{{COLOR}}" d="M311.22,56.79v19.49c0,5.96-1.59,10.77-4.78,14.41-3.17,3.66-7.92,5.49-14.21,5.49-5.15,0-9.34-1.26-12.58-3.76-3.12,2.5-7.21,3.76-12.28,3.76-5.62,0-10.02-1.46-13.2-4.38-3.05,2.25-7.05,3.36-11.98,3.36h-5.74c-2.52,0-4.68-.41-6.51-1.23-1.83-.8-3.32-1.79-4.46-2.93-3.52,2.77-7.68,4.16-12.5,4.16h-33.97c-2.5,0-4.65-.4-6.45-1.17-1.79-.77-3.26-1.72-4.42-2.79-1.62,1.29-3.5,2.26-5.63,2.95-2.13.67-4.55,1.02-7.25,1.02h-5.64c-.89,0-1.74-.07-2.6-.21-.84-.13-1.63-.3-2.37-.5-1.43,6.91-4.5,12.37-9.24,16.4-3.66,3.1-8.05,5-13.2,5.72-1.52.21-3.12.31-4.78.31-1.76,0-3.45-.13-5.06-.39-11.81-2.3-20.96-12.5-22.21-25.14h0c-.1-.97-.14-1.94-.14-2.93,0-9.42,6.01-20.65,10.72-23.6l7.04,7.28c-.13.2-.3.47-.5.82-.89,1.42-1.82,3.36-2.79,5.83-.99,2.47-1.47,5.29-1.47,8.48,0,5.21,1.26,9.32,3.8,12.34,2.53,3,6.08,4.5,10.61,4.5s8.15-1.5,10.65-4.5c2.5-3.02,3.76-7.14,3.76-12.34v-50.03h13.5v38.05c0,1.83.33,3.2.97,4.12.64.92,1.4,1.52,2.29,1.82.87.31,1.64.46,2.33.46h4.62c1.89,0,3.3-.59,4.22-1.77.92-1.19,1.37-2.79,1.37-4.82v-19.78h13.6v19.98c0,1.83.31,3.2.96,4.12.64.92,1.42,1.52,2.29,1.82.89.31,1.66.46,2.33.46h32.46c2.1,0,3.55-.64,4.32-1.93.77-1.27,1.17-2.66,1.17-4.16,0-1.96-.54-3.45-1.63-4.46-1.09-1.02-2.4-1.53-3.96-1.53h-18.58c-2.5,0-4.46-.51-5.89-1.57-1.42-1.04-2.13-2.72-2.13-5.02v-2.75c0-1.34.17-2.6.5-3.75.34-1.16,1.16-2.1,2.45-2.85l26.25-15.57c.27-.13.5-.24.71-.34l4.48,7.06,1.3,2.06-4.62,2.73-.46.27-11.63,6.94h7.91c3.39,0,6.51.71,9.35,2.13,2.83,1.42,5.16,3.5,6.95,6.25,1.79,2.73,2.76,6.11,2.89,10.1v.51c.27,2.63,1,4.28,2.19,4.92,1.19.64,2.32.96,3.4.96h4.72c1.9,0,3.3-.59,4.22-1.77.92-1.19,1.37-2.79,1.37-4.82v-10.93h13.6v11.95c0,4.66,1.86,7.01,5.59,7.01s5.68-2.35,5.68-7.01v-15.6h13.51v15.6c0,4.66,1.86,7.01,5.58,7.01s5.69-2.35,5.69-7.01v-19.29h13.5Z"/>
    </g>
  </g>
</svg>`;

function getLogoSvg(lang: "en" | "ar", color: string): string {
  const template = lang === "ar" ? SCALE_LOGO_AR : SCALE_LOGO_EN;
  return template.replace(/\{\{COLOR\}\}/g, color);
}

// ── Theme colors ─────────────────────────────────────────────────────────────

interface ThemeColors {
  bg: string;
  text: string;
  muted: string;
  border: string;
  altRow: string;
  sectionBg: string;
  terms: string;
  empty: string;
  draftColor: string;
  totalsBg: string;
}

const CLASSIC_COLORS: ThemeColors = {
  bg: "#fff",
  text: "#1a1a1a",
  muted: "#888",
  border: "#eee",
  altRow: "rgba(0,0,0,0.02)",
  sectionBg: "rgba(0,0,0,0.03)",
  terms: "#555",
  empty: "#ccc",
  draftColor: "rgba(0,0,0,0.06)",
  totalsBg: "transparent",
};

const TECH_COLORS: ThemeColors = {
  bg: "#020203",
  text: "#f0f0f0",
  muted: "#9ca3af",
  border: "rgba(255,255,255,0.08)",
  altRow: "rgba(26,61,56,0.15)",
  sectionBg: "rgba(26,61,56,0.2)",
  terms: "#9ca3af",
  empty: "#6b7280",
  draftColor: "rgba(255,255,255,0.04)",
  totalsBg: "rgba(26,61,56,0.25)",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toFixed(2);
}

function fmtDate(dateStr?: string): string {
  if (!dateStr) return "\u2014";
  try {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

function fmtDateLong(dateStr?: string): string {
  if (!dateStr) return "\u2014";
  try {
    const d = new Date(dateStr);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

function escHtml(s: string | undefined | null): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// UOM English → Arabic translation map
const UOM_AR_MAP: Record<string, string> = {
  unit: "حبة",
  piece: "حبة",
  ton: "طن",
  kg: "كجم",
  m: "متر",
  m2: "متر²",
  m3: "متر³",
  liter: "لتر",
  roll: "رول",
  sheet: "لوح",
  pallet: "طبلية",
  box: "صندوق",
  sqm: "متر²",
  cum: "متر³",
};

/** English UOM display map — normalise DB values to user-friendly labels */
const UOM_EN_MAP: Record<string, string> = {
  unit: "piece",
  piece: "piece",
  ton: "ton",
  kg: "kg",
  m: "m",
  m2: "m²",
  m3: "m³",
  liter: "liter",
  roll: "roll",
  sheet: "sheet",
  pallet: "pallet",
  box: "box",
  sqm: "m²",
  cum: "m³",
};

function uomEn(uom?: string): string {
  if (!uom) return "piece";
  return UOM_EN_MAP[uom.toLowerCase()] || uom;
}

function uomAr(uom?: string): string {
  if (!uom) return "حبة";
  return UOM_AR_MAP[uom.toLowerCase()] || uom;
}

/** Wrap known-LTR content (phone numbers, codes) to prevent RTL reordering */
function ltrSpan(text: string): string {
  return `<span dir="ltr" style="unicode-bidi:embed;direction:ltr;">${escHtml(text)}</span>`;
}

// ── Builder ──────────────────────────────────────────────────────────────────

export function buildQuoteHtml(options: QuoteHtmlOptions): string {
  const {
    mode,
    lang,
    items,
    customer,
    project,
    deliveryDate,
    version,
    quotationCode,
    currency = "SAR",
    settings: s,
    isDraft = false,
    deliveryLines,
    deliveryTotal: passedDeliveryTotal,
    theme = "classic",
    deliveryMode = DEFAULT_DELIVERY_MODE,
    globalMargin = 0,
  } = options;

  /**
   * Selling price per unit — single source of truth.
   * In embedded mode: includes delivery_price.
   * In separate mode: excludes delivery_price (it enters via deliveryTotal).
   * Margin: effective_margin_pct → margin_pct → globalMargin (handled inside getSellingPrice).
   */
  const sellingPerUnit = (item: QuoteItem): number =>
    commercialSellingPrice(
      {
        unit_price: item.unit_price,
        delivery_price: item.delivery_price,
        margin_pct: item.margin_pct,
        effective_margin_pct: item.effective_margin_pct,
      },
      globalMargin,
      deliveryMode,
    );

  const isRtl = lang === "ar";
  const dir = isRtl ? "rtl" : "ltr";
  const textAlign = isRtl ? "right" : "left";
  const textAlignEnd = isRtl ? "left" : "right";
  const isQuotation = mode === "quotation";
  const labels = s.labels[lang] || s.labels.en;
  const cols = s.columns[lang] || s.columns.en;
  const docTitle = isQuotation
    ? (labels.document_title || "QUOTATION")
    : (mode === "pricelist" && lang === "ar" ? (s.labels.ar?.document_title || "\u0642\u0627\u0626\u0645\u0629 \u0623\u0633\u0639\u0627\u0631") : (labels.document_title || "PRICE LIST"));
  const pc = s.primary_color || "#f15625";

  // Theme colors
  const c = theme === "tech" ? TECH_COLORS : CLASSIC_COLORS;
  // Tech theme uses Scale orange on dark — high contrast and on-brand
  const accent = pc;

  // Pick the right display values based on lang
  const customerDisplay = isRtl ? (customer.name_ar || customer.name) : customer.name;
  const contactDisplay = isRtl ? (customer.contact_ar || customer.contact) : customer.contact;
  const projectDisplay = isRtl ? (project.name_ar || project.name) : project.name;
  const taglineDisplay = isRtl ? (s.tagline_ar || s.tagline) : s.tagline;

  // Calculate totals — delivery-mode-aware AND margin-aware (single commercial gate)
  // In embedded mode: delivery_price is baked into selling price, deliveryTotal NOT added
  // In separate mode: delivery_price excluded from selling price, deliveryTotal added once
  let subtotal = 0;
  for (const item of items) {
    const qty = item.quantity || 0;
    subtotal += qty * sellingPerUnit(item);
  }
  const deliveryTotal = deliveryMode === "separate" ? (passedDeliveryTotal ?? 0) : 0;
  const preTaxTotal = subtotal + deliveryTotal;
  const vatAmount = preTaxTotal * VAT_RATE;
  const totalWithVat = preTaxTotal + vatAmount;

  // Currency display — inline SVG Riyal symbol sized to match text
  const riyalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1124.14 1256.39" style="height:0.85em;width:0.76em;vertical-align:-0.1em;display:inline-block;fill:currentColor;"><path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"/><path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"/></svg>`;
  const curDisplay = riyalSvg;

  // Footer text with placeholders
  const today = fmtDate(new Date().toISOString());
  const footerLeftTemplate = isRtl ? (s.footer_left_ar || s.footer_left || "") : (s.footer_left || "");
  const footerLeft = footerLeftTemplate
    .replace("{{version}}", String(version))
    .replace("{{date}}", today);
  const footerRight = isRtl ? (s.footer_right_ar || s.footer_right || "") : (s.footer_right || "");

  // Font family
  const fontFamily = isRtl
    ? "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif"
    : "'Inter', 'Segoe UI', Helvetica, Arial, sans-serif";

  // Build table headers & rows based on mode
  let theadHtml = "";
  let tbodyHtml = "";

  const thStyle = (align: string, width?: string) =>
    `text-align:${align};${width ? `width:${width};` : ""}padding:6px 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;color:${accent};`;

  const tdStyle = (align: string, extra = "") =>
    `padding:6px 4px;vertical-align:middle;text-align:${align};${extra}`;

  // Build a display order: each main row followed immediately by its add-on children.
  // Quotation-level add-ons (parent_line_id == null && item_kind === 'addon') are rendered
  // separately in an "Additional Services" block below the items table.
  const isAddon = (it: QuoteItem) => it.item_kind === "addon";
  const itemAddons = items.filter((i) => isAddon(i) && i.parent_line_id != null);
  const quotationAddons = items.filter((i) => isAddon(i) && i.parent_line_id == null);
  const mainItems = items.filter((i) => !isAddon(i));

  type OrderedRow = { item: QuoteItem; isAddonRow: boolean; mainNumber?: number };
  const orderedRows: OrderedRow[] = [];
  let mainCounter = 0;
  for (const main of mainItems) {
    mainCounter++;
    orderedRows.push({ item: main, isAddonRow: false, mainNumber: mainCounter });
    if (main.line_id) {
      for (const addon of itemAddons.filter((a) => a.parent_line_id === main.line_id)) {
        orderedRows.push({ item: addon, isAddonRow: true });
      }
    }
  }

  if (isQuotation) {
    theadHtml = `
      <tr style="border-bottom:2px solid ${accent};">
        <th style="${thStyle(textAlign, "30px")}">${escHtml(cols.num || "#")}</th>
        <th style="${thStyle(textAlign)}">${escHtml(cols.item)}</th>
        <th style="${thStyle("center", "50px")}">${escHtml(cols.uom)}</th>
        <th style="${thStyle("center", "50px")}">${escHtml(cols.qty)}</th>
        <th style="${thStyle(textAlignEnd, "80px")}">${escHtml(cols.unit_price)}</th>
        <th style="${thStyle(textAlignEnd, "80px")}">${escHtml(cols.total)}</th>
      </tr>`;

    orderedRows.forEach(({ item, isAddonRow, mainNumber }, idx) => {
      const itemName = isRtl ? (item.name_ar || item.name) : item.name;
      const itemUom = isRtl ? (item.uom_ar || uomAr(item.uom)) : uomEn(item.uom);
      const displayUnitPrice = sellingPerUnit(item);
      const lineTotal = (item.quantity || 0) * displayUnitPrice;
      const bgColor = idx % 2 === 0 ? c.altRow : "transparent";
      const supplierDisplay = isRtl ? (item.supplier_name_ar || item.supplier_name) : item.supplier_name;
      const supplierLine = !isAddonRow && s.show_supplier_name && supplierDisplay
        ? `<br/><span style="font-size:11px;color:${c.muted};">${isRtl ? "\u0639\u0628\u0631" : "via"} ${escHtml(supplierDisplay)}</span>`
        : "";
      const indent = isAddonRow ? (isRtl ? "padding-right:18px;" : "padding-left:18px;") : "";
      const arrow = isAddonRow ? `<span style="color:${c.muted};margin-${isRtl ? "left" : "right"}:6px;">↳</span>` : "";
      const numCell = isAddonRow ? "" : String(mainNumber);
      tbodyHtml += `
        <tr style="border-bottom:1px solid ${c.border};background:${bgColor};">
          <td style="${tdStyle(textAlign, `color:${c.muted};`)}">${numCell}</td>
          <td style="${tdStyle(textAlign, `font-weight:${isAddonRow ? "400" : "500"};${indent}`)}">${arrow}${escHtml(itemName)}${supplierLine}</td>
          <td style="${tdStyle("center", `color:${c.muted};`)}">${escHtml(itemUom)}</td>
          <td style="${tdStyle("center", "font-weight:500;font-variant-numeric:tabular-nums;")}">${item.quantity ?? "\u2014"}</td>
          <td style="${tdStyle(textAlignEnd, "font-variant-numeric:tabular-nums;")}">${displayUnitPrice > 0 ? fmt(displayUnitPrice) : "\u2014"}</td>
          <td style="${tdStyle(textAlignEnd, "font-weight:500;font-variant-numeric:tabular-nums;")}">${lineTotal > 0 ? fmt(lineTotal) : "\u2014"}</td>
        </tr>`;
    });
  } else {
    // Price list: #, Item, UOM, Unit Price, [Delivery], [Supplier]
    let headerCells = `
      <th style="${thStyle(textAlign, "30px")}">${escHtml(cols.num || "#")}</th>
      <th style="${thStyle(textAlign)}">${escHtml(cols.item)}</th>
      <th style="${thStyle("center", "50px")}">${escHtml(cols.uom)}</th>
      <th style="${thStyle(textAlignEnd, "80px")}">${escHtml(cols.unit_price)}</th>`;
    if (s.show_delivery_column) {
      headerCells += `<th style="${thStyle(textAlignEnd, "80px")}">${escHtml(cols.delivery)}</th>`;
    }
    if (s.show_supplier_name) {
      headerCells += `<th style="${thStyle(textAlign, "140px")}">${escHtml(cols.supplier)}</th>`;
    }
    theadHtml = `<tr style="border-bottom:2px solid ${accent};">${headerCells}</tr>`;

    items.forEach((item, idx) => {
      const itemName = isRtl ? (item.name_ar || item.name) : item.name;
      const itemUom = isRtl ? (item.uom_ar || uomAr(item.uom)) : uomEn(item.uom);
      const bgColor = idx % 2 === 0 ? c.altRow : "transparent";
      let cells = `
        <td style="${tdStyle(textAlign, `color:${c.muted};`)}">${idx + 1}</td>
        <td style="${tdStyle(textAlign, "font-weight:500;")}">${escHtml(itemName)}</td>
        <td style="${tdStyle("center", `color:${c.muted};`)}">${escHtml(itemUom)}</td>
        <td style="${tdStyle(textAlignEnd, "font-variant-numeric:tabular-nums;")}">${item.unit_price ? fmt(item.unit_price) : "\u2014"}</td>`;
      if (s.show_delivery_column) {
        cells += `<td style="${tdStyle(textAlignEnd, "font-variant-numeric:tabular-nums;")}">${item.delivery_price ? fmt(item.delivery_price) : "\u2014"}</td>`;
      }
      if (s.show_supplier_name) {
        const supplierDisplay = isRtl ? (item.supplier_name_ar || item.supplier_name) : item.supplier_name;
        cells += `<td style="${tdStyle(textAlign, `color:${c.muted};`)}">${escHtml(supplierDisplay || "\u2014")}</td>`;
      }
      tbodyHtml += `<tr style="border-bottom:1px solid ${c.border};background:${bgColor};">${cells}</tr>`;
    });
  }

  // Empty state
  if (items.length === 0) {
    const colCount = isQuotation ? 6 : (3 + (s.show_delivery_column ? 1 : 0) + (s.show_supplier_name ? 1 : 0) + 1);
    tbodyHtml = `<tr><td colspan="${colCount}" style="padding:48px 0;text-align:center;color:${c.empty};font-size:14px;">${isRtl ? "\u0644\u0627 \u062a\u0648\u062c\u062f \u0639\u0646\u0627\u0635\u0631" : "No items"}</td></tr>`;
  }

  // "Additional Services" block (quotation-level add-ons) — quotation mode only.
  let additionalServicesHtml = "";
  if (isQuotation && quotationAddons.length > 0) {
    const asLabel = isRtl ? "خدمات إضافية" : "ADDITIONAL SERVICES";
    let asRows = "";
    quotationAddons.forEach((item, idx) => {
      const itemName = isRtl ? (item.name_ar || item.name) : item.name;
      const itemUom = isRtl ? (item.uom_ar || uomAr(item.uom)) : uomEn(item.uom);
      const displayUnitPrice = sellingPerUnit(item);
      const lineTotal = (item.quantity || 0) * displayUnitPrice;
      const bg = idx % 2 === 0 ? c.altRow : "transparent";
      asRows += `<tr style="border-bottom:1px solid ${c.border};background:${bg};">
        <td style="${tdStyle(textAlign, "font-weight:500;")}">${escHtml(itemName)}</td>
        <td style="${tdStyle("center", `color:${c.muted};`)}">${escHtml(itemUom)}</td>
        <td style="${tdStyle("center", "font-weight:500;font-variant-numeric:tabular-nums;")}">${item.quantity ?? "\u2014"}</td>
        <td style="${tdStyle(textAlignEnd, "font-variant-numeric:tabular-nums;")}">${displayUnitPrice > 0 ? fmt(displayUnitPrice) : "\u2014"}</td>
        <td style="${tdStyle(textAlignEnd, "font-weight:500;font-variant-numeric:tabular-nums;")}">${lineTotal > 0 ? fmt(lineTotal) : "\u2014"}</td>
      </tr>`;
    });
    additionalServicesHtml = `
    <div style="margin-bottom:16px;">
      <p style="font-size:10px;text-transform:uppercase;color:${accent};letter-spacing:0.05em;margin:0 0 6px 0;font-weight:600;">${escHtml(asLabel)}</p>
      <table>
        <thead>
          <tr style="border-bottom:2px solid ${accent};">
            <th style="${thStyle(textAlign)}">${escHtml(cols.item)}</th>
            <th style="${thStyle("center", "50px")}">${escHtml(cols.uom)}</th>
            <th style="${thStyle("center", "50px")}">${escHtml(cols.qty)}</th>
            <th style="${thStyle(textAlignEnd, "80px")}">${escHtml(cols.unit_price)}</th>
            <th style="${thStyle(textAlignEnd, "80px")}">${escHtml(cols.total)}</th>
          </tr>
        </thead>
        <tbody>${asRows}</tbody>
      </table>
    </div>`;
  }

  // Delivery breakdown section
  let deliveryBreakdownHtml = "";
  if (deliveryMode === "separate" && deliveryLines && deliveryLines.length > 0) {
    const dlLabel = isRtl ? "تفاصيل التوصيل" : "DELIVERY BREAKDOWN";
    const dlSupplier = isRtl ? "المورد" : "Supplier";
    const dlMaterials = isRtl ? "المواد" : "Materials";
    const dlQty = isRtl ? "الكمية" : "Qty";
    const dlTrips = isRtl ? "الرحلات" : "Trips";
    const dlRate = isRtl ? "السعر/رحلة" : "Rate/Trip";
    const dlRateMoq = isRtl ? "السعر/حمولة" : "Rate/MOQ";
    const dlCost = isRtl ? "التكلفة" : "Cost";

    // Summarize material_names by subcategory prefix (before ":")
    const summarizeMaterials = (names: string[], rtl: boolean): string => {
      const groups: Record<string, number> = {};
      for (const n of names) {
        const colonIdx = n.indexOf(":");
        const prefix = colonIdx > 0 ? n.substring(0, colonIdx).trim() : n;
        groups[prefix] = (groups[prefix] || 0) + 1;
      }
      return Object.entries(groups)
        .map(([prefix, count]) =>
          count > 1
            ? `${escHtml(prefix)} (${count} ${rtl ? "أنواع" : "variations"})`
            : escHtml(prefix)
        )
        .join(", ");
    };

    let dlRows = "";

    if (isQuotation) {
      // Quotation: full breakdown with qty, trips, rate, cost
      deliveryLines.forEach((dl, idx) => {
        const bg = idx % 2 === 0 ? c.altRow : "transparent";
        dlRows += `<tr style="border-bottom:1px solid ${c.border};background:${bg};">
          <td style="${tdStyle(textAlign, "font-weight:500;")}">${escHtml(dl.supplier_name)}</td>
          <td style="${tdStyle(textAlign, `color:${c.muted};font-size:11px;`)}">${summarizeMaterials(isRtl && dl.material_names_ar?.length ? dl.material_names_ar : dl.material_names, isRtl)}</td>
          <td style="${tdStyle("center", "font-variant-numeric:tabular-nums;")}">${dl.total_quantity}</td>
          <td style="${tdStyle("center", "font-variant-numeric:tabular-nums;")}">${dl.trips}</td>
          <td style="${tdStyle(textAlignEnd, "font-variant-numeric:tabular-nums;")}">${fmt(dl.price_per_trip)}</td>
          <td style="${tdStyle(textAlignEnd, "font-weight:500;font-variant-numeric:tabular-nums;")}">${fmt(dl.total_cost)}</td>
        </tr>`;
      });

      deliveryBreakdownHtml = `
      <div style="margin-bottom:16px;">
        <p style="font-size:10px;text-transform:uppercase;color:${accent};letter-spacing:0.05em;margin:0 0 6px 0;font-weight:600;">${escHtml(dlLabel)}</p>
        <table>
          <thead>
            <tr style="border-bottom:2px solid ${accent};">
              <th style="${thStyle(textAlign)}">${escHtml(dlSupplier)}</th>
              <th style="${thStyle(textAlign)}">${escHtml(dlMaterials)}</th>
              <th style="${thStyle("center", "50px")}">${escHtml(dlQty)}</th>
              <th style="${thStyle("center", "50px")}">${escHtml(dlTrips)}</th>
              <th style="${thStyle(textAlignEnd, "80px")}">${escHtml(dlRate)}</th>
              <th style="${thStyle(textAlignEnd, "80px")}">${escHtml(dlCost)}</th>
            </tr>
          </thead>
          <tbody>${dlRows}</tbody>
        </table>
      </div>`;
    } else {
      // Price list: rate only — no qty, no trips, no cost
      deliveryLines.forEach((dl, idx) => {
        const bg = idx % 2 === 0 ? c.altRow : "transparent";
        dlRows += `<tr style="border-bottom:1px solid ${c.border};background:${bg};">
          <td style="${tdStyle(textAlign, "font-weight:500;")}">${escHtml(dl.supplier_name)}</td>
          <td style="${tdStyle(textAlign, `color:${c.muted};font-size:11px;`)}">${summarizeMaterials(isRtl && dl.material_names_ar?.length ? dl.material_names_ar : dl.material_names, isRtl)}</td>
          <td style="${tdStyle(textAlignEnd, "font-variant-numeric:tabular-nums;")}">${fmt(dl.price_per_trip)}</td>
        </tr>`;
      });

      deliveryBreakdownHtml = `
      <div style="margin-bottom:16px;">
        <p style="font-size:10px;text-transform:uppercase;color:${accent};letter-spacing:0.05em;margin:0 0 6px 0;font-weight:600;">${escHtml(dlLabel)}</p>
        <table>
          <thead>
            <tr style="border-bottom:2px solid ${accent};">
              <th style="${thStyle(textAlign)}">${escHtml(dlSupplier)}</th>
              <th style="${thStyle(textAlign)}">${escHtml(dlMaterials)}</th>
              <th style="${thStyle(textAlignEnd, "80px")}">${escHtml(dlRateMoq)}</th>
            </tr>
          </thead>
          <tbody>${dlRows}</tbody>
        </table>
      </div>`;
    }
  }

  // Totals section (quotation only — pricelist never shows totals)
  let totalsHtml = "";
  if (isQuotation && items.length > 0) {
    const totalBorder = theme === "tech" ? `2px solid ${accent}` : `2px solid ${accent}`;
    totalsHtml = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
      <div style="width:280px;background:${c.totalsBg};${theme === "tech" ? "padding:12px;border-radius:8px;border:1px solid " + c.border + ";" : ""}">
        <div style="display:flex;justify-content:space-between;padding:4px 0;">
          <span style="color:${c.muted};">${escHtml(labels.subtotal || "Subtotal")}</span>
          <span style="font-weight:500;font-variant-numeric:tabular-nums;">${fmt(subtotal)} ${curDisplay}</span>
        </div>
        ${deliveryTotal > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:4px 0;">
          <span style="color:${c.muted};">${escHtml(labels.delivery || "Delivery")}</span>
          <span style="font-weight:500;font-variant-numeric:tabular-nums;">${fmt(deliveryTotal)} ${curDisplay}</span>
        </div>` : ""}
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid ${c.border};">
          <span style="color:${c.muted};">${escHtml(labels.total || "Total (pre-tax)")}</span>
          <span style="font-weight:500;font-variant-numeric:tabular-nums;">${fmt(preTaxTotal)} ${curDisplay}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;">
          <span style="color:${c.muted};">${escHtml(labels.vat || "VAT (15%)")}</span>
          <span style="font-weight:500;font-variant-numeric:tabular-nums;">${fmt(vatAmount)} ${curDisplay}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:${totalBorder};font-weight:700;font-size:16px;color:${theme === "tech" ? accent : c.text};">
          <span>${escHtml(labels.total_with_vat || "Total (incl. VAT)")}</span>
          <span style="font-variant-numeric:tabular-nums;">${fmt(totalWithVat)} ${curDisplay}</span>
        </div>
      </div>
    </div>`;
  }

  // Price list note
  let pricelistNoteHtml = "";
  if (!isQuotation && items.length > 0 && s.pricelist_note) {
    pricelistNoteHtml = `<div style="margin-bottom:16px;font-size:12px;color:${c.muted};font-style:italic;">${escHtml(s.pricelist_note)}</div>`;
  }

  // Delivery details section
  let deliveryHtml = "";
  if (s.show_delivery_section && (deliveryDate || project.location) && items.length > 0) {
    let deliveryContent = "";
    if (deliveryDate) {
      deliveryContent += `
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:${c.muted};">${escHtml(labels.est_delivery || "Est. Delivery")}:</span>
          <span style="font-weight:500;">${fmtDateLong(deliveryDate)}</span>
        </div>`;
    }
    if (project.location) {
      deliveryContent += `
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:500;">${escHtml(project.location)}</span>
        </div>`;
    }
    deliveryHtml = `
    <div style="background:${c.sectionBg};border-radius:6px;padding:12px;margin-bottom:16px;">
      <p style="font-size:10px;text-transform:uppercase;color:${c.muted};letter-spacing:0.05em;margin:0 0 6px 0;font-weight:600;">
        ${escHtml(labels.delivery_details || "DELIVERY DETAILS")}
      </p>
      <div style="display:flex;gap:24px;font-size:14px;">
        ${deliveryContent}
      </div>
    </div>`;
  }

  // Terms section
  let termsHtml = "";
  if (s.terms_text) {
    termsHtml = `
    <div style="margin-bottom:16px;padding:10px;border:1px solid ${c.border};border-radius:6px;">
      <p style="font-size:10px;text-transform:uppercase;color:${c.muted};letter-spacing:0.05em;margin:0 0 6px 0;font-weight:600;">${isRtl ? "\u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0623\u062d\u0643\u0627\u0645" : "Terms & Conditions"}</p>
      <p style="font-size:12px;color:${c.terms};margin:0;white-space:pre-line;">${escHtml(s.terms_text)}</p>
    </div>`;
  }

  // Contact info
  let contactHtml = "";
  if (contactDisplay) {
    contactHtml = `
      <div>
        <p style="font-size:10px;text-transform:uppercase;color:${c.muted};letter-spacing:0.05em;margin:0 0 2px 0;">${escHtml(labels.contact || "Contact")}</p>
        <p style="font-weight:500;margin:0;">${escHtml(contactDisplay)}</p>
        ${s.show_contact_phone && customer.phone ? `<p style="font-size:12px;color:${c.muted};margin:2px 0 0 0;">${ltrSpan(customer.phone)}</p>` : ""}
      </div>`;
  }

  // Delivery location in info grid
  let locationInfoHtml = "";
  if (project.location) {
    locationInfoHtml = `
      <div>
        <p style="font-size:10px;text-transform:uppercase;color:${c.muted};letter-spacing:0.05em;margin:0 0 2px 0;">${escHtml(labels.delivery_location || "Delivery Location")}</p>
        <p style="font-weight:500;margin:0;">${escHtml(project.location)}</p>
      </div>`;
  }

  const techTopBar = "";
  const techBottomBar = "";

  // ── Build final HTML ────────────────────────────────────────────────────────
  if (theme === "tech") {
    return buildTechHtml({
      lang, dir, isRtl, textAlign, textAlignEnd, fontFamily, c, accent, pc,
      isDraft, docTitle, quotationCode, taglineDisplay,
      customerDisplay, contactDisplay, customer, projectDisplay, project,
      today, labels, cols, items, isQuotation, s,
      deliveryBreakdownHtml, deliveryHtml, additionalServicesHtml,
      subtotal, deliveryTotal, preTaxTotal, vatAmount, totalWithVat, curDisplay,
      pricelistNoteHtml, termsHtml, footerLeft, footerRight, version, deliveryMode,
      sellingPerUnit,
    });
  }

  // Classic (print) A4 layout
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(isQuotation ? "Quotation" : "Price List")}${quotationCode ? ` - ${escHtml(quotationCode)}` : ""}${customer.name !== "\u2014" ? ` - ${escHtml(isRtl ? (customer.name_ar || customer.name) : customer.name)}` : ""}${isDraft ? " - DRAFT" : ""}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${isRtl ? '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet">' : ""}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${fontFamily};
      font-size: 13px;
      line-height: 1.5;
      color: ${c.text};
      background: ${c.bg};
      direction: ${dir};
      -webkit-font-smoothing: antialiased;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 18mm 14mm 12mm 14mm;
      margin: 0 auto;
      position: relative;
    }
    @page { size: A4; margin: 0; }
    @media print {
      html, body { width: 210mm; height: 297mm; overflow: hidden; }
      .page { padding: 8mm 10mm; width: 210mm; min-height: 297mm; box-sizing: border-box; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td, th { vertical-align: middle; }
  </style>
</head>
<body>
  <div class="page">
    ${isDraft ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:90px;color:${c.draftColor};font-weight:700;letter-spacing:16px;pointer-events:none;z-index:1000;white-space:nowrap;">DRAFT</div>` : ""}
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
      <div>
        <div dir="ltr">${getLogoSvg(lang, pc)}</div>
        <p style="font-size:11px;color:${c.muted};margin-top:4px;${isRtl ? 'direction:rtl;text-align:right;' : ''}">${escHtml(taglineDisplay || "")}</p>
      </div>
      <div style="text-align:${textAlignEnd};">
        <h1 style="font-size:20px;font-weight:700;color:${accent};letter-spacing:0.02em;margin:0;">${escHtml(docTitle)}</h1>
        ${quotationCode ? `<p style="font-size:11px;font-family:monospace;color:${c.muted};margin-top:4px;">${ltrSpan(quotationCode)}</p>` : ""}
      </div>
    </div>

    <!-- Info Grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 32px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid ${c.border};font-size:13px;">
      <div>
        <p style="font-size:10px;text-transform:uppercase;color:${c.muted};letter-spacing:0.05em;margin:0 0 2px 0;">${escHtml(labels.customer || "Customer")}</p>
        <p style="font-weight:500;margin:0;">${escHtml(customerDisplay)}</p>
      </div>
      <div>
        <p style="font-size:10px;text-transform:uppercase;color:${c.muted};letter-spacing:0.05em;margin:0 0 2px 0;">${escHtml(labels.date || "Date")}</p>
        <p style="font-weight:500;margin:0;">${today}</p>
      </div>
      ${contactHtml}
      <div>
        <p style="font-size:10px;text-transform:uppercase;color:${c.muted};letter-spacing:0.05em;margin:0 0 2px 0;">${escHtml(labels.project || "Project")}</p>
        <p style="font-weight:500;margin:0;">${escHtml(projectDisplay)}</p>
      </div>
      ${locationInfoHtml}
    </div>

    <!-- Items Table -->
    <div style="margin-bottom:16px;">
      <table>
        <thead>${theadHtml}</thead>
        <tbody>${tbodyHtml}</tbody>
      </table>
    </div>

    ${deliveryBreakdownHtml}
    ${additionalServicesHtml}
    ${totalsHtml}
    ${pricelistNoteHtml}
    ${deliveryHtml}
    ${termsHtml}

    <!-- Footer -->
    <div style="font-size:10px;color:${c.muted};border-top:1px solid ${c.border};padding-top:12px;display:flex;justify-content:space-between;">
      <span>${escHtml(footerLeft)}</span>
      <span>${escHtml(footerRight)}</span>
    </div>
  </div>
</body>
</html>`;
}

// ── Tech / Digital theme builder (mobile-first, card-based) ──────────────────

interface TechBuildArgs {
  lang: string; dir: string; isRtl: boolean; textAlign: string; textAlignEnd: string;
  fontFamily: string; c: ThemeColors; accent: string; pc: string;
  isDraft: boolean; docTitle: string; quotationCode?: string; taglineDisplay: string;
  customerDisplay: string; contactDisplay?: string; customer: any; projectDisplay: string; project: any;
  today: string; labels: Record<string, string>; cols: Record<string, string>;
  items: QuoteItem[]; isQuotation: boolean; s: TemplateSettings;
  deliveryBreakdownHtml: string; deliveryHtml: string; additionalServicesHtml: string;
  subtotal: number; deliveryTotal: number; preTaxTotal: number; vatAmount: number; totalWithVat: number;
  curDisplay: string; pricelistNoteHtml: string; termsHtml: string;
  footerLeft: string; footerRight: string; version: number;
  deliveryMode: "embedded" | "separate";
  sellingPerUnit: (item: QuoteItem) => number;
}

function buildTechHtml(a: TechBuildArgs): string {
  const { lang, dir, isRtl, textAlign, textAlignEnd, fontFamily, c, accent, pc,
    isDraft, docTitle, quotationCode, taglineDisplay,
    customerDisplay, contactDisplay, customer, projectDisplay, project,
    today, labels, cols, items, isQuotation, s,
    deliveryBreakdownHtml, deliveryHtml, additionalServicesHtml,
    subtotal, deliveryTotal, preTaxTotal, vatAmount, totalWithVat, curDisplay,
    pricelistNoteHtml, termsHtml, footerLeft, footerRight, deliveryMode,
    sellingPerUnit,
  } = a;

  const green = "#1a3d38";
  const greenLight = "#245a52";

  // Build compact table rows instead of cards
  let itemCardsHtml = "";
  if (items.length === 0) {
    itemCardsHtml = `<div style="padding:24px 0;text-align:center;color:${c.empty};font-size:13px;">${isRtl ? "لا توجد عناصر" : "No items"}</div>`;
  } else {
    const thS = (align: string, w?: string) =>
      `text-align:${align};${w ? `width:${w};` : ""}padding:5px 4px;font-size:9px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;color:${accent};`;
    const tdS = (align: string, extra = "") =>
      `padding:5px 4px;vertical-align:middle;text-align:${align};font-size:12px;${extra}`;

    if (isQuotation) {
      let hdr = `<tr style="border-bottom:1px solid ${accent};">
        <th style="${thS(textAlign, "24px")}">#</th>
        <th style="${thS(textAlign)}">${escHtml(cols.item)}</th>
        <th style="${thS("center", "40px")}">${escHtml(cols.uom)}</th>
        <th style="${thS("center", "40px")}">${escHtml(cols.qty)}</th>
        <th style="${thS(textAlignEnd, "60px")}">${escHtml(cols.unit_price)}</th>
        <th style="${thS(textAlignEnd, "70px")}">${escHtml(cols.total)}</th>
      </tr>`;
      let rows = "";
      items.forEach((item, idx) => {
        const itemName = isRtl ? (item.name_ar || item.name) : item.name;
        const itemUom = isRtl ? (item.uom_ar || uomAr(item.uom)) : uomEn(item.uom);
        const displayUnitPrice = sellingPerUnit(item);
        const lineTotal = (item.quantity || 0) * displayUnitPrice;
        const supplierDisplay = isRtl ? (item.supplier_name_ar || item.supplier_name) : item.supplier_name;
        const supplierLine = s.show_supplier_name && supplierDisplay
          ? `<br><span style="font-size:10px;color:${c.muted};">${isRtl ? "عبر" : "via"} ${escHtml(supplierDisplay)}</span>` : "";
        const bg = idx % 2 === 0 ? "rgba(26,61,56,0.08)" : "transparent";
        rows += `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);background:${bg};">
          <td style="${tdS(textAlign, `color:${c.muted};`)}">${idx + 1}</td>
          <td style="${tdS(textAlign, "font-weight:500;")}">${escHtml(itemName)}${supplierLine}</td>
          <td style="${tdS("center", `color:${c.muted};`)}">${escHtml(itemUom)}</td>
          <td style="${tdS("center", "font-weight:500;font-variant-numeric:tabular-nums;")}">${item.quantity ?? "—"}</td>
          <td style="${tdS(textAlignEnd, "font-variant-numeric:tabular-nums;")}">${displayUnitPrice > 0 ? fmt(displayUnitPrice) : "—"}</td>
          <td style="${tdS(textAlignEnd, `font-weight:600;font-variant-numeric:tabular-nums;color:${accent};`)}">${lineTotal > 0 ? fmt(lineTotal) : "—"}</td>
        </tr>`;
      });
      itemCardsHtml = `<table style="width:100%;border-collapse:collapse;"><thead>${hdr}</thead><tbody>${rows}</tbody></table>`;
    } else {
      // Price list table
      let hdrCells = `
        <th style="${thS(textAlign, "24px")}">#</th>
        <th style="${thS(textAlign)}">${escHtml(cols.item)}</th>
        <th style="${thS("center", "40px")}">${escHtml(cols.uom)}</th>
        <th style="${thS(textAlignEnd, "70px")}">${escHtml(cols.unit_price)}</th>`;
      if (s.show_delivery_column) {
        hdrCells += `<th style="${thS(textAlignEnd, "70px")}">${escHtml(cols.delivery)}</th>`;
      }
      if (s.show_supplier_name) {
        hdrCells += `<th style="${thS(textAlign, "100px")}">${escHtml(cols.supplier)}</th>`;
      }
      let rows = "";
      items.forEach((item, idx) => {
        const itemName = isRtl ? (item.name_ar || item.name) : item.name;
        const itemUom = isRtl ? (item.uom_ar || uomAr(item.uom)) : uomEn(item.uom);
        const bg = idx % 2 === 0 ? "rgba(26,61,56,0.08)" : "transparent";
        let cells = `
          <td style="${tdS(textAlign, `color:${c.muted};`)}">${idx + 1}</td>
          <td style="${tdS(textAlign, "font-weight:500;")}">${escHtml(itemName)}</td>
          <td style="${tdS("center", `color:${c.muted};`)}">${escHtml(itemUom)}</td>
          <td style="${tdS(textAlignEnd, `font-weight:600;font-variant-numeric:tabular-nums;color:${accent};`)}">${item.unit_price ? fmt(item.unit_price) : "—"}</td>`;
        if (s.show_delivery_column) {
          cells += `<td style="${tdS(textAlignEnd, "font-variant-numeric:tabular-nums;")}">${item.delivery_price ? fmt(item.delivery_price) : "—"}</td>`;
        }
        if (s.show_supplier_name) {
          const sd = isRtl ? (item.supplier_name_ar || item.supplier_name) : item.supplier_name;
          cells += `<td style="${tdS(textAlign, `color:${c.muted};`)}">${escHtml(sd || "—")}</td>`;
        }
        rows += `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);background:${bg};">${cells}</tr>`;
      });
      itemCardsHtml = `<table style="width:100%;border-collapse:collapse;"><thead><tr style="border-bottom:1px solid ${accent};">${hdrCells}</tr></thead><tbody>${rows}</tbody></table>`;
    }
  }

  // Delivery breakdown (reuse the already-built HTML from classic builder)
  let deliveryCardsHtml = deliveryBreakdownHtml || "";

  // Totals (only for quotation mode) — compact inline style
  let totalsCardHtml = "";
  if (items.length > 0 && isQuotation) {
    totalsCardHtml = `
    <div style="background:linear-gradient(135deg, ${green}, ${greenLight});border-radius:10px;padding:14px 16px;margin-top:12px;border:1px solid rgba(241,86,37,0.15);position:relative;overflow:hidden;">
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;">
        <span style="color:rgba(255,255,255,0.7);">${escHtml(labels.subtotal || "Subtotal")}</span>
        <span style="font-weight:500;font-variant-numeric:tabular-nums;color:#fff;">${fmt(subtotal)} ${curDisplay}</span>
      </div>
      ${deliveryTotal > 0 ? `
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;">
        <span style="color:rgba(255,255,255,0.7);">${escHtml(labels.delivery || "Delivery")}</span>
        <span style="font-weight:500;font-variant-numeric:tabular-nums;color:#fff;">${fmt(deliveryTotal)} ${curDisplay}</span>
      </div>` : ""}
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;border-top:1px solid rgba(255,255,255,0.15);">
        <span style="color:rgba(255,255,255,0.7);">${escHtml(labels.total || "Total (pre-tax)")}</span>
        <span style="font-weight:500;font-variant-numeric:tabular-nums;color:#fff;">${fmt(preTaxTotal)} ${curDisplay}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;">
        <span style="color:rgba(255,255,255,0.7);">${escHtml(labels.vat || "VAT (15%)")}</span>
        <span style="font-variant-numeric:tabular-nums;color:#fff;">${fmt(vatAmount)} ${curDisplay}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0 0 0;border-top:2px solid ${accent};margin-top:4px;">
        <span style="font-weight:700;font-size:14px;color:#fff;">${escHtml(labels.total_with_vat || "Total (incl. VAT)")}</span>
        <span style="font-weight:800;font-size:18px;color:${accent};font-variant-numeric:tabular-nums;text-shadow:0 0 12px ${accent}60;">${fmt(totalWithVat)} ${curDisplay}</span>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(isQuotation ? "Quotation" : "Price List")}${quotationCode ? ` - ${escHtml(quotationCode)}` : ""}${isDraft ? " - DRAFT" : ""}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${isRtl
    ? '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet">'
    : '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">'}
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: ${fontFamily};
      font-size: 14px;
      line-height: 1.5;
      color: ${c.text};
      background: ${c.bg};
      direction: ${dir};
      -webkit-font-smoothing: antialiased;
    }
    .wrap {
      width: 480px;
      max-width: 480px;
      margin: 0 auto;
      padding: 0 16px 32px 16px;
    }
    html, body { width: 480px; max-width: 480px; overflow-x: hidden; }
    @media print {
      html, body { background: ${c.bg} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: 480px auto; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="wrap" style="position:relative;">
    ${isDraft ? `<div style="position:absolute;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:72px;color:rgba(241,86,37,0.18);font-weight:800;letter-spacing:16px;pointer-events:none;z-index:1000;white-space:nowrap;text-shadow:0 0 40px rgba(241,86,37,0.25);">DRAFT</div>` : ""}

    <!-- Hero header -->
    <div style="background:linear-gradient(160deg, ${green}, ${greenLight});border-radius:0 0 16px 16px;padding:20px 16px 16px 16px;margin:0 -16px 14px -16px;position:relative;overflow:hidden;">
      <div style="position:absolute;inset:0;opacity:0.08;pointer-events:none;background-image:url('data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100" width="80" height="100"><path fill="none" stroke="white" stroke-width="1.5" d="M1.3,68.5l4.9-5.5c.24-.27.05-.71-.32-.71h-2.9c-1.65,0-2.98-1.33-2.98-2.98V37c0-1.46.54-2.87,1.51-3.97L29.4,1.7C30.4.6,31.8,0,33.2,0h41.3c1.65,0,2.98,1.33,2.98,2.98V25.5c0,1.24-.45,2.44-1.27,3.37l-4.94,5.63c-.24.28-.05.71.32.71h2.91c1.65,0,2.98,1.33,2.98,2.98V60.6c0,1.25-.46,2.46-1.29,3.4l-28,31.4c-1.13,1.27-2.75,2-4.45,2H3c-1.65,0-2.98-1.33-2.98-2.98V71.9c0-1.26.46-2.47,1.3-3.4Z"/></svg>`)}');background-repeat:repeat;background-size:40px 50px;"></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div dir="ltr">${getLogoSvg(lang as "en" | "ar", "#ffffff")}</div>
        <div style="text-align:${textAlignEnd};">
          <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.5);">${escHtml(docTitle)}</span>
          ${quotationCode ? `<p style="font-size:11px;font-family:monospace;color:rgba(255,255,255,0.7);margin-top:1px;" dir="ltr">${escHtml(quotationCode)}</p>` : ""}
        </div>
      </div>
      <p style="font-size:10px;color:rgba(255,255,255,0.5);margin-bottom:8px;">${escHtml(taglineDisplay || "")}</p>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.5);">${escHtml(labels.customer || "Customer")}</span>
          <p style="font-weight:600;font-size:14px;color:#fff;margin:1px 0 0 0;">${escHtml(customerDisplay)}</p>
        </div>
        <span style="font-size:11px;color:rgba(255,255,255,0.6);">${today}</span>
      </div>
    </div>

    <!-- Info chips -->
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
      <div style="background:rgba(26,61,56,0.15);border:1px solid rgba(26,61,56,0.3);border-radius:8px;padding:8px 12px;flex:1;min-width:110px;">
        <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.04em;color:${c.muted};">${escHtml(labels.project || "Project")}</span>
        <p style="font-weight:500;margin:1px 0 0 0;font-size:12px;">${escHtml(projectDisplay)}</p>
        ${project.location ? `<p style="font-size:10px;color:${c.muted};margin-top:2px;">${escHtml(project.location)}</p>` : ""}
      </div>
      ${contactDisplay ? `
      <div style="background:rgba(26,61,56,0.15);border:1px solid rgba(26,61,56,0.3);border-radius:8px;padding:8px 12px;flex:1;min-width:110px;">
        <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.04em;color:${c.muted};">${escHtml(labels.contact || "Contact")}</span>
        <p style="font-weight:500;margin:1px 0 0 0;font-size:12px;">${escHtml(contactDisplay)}</p>
        ${s.show_contact_phone && customer.phone ? `<p style="font-size:10px;color:${c.muted};margin-top:1px;" dir="ltr">${escHtml(customer.phone)}</p>` : ""}
      </div>` : ""}
    </div>

    <!-- Section label -->
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
      <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:${accent};font-weight:600;">${isRtl ? "المواد" : "ITEMS"}</span>
      <div style="flex:1;height:1px;background:linear-gradient(90deg, ${accent}40, transparent);"></div>
      <span style="font-size:9px;color:#fff;background:${accent};padding:1px 7px;border-radius:8px;font-weight:600;">${items.length}</span>
    </div>

    <!-- Item cards -->
    ${itemCardsHtml}

    <!-- Delivery breakdown -->
    ${deliveryCardsHtml}

    <!-- Additional Services (quotation-level add-ons) -->
    ${additionalServicesHtml}

    <!-- Totals -->
    ${totalsCardHtml}

    ${pricelistNoteHtml ? `<div style="margin-top:10px;font-size:11px;color:${c.muted};font-style:italic;">${pricelistNoteHtml}</div>` : ""}

    ${s.terms_text ? `
    <div style="margin-top:12px;padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;">
      <p style="font-size:9px;text-transform:uppercase;color:${c.muted};letter-spacing:0.05em;margin:0 0 4px 0;font-weight:600;">${isRtl ? "الشروط والأحكام" : "Terms & Conditions"}</p>
      <p style="font-size:11px;color:${c.terms};margin:0;white-space:pre-line;">${escHtml(s.terms_text)}</p>
    </div>` : ""}

    <!-- Footer -->
    <div style="margin-top:16px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
      <p style="font-size:9px;color:${c.muted};">${escHtml(footerLeft)}</p>
      <p style="font-size:9px;color:${c.muted};margin-top:1px;">${escHtml(footerRight)}</p>
    </div>
  </div>
  <script>
    function postHeight(){
      var h = document.querySelector('.wrap').scrollHeight + 32;
      parent.postMessage({type:'tech-resize',height:h},'*');
    }
    window.addEventListener('load', postHeight);
    new MutationObserver(postHeight).observe(document.body,{childList:true,subtree:true});
    setTimeout(postHeight, 200);
  </script>
</body>
</html>`;
}

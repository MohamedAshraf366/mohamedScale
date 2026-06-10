import { useState, useEffect, useMemo, Fragment, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  GitCompareArrows, Search, CheckCircle2, AlertTriangle, XCircle,
  ChevronDown, ChevronRight, Loader2, Wrench,
} from "lucide-react";

// ─── CSV parser (semicolon-delimited, quoted fields) ───
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ';') { current.push(field); field = ""; }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        current.push(field); field = "";
        if (current.some(f => f.length > 0)) rows.push(current);
        current = [];
        if (ch === '\r') i++;
      } else field += ch;
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    if (current.some(f => f.length > 0)) rows.push(current);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || "").trim(); });
    return obj;
  });
}

type MatchStatus = "matched" | "missing_new" | "missing_old" | "differs";

interface ComparisonRow {
  id: string;
  status: MatchStatus;
  label: string;
  oldData: Record<string, any> | null;
  newData: Record<string, any> | null;
  diffs: string[];
}

// ─── Relationship audit types ───
type RelStatus = "ok" | "wrong_parent" | "orphan" | "unmapped";

interface RelFix {
  table: string;
  recordId: string;
  column: string;
  newValue: string;
  label: string; // human-readable: "customer_account_id → ABC Corp"
}

interface RelationshipRow {
  id: string;
  status: RelStatus;
  label: string;
  entityType: "Project" | "Opportunity" | "Communication" | "Task";
  checks: { field: string; expected: string; actual: string; ok: boolean }[];
  fixes: RelFix[];
}

// ─── Field mappings ───
const CUSTOMER_FIELDS = [
  { old: "company_name", new: "display_name", label: "Name" },
  { old: "primary_contact_name", new: "_contact_name", label: "Contact" },
  { old: "primary_contact_phone", new: "_contact_phone", label: "Phone" },
  { old: "city", new: "_city", label: "City" },
  { old: "district", new: "_district", label: "District" },
  { old: "interest_level", new: "_interest", label: "Interest" },
];

const PROJECT_FIELDS = [
  { old: "name", new: "name", label: "Name" },
  { old: "project_type", new: "project_type", label: "Type" },
  { old: "project_size", new: "project_size", label: "Size" },
  { old: "current_phase", new: "current_phase", label: "Phase" },
  { old: "city", new: "_city", label: "City" },
  { old: "district", new: "_district", label: "District" },
];

const OPP_FIELDS = [
  { old: "stage", new: "stage", label: "Stage" },
  { old: "interest_level", new: "interest_level", label: "Interest" },
  { old: "notes", new: "notes", label: "Notes" },
  { old: "in_pipeline", new: "status", label: "Status/Pipeline" },
];

const COMM_FIELDS = [
  { old: "company_name", new: "_account_name", label: "Company" },
  { old: "communication_channels", new: "channel", label: "Channel" },
  { old: "topic", new: "subject", label: "Subject" },
  { old: "summary", new: "summary", label: "Summary" },
  { old: "communication_date", new: "occurred_at", label: "Date" },
];

const TASK_FIELDS = [
  { old: "action", new: "title", label: "Title/Action" },
  { old: "notes", new: "description", label: "Notes" },
  { old: "status_after", new: "status", label: "Status" },
  { old: "priority", new: "priority", label: "Priority" },
  { old: "follow_up_date", new: "due_at", label: "Due Date" },
  { old: "follow_up_channel", new: "channel", label: "Channel" },
];

function normalize(val: any): string {
  if (val === null || val === undefined || val === "") return "";
  return String(val).trim().replace(/[\t\u200B-\u200F\u202A-\u202E\uFEFF]/g, "").replace(/\s+/g, " ").toLowerCase();
}

/** Normalize code: SAL-0086 → sal.0086, SAL-0086-001 → sal.0086_001 */
function normalizeCode(code: string): string {
  return (code || "").trim().replace(/^SAL-/i, "SAL.").replace(/-/g, "_").toLowerCase();
}

// ─── Semantic equivalence helpers ───

/** Normalize phone: strip non-digits, normalize 966 prefix */
function normalizePhone(val: string): string {
  const digits = val.replace(/\D/g, "");
  // 0500056995 → 966500056995
  if (digits.startsWith("0") && digits.length === 10) return "966" + digits.slice(1);
  // 5XXXXXXXX → 9665XXXXXXXX
  if (digits.startsWith("5") && digits.length === 9) return "966" + digits;
  return digits;
}

/** Map Arabic city names to English equivalents */
const CITY_MAP: Record<string, string> = {
  "الرياض": "riyadh", "جدة": "jeddah", "جده": "jeddah", "مكة": "makkah",
  "المدينة": "madinah", "المدينة المنورة": "madinah", "الدمام": "dammam",
  "الخبر": "khobar", "الظهران": "dhahran", "بريدة": "buraydah",
  "تبوك": "tabuk", "أبها": "abha", "حائل": "hail", "حريملاء": "huraymila",
  "الخرج": "al kharj", "القصيم": "qassim", "نجران": "najran",
  "جازان": "jazan", "ينبع": "yanbu", "الطائف": "taif",
};
function normalizeCity(val: string): string {
  const clean = normalize(val);
  return CITY_MAP[clean] || clean;
}

/** Normalize district: strip common prefixes like حي and trailing city names */
function normalizeDistrict(val: string): string {
  let clean = normalize(val);
  // Remove "حي " prefix
  clean = clean.replace(/^حي\s+/, "");
  // Remove trailing city references like "، الرياض" or ", riyadh"
  clean = clean.replace(/[،,]\s*.+$/, "");
  return clean;
}

/** Channel synonym mapping */
const CHANNEL_MAP: Record<string, string> = {
  "phone call": "call", "phone": "call", "هاتف": "call",
  "site_visit": "in_person", "site visit": "in_person", "زيارة": "in_person",
  "whatsapp": "whatsapp", "wa": "whatsapp", "واتساب": "whatsapp",
  "email": "email", "بريد": "email",
  "meeting": "meeting", "اجتماع": "meeting",
  "sms": "sms",
};
function normalizeChannel(val: string): string {
  const clean = normalize(val);
  return CHANNEL_MAP[clean] || clean;
}

/** Status synonym mapping */
const STATUS_MAP: Record<string, string> = {
  "closed": "closed", "completed": "closed", "complete": "closed", "done": "closed",
  "lost": "closed", "won": "closed",
  "false": "closed", "true": "active",
  "open": "pending", "in progress": "in_progress", "in_progress": "in_progress",
};
function normalizeStatus(val: string): string {
  const clean = normalize(val);
  return STATUS_MAP[clean] || clean;
}

/** Normalize date: parse to ISO date string for comparison (ignore format diffs) */
function normalizeDate(val: string): string {
  const clean = String(val || "").trim();
  if (!clean) return "";
  try {
    // Normalize space separator to T, and fix bare timezone offsets like +00 → +00:00
    let iso = clean.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
    const d = new Date(iso);
    if (isNaN(d.getTime())) return normalize(clean);
    return d.toISOString();
  } catch { return normalize(clean); }
}

/** Field-aware normalizer */
function normalizeField(val: any, fieldLabel: string): string {
  const raw = val === null || val === undefined ? "" : String(val);
  if (!raw.trim()) return "";
  switch (fieldLabel) {
    case "Phone": return normalizePhone(raw);
    case "City": return normalizeCity(raw);
    case "District": return normalizeDistrict(raw);
    case "Channel": return normalizeChannel(raw);
    case "Status": case "Status/Pipeline": return normalizeStatus(raw);
    case "Due Date": case "Date": return normalizeDate(raw);
    case "Priority": return normalize(raw);
    default: return normalize(raw);
  }
}

function buildComparison(
  oldRows: Record<string, string>[],
  newRows: Record<string, any>[],
  fields: { old: string; new: string; label: string }[],
  getOldId: (row: Record<string, string>) => string,
  getNewId: (row: Record<string, any>) => string | null,
  getLabel: (row: Record<string, string>) => string,
  getNewLabel?: (row: Record<string, any>) => string,
): ComparisonRow[] {
  const results: ComparisonRow[] = [];
  const newById = new Map<string, Record<string, any>>();
  for (const nr of newRows) {
    const lid = getNewId(nr);
    if (lid) newById.set(lid, nr);
  }

  for (const oldRow of oldRows) {
    const oldId = getOldId(oldRow);
    const newRow = newById.get(oldId) || null;

    if (!newRow) {
      results.push({ id: oldId, status: "missing_new", label: getLabel(oldRow), oldData: oldRow, newData: null, diffs: ["Not migrated"] });
      continue;
    }

    const diffs: string[] = [];
    for (const f of fields) {
      const oldVal = normalizeField(oldRow[f.old], f.label);
      const newVal = normalizeField(newRow[f.new], f.label);
      if (oldVal && newVal && oldVal !== newVal) {
        diffs.push(f.label);
      }
    }

    results.push({
      id: oldId,
      status: diffs.length > 0 ? "differs" : "matched",
      label: getLabel(oldRow),
      oldData: oldRow,
      newData: newRow,
      diffs,
    });

    newById.delete(oldId);
  }

  for (const [lid, nr] of newById) {
    results.push({
      id: lid,
      status: "missing_old",
      label: getNewLabel ? getNewLabel(nr) : (nr.title || nr.display_name || nr.name || lid.slice(0, 8)),
      oldData: null,
      newData: nr,
      diffs: ["No CSV source"],
    });
  }

  return results;
}

// ─── Relationship status badge ───
function RelStatusBadge({ status }: { status: RelStatus }) {
  switch (status) {
    case "ok": return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Correct</Badge>;
    case "wrong_parent": return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Wrong Parent</Badge>;
    case "orphan": return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"><AlertTriangle className="h-3 w-3 mr-1" />Orphan</Badge>;
    case "unmapped": return <Badge className="bg-muted text-muted-foreground border-muted-foreground/30">Unmapped</Badge>;
  }
}

// ─── Status badge ───
function StatusBadge({ status }: { status: MatchStatus }) {
  switch (status) {
    case "matched": return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Match</Badge>;
    case "differs": return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"><AlertTriangle className="h-3 w-3 mr-1" />Differs</Badge>;
    case "missing_new": return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Not migrated</Badge>;
    case "missing_old": return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">New only</Badge>;
  }
}

// ─── Expanded row detail ───
function FieldComparison({ row, fields }: { row: ComparisonRow; fields: { old: string; new: string; label: string }[] }) {
  if (!row.oldData && !row.newData) return null;
  return (
    <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg text-sm">
      <div>
        <p className="font-medium text-muted-foreground mb-2 text-xs uppercase tracking-wider">Old (CSV)</p>
        {fields.map(f => {
          const val = row.oldData?.[f.old] || "—";
          const isDiff = row.diffs.includes(f.label);
          return (
            <div key={f.old} className={`py-1.5 px-2 rounded ${isDiff ? "bg-amber-500/10" : ""}`}>
              <span className="text-muted-foreground">{f.label}: </span>
              <span className={isDiff ? "font-medium text-amber-700 dark:text-amber-400" : ""}>{String(val).slice(0, 120)}</span>
            </div>
          );
        })}
      </div>
      <div>
        <p className="font-medium text-muted-foreground mb-2 text-xs uppercase tracking-wider">New (Platform)</p>
        {fields.map(f => {
          const val = row.newData?.[f.new] || "—";
          const isDiff = row.diffs.includes(f.label);
          return (
            <div key={f.new} className={`py-1.5 px-2 rounded ${isDiff ? "bg-amber-500/10" : ""}`}>
              <span className="text-muted-foreground">{f.label}: </span>
              <span className={isDiff ? "font-medium text-amber-700 dark:text-amber-400" : ""}>{String(val).slice(0, 120)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab content ───
function ComparisonTab({ rows, fields, search }: { rows: ComparisonRow[]; fields: { old: string; new: string; label: string }[]; search: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => r.label.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }, [rows, search]);

  const stats = useMemo(() => ({
    matched: filtered.filter(r => r.status === "matched").length,
    differs: filtered.filter(r => r.status === "differs").length,
    missing: filtered.filter(r => r.status === "missing_new").length,
  }), [filtered]);

  return (
    <div className="space-y-3">
      <div className="flex gap-3 text-sm">
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{stats.matched} matched</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-amber-600 dark:text-amber-400 font-medium">{stats.differs} differ</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-red-600 dark:text-red-400 font-medium">{stats.missing} missing</span>
        <span className="text-muted-foreground ml-auto">{filtered.length} total</span>
      </div>

      <ScrollArea className="h-[calc(100vh-320px)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Record</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-48">Differences</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(row => (
              <ComparisonTableRow
                key={row.id}
                row={row}
                fields={fields}
                isExpanded={expandedId === row.id}
                onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
              />
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function ComparisonTableRow({ row, fields, isExpanded, onToggle }: {
  row: ComparisonRow;
  fields: { old: string; new: string; label: string }[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="py-2">
          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </TableCell>
        <TableCell className="py-2">
          <span className="font-medium text-sm">{row.label.slice(0, 60)}</span>
          <span className="text-xs text-muted-foreground ml-2">{row.id.slice(0, 8)}</span>
        </TableCell>
        <TableCell className="py-2"><StatusBadge status={row.status} /></TableCell>
        <TableCell className="py-2 text-xs text-muted-foreground">
          {row.diffs.length > 0 ? row.diffs.join(", ") : "—"}
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={4} className="p-0 border-0">
            <FieldComparison row={row} fields={fields} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Relationship tab (per-type, with resolve) ───
function RelationshipTab({ rows, search, onResolve, onBulkResolve }: {
  rows: RelationshipRow[];
  search: string;
  onResolve: (row: RelationshipRow) => void;
  onBulkResolve: (rows: RelationshipRow[]) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => r.label.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }, [rows, search]);

  const stats = useMemo(() => ({
    ok: filtered.filter(r => r.status === "ok").length,
    wrong: filtered.filter(r => r.status === "wrong_parent").length,
    orphan: filtered.filter(r => r.status === "orphan").length,
    unmapped: filtered.filter(r => r.status === "unmapped").length,
  }), [filtered]);

  const resolvable = filtered.filter(r => r.fixes.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex gap-3 text-sm items-center">
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{stats.ok} correct</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-red-600 dark:text-red-400 font-medium">{stats.wrong} wrong parent</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-amber-600 dark:text-amber-400 font-medium">{stats.orphan} orphaned</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{stats.unmapped} unmapped</span>
        <span className="text-muted-foreground ml-auto">{filtered.length} total</span>
        {resolvable.length > 0 && (
          <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => onBulkResolve(resolvable)}>
            <Wrench className="h-3.5 w-3.5" />
            Resolve All ({resolvable.length})
          </Button>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-380px)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Record</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-48">Issues</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(row => {
              const isExpanded = expandedId === row.id;
              const failedChecks = row.checks.filter(c => !c.ok);
              return (
                <Fragment key={row.id}>
                  <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedId(isExpanded ? null : row.id)}>
                    <TableCell className="py-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="font-medium text-sm">{row.label.slice(0, 60)}</span>
                    </TableCell>
                    <TableCell className="py-2"><RelStatusBadge status={row.status} /></TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {failedChecks.length > 0 ? failedChecks.map(c => c.field).join(", ") : "—"}
                    </TableCell>
                    <TableCell className="py-2">
                      {row.fixes.length > 0 && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={e => { e.stopPropagation(); onResolve(row); }}>
                          <Wrench className="h-3 w-3" /> Fix
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0 border-0">
                        <div className="p-4 bg-muted/30 rounded-lg text-sm space-y-2">
                          {row.checks.map(c => (
                            <div key={c.field} className={`flex items-center gap-3 py-1.5 px-2 rounded ${c.ok ? "" : "bg-destructive/10"}`}>
                              {c.ok
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                              <span className="font-medium w-36">{c.field}</span>
                              {!c.ok && (
                                <>
                                  <span className="text-muted-foreground">expected:</span>
                                  <span className="font-mono text-xs">{c.expected || "—"}</span>
                                  <span className="text-muted-foreground">→ actual:</span>
                                  <span className="font-mono text-xs text-destructive">{c.actual || "—"}</span>
                                </>
                              )}
                              {c.ok && <span className="text-muted-foreground font-mono text-xs">{c.expected || "—"}</span>}
                            </div>
                          ))}
                          {row.fixes.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Available fixes:</p>
                              {row.fixes.map((f, i) => (
                                <div key={i} className="text-xs font-mono text-primary py-0.5">
                                  {f.table}.{f.column} → {f.label.split("→")[1]?.trim()}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
// ─── Main ───
const REL_ENTITY_TYPES = ["Project", "Opportunity", "Communication", "Task"] as const;

export default function MigrationCompare() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [customerRows, setCustomerRows] = useState<ComparisonRow[]>([]);
  const [projectRows, setProjectRows] = useState<ComparisonRow[]>([]);
  const [oppRows, setOppRows] = useState<ComparisonRow[]>([]);
  const [commRows, setCommRows] = useState<ComparisonRow[]>([]);
  const [taskRows, setTaskRows] = useState<ComparisonRow[]>([]);
  const [relRows, setRelRows] = useState<RelationshipRow[]>([]);
  const [filter, setFilter] = useState<"all" | MatchStatus>("all");
  const [relFilter, setRelFilter] = useState<"all" | RelStatus>("all");
  const [relTypeTab, setRelTypeTab] = useState<string>("Project");

  // Resolve dialog state
  const [resolvePreview, setResolvePreview] = useState<RelFix[] | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const base = window.location.origin;

      const [
        clientsText, projectsText, oppsText, commsText, tasksText,
        dbAccounts, dbProjects, dbOpps, dbComms, dbTasks,
      ] = await Promise.all([
        fetch(`${base}/migration/clients.csv`).then(r => r.text()),
        fetch(`${base}/migration/projects.csv`).then(r => r.text()),
        fetch(`${base}/migration/opportunities.csv`).then(r => r.text()),
        fetch(`${base}/migration/communications.csv`).then(r => r.text()),
        fetch(`${base}/migration/tasks.csv`).then(r => r.text()),
        supabase.from("accounts").select("*, contacts:contacts!contacts_account_id_fkey(full_name, phone, is_primary), locations:location_id(city, address_text)").eq("status", "active"),
        supabase.from("projects").select("*, locations:location_id(city, address_text)").is("deleted_at", null),
        supabase.from("opportunities").select("*").filter("metadata->>legacy_migration", "eq", "true"),
        supabase.from("communications").select("*, accounts:account_id(display_name)").filter("metadata->>legacy_migration", "eq", "true"),
        supabase.from("tasks").select("*").filter("metadata->>legacy_migration", "eq", "true"),
      ]);

      const oldClients = parseCsv(clientsText);
      const oldProjects = parseCsv(projectsText);
      const oldOpps = parseCsv(oppsText);
      const oldComms = parseCsv(commsText);
      const oldTasks = parseCsv(tasksText);

      // Enrich accounts with primary contact + location
      const newAccounts = (dbAccounts.data || []).map((a: any) => {
        const primaryContact = (a.contacts || []).find((c: any) => c.is_primary) || (a.contacts || [])[0];
        return {
          ...a,
          _contact_name: primaryContact?.full_name || "",
          _contact_phone: primaryContact?.phone || "",
          _city: a.locations?.city || "",
          _district: a.locations?.address_text || "",
          _interest: "",
        };
      });

      const newProjects = (dbProjects.data || []).map((p: any) => ({
        ...p,
        _city: p.locations?.city || "",
        _district: p.locations?.address_text || "",
      }));

      const newOpps = (dbOpps.data || []) as any[];
      const newComms = (dbComms.data || []).map((c: any) => ({
        ...c,
        _account_name: c.accounts?.display_name || "",
      }));
      const newTasks = (dbTasks.data || []) as any[];

      // Customers: match by normalized display name
      setCustomerRows(buildComparison(
        oldClients, newAccounts, CUSTOMER_FIELDS,
        r => normalize(r.company_name),
        r => normalize(r.display_name || ""),
        r => `${r.client_code || ""} — ${r.company_name || ""}`,
        r => `${r.code || ""} — ${r.display_name || ""}`,
      ));

      // Projects: match by ID (same UUIDs preserved)
      setProjectRows(buildComparison(
        oldProjects, newProjects, PROJECT_FIELDS,
        r => r.id,
        r => r.id,
        r => `${r.project_code || ""} — ${r.name || ""}`,
        r => `${r.code || ""} — ${r.name || ""}`,
      ));

      setOppRows(buildComparison(
        oldOpps, newOpps, OPP_FIELDS,
        r => r.id,
        r => (r.metadata as any)?.legacy_id || null,
        r => `${r.opportunity_code || ""} — ${(r.notes || "").slice(0, 40)}`,
      ));

      setCommRows(buildComparison(
        oldComms, newComms, COMM_FIELDS,
        r => r.id,
        r => (r.metadata as any)?.legacy_id || null,
        r => `${r.company_name || ""} — ${(r.topic || r.summary || "").slice(0, 40)}`,
      ));

      setTaskRows(buildComparison(
        oldTasks, newTasks, TASK_FIELDS,
        r => r.id,
        r => (r.metadata as any)?.legacy_id || null,
        r => `${(r.action || "").slice(0, 50)}`,
      ));

      // ─── Relationship audit (name-based matching, with resolve fixes) ───
      const oldClientIdToName = new Map<string, string>();
      for (const c of oldClients) { if (c.id) oldClientIdToName.set(c.id, normalize(c.company_name)); }
      const oldProjectIdToName = new Map<string, string>();
      for (const p of oldProjects) { if (p.id) oldProjectIdToName.set(p.id, normalize(p.name)); }

      const newAccountIdToName = new Map<string, string>();
      const newNameToAccountId = new Map<string, string>();
      for (const a of newAccounts) {
        const n = normalize(a.display_name || "");
        newAccountIdToName.set(a.id, n);
        newNameToAccountId.set(n, a.id);
      }
      const newProjectIdToName = new Map<string, string>();
      const newNameToProjectId = new Map<string, string>();
      for (const p of newProjects) {
        const n = normalize(p.name || "");
        newProjectIdToName.set(p.id, n);
        newNameToProjectId.set(n, p.id);
      }
      const newOppIdToTitle = new Map<string, string>();
      for (const o of newOpps) newOppIdToTitle.set(o.id, normalize(o.title || ""));

      const newOppByLegacyId = new Map<string, any>();
      for (const o of newOpps) { const lid = (o.metadata as any)?.legacy_id; if (lid) newOppByLegacyId.set(lid, o); }
      const newCommByLegacyId = new Map<string, any>();
      for (const c of newComms) { const lid = (c.metadata as any)?.legacy_id; if (lid) newCommByLegacyId.set(lid, c); }
      const newTaskByLegacyId = new Map<string, any>();
      for (const t of newTasks) { const lid = (t.metadata as any)?.legacy_id; if (lid) newTaskByLegacyId.set(lid, t); }
      const newProjectById = new Map<string, any>();
      for (const p of newProjects) newProjectById.set(p.id, p);

      const relResults: RelationshipRow[] = [];

      function nameCheckWithFix(
        field: string, expectedName: string | null, actualId: string | null,
        lookupMap: Map<string, string>, reverseMap: Map<string, string>,
        table: string, recordId: string, column: string,
      ): { check: RelationshipRow["checks"][0]; fix: RelFix | null } {
        const actualName = actualId ? (lookupMap.get(actualId) || "?") : "";
        const ok = expectedName ? expectedName === actualName : !actualId;
        const check = { field, expected: expectedName || "(none)", actual: actualName || "(none)", ok };
        let fix: RelFix | null = null;
        if (!ok && expectedName) {
          const correctId = reverseMap.get(expectedName);
          if (correctId) fix = { table, recordId, column, newValue: correctId, label: `${column} → ${expectedName}` };
        }
        return { check, fix };
      }

      // 1) Projects → Customer
      for (const oldProj of oldProjects) {
        const newProj = newProjectById.get(oldProj.id);
        if (!newProj) continue;
        const expectedCustomerName = oldClientIdToName.get(oldProj.client_id) || null;
        const { check, fix } = nameCheckWithFix("customer (parent)", expectedCustomerName, newProj.customer_account_id, newAccountIdToName, newNameToAccountId, "projects", newProj.id, "customer_account_id");
        relResults.push({ id: `proj-${oldProj.id}`, status: !expectedCustomerName ? "unmapped" : !check.ok ? "wrong_parent" : "ok", label: `${oldProj.project_code || ""} — ${oldProj.name || ""}`, entityType: "Project", checks: [check], fixes: fix ? [fix] : [] });
      }

      // 2) Opportunities → Project + Customer (matched by legacy_id, parents matched by name)
      for (const oldOpp of oldOpps) {
        const newOpp = newOppByLegacyId.get(oldOpp.id);
        if (!newOpp) continue;
        const r1 = nameCheckWithFix("project (parent)", oldProjectIdToName.get(oldOpp.project_id) || null, newOpp.project_id, newProjectIdToName, newNameToProjectId, "opportunities", newOpp.id, "project_id");
        const r2 = nameCheckWithFix("customer (grandparent)", oldClientIdToName.get(oldOpp.client_id) || null, newOpp.customer_account_id, newAccountIdToName, newNameToAccountId, "opportunities", newOpp.id, "customer_account_id");
        const checks = [r1.check, r2.check];
        const fixes = [r1.fix, r2.fix].filter(Boolean) as RelFix[];
        const hasWrong = checks.some(c => !c.ok && c.expected !== "(none)");
        const expectedCustomerName = oldClientIdToName.get(oldOpp.client_id) || null;
        relResults.push({ id: `opp-${oldOpp.id}`, status: !expectedCustomerName ? "unmapped" : hasWrong ? "wrong_parent" : checks.every(c => c.ok) ? "ok" : "orphan", label: `${oldOpp.opportunity_code || ""} — ${(oldOpp.notes || "").slice(0, 40)}`, entityType: "Opportunity", checks, fixes });
      }

      // 3) Communications
      for (const oldComm of oldComms) {
        const newComm = newCommByLegacyId.get(oldComm.id);
        if (!newComm) continue;
        const checks: RelationshipRow["checks"] = [];
        const fixes: RelFix[] = [];
        if (oldComm.client_id) {
          const { check, fix } = nameCheckWithFix("account", oldClientIdToName.get(oldComm.client_id) || null, newComm.account_id, newAccountIdToName, newNameToAccountId, "communications", newComm.id, "account_id");
          checks.push(check); if (fix) fixes.push(fix);
        }
        if (oldComm.project_id) {
          const { check, fix } = nameCheckWithFix("project", oldProjectIdToName.get(oldComm.project_id) || null, newComm.project_id, newProjectIdToName, newNameToProjectId, "communications", newComm.id, "project_id");
          checks.push(check); if (fix) fixes.push(fix);
        }
        if (oldComm.opportunity_id) {
          const newOppForComm = newOppByLegacyId.get(oldComm.opportunity_id);
          const expectedNewOppId = newOppForComm?.id || null;
          const actualOppName = newComm.opportunity_id ? (newOppIdToTitle.get(newComm.opportunity_id) || "?") : "";
          const expectedOppName = expectedNewOppId ? (newOppIdToTitle.get(expectedNewOppId) || "?") : "(none)";
          const ok = expectedNewOppId ? newComm.opportunity_id === expectedNewOppId : !newComm.opportunity_id;
          checks.push({ field: "opportunity", expected: expectedOppName, actual: actualOppName || "(none)", ok });
          if (!ok && expectedNewOppId) fixes.push({ table: "communications", recordId: newComm.id, column: "opportunity_id", newValue: expectedNewOppId, label: `opportunity_id → ${expectedOppName}` });
        }
        if (checks.length === 0) continue;
        relResults.push({ id: `comm-${oldComm.id}`, status: checks.some(c => !c.ok) ? "wrong_parent" : "ok", label: `${oldComm.company_name || ""} — ${(oldComm.topic || oldComm.summary || "").slice(0, 40)}`, entityType: "Communication", checks, fixes });
      }

      // 4) Tasks
      for (const oldTask of oldTasks) {
        const newTask = newTaskByLegacyId.get(oldTask.id);
        if (!newTask) continue;
        const checks: RelationshipRow["checks"] = [];
        const fixes: RelFix[] = [];
        if (oldTask.project_id) {
          const { check, fix } = nameCheckWithFix("project", oldProjectIdToName.get(oldTask.project_id) || null, newTask.project_id, newProjectIdToName, newNameToProjectId, "tasks", newTask.id, "project_id");
          checks.push(check); if (fix) fixes.push(fix);
        }
        if (oldTask.opportunity_id) {
          const newOppForTask = newOppByLegacyId.get(oldTask.opportunity_id);
          const expectedNewOppId = newOppForTask?.id || null;
          const actualOppName = newTask.opportunity_id ? (newOppIdToTitle.get(newTask.opportunity_id) || "?") : "";
          const expectedOppName = expectedNewOppId ? (newOppIdToTitle.get(expectedNewOppId) || "?") : "(none)";
          const ok = expectedNewOppId ? newTask.opportunity_id === expectedNewOppId : !newTask.opportunity_id;
          checks.push({ field: "opportunity", expected: expectedOppName, actual: actualOppName || "(none)", ok });
          if (!ok && expectedNewOppId) fixes.push({ table: "tasks", recordId: newTask.id, column: "opportunity_id", newValue: expectedNewOppId, label: `opportunity_id → ${expectedOppName}` });
        }
        if (checks.length === 0) continue;
        relResults.push({ id: `task-${oldTask.id}`, status: checks.some(c => !c.ok) ? "wrong_parent" : "ok", label: `${(oldTask.action || "").slice(0, 50)}`, entityType: "Task", checks, fixes });
      }

      setRelRows(relResults);
    } catch (err) {
      console.error("Failed to load comparison data:", err);
    } finally {
      setLoading(false);
    }
  }

  // ─── Resolve logic ───
  const handleResolve = useCallback((row: RelationshipRow) => {
    setResolvePreview(row.fixes);
  }, []);

  const handleBulkResolve = useCallback((rows: RelationshipRow[]) => {
    const allFixes = rows.flatMap(r => r.fixes);
    if (allFixes.length === 0) return;
    setResolvePreview(allFixes);
  }, []);

  const executeResolve = useCallback(async () => {
    if (!resolvePreview || resolvePreview.length === 0) return;
    setResolving(true);
    try {
      // Group fixes by table
      const byTable = new Map<string, RelFix[]>();
      for (const f of resolvePreview) {
        if (!byTable.has(f.table)) byTable.set(f.table, []);
        byTable.get(f.table)!.push(f);
      }

      let successCount = 0;
      let errorCount = 0;

      for (const [table, fixes] of byTable) {
        for (const fix of fixes) {
          const { error } = await supabase
            .from(table as any)
            .update({ [fix.column]: fix.newValue } as any)
            .eq("id", fix.recordId);
          if (error) {
            console.error(`Fix failed for ${table}.${fix.recordId}:`, error);
            errorCount++;
          } else {
            successCount++;
          }
        }
      }

      if (errorCount === 0) {
        toast.success(`Fixed ${successCount} relationship(s)`);
      } else {
        toast.warning(`Fixed ${successCount}, failed ${errorCount}`);
      }

      setResolvePreview(null);
      loadData(); // reload
    } catch (err: any) {
      toast.error(err.message || "Resolve failed");
    } finally {
      setResolving(false);
    }
  }, [resolvePreview]);

  const applyFilter = (rows: ComparisonRow[]) =>
    filter === "all" ? rows : rows.filter(r => r.status === filter);

  const applyRelFilter = (rows: RelationshipRow[]) =>
    relFilter === "all" ? rows : rows.filter(r => r.status === relFilter);

  const compTabs = [
    { key: "customers", label: "Customers", rows: customerRows, fields: CUSTOMER_FIELDS },
    { key: "projects", label: "Projects", rows: projectRows, fields: PROJECT_FIELDS },
    { key: "opportunities", label: "Opportunities", rows: oppRows, fields: OPP_FIELDS },
    { key: "communications", label: "Communications", rows: commRows, fields: COMM_FIELDS },
    { key: "tasks", label: "Tasks", rows: taskRows, fields: TASK_FIELDS },
  ];

  const relByType = useMemo(() => {
    const map: Record<string, RelationshipRow[]> = {};
    for (const t of REL_ENTITY_TYPES) map[t] = [];
    for (const r of relRows) map[r.entityType]?.push(r);
    return map;
  }, [relRows]);

  const totalRelIssues = relRows.filter(r => r.status !== "ok").length;

  return (
    <AppLayout>
      <div className="px-6 py-6 space-y-5 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <GitCompareArrows className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Migration Comparison</h1>
              <p className="text-sm text-muted-foreground">Old CSV data vs new platform records — field-level diff + relationship audit</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading comparison data...
          </div>
        ) : (
          <Tabs defaultValue="relationships" className="w-full">
            <TabsList>
              <TabsTrigger value="relationships" className="gap-1.5">
                🔗 Relationships
                {totalRelIssues > 0 && <Badge variant="destructive" className="text-xs ml-1">{totalRelIssues}</Badge>}
                {totalRelIssues === 0 && <Badge variant="secondary" className="text-xs ml-1">{relRows.length}</Badge>}
              </TabsTrigger>
              {compTabs.map(t => (
                <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                  {t.label} <Badge variant="secondary" className="text-xs ml-1">{t.rows.length}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Relationship audit — split by entity type */}
            <TabsContent value="relationships" className="mt-4 space-y-3">
              {/* Status filter */}
              <div className="flex gap-1 mb-1">
                {(["all", "ok", "wrong_parent", "orphan", "unmapped"] as const).map(f => (
                  <Button key={f} variant={relFilter === f ? "default" : "ghost"} size="sm" onClick={() => setRelFilter(f)} className="text-xs">
                    {f === "all" ? "All" : f === "ok" ? "✓ Correct" : f === "wrong_parent" ? "✗ Wrong Parent" : f === "orphan" ? "⚠ Orphan" : "? Unmapped"}
                  </Button>
                ))}
              </div>

              {/* Entity type sub-tabs */}
              <Tabs value={relTypeTab} onValueChange={setRelTypeTab}>
                <TabsList>
                  {REL_ENTITY_TYPES.map(t => {
                    const typeRows = relByType[t] || [];
                    const issues = typeRows.filter(r => r.status !== "ok").length;
                    return (
                      <TabsTrigger key={t} value={t} className="gap-1.5 text-xs">
                        {t}s
                        {issues > 0 ? <Badge variant="destructive" className="text-xs ml-1">{issues}</Badge> : <Badge variant="secondary" className="text-xs ml-1">{typeRows.length}</Badge>}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {REL_ENTITY_TYPES.map(t => (
                  <TabsContent key={t} value={t} className="mt-3">
                    <RelationshipTab
                      rows={applyRelFilter(relByType[t] || [])}
                      search={search}
                      onResolve={handleResolve}
                      onBulkResolve={handleBulkResolve}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </TabsContent>

            {compTabs.map(t => (
              <TabsContent key={t.key} value={t.key} className="mt-4">
                <div className="flex gap-1 mb-3">
                  {(["all", "matched", "differs", "missing_new"] as const).map(f => (
                    <Button key={f} variant={filter === f ? "default" : "ghost"} size="sm" onClick={() => setFilter(f)} className="text-xs">
                      {f === "all" ? "All" : f === "matched" ? "✓ Matched" : f === "differs" ? "⚡ Differs" : "✗ Missing"}
                    </Button>
                  ))}
                </div>
                <ComparisonTab rows={applyFilter(t.rows)} fields={t.fields} search={search} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* Resolve preview dialog */}
      <Dialog open={!!resolvePreview} onOpenChange={open => { if (!open) setResolvePreview(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Resolve {resolvePreview?.length || 0} fix(es)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-auto">
            {resolvePreview?.map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                <Badge variant="outline" className="text-xs shrink-0">{f.table}</Badge>
                <span className="font-mono text-xs truncate">{f.recordId.slice(0, 8)}…</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-xs font-medium">{f.label}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolvePreview(null)}>Cancel</Button>
            <Button variant="destructive" onClick={executeResolve} disabled={resolving} className="gap-1.5">
              {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
              Apply {resolvePreview?.length || 0} fix(es)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

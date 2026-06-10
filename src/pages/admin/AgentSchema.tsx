import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Play, Copy, ChevronDown, ChevronRight, Database, Zap, BookOpen, Terminal, Download } from "lucide-react";

/* ── Data hooks ── */
function useAgentActions() {
  return useQuery({
    queryKey: ["agent-actions-dev"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_actions")
        .select("*")
        .eq("status", "active")
        .order("menu_order");
      if (error) throw error;
      return data;
    },
  });
}

function useTableSchemas() {
  return useQuery({
    queryKey: ["agent-table-schema"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_table_schema")
        .select("*")
        .order("table_name");
      if (error) throw error;
      return data;
    },
  });
}

/* ── Intents Tab ── */
function IntentsTab() {
  const { data: actions, isLoading } = useAgentActions();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-3">
      {actions?.map((action) => {
        const mainFields = action.main_fields as any;
        const isOpen = expanded === action.intent_key;
        return (
          <Card key={action.intent_key} className="overflow-hidden">
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : action.intent_key)}
            >
              {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{action.intent_key}</span>
                  <Badge variant="outline" className="text-[10px]">{action.tool_name}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{action.title_en} / {action.title_ar}</p>
              </div>
              <div className="flex gap-1 flex-wrap">
                {(action.tables || []).map((t: string) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                ))}
              </div>
            </div>
            {isOpen && mainFields && (
              <CardContent className="border-t bg-muted/30 space-y-4">
                {mainFields.sections && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sections</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {Object.entries(mainFields.sections).map(([key, val]: [string, any]) => (
                        <div key={key} className="rounded-md border p-2 text-xs">
                          <p className="font-medium">{key}</p>
                          <p className="text-muted-foreground">
                            {val.mode && `mode: ${val.mode}`}
                            {val.required !== undefined && ` • ${val.required ? "required" : "optional"}`}
                            {val.auto_generate && ` • auto: "${val.auto_generate}"`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {mainFields.required_questions?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Required Questions</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Key</TableHead>
                          <TableHead className="text-xs">Path</TableHead>
                          <TableHead className="text-xs">EN</TableHead>
                          <TableHead className="text-xs">AR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mainFields.required_questions.map((q: any) => (
                          <TableRow key={q.key}>
                            <TableCell className="font-mono text-xs">{q.key}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{q.path}</TableCell>
                            <TableCell className="text-xs">{q.q_en}</TableCell>
                            <TableCell className="text-xs" dir="rtl">{q.q_ar}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {mainFields.optional_prompts?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Optional Prompts</h4>
                    {mainFields.optional_prompts.map((p: any) => (
                      <p key={p.key} className="text-xs"><span className="font-mono">{p.key}</span>: {p.q_en} / <span dir="rtl">{p.q_ar}</span></p>
                    ))}
                  </div>
                )}
                {mainFields.business_rules?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Business Rules</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {mainFields.business_rules.map((r: string, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground">{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Examples (EN)</h4>
                    {(action.example_phrases_en || []).map((p: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] mr-1 mb-1">{p}</Badge>
                    ))}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Examples (AR)</h4>
                    {(action.example_phrases_ar || []).map((p: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] mr-1 mb-1" dir="rtl">{p}</Badge>
                    ))}
                  </div>
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Raw main_fields JSON</summary>
                  <pre className="mt-2 p-3 bg-background rounded border overflow-auto max-h-60 text-[11px]">
                    {JSON.stringify(mainFields, null, 2)}
                  </pre>
                </details>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ── Schema Explorer Tab ── */
function SchemaTab() {
  const { data: schemas, isLoading } = useTableSchemas();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-3">
      {schemas?.map((schema) => {
        const isOpen = expanded === schema.table_name;
        const cols = (schema.columns_doc as any[]) || [];
        const rels = (schema.relationships as any[]) || [];
        const hints = (schema.read_hints as string[]) || [];
        return (
          <Card key={schema.table_name} className="overflow-hidden">
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : schema.table_name)}
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Database className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <span className="font-mono text-sm font-semibold">{schema.table_name}</span>
                <p className="text-xs text-muted-foreground">{schema.description_en}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{cols.length} cols</Badge>
            </div>
            {isOpen && (
              <CardContent className="border-t bg-muted/30 space-y-4">
                <p className="text-xs text-muted-foreground" dir="rtl">{schema.description_ar}</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Column</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Required</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs">Enum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cols.map((col: any) => (
                      <TableRow key={col.name}>
                        <TableCell className="font-mono text-xs">{col.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{col.type}</TableCell>
                        <TableCell className="text-xs">{col.required ? "✓" : ""}</TableCell>
                        <TableCell className="text-xs">{col.description}</TableCell>
                        <TableCell className="text-xs">
                          {col.enum_values?.map((v: string) => (
                            <Badge key={v} variant="secondary" className="text-[10px] mr-1">{v}</Badge>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rels.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Relationships</h4>
                    {rels.map((r: any, i: number) => (
                      <p key={i} className="text-xs">
                        → <span className="font-mono">{r.target_table}</span> ({r.cardinality}) via <span className="font-mono">{r.join_key}</span>
                        {r.description && <span className="text-muted-foreground"> — {r.description}</span>}
                      </p>
                    ))}
                  </div>
                )}
                {hints.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Read Hints</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {hints.map((h, i) => <li key={i} className="text-xs text-muted-foreground">{h}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ── Generate Markdown ── */
function generateApiMarkdown(): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "bliiejmmpjpduxrewyev";
  const baseUrl = `https://${projectId}.supabase.co/functions/v1`;

  return `# Scale Agent API Reference

> Auto-generated — ${new Date().toISOString().slice(0, 10)}
> Version: 2026-03-11.v4

## Base URL

\`\`\`
${baseUrl}
\`\`\`

---

## 1. agent-schema (GET)

**Discovery endpoint.** Returns all active intents, table schemas, enum values, smart queries, write contracts, full database schema, coding system reference, and write engine v3 documentation.

\`\`\`bash
curl ${baseUrl}/agent-schema
\`\`\`

---

## 2. agent-read (POST)

**Universal read endpoint** with 3 modes: Direct SQL, Smart Queries, and Table+Filters.

### Mode 1: Direct SQL (Recommended)

Send any SELECT query directly. No row limit. 10-second timeout.

\`\`\`json
{
  "sql": "SELECT a.display_name, COUNT(o.id) as opp_count FROM accounts a LEFT JOIN opportunities o ON o.customer_account_id = a.id WHERE a.status = 'active' GROUP BY a.display_name ORDER BY opp_count DESC"
}
\`\`\`

**Safety rules:**
- Only \`SELECT\` and \`WITH\` (CTE) queries are allowed
- Blocked keywords: \`INSERT\`, \`UPDATE\`, \`DELETE\`, \`DROP\`, \`ALTER\`, \`TRUNCATE\`, \`CREATE\`, \`GRANT\`, \`REVOKE\`, \`EXECUTE\`
- 10-second statement timeout enforced at DB level

---

## 3. Coding System

All entity codes are **auto-generated** by INSERT triggers. They are **read-only**.

| Domain | Format | Example |
|--------|--------|---------|
| Materials | \`MAT.{cat}.{subcat}.{type}{insul}{holes}.{size}\` | \`MAT.BB.01.110.20\` |
| Sales | \`SAL.{cust}_{proj}_{opp}\` | \`SAL.0178_001_001\` |
| Supplier | \`SUP.{region}.{seq}\` | \`SUP.RIY.001\` |

---

## 4. agent-write (POST) — Legacy

**Two-step confirmed write.** Still supported for backward compatibility. See v3 endpoints below.

---

## 5. global-activity (POST) — V3 Write Engine ⭐

**New canonical write endpoint** that mirrors the platform's GlobalActivitySheet exactly.

### Prepare (default action)

Returns structured response with status: \`needs_input\`, \`choose_one\`, \`ready\`, or \`blocked\`.

\`\`\`json
{
  "intent": "log_update_v2",
  "actor_user_id": "uuid",
  "actor_phone": "9665...",
  "opportunity": { "mode": "select", "selectedId": "uuid" },
  "context": { "type": "communication", "channel": "whatsapp", "summary": "Client requested new quote" },
  "actions": [{ "taskType": "send_quote", "dueDate": "2026-03-14T10:00:00Z" }]
}
\`\`\`

**Response statuses:**

| Status | Meaning |
|--------|---------|
| \`needs_input\` | Required info missing. Returns exact \`missing[]\` fields with bilingual labels. |
| \`choose_one\` | Ambiguous input. Returns \`choices[]\` and \`buttons[]\` for disambiguation. |
| \`ready\` | All validated. Returns \`token\`, \`summary\`, \`can_commit: true\`. |
| \`blocked\` | Business rule violation. Returns \`warnings[]\` with clear reason. |

**Entity modes:**
- \`chip\` — resolved, no changes
- \`select\` — pick existing
- \`create\` — new entity form
- \`edit\` — modify existing
- \`default\` — auto "General" project
- \`none\` — hidden

### Commit

\`\`\`json
{ "token": "uuid-from-prepare" }
\`\`\`

---

## 6. resolve-entity (POST)

**Fuzzy entity search** with confidence scoring. Returns exact code matches first.

\`\`\`json
{
  "entity_type": "opportunity",
  "query": "cement block",
  "limit": 5,
  "session_context": { "resolved_customer_id": "uuid" }
}
\`\`\`

**Response:**
\`\`\`json
{
  "matches": [
    { "id": "uuid", "label": "Cement Block Order", "code": "SAL.0178_001_001", "subtitle": "negotiation • active • ABC Corp", "confidence": 0.93 }
  ]
}
\`\`\`
`;
}

/* ── API Reference Tab ── */
function ApiReferenceTab() {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "bliiejmmpjpduxrewyev";
  const baseUrl = `https://${projectId}.supabase.co/functions/v1`;

  const handleDownloadMd = () => {
    const md = generateApiMarkdown();
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scale-agent-api-reference.md";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded API reference");
  };

  const endpoints = [
    {
      name: "agent-schema",
      method: "GET",
      url: `${baseUrl}/agent-schema`,
      description: "Discovery endpoint. Returns intents, schemas, enums, full database schema, coding system, and read modes.",
      example: "curl " + `${baseUrl}/agent-schema`,
    },
    {
      name: "agent-read",
      method: "POST",
      url: `${baseUrl}/agent-read`,
      description: "Universal read endpoint with 3 modes: Direct SQL, Smart Queries, and Table+Filters.",
      examples: [
        {
          label: "Direct SQL (recommended)",
          code: JSON.stringify({
            sql: "SELECT a.display_name, COUNT(o.id) as opp_count FROM accounts a LEFT JOIN opportunities o ON o.customer_account_id = a.id WHERE a.status = 'active' GROUP BY a.display_name ORDER BY opp_count DESC",
          }, null, 2),
        },
        {
          label: "Smart Query",
          code: JSON.stringify({ smart_query: "pipeline_status" }, null, 2),
        },
        {
          label: "Table + Filters (legacy)",
          code: JSON.stringify({
            table: "customer_list_v1",
            columns: "account_id, display_name, primary_contact_phone",
            filters: [{ column: "display_name", operator: "ilike", value: "%cement%" }],
            limit: 10,
          }, null, 2),
        },
      ],
      smartQueries: [
        { query: "customer_summary", description: "Full customer context with projects, opportunities, tasks", requires: "entity_id" },
        { query: "pipeline_status", description: "Active opportunities grouped by stage" },
        { query: "overdue_tasks", description: "Open tasks past due date" },
        { query: "recent_activity", description: "Latest 20 communications" },
        { query: "decode_code", description: "Decode a Scale code (MAT/SAL/SUP) into labelled segments", requires: "entity_id (code string)" },
      ],
      safetyRules: [
        "Only SELECT and WITH (CTE) queries are allowed",
        "Blocked keywords: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE, EXECUTE",
        "Validation at edge function + database function levels",
        "10-second statement timeout at DB level",
        "No artificial row limit — agent controls LIMIT in SQL",
      ],
    },
    {
      name: "agent-write",
      method: "POST",
      url: `${baseUrl}/agent-write`,
      description: "Legacy two-step confirmed write. Still supported. See global-activity for v3.",
      examples: [
        {
          label: "Prepare (legacy)",
          code: JSON.stringify({
            intent: "create_entity_v2",
            step: "prepare",
            customer: { mode: "create", displayName: "Acme Corp", contactPhone: "+966501234567" },
            context: { contextType: "communication", channel: "whatsapp", summary: "New lead from exhibition" },
            actions: [{ taskType: "call_client", dueDate: "2026-03-10T10:00:00Z" }],
          }, null, 2),
        },
      ],
    },
    {
      name: "global-activity",
      method: "POST",
      url: `${baseUrl}/global-activity`,
      description: "V3 Write Engine — mirrors GlobalActivitySheet. Returns structured guidance (needs_input, choose_one, ready, blocked).",
      examples: [
        {
          label: "Prepare — Log update",
          code: JSON.stringify({
            intent: "log_update_v2",
            opportunity: { mode: "select", selectedId: "<opportunity-uuid>" },
            context: { type: "communication", channel: "whatsapp", summary: "Client requested new quotation" },
            actions: [{ taskType: "send_quote", dueDate: new Date(Date.now() + 3 * 86400000).toISOString() }],
          }, null, 2),
        },
        {
          label: "Prepare — Create entity",
          code: JSON.stringify({
            intent: "create_entity_v2",
            customer: { mode: "create", draft: { displayName: "Test Corp", contactPhone: "+966500000000" } },
            project: { mode: "default" },
            opportunity: { mode: "create", draft: { title: "Block supply for villa" } },
            context: { type: "communication", channel: "call", summary: "New lead from call" },
            actions: [{ taskType: "follow_up", dueDate: new Date(Date.now() + 86400000).toISOString() }],
          }, null, 2),
        },
        {
          label: "Commit",
          code: JSON.stringify({ token: "<token-from-prepare>" }, null, 2),
        },
      ],
    },
    {
      name: "resolve-entity",
      method: "POST",
      url: `${baseUrl}/resolve-entity`,
      description: "Fuzzy entity search with confidence scoring. Returns exact code matches first, then fuzzy matches.",
      examples: [
        {
          label: "Search opportunity",
          code: JSON.stringify({
            entity_type: "opportunity",
            query: "cement block",
            limit: 5,
            session_context: { resolved_customer_id: null },
          }, null, 2),
        },
        {
          label: "Search by code",
          code: JSON.stringify({
            entity_type: "customer",
            query: "SAL.0178",
          }, null, 2),
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleDownloadMd} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Download .md
        </Button>
      </div>
      {endpoints.map((ep) => (
        <Card key={ep.name}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge className="text-xs">{ep.method}</Badge>
              <CardTitle className="text-sm font-mono">{ep.name}</CardTitle>
            </div>
            <CardDescription>{ep.description}</CardDescription>
            <p className="text-xs font-mono text-muted-foreground break-all">{ep.url}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Multiple examples */}
            {(ep as any).examples ? (
              <div className="space-y-3">
                {(ep as any).examples.map((ex: any, i: number) => (
                  <div key={i}>
                    <h4 className="text-xs font-semibold mb-1">{ex.label}</h4>
                    <pre className="p-3 bg-muted rounded text-[11px] overflow-auto max-h-40">{ex.code}</pre>
                  </div>
                ))}
              </div>
            ) : (ep as any).example ? (
              <div>
                <h4 className="text-xs font-semibold mb-1">Example</h4>
                <pre className="p-3 bg-muted rounded text-[11px] overflow-auto max-h-40">{(ep as any).example}</pre>
              </div>
            ) : null}

            {/* Safety rules */}
            {(ep as any).safetyRules && (
              <div>
                <h4 className="text-xs font-semibold mb-1">SQL Safety Rules</h4>
                <ul className="list-disc list-inside space-y-1">
                  {(ep as any).safetyRules.map((r: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground">{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Smart queries table */}
            {(ep as any).smartQueries && (
              <div>
                <h4 className="text-xs font-semibold mb-1">Smart Queries</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Query</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs">Requires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ep as any).smartQueries.map((sq: any) => (
                      <TableRow key={sq.query}>
                        <TableCell className="font-mono text-xs">{sq.query}</TableCell>
                        <TableCell className="text-xs">{sq.description}</TableCell>
                        <TableCell className="text-xs">{sq.requires || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Test Console Tab ── */
function TestConsoleTab() {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "bliiejmmpjpduxrewyev";
  const baseUrl = `https://${projectId}.supabase.co/functions/v1`;

  const [endpoint, setEndpoint] = useState("agent-schema");
  const [requestBody, setRequestBody] = useState("");
  const [response, setResponse] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const url = `${baseUrl}/${endpoint}`;
      const isGet = endpoint === "agent-schema";
      const res = await fetch(url, {
        method: isGet ? "GET" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(isGet ? {} : { body: requestBody }),
      });
      return res.json();
    },
    onSuccess: (data) => setResponse(JSON.stringify(data, null, 2)),
    onError: (err) => setResponse(`Error: ${err.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["agent-schema", "agent-read", "agent-write", "global-activity", "resolve-entity"].map((ep) => (
          <Button
            key={ep}
            variant={endpoint === ep ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setEndpoint(ep);
              setResponse("");
              if (ep === "agent-read") {
                setRequestBody(JSON.stringify({ sql: "SELECT id, display_name, code FROM accounts WHERE status = 'active' ORDER BY display_name LIMIT 10" }, null, 2));
              } else if (ep === "agent-write") {
                setRequestBody(JSON.stringify({
                  intent: "create_entity_v2",
                  step: "prepare",
                  customer: { mode: "create", displayName: "Test Corp", contactPhone: "+966500000000" },
                  context: { contextType: "internal_note", channel: "internal", summary: "Test from console" },
                  actions: [{ taskType: "follow_up", dueDate: new Date(Date.now() + 86400000).toISOString() }],
                }, null, 2));
              } else if (ep === "global-activity") {
                setRequestBody(JSON.stringify({
                  intent: "log_update_v2",
                  opportunity: { mode: "select", selectedId: null, draft: { query: "test" } },
                  context: { type: "communication", channel: "whatsapp", summary: "Test update" },
                  actions: [{ taskType: "follow_up", dueDate: new Date(Date.now() + 86400000).toISOString() }],
                }, null, 2));
              } else if (ep === "resolve-entity") {
                setRequestBody(JSON.stringify({
                  entity_type: "customer",
                  query: "test",
                  limit: 5,
                }, null, 2));
              } else {
                setRequestBody("");
              }
            }}
          >
            {ep}
          </Button>
        ))}
      </div>

      {endpoint !== "agent-schema" && (
        <div>
          <label className="text-xs font-semibold">Request Body (JSON)</label>
          <Textarea
            value={requestBody}
            onChange={(e) => setRequestBody(e.target.value)}
            className="font-mono text-xs min-h-[150px]"
          />
        </div>
      )}

      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} size="sm">
        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
        Send Request
      </Button>

      {response && (
        <div className="relative">
          <Button
            variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6"
            onClick={() => { navigator.clipboard.writeText(response); toast.success("Copied"); }}
          >
            <Copy className="h-3 w-3" />
          </Button>
          <ScrollArea className="max-h-[400px]">
            <pre className="p-4 bg-muted rounded text-[11px] overflow-auto">{response}</pre>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function AgentSchema() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Agent API & Schema</h1>
          <p className="text-muted-foreground text-sm">
            Knowledge base for the AI agent — intents, table schemas, API reference, and test console
          </p>
        </div>

        <Tabs defaultValue="intents">
          <TabsList>
            <TabsTrigger value="intents" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Intents
            </TabsTrigger>
            <TabsTrigger value="schema" className="gap-1.5">
              <Database className="h-3.5 w-3.5" /> Schema
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> API Reference
            </TabsTrigger>
            <TabsTrigger value="console" className="gap-1.5">
              <Terminal className="h-3.5 w-3.5" /> Test Console
            </TabsTrigger>
          </TabsList>

          <TabsContent value="intents"><IntentsTab /></TabsContent>
          <TabsContent value="schema"><SchemaTab /></TabsContent>
          <TabsContent value="api"><ApiReferenceTab /></TabsContent>
          <TabsContent value="console"><TestConsoleTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

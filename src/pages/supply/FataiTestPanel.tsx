import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, RefreshCw, CheckCircle2, XCircle, Clock, Eye, MessageSquare, AlertTriangle, Layers } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { PageGuidance } from '@/components/supply/PageGuidance';
import { FATAI_TEST_GUIDANCE } from '@/components/supply/guidance-content';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface OutreachDebugResult {
  success?: boolean;
  wa_message_id?: string | null;
  conversation_id?: string | null;
  action?: string;
  to?: string;
  error?: string;
  status?: number;
  details?: unknown;
  debug?: {
    fatai_request_payload: unknown;
    fatai_response_status: number;
    fatai_response_body: unknown;
    fatai_url: string;
    timestamp: string;
  };
}

interface WebhookLogEntry {
  id: string;
  event_type: string;
  actor_phone: string;
  payload: Record<string, unknown>;
  created_at: string;
  channel: string | null;
  wa_message_id: string | null;
  wa_type: string | null;
}

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  sent: Send,
  delivered: CheckCircle2,
  read: Eye,
  failed: XCircle,
};

export default function FataiTestPanel() {
  const { roles } = useAuth();
  const isAllowed = roles?.includes("admin") || roles?.includes("management");

  if (!isAllowed) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp Test Panel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send WhatsApp test messages via Fatai and monitor incoming webhook events.
        </p>
      </div>
      <PageGuidance {...FATAI_TEST_GUIDANCE} />
      <div className="grid gap-6 lg:grid-cols-2">
        <OutboundTestCard />
        <WebhookMonitorCard />
      </div>
      <CorrelationCard />
    </div>
  );
}

// ─── A. Outbound Send Test ───

function OutboundTestCard() {
  const [phone, setPhone] = useState("");
  const [sendMode, setSendMode] = useState<"text" | "template">("text");
  const [textBody, setTextBody] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("ar");
  const [action, setAction] = useState<string>("validity_confirmation");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<OutreachDebugResult | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);

  const handleSend = async () => {
    if (!phone.trim()) {
      toast.error("Enter a target phone number");
      return;
    }
    setSending(true);
    setResult(null);
    setSentAt(null);
    setRawResponse(null);

    const timestamp = new Date().toISOString();
    setSentAt(timestamp);

    try {
      const payload: Record<string, unknown> = {
        action,
        to: phone.trim(),
        send_mode: sendMode,
        _debug: true,
      };

      if (sendMode === "text") {
        payload.body = textBody || undefined;
      } else {
        payload.template_name = templateName;
        payload.template_language = templateLanguage;
      }

      // Use raw fetch so we can capture non-2xx response bodies
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `https://${projectId}.supabase.co/functions/v1/supply-outreach`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey,
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();
      setRawResponse(responseText);

      let data: OutreachDebugResult;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { success: false, error: `Non-JSON response (HTTP ${res.status}): ${responseText.slice(0, 500)}` };
      }

      setResult(data);
    } catch (e) {
      setResult({
        success: false,
        error: (e as Error).message,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4" /> Outbound Send Test
        </CardTitle>
        <CardDescription>Send a WhatsApp message via Fatai</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Target Phone (E.164)</Label>
          <Input
            placeholder="+966501234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="validity_confirmation">Validity Confirmation</SelectItem>
                <SelectItem value="renegotiation_outreach">Renegotiation Outreach</SelectItem>
                <SelectItem value="follow_up">Follow Up</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Send Mode</Label>
            <Select value={sendMode} onValueChange={(v) => setSendMode(v as "text" | "template")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Plain Text</SelectItem>
                <SelectItem value="template">Template</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {sendMode === "text" ? (
          <div className="space-y-2">
            <Label>Message Body (leave empty for default)</Label>
            <Textarea
              placeholder="Custom message text..."
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              rows={3}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="template_name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Input value={templateLanguage} onChange={(e) => setTemplateLanguage(e.target.value)} />
            </div>
          </div>
        )}

        <Button onClick={handleSend} disabled={sending} className="w-full">
          {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Send Test Message
        </Button>

        {/* Results */}
        {(sentAt || result) && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Result</h4>
              {sentAt && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Sent at:</span>{" "}
                  <span className="font-mono">{sentAt}</span>
                </div>
              )}

              {result && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {result.success ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Success
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" /> Failed
                      </Badge>
                    )}
                    {result.wa_message_id && (
                      <span className="text-xs font-mono text-muted-foreground">
                        wa_message_id: {result.wa_message_id}
                      </span>
                    )}
                    {result.conversation_id && (
                      <span className="text-xs font-mono text-muted-foreground">
                        conv: {result.conversation_id}
                      </span>
                    )}
                  </div>

                  {/* Error details */}
                  {result.error && (
                    <div className="text-xs text-destructive bg-destructive/5 p-2 rounded break-all">
                      <strong>Error:</strong> {result.error}
                    </div>
                  )}
                  {result.details && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground font-medium">Error Details</div>
                      <pre className="text-xs bg-destructive/5 p-2 rounded overflow-auto max-h-32 font-mono">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </div>
                  )}
                  {result.status && !result.success && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Fatai HTTP status:</span>{" "}
                      <Badge variant="destructive" className="text-xs">{result.status}</Badge>
                    </div>
                  )}

                  {/* Debug payload */}
                  {result.debug && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground font-medium">Payload → Fatai</div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 font-mono">
                        {JSON.stringify(result.debug.fatai_request_payload, null, 2)}
                      </pre>
                      <div className="text-xs text-muted-foreground font-medium">
                        Response ← Fatai ({result.debug.fatai_response_status})
                      </div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 font-mono">
                        {JSON.stringify(result.debug.fatai_response_body, null, 2)}
                      </pre>
                      <div className="text-xs text-muted-foreground font-medium">Endpoint URL</div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto font-mono">
                        {result.debug.fatai_url}
                      </pre>
                    </div>
                  )}

                  {/* Raw response fallback */}
                  {!result.debug && rawResponse && (
                    <div>
                      <div className="text-xs text-muted-foreground font-medium">Raw Edge Function Response</div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 font-mono">
                        {rawResponse}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── B. Webhook Event Monitor ───

function WebhookMonitorCard() {
  const [logs, setLogs] = useState<WebhookLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("agent_logs")
        .select("id, event_type, actor_phone, payload, created_at, channel, wa_message_id, wa_type")
        .eq("channel", "supply_webhook")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        toast.error("Failed to fetch webhook logs: " + error.message);
      } else {
        setLogs((data || []) as WebhookLogEntry[]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" /> Webhook Events
            </CardTitle>
            <CardDescription>Recent inbound events from Fatai</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No webhook events received yet.
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {logs.map((log) => (
                <WebhookEventCard key={log.id} log={log} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function WebhookEventCard({ log }: { log: WebhookLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const payload = log.payload || {};
  const fataiEvent = (payload as Record<string, unknown>).event as string || log.wa_type || log.event_type;
  const matched = (payload as Record<string, unknown>)._matched_to as string | undefined;
  const authFailed = (payload as Record<string, unknown>)._auth_failed as boolean | undefined;

  const StatusIcon = STATUS_ICONS[payload.status as string] || Clock;

  return (
    <div className="border border-border/50 rounded-lg p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={fataiEvent === "message_received" || log.wa_type === "inbound" ? "default" : "secondary"} className="text-xs">
            {fataiEvent}
          </Badge>
          {authFailed && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" /> Auth Failed
            </Badge>
          )}
          {matched && (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
              → {matched}
            </Badge>
          )}
          {!matched && !authFailed && (
            <Badge variant="outline" className="text-xs text-muted-foreground">Unmatched</Badge>
          )}
        </div>
        <span className="text-muted-foreground font-mono">
          {new Date(log.created_at).toLocaleString()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-muted-foreground">
        <div>
          <span className="font-medium">From:</span> {log.actor_phone || "–"}
        </div>
        <div>
          <span className="font-medium">wa_msg:</span>{" "}
          <span className="font-mono">{log.wa_message_id || "–"}</span>
        </div>
        <div>
          <span className="font-medium">Status:</span>{" "}
          {(payload as Record<string, unknown>).status ? (
            <span className="inline-flex items-center gap-1">
              <StatusIcon className="h-3 w-3" />
              {(payload as Record<string, unknown>).status as string}
            </span>
          ) : (
            "–"
          )}
        </div>
      </div>

      {(payload as Record<string, unknown>).text && (
        <div className="text-foreground bg-muted/50 p-2 rounded">
          "{((payload as Record<string, unknown>).text as string).slice(0, 200)}"
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-xs h-6 px-2"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "Hide" : "Show"} raw payload
      </Button>

      {expanded && (
        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 font-mono">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── C. Correlation Visibility ───

function CorrelationCard() {
  const [logs, setLogs] = useState<WebhookLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCorrelation = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("agent_logs")
        .select("id, event_type, actor_phone, payload, created_at, channel, wa_message_id, wa_type")
        .eq("channel", "supply_webhook")
        .order("created_at", { ascending: false })
        .limit(50);

      setLogs((data || []) as WebhookLogEntry[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrelation();
  }, []);

  const chains = new Map<string, WebhookLogEntry[]>();
  for (const log of logs) {
    const msgId = log.wa_message_id || "unknown";
    if (!chains.has(msgId)) chains.set(msgId, []);
    chains.get(msgId)!.push(log);
  }

  const knownChains = Array.from(chains.entries()).filter(([k]) => k !== "unknown");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" /> Correlation Tracker
            </CardTitle>
            <CardDescription>
              Message lifecycle: sent → delivered → read → reply received → classified
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCorrelation} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {knownChains.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No correlated message chains yet. Send a test message and wait for status events.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>wa_message_id</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status Flow</TableHead>
                <TableHead>Classification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {knownChains.slice(0, 10).map(([msgId, events]) => {
                const statuses = events
                  .filter((e) => e.wa_type === "status" || ((e.payload as Record<string, unknown>).event === "message_status_updated"))
                  .map((e) => ((e.payload as Record<string, unknown>).data as Record<string, unknown>)?.status as string || (e.payload as Record<string, unknown>).status as string)
                  .filter(Boolean);

                const inbound = events.find((e) => e.wa_type === "inbound" || (e.payload as Record<string, unknown>).event === "message_received");
                const classification = inbound
                  ? ((inbound.payload as Record<string, unknown>)._classification as string) || "unclassified"
                  : null;

                const matched = events.find(
                  (e) => (e.payload as Record<string, unknown>)._matched_to
                );
                const matchTarget = matched
                  ? ((matched.payload as Record<string, unknown>)._matched_to as string)
                  : null;

                return (
                  <TableRow key={msgId}>
                    <TableCell className="font-mono text-xs max-w-[150px] truncate">
                      {msgId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{events.length}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {statuses.length > 0
                          ? statuses.map((s, i) => {
                              const Icon = STATUS_ICONS[s] || Clock;
                              return (
                                <Badge key={i} variant="secondary" className="text-xs gap-1">
                                  <Icon className="h-3 w-3" /> {s}
                                </Badge>
                              );
                            })
                          : <span className="text-muted-foreground text-xs">pending</span>
                        }
                      </div>
                    </TableCell>
                    <TableCell>
                      {classification ? (
                        <Badge
                          className={
                            classification === "no_change"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs"
                              : classification === "changed"
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs"
                              : "text-xs"
                          }
                        >
                          {classification}
                        </Badge>
                      ) : matchTarget ? (
                        <span className="text-xs text-muted-foreground">→ {matchTarget}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">–</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

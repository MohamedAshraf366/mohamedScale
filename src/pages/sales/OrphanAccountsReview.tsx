import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AlertTriangle, Trash2, Save, FlaskConical, Calculator, Truck, UserPlus } from "lucide-react";

/**
 * Internal review page (NOT in nav).
 * Three sections:
 *  1. Unlinked accounts — accounts with no `customers` row, classified as Supplier / Customer / Unclassified
 *  2. Example data — rows whose name contains example/test/مثال/تجربة keywords
 *  3. Dashboard equations — every formula behind the Sales Dashboard, with source tables & filters
 *
 * Routes: /sales/_orphan-review (legacy) and /sales/_review
 */

const EXAMPLE_KEYWORDS = ["example", "test", "demo", "sample", "مثال", "تجربة", "اختبار", "تجريب"];
const containsExample = (s?: string | null) =>
  !!s && EXAMPLE_KEYWORDS.some(k => s.toLowerCase().includes(k.toLowerCase()));

type Classification = "supplier" | "customer" | "unclassified";

export default function OrphanAccountsReview() {
  const queryClient = useQueryClient();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  /* ─────────────────────────── 1. Unlinked accounts ─────────────────────────── */
  const { data: unlinked, isLoading: loadingUnlinked } = useQuery({
    queryKey: ["review-unlinked-accounts"],
    queryFn: async () => {
      const [{ data: live }, { data: customerRows }, { data: supplierRows }] = await Promise.all([
        supabase.from("accounts").select("id, display_name, display_name_ar, code, created_at, status").is("deleted_at", null),
        supabase.from("customers").select("account_id").is("deleted_at", null),
        supabase.from("suppliers").select("account_id"),
      ]);

      const customerIds = new Set((customerRows ?? []).map(c => c.account_id));
      const supplierIds = new Set((supplierRows ?? []).map(s => s.account_id));
      const orphanAccounts = (live ?? []).filter(a => !customerIds.has(a.id));

      // Duplicate detection by display_name
      const nameMap = new Map<string, typeof orphanAccounts>();
      orphanAccounts.forEach(a => {
        const key = (a.display_name || "").trim().toLowerCase();
        if (!key) return;
        if (!nameMap.has(key)) nameMap.set(key, []);
        nameMap.get(key)!.push(a);
      });

      // References
      const orphanIds = orphanAccounts.map(o => o.id);
      const refs = await Promise.all(orphanIds.map(async (id) => {
        const [{ count: oppCount }, { count: commCount }, { count: projCount }, { count: orderCount }] = await Promise.all([
          supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("customer_account_id", id),
          supabase.from("communications").select("id", { count: "exact", head: true }).eq("account_id", id),
          supabase.from("projects").select("id", { count: "exact", head: true }).eq("customer_account_id", id),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_account_id", id),
        ]);
        return { id, opportunities: oppCount ?? 0, communications: commCount ?? 0, projects: projCount ?? 0, orders: orderCount ?? 0 };
      }));
      const refMap = new Map(refs.map(r => [r.id, r]));

      return orphanAccounts.map(a => {
        const key = (a.display_name || "").trim().toLowerCase();
        const orphanDups = (nameMap.get(key) ?? []).filter(x => x.id !== a.id);
        const isSupplier = supplierIds.has(a.id);
        const looksExample = containsExample(a.display_name) || containsExample(a.display_name_ar);
        const classification: Classification = isSupplier ? "supplier" : "unclassified";
        return {
          ...a,
          classification,
          looksExample,
          orphanDuplicates: orphanDups,
          refs: refMap.get(a.id) ?? { opportunities: 0, communications: 0, projects: 0, orders: 0 },
        };
      });
    },
  });

  /* ─────────────────────────── 2. Example data ─────────────────────────── */
  const { data: exampleData, isLoading: loadingExample } = useQuery({
    queryKey: ["review-example-data"],
    queryFn: async () => {
      // Build OR filter for ilike across keywords (PostgREST .or() syntax)
      const accOr = EXAMPLE_KEYWORDS.flatMap(k => [`display_name.ilike.%${k}%`, `display_name_ar.ilike.%${k}%`]).join(",");
      const conOr = EXAMPLE_KEYWORDS.flatMap(k => [`full_name.ilike.%${k}%`, `full_name_ar.ilike.%${k}%`]).join(",");
      const projOr = EXAMPLE_KEYWORDS.flatMap(k => [`name.ilike.%${k}%`, `name_ar.ilike.%${k}%`]).join(",");
      const oppOr = EXAMPLE_KEYWORDS.map(k => `title.ilike.%${k}%`).join(",");

      const [accs, cons, projs, opps] = await Promise.all([
        supabase.from("accounts").select("id, display_name, display_name_ar, created_at").is("deleted_at", null).or(accOr),
        supabase.from("contacts").select("id, full_name, full_name_ar, account_id, created_at").is("deleted_at", null).or(conOr),
        supabase.from("projects").select("id, name, name_ar, customer_account_id, created_at").is("deleted_at", null).or(projOr),
        supabase.from("opportunities").select("id, title, customer_account_id, created_at").is("deleted_at", null).or(oppOr),
      ]);

      return {
        accounts: accs.data ?? [],
        contacts: cons.data ?? [],
        projects: projs.data ?? [],
        opportunities: opps.data ?? [],
      };
    },
  });

  /* ─────────────────────────── Mutations ─────────────────────────── */
  const repairAsCustomer = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase.from("customers").insert({ account_id: accountId, customer_type: "SME" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer record created");
      queryClient.invalidateQueries({ queryKey: ["review-unlinked-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["sales-customers"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to repair"),
  });

  const linkAsSupplier = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase.from("suppliers").insert({ account_id: accountId } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supplier link created");
      queryClient.invalidateQueries({ queryKey: ["review-unlinked-accounts"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to link as supplier"),
  });

  const softDelete = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from("accounts").update({
        deleted_at: new Date().toISOString(),
        deleted_reason: reason || "review_soft_delete",
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account soft-deleted");
      queryClient.invalidateQueries({ queryKey: ["review-unlinked-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["review-example-data"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  /* ─────────────────────────── Buckets ─────────────────────────── */
  const buckets = useMemo(() => {
    const suppliers = (unlinked ?? []).filter(o => o.classification === "supplier");
    const unclassified = (unlinked ?? []).filter(o => o.classification === "unclassified");
    return { suppliers, unclassified };
  }, [unlinked]);

  return (
    <AppLayout>
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
        <div>
          <Badge variant="outline" className="mb-2">Internal · not in nav</Badge>
          <h1 className="text-2xl font-semibold">Sales Data Review</h1>
          <p className="text-sm text-muted-foreground">
            Triage accounts that aren't linked as customers, scrub example/test data, and inspect every Sales Dashboard equation.
          </p>
        </div>

        <Tabs defaultValue="unlinked" className="space-y-4">
          <TabsList>
            <TabsTrigger value="unlinked">
              Unlinked accounts {unlinked && <Badge variant="secondary" className="ml-2">{unlinked.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="example">
              <FlaskConical className="h-3.5 w-3.5 mr-1.5" /> Example data
            </TabsTrigger>
            <TabsTrigger value="equations">
              <Calculator className="h-3.5 w-3.5 mr-1.5" /> Dashboard equations
            </TabsTrigger>
          </TabsList>

          {/* ─────────── UNLINKED ─────────── */}
          <TabsContent value="unlinked" className="space-y-6">
            {loadingUnlinked ? (
              <Skeleton className="h-40 w-full" />
            ) : !unlinked?.length ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">No unlinked accounts. ✨</CardContent></Card>
            ) : (
              <>
                {/* Suppliers section */}
                <section className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold">Linked as Suppliers ({buckets.suppliers.length})</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These accounts are already registered as suppliers. They legitimately have no <code>customers</code> row.
                    Action only needed if you also want to invoice them as a customer.
                  </p>
                  {buckets.suppliers.length === 0 ? (
                    <Card><CardContent className="p-4 text-xs text-muted-foreground">None.</CardContent></Card>
                  ) : (
                    <div className="grid gap-2">
                      {buckets.suppliers.map(o => (
                        <UnlinkedRow
                          key={o.id} row={o} kind="supplier"
                          reason={reasons[o.id] ?? ""}
                          onReason={v => setReasons(s => ({ ...s, [o.id]: v }))}
                          onRepairCustomer={() => repairAsCustomer.mutate(o.id)}
                          onLinkSupplier={() => linkAsSupplier.mutate(o.id)}
                          onDelete={() => softDelete.mutate({ id: o.id, reason: reasons[o.id] || "" })}
                          busy={repairAsCustomer.isPending || softDelete.isPending}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* Unclassified section */}
                <section className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <h2 className="text-sm font-semibold">Unclassified ({buckets.unclassified.length})</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Not linked to any customers or suppliers. Decide: mark as supplier, repair as customer, or soft-delete.
                  </p>
                  {buckets.unclassified.length === 0 ? (
                    <Card><CardContent className="p-4 text-xs text-muted-foreground">None.</CardContent></Card>
                  ) : (
                    <div className="grid gap-2">
                      {buckets.unclassified.map(o => (
                        <UnlinkedRow
                          key={o.id} row={o} kind="unclassified"
                          reason={reasons[o.id] ?? ""}
                          onReason={v => setReasons(s => ({ ...s, [o.id]: v }))}
                          onRepairCustomer={() => repairAsCustomer.mutate(o.id)}
                          onLinkSupplier={() => linkAsSupplier.mutate(o.id)}
                          onDelete={() => softDelete.mutate({ id: o.id, reason: reasons[o.id] || "" })}
                          busy={repairAsCustomer.isPending || linkAsSupplier.isPending || softDelete.isPending}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </TabsContent>

          {/* ─────────── EXAMPLE DATA ─────────── */}
          <TabsContent value="example" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Rows whose name contains: <span className="font-mono">{EXAMPLE_KEYWORDS.join(", ")}</span>
            </p>
            {loadingExample ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="grid gap-3">
                <ExampleSection title="Accounts" rows={exampleData?.accounts ?? []} render={r => r.display_name || r.display_name_ar} onDelete={(id) => softDelete.mutate({ id, reason: "example_data_cleanup" })} canDelete />
                <ExampleSection title="Contacts" rows={exampleData?.contacts ?? []} render={r => r.full_name || r.full_name_ar} />
                <ExampleSection title="Projects" rows={exampleData?.projects ?? []} render={r => r.name || r.name_ar} />
                <ExampleSection title="Opportunities" rows={exampleData?.opportunities ?? []} render={r => r.title} />
              </div>
            )}
          </TabsContent>

          {/* ─────────── EQUATIONS ─────────── */}
          <TabsContent value="equations">
            <DashboardEquations />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

/* ════════════════════════════════════════════════════════════════════════════ */

function UnlinkedRow({ row, kind, reason, onReason, onRepairCustomer, onLinkSupplier, onDelete, busy }: {
  row: any;
  kind: "supplier" | "unclassified";
  reason: string;
  onReason: (v: string) => void;
  onRepairCustomer: () => void;
  onLinkSupplier: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const hasRefs = row.refs.opportunities + row.refs.communications + row.refs.projects + row.refs.orders > 0;
  return (
    <Card className={row.looksExample ? "border-amber-300 dark:border-amber-700" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-sm">{row.display_name || <span className="text-muted-foreground italic">No name</span>}</CardTitle>
            <div className="text-[11px] text-muted-foreground mt-1 font-mono">
              {row.id}{row.code ? ` · ${row.code}` : ""} · {new Date(row.created_at).toLocaleDateString()}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {kind === "supplier" && <Badge className="bg-primary/10 text-primary border-primary/30" variant="outline"><Truck className="h-3 w-3 mr-1" />Supplier</Badge>}
            {row.looksExample && <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400"><FlaskConical className="h-3 w-3 mr-1" />Example?</Badge>}
            {row.orphanDuplicates.length > 0 && <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3 mr-1" />Duplicate ×{row.orphanDuplicates.length}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-[11px] text-muted-foreground">
          References: {row.refs.opportunities} opps · {row.refs.communications} comms · {row.refs.projects} projects · {row.refs.orders} orders
          {hasRefs && <span className="text-amber-600 dark:text-amber-400"> — has data, do not delete</span>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          {kind === "unclassified" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={onLinkSupplier}>
              <Truck className="h-3 w-3 mr-1" /> Mark as Supplier
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={busy} onClick={onRepairCustomer}>
            <UserPlus className="h-3 w-3 mr-1" /> Mark as Customer
          </Button>
          <div className="flex gap-2 flex-1">
            <Input placeholder="Reason for soft delete (optional)" value={reason} onChange={e => onReason(e.target.value)} className="text-xs h-9" />
            <Button size="sm" variant="destructive" disabled={busy || hasRefs} onClick={onDelete}>
              <Trash2 className="h-3 w-3 mr-1" /> Soft delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExampleSection<T extends { id: string; created_at?: string }>({ title, rows, render, onDelete, canDelete }: {
  title: string;
  rows: T[];
  render: (r: T) => string | null | undefined;
  onDelete?: (id: string) => void;
  canDelete?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {title} <Badge variant="secondary">{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">None found.</p>
        ) : (
          <ul className="text-xs space-y-1.5">
            {rows.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5 last:border-0">
                <div className="min-w-0">
                  <div className="font-medium truncate">{render(r) || <span className="italic text-muted-foreground">No name</span>}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{r.id}{r.created_at ? ` · ${new Date(r.created_at).toLocaleDateString()}` : ""}</div>
                </div>
                {canDelete && onDelete && (
                  <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => onDelete(r.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DASHBOARD EQUATIONS — every formula behind useSalesDashboard.ts
   Each metric: plain-English meaning + technical detail.
   ════════════════════════════════════════════════════════════════════════════ */
type Metric = {
  name: string;
  plain: string;        // human-readable explanation
  example?: string;     // worked example
  formula: string;      // technical formula
  sources: string;
  filter: string;
  notes?: string;
};

function DashboardEquations() {
  const groups: Array<{ title: string; intro: string; metrics: Metric[] }> = [
    {
      title: "Clients",
      intro: "How many companies you talked to, how many were new, and how many actually bought.",
      metrics: [
        {
          name: "Engaged Clients",
          plain: "Unique companies your team had at least one logged conversation with during the period (call, WhatsApp, meeting, email, etc.).",
          example: "If you spoke with Acme 5 times and Globex once → counts as 2 engaged clients.",
          formula: "COUNT DISTINCT account_id from communications",
          sources: "communications",
          filter: "occurred_at ∈ [start, end] AND deleted_at IS NULL AND account_id IS NOT NULL",
        },
        {
          name: "New Clients",
          plain: "Engaged clients whose account was created inside the same period — i.e. brand-new logos you started talking to.",
          example: "Acme existed since 2024 → not new. Initech was added on Jan 5 and you talked to them on Jan 6 → new.",
          formula: "COUNT engaged accounts where accounts.created_at ∈ [start, end]",
          sources: "communications + accounts",
          filter: "engaged set ∩ accounts.created_at in range",
        },
        {
          name: "Ordering Clients",
          plain: "Unique companies that produced at least one Won opportunity during the period (i.e. they actually bought).",
          example: "If Acme won 3 deals and Globex won 1 → 2 ordering clients.",
          formula: "COUNT DISTINCT customer_account_id from won opportunities",
          sources: "opportunities",
          filter: "won_at ∈ [start, end] AND deleted_at IS NULL",
        },
        {
          name: "Conversion Rate",
          plain: "Of all engaged clients, what share actually placed an order. Higher = your conversations turn into sales.",
          example: "20 engaged, 5 ordering → 25%.",
          formula: "ordering ÷ engaged",
          sources: "derived",
          filter: "—",
        },
        {
          name: "Retention Rate",
          plain: "Of clients who bought this period, what share were already in your system before the period started — i.e. repeat customers.",
          example: "10 ordering clients, 7 of them existed before period start → 70%.",
          formula: "(ordering clients with accounts.created_at < range.start) ÷ ordering",
          sources: "derived",
          filter: "accounts.created_at < range.start",
        },
        {
          name: "Activation Rate",
          plain: "Of brand-new clients added in the period, what share already converted to a sale within the same period.",
          example: "8 new clients, 2 of them won → 25%.",
          formula: "ordering ÷ new",
          sources: "derived",
          filter: "—",
        },
      ],
    },
    {
      title: "Pipeline",
      intro: "How many deals entered and exited the pipeline, their value, and how fast they move.",
      metrics: [
        {
          name: "Created",
          plain: "Number of opportunities (deals) opened during the period.",
          formula: "COUNT opportunities",
          sources: "opportunities",
          filter: "created_at ∈ [start, end] AND deleted_at IS NULL",
        },
        {
          name: "Created Amount",
          plain: "Total monetary value of deals created — sum of every quotation attached to those deals (any status).",
          example: "Two new deals with quotations of SAR 10k and SAR 25k → SAR 35k created amount.",
          formula: "SUM(quotations.total) where opportunity_id ∈ created opps",
          sources: "quotations",
          filter: "opportunity_id IN created opps (any status)",
        },
        {
          name: "Won",
          plain: "Number of opportunities that reached the Won stage during the period.",
          formula: "COUNT opportunities",
          sources: "opportunities",
          filter: "won_at ∈ [start, end] AND deleted_at IS NULL",
        },
        {
          name: "Won Amount (= Revenue)",
          plain: "Total value of accepted quotations on Won deals — this is your booked revenue.",
          example: "Acme deal won with accepted quote of SAR 50k → adds SAR 50k.",
          formula: "SUM(quotations.total) where status = 'accepted' AND opportunity_id ∈ won opps",
          sources: "quotations",
          filter: "status = 'accepted' AND opportunity_id ∈ won opps",
          notes: "A DB trigger auto-accepts the latest quotation when an opportunity stage changes to Won, so revenue is never lost.",
        },
        {
          name: "Pipeline Conversion",
          plain: "Of every deal opened, what share was eventually won. Higher = healthier pipeline.",
          example: "20 created, 4 won → 20%.",
          formula: "won ÷ created",
          sources: "derived",
          filter: "—",
        },
        {
          name: "Avg Deal Cycle (days)",
          plain: "Average days from opportunity creation to Won — how long it takes to close a deal end-to-end.",
          example: "Three deals closing in 30, 60, 90 days → avg 60 days.",
          formula: "AVG(won_at − created_at) over won opps",
          sources: "opportunities",
          filter: "won opps in range",
        },
        {
          name: "Avg Stage Time (days)",
          plain: "Average time a deal spends in a single stage before moving forward (e.g. RFP → Negotiation).",
          formula: "AVG(time between consecutive stage_change events) per opp",
          sources: "activity_log",
          filter: "entity_type='opportunity' AND action='stage_change' AND created_at ∈ range",
          notes: "Falls back to (Avg Deal Cycle ÷ 4) if no stage-change events exist yet.",
        },
      ],
    },
    {
      title: "Sales",
      intro: "Money in: how much was sold, how big each deal was, and how much each client is worth.",
      metrics: [
        {
          name: "Revenue",
          plain: "Total value of accepted quotations on Won deals — same as Won Amount above.",
          formula: "Same as Won Amount",
          sources: "quotations",
          filter: "accepted ∧ won opp in range",
        },
        {
          name: "Deals",
          plain: "Number of Won opportunities in the period.",
          formula: "COUNT won opps in range",
          sources: "opportunities",
          filter: "won_at ∈ range",
        },
        {
          name: "Avg Sale Size",
          plain: "Average value of one closed deal.",
          example: "SAR 200k revenue across 4 deals → SAR 50k avg sale size.",
          formula: "revenue ÷ deals",
          sources: "derived",
          filter: "—",
        },
        {
          name: "Avg Orders / Client",
          plain: "How many separate deals each ordering client closed on average.",
          example: "8 deals across 4 clients → 2 orders per client.",
          formula: "deals ÷ ordering",
          sources: "derived",
          filter: "—",
        },
        {
          name: "Revenue / Client",
          plain: "Average revenue generated per ordering client — your spend-per-customer.",
          example: "SAR 200k ÷ 4 clients → SAR 50k per client.",
          formula: "revenue ÷ ordering",
          sources: "derived",
          filter: "—",
        },
        {
          name: "Revenue Retention",
          plain: "Of total revenue, what share came from clients you already had before the period started — i.e. recurring/repeat money.",
          example: "SAR 200k revenue, SAR 150k from existing clients → 75%.",
          formula: "revenue from accounts created BEFORE range.start ÷ total revenue",
          sources: "derived",
          filter: "accounts.created_at < range.start",
        },
      ],
    },
    {
      title: "Follow-ups",
      intro: "Whether the team is keeping their commitments to clients on time.",
      metrics: [
        {
          name: "Created",
          plain: "Tasks/follow-ups created in the period.",
          formula: "COUNT tasks",
          sources: "tasks",
          filter: "created_at ∈ range AND deleted_at IS NULL",
        },
        {
          name: "On time",
          plain: "Tasks marked completed/done either before their due date or with no due date set.",
          formula: "COUNT tasks where status ∈ {completed, done} AND (completed_at ≤ due_at OR due_at IS NULL)",
          sources: "tasks",
          filter: "same range",
        },
        {
          name: "Overdue",
          plain: "Tasks still open whose due date has already passed.",
          formula: "COUNT tasks where status ∉ {completed, done} AND due_at < now()",
          sources: "tasks",
          filter: "same range",
        },
      ],
    },
    {
      title: "Funnel",
      intro: "Distribution of opportunities across stages and interest levels — the shape of your pipeline.",
      metrics: [
        {
          name: "Stage counts",
          plain: "How many opportunities sit in each stage (Discovery, RFP, Negotiation, Won, Lost) for deals created in the period.",
          formula: "COUNT opportunities by stage",
          sources: "opportunities",
          filter: "created_at ∈ range AND deleted_at IS NULL",
        },
        {
          name: "Interest counts",
          plain: "How many opportunities are tagged at each interest level (High, Medium, Low, Not interested).",
          formula: "COUNT opportunities by interest_level",
          sources: "opportunities",
          filter: "same range",
        },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Who can see these numbers?</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            <span className="font-medium text-foreground">Every authenticated user</span> can read the source tables behind this dashboard. We verified the
            Row-Level-Security policies on <span className="font-mono">accounts, customers, opportunities, quotations, communications, tasks</span> are all
            <span className="font-mono"> USING (true)</span> for the <span className="font-mono">authenticated</span> role — meaning anyone signed in sees the
            same numbers, regardless of admin status.
          </p>
          <p>
            <span className="font-medium text-foreground">Why we did NOT build a dedicated dashboard view:</span> the equations join across 6 tables with
            range-dependent filters and per-row classification (returning vs new client). A SQL view would either need to recompute on every read (slow)
            or be a materialized view (stale + needs refresh job). The current TanStack-Query hook is fast, cached, and inherits the user's RLS automatically —
            so there is <span className="italic">no account that cannot access it</span> as long as they are signed in.
          </p>
          <p>
            <span className="font-medium text-foreground">One caveat:</span> the <span className="font-mono">activity_log</span> table (used only for "Avg Stage Time")
            is <span className="text-amber-600 dark:text-amber-400">admin-only</span>. Non-admins simply see the fallback value (Avg Deal Cycle ÷ 4) for that
            single metric — every other number is identical for everyone.
          </p>
          <p>• Previous-period comparison uses the same duration immediately before the current range.</p>
          <p>• Numerator / denominator zero → metric shows <span className="font-mono">—</span> (avoids divide-by-zero noise).</p>
          <p>• Source: <span className="font-mono">src/hooks/useSalesDashboard.ts</span></p>
        </CardContent>
      </Card>

      {groups.map(g => (
        <Card key={g.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{g.title}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{g.intro}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {g.metrics.map(m => (
              <div key={m.name} className="border-l-2 border-primary/40 pl-3 py-1">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <h4 className="text-sm font-semibold">{m.name}</h4>
                  <code className="text-[11px] text-muted-foreground font-mono">{m.formula}</code>
                </div>
                <p className="text-xs mt-1">{m.plain}</p>
                {m.example && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    <span className="font-medium not-italic">Example:</span> {m.example}
                  </p>
                )}
                <div className="text-[11px] text-muted-foreground mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
                  <span><span className="font-medium">Source:</span> <span className="font-mono">{m.sources}</span></span>
                  <span><span className="font-medium">Filter:</span> <span className="font-mono">{m.filter}</span></span>
                </div>
                {m.notes && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">⚠ {m.notes}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

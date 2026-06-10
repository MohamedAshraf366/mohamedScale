import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, TrendingUp, Zap, Banknote, Target, Save, ArrowLeft,
  Clock, CheckCircle, AlertTriangle, Info, ChevronDown,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  useKpiTargets, useUpdateKpiTargets,
  computeDerived, DEFAULT_PRIMARY, DEFAULT_OVERRIDES,
  type PrimaryInputs, type AdvancedOverrides,
} from "@/hooks/useKpiTargets";
import { ProtectedRoute } from "@/components/ProtectedRoute";

/* ─── Info Tooltip ─── */
function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3 w-3 text-muted-foreground/40 hover:text-muted-foreground cursor-help inline-block ml-1 shrink-0" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

/* ─── Editable hero metric ─── */
function EditableHero({ label, tip, value, onChange, format: fmt = "number" }: {
  label: string; tip?: string; value: number;
  onChange: (val: number) => void; format?: "number" | "currency";
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-muted/60 dark:bg-muted/35 border border-border/50 p-5 text-center">
      <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground/60 font-medium mb-2">
        {label}{tip && <InfoTip text={tip} />}
      </p>
      <div className="flex justify-center">
        <Input
          type="number"
          step={fmt === "currency" ? "1000" : "1"}
          value={value.toString()}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-10 text-2xl font-black text-center w-36 tabular-nums"
        />
      </div>
      {fmt === "currency" && <p className="text-[10px] text-muted-foreground/50 mt-1">SAR</p>}
    </div>
  );
}

/* ─── Editable small inline metric ─── */
function EditableInline({ label, tip, value, onChange }: {
  label: string; tip?: string; value: number; onChange: (val: number) => void;
}) {
  return (
    <div className="text-center space-y-1">
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground/60 font-semibold">{label}{tip && <InfoTip text={tip} />}</p>
      <Input
        type="number"
        value={value.toString()}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-8 text-lg font-extrabold text-center w-24 mx-auto tabular-nums"
      />
    </div>
  );
}

/* ─── Read-only derived metric row ─── */
function DerivedRow({ label, value, format: fmt = "number", highlighted = false }: {
  label: string; value: number; format?: "number" | "currency" | "percent" | "days" | "decimal"; highlighted?: boolean;
}) {
  let display: string;
  let suffix = "";
  if (fmt === "percent") { display = (value * 100).toFixed(1); suffix = "%"; }
  else if (fmt === "currency") { display = new Intl.NumberFormat("en-SA", { maximumFractionDigits: 0 }).format(value); suffix = "SAR"; }
  else if (fmt === "days") { display = Math.round(value).toString(); suffix = "d"; }
  else if (fmt === "decimal") { display = value.toFixed(1); }
  else { display = Math.round(value).toString(); }

  const inner = (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-xs text-muted-foreground/80 font-medium inline-flex items-center gap-1.5">
        {label}
        <span className="text-[8px] px-1 py-0 h-3.5 inline-flex items-center font-medium text-muted-foreground/40 border border-border/30 rounded-md">auto</span>
      </span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold tabular-nums text-foreground/70">{display}</span>
        {suffix && <span className="text-[10px] text-muted-foreground/40">{suffix}</span>}
      </div>
    </div>
  );

  if (highlighted) {
    return <div className="bg-muted/60 dark:bg-muted/35 border border-border/50 rounded-xl p-3">{inner}</div>;
  }
  return inner;
}

/* ─── Override row (editable) ─── */
function OverrideRow({ label, value, onChange, format: fmt = "number" }: {
  label: string; value: number; onChange: (v: number) => void;
  format?: "number" | "percent" | "days";
}) {
  const displayVal = fmt === "percent" ? (value * 100).toString() : value.toString();
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-xs text-muted-foreground/80 font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          step={fmt === "percent" ? "1" : "1"}
          value={displayVal}
          onChange={(e) => {
            let num = parseFloat(e.target.value) || 0;
            if (fmt === "percent") num = num / 100;
            onChange(num);
          }}
          className="h-7 text-xs font-bold text-right w-24 tabular-nums"
        />
        {fmt === "percent" && <span className="text-[10px] text-muted-foreground/40">%</span>}
        {fmt === "days" && <span className="text-[10px] text-muted-foreground/40">d</span>}
      </div>
    </div>
  );
}

/* ─── Follow-up editable ─── */
function EditableFollowUp({ icon: Icon, label, value, onChange, variant, invert }: {
  icon: React.ElementType; label: string; value: number;
  onChange: (v: number) => void;
  variant: "neutral" | "success" | "danger"; invert?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl p-3 text-center space-y-1.5 border",
      variant === "success" ? "bg-primary/5 border-primary/20" :
      variant === "danger" ? "bg-destructive/5 border-destructive/20" :
      "bg-muted/40 border-border/30"
    )}>
      <Icon className={cn("h-4 w-4 mx-auto",
        variant === "success" ? "text-primary/60" :
        variant === "danger" ? "text-destructive/60" :
        "text-muted-foreground/60"
      )} />
      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60 font-semibold">{label}{invert && " (max)"}</p>
      <Input
        type="number"
        value={value.toString()}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-7 text-sm font-bold text-center w-16 mx-auto tabular-nums"
      />
    </div>
  );
}

/* ─── Section Card ─── */
function SectionCard({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-[3px] rounded-full" />
      <CardHeader className="pb-3 pt-4 px-4 flex flex-row items-center gap-2">
        <Icon className="h-4 w-4 text-primary/60" />
        <CardTitle className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground/60">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">{children}</CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function SalesTargets() {
  const navigate = useNavigate();
  const { data: kpiData, isLoading } = useKpiTargets();
  const { mutate, isPending } = useUpdateKpiTargets();

  // Use loaded data as initial, then track edits in local state
  const [edited, setEdited] = useState<{ primary: PrimaryInputs; overrides: AdvancedOverrides } | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Current values: local edits take priority, then loaded data, then defaults
  const primary = edited?.primary ?? kpiData?._primary ?? DEFAULT_PRIMARY;
  const overrides = edited?.overrides ?? kpiData?._overrides ?? DEFAULT_OVERRIDES;
  const derived = computeDerived(primary, overrides);

  const updatePrimary = (key: keyof PrimaryInputs, val: number) => {
    setEdited((prev) => ({
      primary: { ...(prev?.primary ?? primary), [key]: val },
      overrides: prev?.overrides ?? overrides,
    }));
  };

  const updateOverride = (key: keyof AdvancedOverrides, val: number) => {
    setEdited((prev) => ({
      primary: prev?.primary ?? primary,
      overrides: { ...(prev?.overrides ?? overrides), [key]: val },
    }));
  };

  const handleSave = () => {
    mutate({ primary, overrides }, {
      onSuccess: () => setEdited(null),
    });
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <TooltipProvider delayDuration={200}>
          <div className="space-y-6 p-6">

            {/* ─── Header ─── */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("/sales/dashboard")}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Target className="h-5 w-5 text-primary" />
                  <h1 className="text-xl font-extrabold tracking-tight">KPI Targets</h1>
                </div>
                <p className="text-xs text-muted-foreground/60 font-medium tracking-wide ml-9">
                  Set monthly targets — weekly &amp; yearly are auto-calculated
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1.5 h-7 rounded-lg px-3 text-[11px]"
                onClick={handleSave}
                disabled={isPending || !edited}
              >
                <Save className="h-3 w-3" />
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>

            {/* ─── KPI Grid ─── */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}><CardContent className="p-6 space-y-4">
                    <Skeleton className="h-3 w-20" /><Skeleton className="h-10 w-24 mx-auto" /><Skeleton className="h-16 w-full" />
                  </CardContent></Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                {/* ── CLIENTS ── */}
                <SectionCard icon={Users} title="Clients">
                  <EditableHero label="Ordering Clients" tip="Clients placing orders this month" value={primary.orderingClients} onChange={(v) => updatePrimary("orderingClients", v)} />
                  <div className="flex items-end justify-around pt-1">
                    <EditableInline label="Engaged" tip="Clients with any interaction" value={primary.engagedClients} onChange={(v) => updatePrimary("engagedClients", v)} />
                    <EditableInline label="New" tip="First-time clients" value={primary.newClients} onChange={(v) => updatePrimary("newClients", v)} />
                  </div>
                  <div className="h-px bg-border/30 dark:bg-border/15" />
                  <DerivedRow label="Conversion Rate" value={derived.conversionRate} format="percent" highlighted />
                  <DerivedRow label="Activation Rate" value={derived.activationRate} format="percent" />
                  <OverrideRow label="Retention Rate" value={overrides.retentionRate} onChange={(v) => updateOverride("retentionRate", v)} format="percent" />
                </SectionCard>

                {/* ── PIPELINE ── */}
                <SectionCard icon={TrendingUp} title="Pipeline">
                  <EditableHero label="Won" tip="Won deals this month" value={primary.wonDeals} onChange={(v) => updatePrimary("wonDeals", v)} />
                  <div className="flex items-end justify-around pt-1">
                    <EditableInline label="Created" tip="New opportunities created" value={primary.pipelineCreated} onChange={(v) => updatePrimary("pipelineCreated", v)} />
                  </div>
                  <div className="h-px bg-border/30 dark:bg-border/15" />
                  <DerivedRow label="Pipeline Conv. Rate" value={derived.pipelineConvRate} format="percent" highlighted />
                  <OverrideRow label="Avg. Deal Cycle" value={overrides.avgCycleDays} onChange={(v) => updateOverride("avgCycleDays", v)} format="days" />
                  <DerivedRow label="Avg. Stage Time" value={derived.avgStageTimeDays} format="days" />
                </SectionCard>

                {/* ── SALES ── */}
                <SectionCard icon={Zap} title="Sales">
                  <EditableHero label="Revenue" tip="Total revenue target" value={primary.revenue} onChange={(v) => updatePrimary("revenue", v)} format="currency" />
                  <div className="flex items-end justify-around pt-1">
                    <div className="text-center space-y-1">
                      <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground/60 font-semibold inline-flex items-center gap-1">
                        Deals
                        <span className="text-[8px] px-1 py-0 h-3.5 inline-flex items-center font-medium text-muted-foreground/40 border border-border/30 rounded-md">= Won</span>
                      </span>
                      <p className="text-lg font-extrabold tabular-nums text-foreground/70">{derived.salesCount}</p>
                    </div>
                  </div>
                  <div className="h-px bg-border/30 dark:bg-border/15" />
                  <DerivedRow label="Avg. Sale Size" value={derived.avgSaleSize} format="currency" highlighted />
                  <DerivedRow label="Avg. Orders/Client" value={derived.avgOrdersPerClient} format="decimal" />
                  <DerivedRow label="Revenue/Client" value={derived.revenuePerClient} format="currency" />
                  <OverrideRow label="Revenue Retention" value={overrides.revenueRetentionRate} onChange={(v) => updateOverride("revenueRetentionRate", v)} format="percent" />
                </SectionCard>

                {/* ── COLLECTION (placeholder) ── */}
                <SectionCard icon={Banknote} title="Collection">
                  <div className="flex items-center justify-end -mt-1 -mb-1">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/40 font-bold bg-muted/30 px-2 py-0.5 rounded-md">Coming Soon</span>
                  </div>
                  <div className="rounded-xl bg-muted/30 dark:bg-muted/15 border border-border/20 p-8 text-center">
                    <p className="text-xs text-muted-foreground/40">Collection targets will be available when the Operations module is live.</p>
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ─── Advanced Overrides (Follow-ups) ─── */}
            {!isLoading && (
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground">
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-180")} />
                    Follow-up Targets
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-3">
                    <Card className="lg:col-span-1">
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-3 gap-2.5">
                          <EditableFollowUp icon={Clock} label="Created" value={overrides.followUpsCreated} onChange={(v) => updateOverride("followUpsCreated", v)} variant="neutral" />
                          <EditableFollowUp icon={CheckCircle} label="On-time" value={overrides.followUpsOnTime} onChange={(v) => updateOverride("followUpsOnTime", v)} variant="success" />
                          <EditableFollowUp icon={AlertTriangle} label="Overdue" value={overrides.followUpsOverdue} onChange={(v) => updateOverride("followUpsOverdue", v)} variant="danger" invert />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* ─── Info note ─── */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/20 max-w-xl">
              <Info className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                Only <strong>6 primary metrics</strong> are editable. All other KPIs (marked <span className="text-[8px] px-1 py-0 font-medium text-muted-foreground/40 border border-border/30 rounded-md inline-flex items-center">auto</span>) are derived automatically. Weekly &amp; yearly targets scale from monthly values.
              </p>
            </div>
          </div>
        </TooltipProvider>
      </AppLayout>
    </ProtectedRoute>
  );
}

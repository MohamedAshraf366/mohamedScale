import * as React from "react";
import {
  ArrowUpRight, ArrowDownRight, Minus, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/* ─── Delta Badge ─── */
export function DeltaBadge({ current, previous, invert = false }: {
  current: number | null; previous: number | null; format?: string; invert?: boolean;
}) {
  if (current === null || previous === null || previous === 0) return null;
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  if (!isFinite(delta)) return null;
  const isUp = delta > 0;
  const isGood = invert ? !isUp : isUp;
  const isNeutral = Math.abs(delta) < 0.5;

  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md",
      isNeutral
        ? "text-muted-foreground/70 bg-muted/60"
        : isGood
        ? "text-green-600/80 bg-green-500/8 dark:text-green-400/80 dark:bg-green-500/10"
        : "text-red-600/70 bg-red-500/8 dark:text-red-400/70 dark:bg-red-500/10"
    )}>
      {isNeutral ? <Minus className="h-2.5 w-2.5" /> : isUp ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
      {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

/* ─── Funnel Bar ─── */
export function FunnelBar({ items, prevItems, colors, labels }: {
  items: Record<string, number>; prevItems?: Record<string, number>;
  colors: Record<string, string>; labels: Record<string, string>;
}) {
  const total = Object.values(items).reduce((s, v) => s + v, 0) || 1;
  return (
    <div className="space-y-2.5">
      {Object.entries(items).map(([key, count]) => (
        <div key={key} className="group flex items-center gap-2.5">
          <span className="text-[11px] font-medium text-muted-foreground w-24 text-right shrink-0 truncate">
            {labels[key] || key}
          </span>
          <div className="flex-1 relative">
            <div className="h-6 bg-border/30 rounded overflow-hidden">
              <div
                className={cn("h-full rounded transition-all duration-700 ease-out", colors[key] || "bg-foreground/40")}
                style={{ width: `${Math.max((count / total) * 100, 5)}%` }}
              />
            </div>
            <div className="absolute inset-y-0 left-2 flex items-center">
              <span className="text-[10px] font-semibold text-white drop-shadow-sm">{count}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 w-20 justify-end">
            <span className="text-[10px] text-muted-foreground/70 tabular-nums">{((count / total) * 100).toFixed(0)}%</span>
            {prevItems && <DeltaBadge current={count} previous={prevItems[key] ?? 0} />}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Target Progress ─── */
const sar = (v: number) =>
  new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(v);

export function TargetProgress({ current, target, format: fmt = "number", label, invert = false }: {
  current: number; target: number; format?: "number" | "currency" | "percent" | "days" | "decimal"; label?: string; invert?: boolean;
}) {
  const pctVal = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isGood = invert ? (current <= target) : (target > 0 && current >= target);
  const formatVal = (v: number) => {
    if (fmt === "currency") return sar(v);
    if (fmt === "percent") return `${(v * 100).toFixed(0)}%`;
    if (fmt === "days") return `${Math.round(v)}d`;
    if (fmt === "decimal") return v.toFixed(1);
    return v.toLocaleString();
  };

  return (
    <div className="mt-2.5 space-y-1">
      <div className="flex items-center justify-between text-[10px] gap-3">
        <span className="text-muted-foreground/70 whitespace-nowrap">{label || "Target"}: {formatVal(target)}</span>
        <span className={cn("font-bold tabular-nums whitespace-nowrap", isGood ? "text-primary/70" : "text-muted-foreground/50")}>
          {pctVal.toFixed(0)}%
        </span>
      </div>
      <div className="h-1 w-full bg-border/40 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            isGood ? "bg-primary/70" : pctVal >= 70 ? "bg-primary/50" : pctVal >= 40 ? "bg-primary/30" : "bg-primary/20"
          )}
          style={{ width: `${Math.max(pctVal, 2)}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Info Tooltip ─── */
export type MetricTip =
  | string
  | {
      what: string;       // plain-English meaning (1 sentence)
      formula?: string;   // technical formula
      example?: string;   // worked example
      note?: string;      // caveat / data source
    };

export function InfoTip({ text }: { text: MetricTip }) {
  const obj = typeof text === "string" ? { what: text } : text;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3 w-3 text-muted-foreground/40 hover:text-muted-foreground cursor-help inline-block ml-1 shrink-0" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed space-y-1.5 p-3">
        <p>{obj.what}</p>
        {obj.formula && (
          <p className="font-mono text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 inline-block">
            {obj.formula}
          </p>
        )}
        {obj.example && (
          <p className="text-[11px] text-muted-foreground italic">e.g. {obj.example}</p>
        )}
        {obj.note && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">⚠ {obj.note}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/* ─── Hero Stat (oversized number with glow effect) ─── */
export function HeroStat({ value, label, tip, accentClass, delta, prevValue, compareMode, targetBar, sub }: {
  value: string | number; label: string; tip?: MetricTip; accentClass?: string;
  delta?: React.ReactNode; prevValue?: string | number; compareMode?: boolean; targetBar?: React.ReactNode; sub?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-muted/60 dark:bg-muted/35 border border-border/50 p-5 text-center">
      <div className="relative">
        <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground/60 font-medium mb-2">
          {label}{tip && <InfoTip text={tip} />}
        </p>
        <p className="text-4xl font-black tracking-tight leading-none text-foreground">
          {value}
        </p>
        {sub && <p className="text-sm text-muted-foreground/70 font-semibold mt-1">{sub}</p>}
        {compareMode && prevValue !== undefined && (
          <p className="text-[11px] text-muted-foreground/60 mt-1.5 font-medium">was {prevValue}</p>
        )}
        {delta && <div className="mt-2">{delta}</div>}
        {targetBar}
      </div>
    </div>
  );
}

/* ─── Inline KPI (compact stat) ─── */
export function InlineKpi({ label, value, delta, sub, prevValue, compareMode, tip, targetBar }: {
  label: string; value: string | number; delta?: React.ReactNode; sub?: string;
  prevValue?: string | number; compareMode?: boolean; tip?: MetricTip; targetBar?: React.ReactNode;
}) {
  return (
    <div className="text-center space-y-1">
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground/60 font-semibold">{label}{tip && <InfoTip text={tip} />}</p>
      <p className="text-2xl font-extrabold tracking-tight leading-none">{value}</p>
      {compareMode && prevValue !== undefined && (
        <p className="text-[10px] text-muted-foreground/50 font-medium">was {prevValue}</p>
      )}
      {delta && <div className="mt-0.5">{delta}</div>}
      {sub && <p className="text-[10px] text-muted-foreground/50">{sub}</p>}
      {targetBar}
    </div>
  );
}

/* ─── Row Metric (label — value row) ─── */
export function RowMetric({ label, value, delta, prevValue, compareMode, tip, targetBar }: {
  label: string; value: string; delta?: React.ReactNode; prevValue?: string;
  compareMode?: boolean; tip?: MetricTip; targetBar?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between py-2.5 group">
        <span className="text-xs text-muted-foreground/80 font-medium inline-flex items-center group-hover:text-muted-foreground transition-colors">
          {label}{tip && <InfoTip text={tip} />}
        </span>
        <div className="flex items-center gap-2">
          {compareMode && prevValue !== undefined && (
            <span className="text-[11px] text-muted-foreground/40 font-medium">was {prevValue}</span>
          )}
          {delta}
          <span className="text-base font-bold tabular-nums">{value}</span>
        </div>
      </div>
      {targetBar}
    </div>
  );
}

/* ─── Follow-up Stat ─── */
export function FollowUpStat({ icon: Icon, label, value, variant, prevValue, compareMode, targetBar }: {
  icon: React.ElementType; label: string; value: number; variant: "neutral" | "success" | "danger";
  prevValue?: number; compareMode?: boolean; targetBar?: React.ReactNode;
}) {
  const styles = {
    neutral: "bg-muted/30 border-border/30",
    success: "bg-muted/30 border-primary/20",
    danger: "bg-muted/30 border-destructive/20",
  };
  const iconClr = {
    neutral: "text-muted-foreground/60",
    success: "text-primary/70",
    danger: "text-destructive/70",
  };
  const valClr = {
    neutral: "",
    success: "text-primary",
    danger: "text-destructive",
  };

  return (
    <div className={cn("rounded-xl border p-4 text-center space-y-1 transition-colors", styles[variant])}>
      <Icon className={cn("h-4 w-4 mx-auto", iconClr[variant])} />
      <p className={cn("text-2xl font-extrabold tracking-tight", valClr[variant])}>{value}</p>
      {compareMode && prevValue !== undefined && (
        <p className="text-[11px] text-muted-foreground/50 font-medium">was {prevValue}</p>
      )}
      <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">{label}</p>
      {prevValue !== undefined && (
        <div className="pt-0.5"><DeltaBadge current={value} previous={prevValue} invert={variant === "danger"} /></div>
      )}
      {targetBar}
    </div>
  );
}

/* ─── Section Card wrapper ─── */
export function SectionCard({ children, icon: Icon, title, accentBorder, className }: {
  children: React.ReactNode; icon: React.ElementType; title: string; accentBorder?: string; className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden relative", className)}>
      <div className="absolute left-0 top-4 bottom-4 w-[2px] rounded-full bg-primary/30" />
      <CardHeader className="pb-2 pl-5">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-primary/50" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pl-5 space-y-3 pt-0">{children}</CardContent>
    </Card>
  );
}

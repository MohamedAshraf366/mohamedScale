import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Target,
  Calendar,
  TrendingUp,
  ShoppingCart,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, differenceInDays, formatDistanceToNow } from "date-fns";

/* ─── Stage Badge ────────────────────────────────────────────── */
const STAGE_COLORS: Record<string, string> = {
  discovery: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  rfp: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  negotiation: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  won: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <Badge className={cn("text-xs capitalize", STAGE_COLORS[stage] || STAGE_COLORS.discovery)}>
      {stage}
    </Badge>
  );
}

/* ─── Interest Badge ─────────────────────────────────────────── */
const INTEREST_COLORS: Record<string, string> = {
  High: "border-emerald-500/60 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300",
  Medium: "border-amber-500/60 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300",
  Low: "border-orange-500/60 text-orange-700 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-300",
  "Not interested": "border-rose-500/60 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300",
  // Legacy lowercase fallbacks
  high: "border-emerald-500/60 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300",
  medium: "border-amber-500/60 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300",
  low: "border-orange-500/60 text-orange-700 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-300",
  not_interested: "border-rose-500/60 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300",
};

/** Color class presets for chip-filter usage (active / inactive) */
export const INTEREST_CHIP_COLORS: Record<string, { active: string; inactive: string }> = {
  High: {
    active: "bg-emerald-600 text-white border-emerald-600",
    inactive: "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400",
  },
  Medium: {
    active: "bg-amber-500 text-white border-amber-500",
    inactive: "border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400",
  },
  Low: {
    active: "bg-orange-500 text-white border-orange-500",
    inactive: "border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-400",
  },
  "Not interested": {
    active: "bg-rose-500 text-white border-rose-500",
    inactive: "border-rose-200 text-rose-600 dark:border-rose-800 dark:text-rose-400",
  },
};

export function InterestBadge({ level }: { level: string | null | undefined }) {
  if (!level) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", INTEREST_COLORS[level] || "")}>
      <TrendingUp className="h-3 w-3 mr-1" />
      {level.replace("_", " ")}
    </Badge>
  );
}

/* ─── Activity Dot ───────────────────────────────────────────── */
export function ActivityIndicator({ date }: { date: string | null | undefined }) {
  if (!date) return <span className="text-xs text-muted-foreground">No activity</span>;
  const days = differenceInDays(new Date(), new Date(date));
  const dotColor = days <= 2 ? "bg-green-500" : days <= 4 ? "bg-yellow-500" : "bg-red-500";
  const tooltipText = days <= 2 ? "Active — recent engagement" : days <= 4 ? "Cooling — follow up soon" : "Cold — needs attention";
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default">
            <div className={cn("h-2 w-2 rounded-full shrink-0", dotColor)} />
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(date), { addSuffix: true })}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ─── Order Status Badge ─────────────────────────────────────── */
const ORDER_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  processing: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  delivered: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("text-xs capitalize", ORDER_COLORS[status] || "bg-muted text-muted-foreground")}>
      {status}
    </Badge>
  );
}

/* ─── Date Cell ──────────────────────────────────────────────── */
export function DateCell({ date, icon }: { date: string | null | undefined; icon?: boolean }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      {icon && <Calendar className="h-3 w-3" />}
      {format(new Date(date), "MMM d, yyyy")}
    </span>
  );
}

/* ─── Currency Cell ──────────────────────────────────────────── */
export function CurrencyCell({ value, currency = "SAR" }: { value: number | null | undefined; currency?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-sm font-medium">
      {new Intl.NumberFormat("en-SA", { style: "currency", currency, maximumFractionDigits: 0 }).format(value)}
    </span>
  );
}

/* ─── Code Cell ──────────────────────────────────────────────── */
export function CodeCell({ code }: { code: string | null | undefined }) {
  if (!code) return null;
  return <span className="text-xs font-mono text-muted-foreground">{code}</span>;
}

/* ─── Icon for entity type ───────────────────────────────────── */
export function EntityIcon({ type }: { type: "opportunity" | "order" }) {
  const Icon = type === "opportunity" ? Target : ShoppingCart;
  return <Icon className="h-3.5 w-3.5 text-muted-foreground" />;
}

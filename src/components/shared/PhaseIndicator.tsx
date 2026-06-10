import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Fence,
  Landmark,
  Building,
  Wrench,
  Paintbrush,
  Pause,
  CheckCircle2,
  HardHat,
} from "lucide-react";

export interface PhaseConfig {
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  color: string;
  dotColor: string;
}

export const PHASE_CONFIG: Record<string, PhaseConfig> = {
  "Site Preparation & Fencing": {
    label: "Site Preparation & Fencing",
    shortLabel: "Site Prep",
    icon: Fence,
    color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    dotColor: "bg-amber-500",
  },
  "Foundation Works / Substructure": {
    label: "Foundation Works / Substructure",
    shortLabel: "Foundation",
    icon: Landmark,
    color: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
    dotColor: "bg-orange-500",
  },
  "Skeleton Works / Superstructure": {
    label: "Skeleton Works / Superstructure",
    shortLabel: "Skeleton",
    icon: Building,
    color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    dotColor: "bg-blue-500",
  },
  "Masonry & MEP Works": {
    label: "Masonry & MEP Works",
    shortLabel: "MEP & Masonry",
    icon: Wrench,
    color: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
    dotColor: "bg-purple-500",
  },
  "Finishing Works": {
    label: "Finishing Works",
    shortLabel: "Finishing",
    icon: Paintbrush,
    color: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
    dotColor: "bg-teal-500",
  },
  Paused: {
    label: "Paused",
    shortLabel: "Paused",
    icon: Pause,
    color: "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
    dotColor: "bg-gray-400",
  },
  Completed: {
    label: "Completed",
    shortLabel: "Completed",
    icon: CheckCircle2,
    color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    dotColor: "bg-emerald-500",
  },
};

const FALLBACK: PhaseConfig = {
  label: "Unknown",
  shortLabel: "Unknown",
  icon: HardHat,
  color: "bg-muted text-muted-foreground border-border",
  dotColor: "bg-muted-foreground",
};

interface PhaseIndicatorProps {
  phase: string | null | undefined;
  /** "badge" shows icon + label badge; "dot" shows colored dot + short label; "compact" just dot */
  variant?: "badge" | "dot" | "compact";
  className?: string;
}

export function PhaseIndicator({ phase, variant = "badge", className }: PhaseIndicatorProps) {
  if (!phase) return <span className="text-muted-foreground text-sm">—</span>;

  const config = PHASE_CONFIG[phase] || { ...FALLBACK, label: phase, shortLabel: phase };
  const Icon = config.icon;

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-1.5", className)} title={config.label}>
        <div className={cn("h-2 w-2 rounded-full shrink-0", config.dotColor)} />
      </div>
    );
  }

  if (variant === "dot") {
    return (
      <div className={cn("flex items-center gap-1.5", className)} title={config.label}>
        <div className={cn("h-2 w-2 rounded-full shrink-0", config.dotColor)} />
        <span className="text-xs text-muted-foreground">{config.shortLabel}</span>
      </div>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn("text-xs gap-1 font-medium border", config.color, className)}
    >
      <Icon className="h-3 w-3" />
      {config.shortLabel}
    </Badge>
  );
}

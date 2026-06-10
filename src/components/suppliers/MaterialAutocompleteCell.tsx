/**
 * Phase 2b — in-cell material autocomplete using Radix Popover so the
 * dropdown is portaled out of the scrolling table (fixes clipping).
 * Auto-resolves UoM/MOQ inheritance on pick.
 *
 * Reused in:
 *   • supplier quote entry (no status badges)
 *   • sales QuotationBuilder (showStatus + zoneCode → per-hit chips)
 */

import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  searchMaterials,
  fetchMaterialStatuses,
  type SearchMaterialHit,
  type MaterialStatus,
} from "@/lib/searchMaterials";
import { resolveMaterialDefaults } from "@/lib/resolveMaterialDefaults";
import type { PickedMaterial } from "@/components/shared/MaterialStepPicker";

interface Props {
  placeholder?: string;
  initialQuery?: string;
  autoFocus?: boolean;
  onPick: (material: PickedMaterial) => void;
  onOpenCatalog?: () => void;
  onCellKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** When true, show per-hit supplier / delivery / target-price status chips. */
  showStatus?: boolean;
  /** Required for delivery-zone status check when showStatus is true. */
  zoneCode?: string | null;
}

export function MaterialAutocompleteCell({
  initialQuery = "",
  placeholder = "Type to search materials…",
  autoFocus = false,
  onPick,
  onOpenCatalog,
  onCellKeyDown,
  showStatus = false,
  zoneCode = null,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<SearchMaterialHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, MaterialStatus>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      setStatuses({});
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchMaterials(query, { limit: 8 });
      setHits(results);
      setActiveIdx(0);
      setOpen(true);
      setLoading(false);
      if (showStatus && results.length > 0) {
        const ids = results.map((r) => r.material_id);
        fetchMaterialStatuses(ids, zoneCode)
          .then(setStatuses)
          .catch(() => setStatuses({}));
      } else {
        setStatuses({});
      }
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, showStatus, zoneCode]);

  const choose = useCallback(
    async (hit: SearchMaterialHit) => {
      // Resolve real UoM/MOQ via subcategory/category inheritance —
      // materials.uom and materials.default_moq are force-NULLed by trigger.
      const defaults = await resolveMaterialDefaults(hit.material_id);
      onPick({
        id: hit.material_id,
        name: hit.display_en || hit.code || "Material",
        code: hit.code,
        uom: defaults.uom,
        moq: defaults.moq,
      });
      setQuery("");
      setHits([]);
      setOpen(false);
    },
    [onPick],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (open && hits.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, hits.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter")     { e.preventDefault(); choose(hits[activeIdx]); return; }
      if (e.key === "Escape")    { e.preventDefault(); setOpen(false); return; }
    }
    onCellKeyDown?.(e);
  };

  return (
    <Popover open={open && (hits.length > 0 || loading)} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="flex items-center gap-1">
          <Input
            autoFocus={autoFocus}
            value={query}
            placeholder={placeholder}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => hits.length > 0 && setOpen(true)}
            onKeyDown={handleKeyDown}
            className="h-8 text-sm"
            dir="auto"
          />
          {onOpenCatalog && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={onOpenCatalog}
              title="Open full catalog"
            >
              <Search className="h-3 w-3" />
            </Button>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[28rem] max-w-[80vw] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {loading && hits.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Searching…
          </div>
        ) : (
          <TooltipProvider delayDuration={200}>
            <ul className="max-h-72 overflow-y-auto py-1">
              {hits.map((hit, idx) => {
                const st = statuses[hit.material_id];
                return (
                  <li
                    key={hit.material_id}
                    onMouseDown={(e) => { e.preventDefault(); choose(hit); }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={cn(
                      "cursor-pointer px-3 py-2 text-xs",
                      idx === activeIdx ? "bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium leading-tight" dir="auto">
                        {hit.display_en || hit.code}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {showStatus && st && (
                          <StatusChips status={st} zoneCode={zoneCode} />
                        )}
                        {hit.code && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {hit.code}
                          </span>
                        )}
                      </div>
                    </div>
                    {hit.display_ar && (
                      <div className="text-[11px] text-muted-foreground leading-tight" dir="rtl">
                        {hit.display_ar}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </TooltipProvider>
        )}
      </PopoverContent>
    </Popover>
  );
}

function StatusChips({
  status,
  zoneCode,
}: {
  status: MaterialStatus;
  zoneCode: string | null | undefined;
}) {
  const chips: Array<{ color: string; label: string; tip: string }> = [];
  if (!status.hasSupplier) {
    chips.push({
      color: "bg-destructive",
      label: "no supplier",
      tip: "No approved supplier for this material.",
    });
  } else if (zoneCode && !status.hasDeliveryInZone) {
    chips.push({
      color: "bg-amber-500",
      label: "no delivery",
      tip: "Has supplier but no delivery rate in this zone.",
    });
  } else {
    chips.push({
      color: "bg-emerald-500",
      label: "ready",
      tip: zoneCode ? "Supplier available and delivers to this zone." : "Approved supplier available.",
    });
  }
  if (status.hasTargetPrice) {
    chips.push({
      color: "bg-slate-400",
      label: "target",
      tip: "Has a target price defined by Supply.",
    });
  }
  return (
    <span className="flex items-center gap-1">
      {chips.map((c, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-0.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", c.color)} />
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                {c.label}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            {c.tip}
          </TooltipContent>
        </Tooltip>
      ))}
    </span>
  );
}

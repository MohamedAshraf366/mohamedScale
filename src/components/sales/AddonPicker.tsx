import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, PenLine, Search } from "lucide-react";
import { useAddonDefinitions, type AddonDefinition } from "@/hooks/useAddonDefinitions";

export interface AddonPick {
  custom: true;
  definition?: undefined;
}
export interface AddonRegistryPick {
  custom?: false;
  definition: AddonDefinition;
}
export type AddonSelection = AddonPick | AddonRegistryPick;

interface Props {
  /** When set, picker shows item-level scope (definitions matching material → subcategory → global). */
  parentMaterialId?: string | null;
  /** Subcategory of the parent line, used to surface subcategory-scoped defs. */
  parentSubcategoryId?: string | null;
  /** When true, only global-scope definitions are surfaced (quotation-level add-on). */
  globalOnly?: boolean;
  trigger: React.ReactNode;
  onSelect: (sel: AddonSelection) => void;
}

export function AddonPicker({
  parentMaterialId,
  parentSubcategoryId,
  globalOnly,
  trigger,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: defs, isLoading } = useAddonDefinitions();

  const filtered = useMemo(() => {
    const all = defs ?? [];
    const matchedScope = all.filter((d) => {
      if (globalOnly) return d.scope === "global";
      if (d.scope === "global") return true;
      if (d.scope === "subcategory") return parentSubcategoryId && d.subcategory_id === parentSubcategoryId;
      if (d.scope === "material") return parentMaterialId && d.material_id === parentMaterialId;
      return false;
    });
    if (!q.trim()) return matchedScope;
    const s = q.trim().toLowerCase();
    return matchedScope.filter(
      (d) => d.name.toLowerCase().includes(s) || (d.name_ar ?? "").toLowerCase().includes(s),
    );
  }, [defs, q, globalOnly, parentMaterialId, parentSubcategoryId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search add-ons…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {isLoading ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                No registry add-ons match. Use a custom one below.
              </div>
            ) : (
              filtered.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-accent flex items-start justify-between gap-2"
                  onClick={() => {
                    onSelect({ definition: d });
                    setOpen(false);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{d.name}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <span>{d.default_uom}</span>
                      {d.default_price != null && (
                        <>
                          <span>·</span>
                          <span className="tabular-nums">{Number(d.default_price).toFixed(2)} SAR</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                    {d.scope}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
        <div className="p-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs border-dashed"
            onClick={() => {
              onSelect({ custom: true });
              setOpen(false);
            }}
          >
            <PenLine className="h-3 w-3 mr-1" />
            Custom add-on
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const AddonPickerPlusIcon = Plus;

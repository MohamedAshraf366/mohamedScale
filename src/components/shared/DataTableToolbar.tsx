import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Search, Settings2, X, Filter, ArrowUpDown, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

/* ─── Public types ──────────────────────────────────── */

export interface ColumnDef {
  id: string;
  label: string;
  defaultVisible: boolean;
  sortable?: boolean;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterColumnDef {
  id: string;
  label: string;
  type?: "select" | "text";
  options?: FilterOption[];
}

/** @deprecated Use FilterColumnDef + smartFilters instead */
export interface FilterDef {
  id: string;
  label: string;
  options: FilterOption[];
}

export interface SmartFilterRule {
  id: string;
  column: string;
  value: string;
}

export interface SortOption {
  column: string;
  direction: "asc" | "desc";
}

export interface ChipFilterItem {
  value: string;
  label: string;
  count?: number;
  activeClass?: string;
  inactiveClass?: string;
  dimmed?: boolean;
}

export interface ChipFilterGroup {
  id: string;
  label: string;
  items: ChipFilterItem[];
  active: Set<string>;
  onToggle: (value: string) => void;
}

export interface QuickFilterOption {
  value: string;
  label: string;
  count?: number;
  active?: boolean;
}

/* ─── Props ─────────────────────────────────────────── */

interface DataTableToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  columns?: ColumnDef[];
  visibleColumns?: string[];
  onToggleColumn?: (columnId: string) => void;

  /** Smart filter columns (Supabase-style) */
  filterColumns?: FilterColumnDef[];
  activeSmartFilters?: SmartFilterRule[];
  onSmartFiltersChange?: (filters: SmartFilterRule[]) => void;

  /** @deprecated Use filterColumns + activeSmartFilters instead */
  filters?: FilterDef[];
  /** @deprecated */
  activeFilters?: Record<string, string>;
  /** @deprecated */
  onFilterChange?: (filterId: string, value: string) => void;

  chipGroups?: ChipFilterGroup[];

  quickFilters?: QuickFilterOption[];
  onQuickFilterChange?: (value: string) => void;

  sortOptions?: { value: string; label: string }[];
  activeSort?: SortOption | null;
  defaultSort?: SortOption | null;
  onSortChange?: (sort: SortOption | null) => void;

  extraActions?: React.ReactNode;

  onClear?: () => void;
  clearLabel?: string;
}

/* ─── Sub-components ────────────────────────────────── */

let _filterId = 0;
function nextFilterId() { return `sf_${++_filterId}`; }

function SmartFilterPopover({
  filterColumns,
  activeFilters,
  onAdd,
}: {
  filterColumns: FilterColumnDef[];
  activeFilters: SmartFilterRule[];
  onAdd: (rule: SmartFilterRule) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedCol, setSelectedCol] = useState("");
  const [selectedVal, setSelectedVal] = useState("");

  const colDef = filterColumns.find((c) => c.id === selectedCol);

  const handleAdd = () => {
    if (!selectedCol || !selectedVal) return;
    onAdd({ id: nextFilterId(), column: selectedCol, value: selectedVal });
    setSelectedCol("");
    setSelectedVal("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs",
                activeFilters.length > 0 && "border-primary/50 text-primary",
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
              {activeFilters.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom"><p>Add filter rules</p></TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Add a filter</p>
        <div className="flex flex-col gap-2">
          <Select value={selectedCol} onValueChange={(v) => { setSelectedCol(v); setSelectedVal(""); }}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Column" />
            </SelectTrigger>
            <SelectContent>
              {filterColumns.map((col) => (
                <SelectItem key={col.id} value={col.id}>{col.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {colDef && colDef.options && colDef.options.length > 0 ? (
            <Select value={selectedVal} onValueChange={setSelectedVal}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Value" />
              </SelectTrigger>
              <SelectContent>
                {colDef.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : colDef ? (
            <Input
              className="h-8 text-xs"
              placeholder="Enter value..."
              value={selectedVal}
              onChange={(e) => setSelectedVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          ) : null}

          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleAdd}
            disabled={!selectedCol || !selectedVal}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Filter
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ActiveFilterBadges({
  filters,
  filterColumns,
  onRemove,
}: {
  filters: SmartFilterRule[];
  filterColumns: FilterColumnDef[];
  onRemove: (id: string) => void;
}) {
  if (filters.length === 0) return null;
  return (
    <>
      {filters.map((f) => {
        const colDef = filterColumns.find((c) => c.id === f.column);
        const valLabel = colDef?.options?.find((o) => o.value === f.value)?.label || f.value;
        return (
          <Badge
            key={f.id}
            variant="secondary"
            className="h-6 gap-1 pl-2 pr-1 text-xs font-normal"
          >
            <span className="text-muted-foreground">{colDef?.label || f.column}:</span>
            <span>{valLabel}</span>
            <button
              onClick={() => onRemove(f.id)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}
    </>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex-1 max-w-sm min-w-[180px]">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 pl-9 pr-8 text-sm"
      />
      {value && (
        <button
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => onChange("")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function ColumnToggle({
  columns,
  visibleColumns,
  onToggleColumn,
}: {
  columns: ColumnDef[];
  visibleColumns: string[];
  onToggleColumn: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs">
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              Columns
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom"><p>Show/hide table columns</p></TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.id}
            checked={visibleColumns.includes(col.id)}
            onCheckedChange={() => onToggleColumn(col.id)}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Main Component ────────────────────────────────── */

export function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  columns,
  visibleColumns,
  onToggleColumn,
  filterColumns,
  activeSmartFilters,
  onSmartFiltersChange,
  filters,
  activeFilters,
  onFilterChange,
  chipGroups,
  quickFilters,
  onQuickFilterChange,
  sortOptions,
  activeSort,
  defaultSort,
  onSortChange,
  extraActions,
  onClear,
  clearLabel = "Clear",
}: DataTableToolbarProps) {
  const hasSelectableColumns = Boolean(columns?.length && visibleColumns && onToggleColumn);

  // Smart filter helpers
  const smartFilters = activeSmartFilters ?? [];
  const hasSmartFilters = smartFilters.length > 0;
  const useSmartFilterMode = Boolean(filterColumns && filterColumns.length > 0);

  // Legacy filter check
  const hasActiveDropdownFilters = Object.values(activeFilters ?? {}).some((v) => v !== "all");
  const hasActiveChips = chipGroups?.some((g) => g.active.size > 0) ?? false;
  const hasCustomSort = Boolean(
    activeSort && defaultSort &&
      (activeSort.column !== defaultSort.column || activeSort.direction !== defaultSort.direction),
  );
  const showClear = Boolean(searchValue || hasActiveDropdownFilters || hasActiveChips || hasCustomSort || hasSmartFilters);

  const handleClear = () => {
    if (onClear) { onClear(); return; }
    onSearchChange("");
    onSmartFiltersChange?.([]);
    filters?.forEach((f) => onFilterChange?.(f.id, "all"));
    if (defaultSort && onSortChange) onSortChange(defaultSort);
  };

  const addSmartFilter = useCallback((rule: SmartFilterRule) => {
    onSmartFiltersChange?.([...smartFilters, rule]);
  }, [smartFilters, onSmartFiltersChange]);

  const removeSmartFilter = useCallback((id: string) => {
    onSmartFiltersChange?.(smartFilters.filter((f) => f.id !== id));
  }, [smartFilters, onSmartFiltersChange]);

  const hasQuickFilters = quickFilters && quickFilters.length > 0;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-2 w-full">
        {/* ── Row 1: Quick filter chips (only if provided) ── */}
        {hasQuickFilters && (
          <div className="flex items-center gap-1.5">
            {quickFilters!.map((filter) => (
              <Tooltip key={filter.value}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant={filter.active ? "secondary" : "ghost"}
                    className={cn(
                      "h-7 rounded-md px-2.5 text-xs font-medium",
                      filter.active && "shadow-sm bg-secondary",
                    )}
                    onClick={() => onQuickFilterChange?.(filter.value)}
                  >
                    <span>{filter.label}</span>
                    {typeof filter.count === "number" && (
                      <span className={cn(
                        "ml-1.5 tabular-nums",
                        filter.active ? "text-foreground" : "text-muted-foreground",
                      )}>{filter.count}</span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Show {filter.label.toLowerCase()} items</p></TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        {/* ── Row 2: Search + Smart Filter + Chips + Sort + Actions ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <SearchInput value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} />

          {/* Chip groups (Pipeline-style) */}
          {chipGroups && chipGroups.length > 0 && (
            <>
              <div className="mx-0.5 h-5 w-px bg-border" />
              {chipGroups.map((group, gi) => (
                <div key={group.id} className="contents">
                  {gi > 0 && <div className="mx-0.5 h-5 w-px bg-border" />}
                  <span className="mr-0.5 text-xs font-medium text-muted-foreground">{group.label}</span>
                  {group.items.map((item) => {
                    const isActive = group.active.has(item.value);
                    return (
                      <Tooltip key={item.value}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => group.onToggle(item.value)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-all",
                              isActive
                                ? item.activeClass ?? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : item.dimmed
                                  ? item.inactiveClass ?? "border-border/50 bg-background text-muted-foreground/50 hover:border-foreground/20 hover:text-foreground"
                                  : item.inactiveClass ?? "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                            )}
                          >
                            <span>{item.label}</span>
                            {typeof item.count === "number" && (
                              <span className={cn(
                                "rounded px-1 py-px text-[10px] font-semibold",
                                isActive ? "bg-white/20 text-inherit" : "bg-muted text-muted-foreground",
                              )}>
                                {item.count}
                              </span>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>{isActive ? "Remove" : "Filter by"} {item.label}{typeof item.count === "number" ? ` (${item.count})` : ""}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {/* Separator before filter/sort area */}
          <div className="mx-0.5 h-5 w-px bg-border" />

          {/* Smart Filter button (Supabase-style) */}
          {useSmartFilterMode && filterColumns && (
            <SmartFilterPopover
              filterColumns={filterColumns}
              activeFilters={smartFilters}
              onAdd={addSmartFilter}
            />
          )}

          {/* Legacy dropdown filters (fallback) */}
          {!useSmartFilterMode && filters?.map((filter) => (
            <Tooltip key={filter.id}>
              <TooltipTrigger asChild>
                <div>
                  <Select
                    value={activeFilters?.[filter.id] || "all"}
                    onValueChange={(value) => onFilterChange?.(filter.id, value)}
                  >
                    <SelectTrigger className="h-8 w-auto min-w-[100px] bg-card text-xs">
                      <SelectValue placeholder={filter.label} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All {filter.label}</SelectItem>
                      {filter.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Filter by {filter.label.toLowerCase()}</p></TooltipContent>
            </Tooltip>
          ))}

          {/* Active smart filter badges */}
          {useSmartFilterMode && filterColumns && (
            <ActiveFilterBadges
              filters={smartFilters}
              filterColumns={filterColumns}
              onRemove={removeSmartFilter}
            />
          )}

          {/* Sort controls - visually differentiated with icon */}
          {sortOptions && sortOptions.length > 0 && (
            <>
              <div className="mx-0.5 h-5 w-px bg-border" />
              <div className="flex items-center gap-1">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <Select
                  value={activeSort?.column ?? ""}
                  onValueChange={(value) => {
                    onSortChange?.({
                      column: value,
                      direction: activeSort?.direction ?? defaultSort?.direction ?? "asc",
                    });
                  }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectTrigger className="h-8 w-auto min-w-[100px] border-dashed text-xs">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Sort column</p></TooltipContent>
                  </Tooltip>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        const col = activeSort?.column ?? defaultSort?.column;
                        if (!col) return;
                        const newDir = (activeSort?.direction ?? defaultSort?.direction ?? "asc") === "asc" ? "desc" : "asc";
                        onSortChange?.({ column: col, direction: newDir });
                      }}
                    >
                      {(activeSort?.direction ?? defaultSort?.direction ?? "asc") === "asc"
                        ? <ArrowUp className="h-3.5 w-3.5" />
                        : <ArrowDown className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{(activeSort?.direction ?? "asc") === "asc" ? "Ascending" : "Descending"} — click to toggle</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </>
          )}

          {/* Extra actions */}
          {extraActions}

          {/* Clear */}
          {showClear && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={handleClear}>
                  <X className="h-3 w-3" />
                  {clearLabel}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Reset all filters and sorting</p></TooltipContent>
            </Tooltip>
          )}

          {/* Column visibility - pushed to the right */}
          {hasSelectableColumns && columns && visibleColumns && onToggleColumn && (
            <div className="ml-auto">
              <ColumnToggle columns={columns} visibleColumns={visibleColumns} onToggleColumn={onToggleColumn} />
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

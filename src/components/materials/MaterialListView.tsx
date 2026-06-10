import { useState, useMemo, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTableToolbar, type FilterColumnDef, type SmartFilterRule, type SortOption } from '@/components/shared/DataTableToolbar';
import type { MaterialGroup } from './MaterialCard';
import type { SpecDefinition } from './SpecFilterBar';
import { Star, Trash2, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveUom } from '@/lib/resolve-inherited';

/** Flat variant row — one per DB row */
export interface FlatVariant {
  id: string;
  material_no: number;
  variant_no: number;
  name: string;
  code: string | null;
  size_cm: string | null;
  uom: string | null;
  subcategory_default_uom: string | null;
  category_default_uom: string | null;
  specs: Record<string, unknown>;
  is_core: boolean;
  market_price_min_sar: number | null;
  market_price_max_sar: number | null;
}

interface MaterialListViewProps {
  materials: MaterialGroup[];
  specDefinitions: SpecDefinition[];
  variantAxis?: { key: string; label: string } | null;
  onDeleteVariant?: (variantId: string, variantName: string) => void; 
  onToggleCoreVariant?: (variantId: string, isCore: boolean) => void;
  onBulkVariantAction?: (variantIds: string[], action: 'delete' | 'core' | 'uncore') => void;
  onSelectMaterial?: (material: MaterialGroup) => void;
  groupByAxes?: string[];
  onGroupByChange?: (axes: string[]) => void;
}

function getSpecLabel(specDefs: SpecDefinition[], key: string, value: unknown): string {
  const def = specDefs.find((d) => d.key === key);
  if (!def) return String(value);
  const opt = def.options.find((o) => o.value === String(value));
  return opt?.label_en || String(value);
}

/* ─── Recursive nested group structure ─── */
interface GroupNode {
  label: string;
  axisKey: string;
  axisValue: string;
  items: FlatVariant[];
  children: GroupNode[];
}

function buildNestedGroups(
  items: FlatVariant[],
  axes: string[],
  specDefs: SpecDefinition[],
  variantAxis?: { key: string; label: string } | null,
  depth: number = 0,
): GroupNode[] {
  if (depth >= axes.length) return [];
  const axisKey = axes[depth];
  const buckets = new Map<string, FlatVariant[]>();
  for (const v of items) {
    let val: string;
    if (variantAxis && axisKey === variantAxis.key) {
      val = v.size_cm ? `${v.size_cm} cm` : String(v.variant_no);
    } else {
      val = String(v.specs[axisKey] ?? 'Unknown');
    }
    if (!buckets.has(val)) buckets.set(val, []);
    buckets.get(val)!.push(v);
  }
  const groups: GroupNode[] = [];
  for (const [val, groupItems] of buckets) {
    const label = (variantAxis && axisKey === variantAxis.key)
      ? val
      : getSpecLabel(specDefs, axisKey, val);
    groups.push({
      label,
      axisKey,
      axisValue: val,
      items: groupItems,
      children: buildNestedGroups(groupItems, axes, specDefs, variantAxis, depth + 1),
    });
  }
  return groups;
}

function getAllIds(group: GroupNode): string[] {
  return group.items.map((v) => v.id);
}

/* ─── Group row component (recursive) ─── */
function GroupRow({
  group,
  depth,
  selected,
  onToggleGroup,
  specDefinitions,
  colSpan,
  renderRow,
}: {
  group: GroupNode;
  depth: number;
  selected: Set<string>;
  onToggleGroup: (ids: string[]) => void;
  specDefinitions: SpecDefinition[];
  colSpan: number;
  renderRow: (v: FlatVariant) => React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const allIds = getAllIds(group);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = allIds.some((id) => selected.has(id)) && !allSelected;
  const hasChildren = group.children.length > 0;

  return (
    <>
      <tr
        className="bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer border-t border-border/50"
        onClick={() => setOpen(!open)}
      >
        <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={allSelected}
            // @ts-ignore - indeterminate support
            indeterminate={someSelected}
            onCheckedChange={() => onToggleGroup(allIds)}
            className="h-3.5 w-3.5"
          />
        </td>
        <td colSpan={colSpan - 1} className="px-3 py-1.5">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 16}px` }}>
            {open ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm font-medium">{group.label}</span>
            <Badge variant="secondary" className="text-[10px] h-4">
              {allIds.length}
            </Badge>
          </div>
        </td>
      </tr>
      {open && (
        hasChildren
          ? group.children.map((child) => (
              <GroupRow
                key={`${child.axisKey}:${child.axisValue}`}
                group={child}
                depth={depth + 1}
                selected={selected}
                onToggleGroup={onToggleGroup}
                specDefinitions={specDefinitions}
                colSpan={colSpan}
                renderRow={renderRow}
              />
            ))
          : group.items.map(renderRow)
      )}
    </>
  );
}

export function MaterialListView({
  materials,
  specDefinitions,
  variantAxis,
  onDeleteVariant,
  onToggleCoreVariant,
  onBulkVariantAction,
  onSelectMaterial,
  groupByAxes = [],
  onGroupByChange,
}: MaterialListViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [smartFilters, setSmartFilters] = useState<SmartFilterRule[]>([]);
  const [activeSort, setActiveSort] = useState<SortOption | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  // حساب عدد المواد المحذوفة
  const deletedCount = useMemo(() => {
    let count = 0;
    for (const mg of materials) {
      if (mg.status === 'deleted') count++;
      for (const v of mg.variants) {
        if (v.status === 'deleted') count++;
      }
    }
    return count;
  }, [materials]);

  // Flat variants مع دعم showDeleted
  const flatVariants = useMemo(() => {
    const result: FlatVariant[] = [];
    for (const mg of materials) {
      if (!showDeleted && mg.status === 'deleted') continue;
      
      for (const v of mg.variants) {
        if (!showDeleted && v.status === 'deleted') continue;
        
        result.push({
          id: v.id,
          material_no: mg.material_no,
          variant_no: v.variant_no,
          name: v.name || mg.name,
          code: v.code,
          size_cm: v.size_cm,
          uom: v.uom,
          subcategory_default_uom: mg.subcategory_default_uom ?? null,
          category_default_uom: mg.category_default_uom ?? null,
          specs: mg.specs,
          is_core: v.is_core === true,
          market_price_min_sar: v.market_price_min_sar,
          market_price_max_sar: v.market_price_max_sar,
        });
      }
    }
    return result;
  }, [materials, showDeleted]);

  // Reverse map: variant id → parent MaterialGroup
  const variantToGroup = useMemo(() => {
    const map = new Map<string, MaterialGroup>();
    for (const mg of materials) {
      for (const v of mg.variants) {
        map.set(v.id, mg);
      }
    }
    return map;
  }, [materials]);

  const filterColumns: FilterColumnDef[] = useMemo(() => {
    const cols: FilterColumnDef[] = specDefinitions.map((spec) => ({
      id: spec.key,
      label: spec.label_en,
      type: 'select' as const,
      options: spec.options.map((o) => ({ value: o.value, label: o.label_en })),
    }));
    if (variantAxis) {
      const sizeOptions = [...new Set(flatVariants.map((v) => v.size_cm).filter(Boolean))].sort();
      cols.push({
        id: variantAxis.key,
        label: variantAxis.label,
        type: 'select',
        options: sizeOptions.map((s) => ({ value: s!, label: `${s} cm` })),
      });
    }
    cols.push({
      id: 'is_core',
      label: 'Core',
      type: 'select',
      options: [
        { value: 'true', label: 'Core' },
        { value: 'false', label: 'Non-Core' },
      ],
    });
    return cols;
  }, [specDefinitions, variantAxis, flatVariants]);

  const sortOptions = useMemo(() => [
    { value: 'name', label: 'Name' },
    { value: 'material_no', label: 'Material #' },
    { value: 'size', label: 'Size' },
  ], []);

  const filteredVariants = useMemo(() => {
    let list = flatVariants;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((v) =>
        v.name.toLowerCase().includes(q) ||
        (v.code && v.code.toLowerCase().includes(q))
      );
    }
    for (const filter of smartFilters) {
      if (filter.column === 'is_core') {
        const wantCore = filter.value === 'true';
        list = list.filter((v) => v.is_core === wantCore);
      } else if (variantAxis && filter.column === variantAxis.key) {
        list = list.filter((v) => v.size_cm === filter.value);
      } else {
        list = list.filter((v) => String(v.specs[filter.column]) === filter.value);
      }
    }
    if (activeSort) {
      list = [...list].sort((a, b) => {
        let cmp = 0;
        if (activeSort.column === 'name') cmp = a.name.localeCompare(b.name);
        else if (activeSort.column === 'material_no') cmp = a.material_no - b.material_no;
        else if (activeSort.column === 'size') cmp = (parseFloat(a.size_cm || '0') || 0) - (parseFloat(b.size_cm || '0') || 0);
        return activeSort.direction === 'desc' ? -cmp : cmp;
      });
    }
    return list;
  }, [flatVariants, searchQuery, smartFilters, activeSort, variantAxis]);

  const nestedGroups = useMemo(() => {
    if (groupByAxes.length === 0) return null;
    return buildNestedGroups(filteredVariants, groupByAxes, specDefinitions, variantAxis);
  }, [filteredVariants, groupByAxes, specDefinitions, variantAxis]);

  const toggleAll = () => {
    if (selected.size === filteredVariants.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredVariants.map((v) => v.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectedArray = Array.from(selected);
  const hasSelection = selectedArray.length > 0;

  const handleClear = useCallback(() => {
    setSearchQuery('');
    setSmartFilters([]);
    setActiveSort(null);
  }, []);

  const toggleGroupAxis = (key: string) => {
    if (!onGroupByChange) return;
    const current = groupByAxes || [];
    if (current.includes(key)) {
      onGroupByChange(current.filter((k) => k !== key));
    } else {
      onGroupByChange([...current, key]);
    }
  };

  const allGroupAxes = useMemo(() => {
    const result = specDefinitions.map((s) => ({ key: s.key, label: s.label_en }));
    if (variantAxis) result.push({ key: variantAxis.key, label: variantAxis.label });
    return result;
  }, [specDefinitions, variantAxis]);

  const groupBySelector = allGroupAxes.length > 0 ? (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Group:</span>
      <Button
        variant={groupByAxes.length === 0 ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 text-xs px-2"
        onClick={() => onGroupByChange?.([])}
      >
        None
      </Button>
      {allGroupAxes.map((axis) => (
        <Button
          key={axis.key}
          variant={groupByAxes.includes(axis.key) ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 text-xs px-2"
          onClick={() => toggleGroupAxis(axis.key)}
        >
          {axis.label}
          {groupByAxes.includes(axis.key) && (
            <Badge variant="outline" className="ml-1 text-[9px] h-3.5 px-1">
              {groupByAxes.indexOf(axis.key) + 1}
            </Badge>
          )}
        </Button>
      ))}
    </div>
  ) : null;

  // Column count for colSpan
  const colCount = 6;

  const renderRow = (v: FlatVariant) => {
    const isChecked = selected.has(v.id);
    const indent = groupByAxes.length > 0 ? groupByAxes.length * 16 : 0;
    const parentGroup = variantToGroup.get(v.id);

    return (
      <tr
        key={v.id}
        className={cn(
          'border-t border-border/50 transition-colors hover:bg-muted/30 cursor-pointer',
          isChecked && 'bg-primary/5'
        )}
        onClick={() => parentGroup && onSelectMaterial?.(parentGroup)}
      >
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isChecked}
            onCheckedChange={() => toggleOne(v.id)}
            className="h-3.5 w-3.5"
          />
        </td>
        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
          {v.code}
        </td>
        <td
          className="px-3 py-2 font-medium max-w-[240px] truncate"
          title={v.name}
          style={indent > 0 ? { paddingLeft: `${indent + 12}px` } : undefined}
        >
          {v.name}
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">
          {resolveUom(
            { uom: v.uom },
            { default_uom: v.subcategory_default_uom },
            { default_uom: v.category_default_uom },
          ).uom}
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onToggleCoreVariant?.(v.id, !v.is_core)}
            className="p-1 hover:scale-110 transition-transform"
          >
            <Star className={cn(
              'h-4 w-4 transition-colors',
              v.is_core ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30 hover:text-amber-400'
            )} />
          </button>
        </td>
        <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
            onClick={() => onDeleteVariant?.(v.id, v.name)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-3">
      <DataTableToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search materials..."
        filterColumns={filterColumns}
        activeSmartFilters={smartFilters}
        onSmartFiltersChange={setSmartFilters}
        sortOptions={sortOptions}
        activeSort={activeSort}
        defaultSort={null}
        onSortChange={setActiveSort}
        extraActions={groupBySelector}
        onClear={handleClear}
      />

      {/* Bulk Actions with Show Deleted button */}
      {hasSelection && onBulkVariantAction && (
        <div className="flex items-center justify-between gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {selectedArray.length} selected
            </Badge>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onBulkVariantAction(selectedArray, 'core')}>
              <Star className="h-3 w-3" /> Mark Core
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => onBulkVariantAction(selectedArray, 'uncore')}>
              <Star className="h-3 w-3" /> Remove Core
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => onBulkVariantAction(selectedArray, 'delete')}>
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          </div>
          
          {/* Show/Hide Deleted button */}
          <Button
            size="sm"
            variant={showDeleted ? "default" : "ghost"}
            className="h-7 text-xs gap-1"
            onClick={() => setShowDeleted(!showDeleted)}
          >
            <Trash2 className="h-3 w-3" />
            {showDeleted ? "Hide Deleted" : "Show Deleted"}
            {!showDeleted && deletedCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-[9px] h-3.5 px-1">
                {deletedCount}
              </Badge>
            )}
          </Button>
        </div>
      )}

      {/* Show Deleted button when no selection (standalone) */}
      {!hasSelection && deletedCount > 0 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant={showDeleted ? "default" : "ghost"}
            className="h-7 text-xs gap-1"
            onClick={() => setShowDeleted(!showDeleted)}
          >
            <Trash2 className="h-3 w-3" />
            {showDeleted ? "Hide Deleted" : "Show Deleted"}
            <Badge variant="destructive" className="ml-1 text-[9px] h-3.5 px-1">
              {deletedCount}
            </Badge>
          </Button>
        </div>
      )}

      {filteredVariants.length > 0 ? (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={selected.size === filteredVariants.length && filteredVariants.length > 0}
                    onCheckedChange={toggleAll}
                    className="h-3.5 w-3.5"
                  />
                </th>
                <th className="text-left px-3 py-2 font-medium">Code</th>
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">UoM</th>
                <th className="text-left px-3 py-2 font-medium w-12">Core</th>
                <th className="w-16 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {nestedGroups
                ? nestedGroups.map((group) => (
                    <GroupRow
                      key={`${group.axisKey}:${group.axisValue}`}
                      group={group}
                      depth={0}
                      selected={selected}
                      onToggleGroup={toggleGroup}
                      specDefinitions={specDefinitions}
                      colSpan={colCount}
                      renderRow={renderRow}
                    />
                  ))
                : filteredVariants.map(renderRow)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No materials match the current filters</p>
        </div>
      )}
    </div>
  );
}
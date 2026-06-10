import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseSpecsFromCode } from '@/lib/coding-system';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, ChevronRight, Package, Settings2, Grid3X3, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSubcategoryAreas } from '@/hooks/useSubcategoryAreas';
import { useCreateUnlockCycle } from '@/hooks/useUnlockCycles';
import { SubcategoryAreasSheet } from '@/components/materials/SubcategoryAreasSheet';
import { useSupplyDomainsBySubcategory } from '@/hooks/useSupplyDomains';
import type { SpecDefinition } from '@/components/materials/SpecFilterBar';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CategoryOption {
  id: string;
  name_en: string;
}

interface SubcategoryOption {
  id: string;
  name_en: string;
  category_id: string;
  spec_definitions: SpecDefinition[];
  domain_axis: string | null;
}

export function ScopeSelectorSheet({ open, onOpenChange }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [manageAreasOpen, setManageAreasOpen] = useState(false);

  const createMut = useCreateUnlockCycle();

  const { data: categories } = useQuery({
    queryKey: ['cycle-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_categories')
        .select('id, name_en')
        .eq('status', 'active')
        .order('name_en');
      if (error) throw error;
      return (data || []) as CategoryOption[];
    },
  });

  const { data: subcategories } = useQuery({
    queryKey: ['cycle-subcategories', selectedCategoryId],
    enabled: !!selectedCategoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_subcategories')
        .select('id, name_en, category_id, spec_definitions, domain_axis')
        .eq('category_id', selectedCategoryId)
        .eq('status', 'active')
        .order('name_en');
      if (error) throw error;
      return (data || []).map(d => ({
        ...d,
        spec_definitions: Array.isArray(d.spec_definitions)
          ? (d.spec_definitions as unknown as SpecDefinition[])
          : [],
        domain_axis: (d as any).domain_axis || null,
      })) as SubcategoryOption[];
    },
  });

  const selectedSubcategory = subcategories?.find(s => s.id === selectedSubcategoryId);
  const specDefs = selectedSubcategory?.spec_definitions || [];
  const domainAxis = selectedSubcategory?.domain_axis || null;

  const { data: areas } = useSubcategoryAreas(selectedSubcategoryId || null);
  const { data: domains } = useSupplyDomainsBySubcategory(selectedSubcategoryId || null);

  const activeDomains = useMemo(() => (domains || []).filter(d => d.status === 'active'), [domains]);
  const hasDomains = activeDomains.length > 0;

  const domainAxisSpec = useMemo(() => {
    if (!domainAxis) return null;
    return specDefs.find(s => s.key === domainAxis) || null;
  }, [domainAxis, specDefs]);

  const domainMatrix = useMemo(() => {
    if (!areas || !domains) return [];
    const axisValues = domainAxisSpec
      ? domainAxisSpec.options.map(o => o.value)
      : [null];

    return axisValues.map(axisVal => ({
      axisValue: axisVal,
      label: axisVal
        ? (domainAxisSpec?.options.find(o => o.value === axisVal)?.label_en || axisVal)
        : selectedSubcategory?.name_en || 'All',
      cells: areas.map(area => {
        const domain = domains.find(d =>
          d.area_id === area.id &&
          (axisVal === null ? d.axis_value === null : d.axis_value === axisVal)
        );
        return { area, domain };
      }),
    }));
  }, [areas, domains, domainAxisSpec, selectedSubcategory]);

  // Auto-select all active domains when they load
  useEffect(() => {
    if (activeDomains.length > 0) {
      setSelectedDomainIds(activeDomains.map(d => d.id));
    } else {
      setSelectedDomainIds([]);
    }
  }, [activeDomains]);

  // Resolve matching materials based on selected domains
  const { data: resolvedMaterials } = useQuery({
    queryKey: ['cycle-resolved-materials', selectedSubcategoryId, selectedDomainIds, domains],
    enabled: !!selectedSubcategoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, code')
        .eq('subcategory_id', selectedSubcategoryId)
        .eq('status', 'active')
        .order('name');
      if (error) throw error;

      const allMats = data || [];

      // Filter by selected domain axis values if axis-based.
      // Specs are derived from the code (single source of truth).
      if (hasDomains && domainAxis) {
        const selectedDomains = activeDomains.filter(d => selectedDomainIds.includes(d.id));
        const selectedAxisValues = new Set(selectedDomains.map(d => d.axis_value).filter(Boolean));
        if (selectedAxisValues.size > 0) {
          return allMats.filter(mat => {
            const specs = parseSpecsFromCode(mat.code, selectedSubcategory as any);
            return selectedAxisValues.has(specs[domainAxis] || '');
          });
        }
      }

      return allMats;
    },
  });

  const handleCategoryChange = (id: string) => {
    setSelectedCategoryId(id);
    setSelectedSubcategoryId('');
    setSelectedDomainIds([]);
  };

  const handleSubcategoryChange = (id: string) => {
    setSelectedSubcategoryId(id);
    setSelectedDomainIds([]);
  };

  // Derive areas and zones from selected domains
  const selectedAreas = useMemo(() => {
    if (!areas || !hasDomains) return [];
    const selectedDomains = activeDomains.filter(d => selectedDomainIds.includes(d.id));
    const domainAreaIds = new Set(selectedDomains.map(d => d.area_id));
    return areas.filter(a => domainAreaIds.has(a.id));
  }, [areas, activeDomains, selectedDomainIds, hasDomains]);

  const allZoneCodes = useMemo(() => {
    return [...new Set(selectedAreas.flatMap(a => a.zone_codes))];
  }, [selectedAreas]);

  const areaZoneMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    selectedAreas.forEach(a => { map[a.id] = a.zone_codes; });
    return map;
  }, [selectedAreas]);

  const toggleDomainId = (id: string) => {
    setSelectedDomainIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const allDomainsSelected = activeDomains.length > 0 && selectedDomainIds.length === activeDomains.length;

  const canCreate = !!(name && selectedSubcategoryId && hasDomains && selectedDomainIds.length > 0 && resolvedMaterials?.length && allZoneCodes.length);

  const handleSubmit = () => {
    if (!canCreate) return;

    createMut.mutate(
      {
        name,
        description,
        start_date: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
        end_date: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
        subcategory_id: selectedSubcategoryId,
        zone_codes: allZoneCodes,
        zone_group_ids: [],
        material_ids: resolvedMaterials!.map(m => m.id),
        area_zone_map: areaZoneMap,
        domain_ids: selectedDomainIds,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      }
    );
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedCategoryId('');
    setSelectedSubcategoryId('');
    setSelectedDomainIds([]);
  };

  const categoryName = categories?.find(c => c.id === selectedCategoryId)?.name_en;
  const subcategoryName = selectedSubcategory?.name_en;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full flex flex-col">
        <SheetHeader>
          <SheetTitle>New Supply Cycle</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Cycle Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q2 Riyadh Cement Blocks" />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'dd MMM yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'dd MMM yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Separator />

            {/* Material Scope */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Material Scope</Label>

              {/* Category */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={selectedCategoryId} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories || []).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subcategory */}
              {selectedCategoryId && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Subcategory</Label>
                  <Select value={selectedSubcategoryId} onValueChange={handleSubcategoryChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subcategory…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(subcategories || []).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name_en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* No domains warning */}
              {selectedSubcategoryId && !hasDomains && (
                <div className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30 text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                  <div className="text-xs space-y-1">
                    <p className="font-medium text-foreground">No domains defined</p>
                    <p>Please configure domain grouping and areas in the Material Registry first.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 mt-1"
                      onClick={() => setManageAreasOpen(true)}
                    >
                      <Settings2 className="h-3 w-3" /> Manage Areas
                    </Button>
                  </div>
                </div>
              )}

              {/* Domain selector matrix */}
              {selectedSubcategoryId && hasDomains && (
                <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium">Select Domains</span>
                    {domainAxis && domainAxisSpec && (
                      <Badge variant="outline" className="text-[10px]">
                        Grouped by {domainAxisSpec.label_en}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      checked={!!allDomainsSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedDomainIds(activeDomains.map(d => d.id));
                        } else {
                          setSelectedDomainIds([]);
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground">Select all domains</span>
                  </div>

                  {areas && areas.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">
                              {domainAxisSpec ? domainAxisSpec.label_en : 'Group'}
                            </th>
                            {areas.map(area => (
                              <th key={area.id} className="text-center py-1.5 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: area.color }} />
                                  <span className="font-medium">{area.name}</span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {domainMatrix.map(row => (
                            <tr key={row.axisValue ?? '__all__'} className="border-b last:border-0">
                              <td className="py-2 pr-3 font-medium">{row.label}</td>
                              {row.cells.map(cell => (
                                <td key={cell.area.id} className="text-center py-2 px-2">
                                  {cell.domain ? (
                                    <Checkbox
                                      checked={selectedDomainIds.includes(cell.domain.id)}
                                      onCheckedChange={() => toggleDomainId(cell.domain!.id)}
                                      disabled={cell.domain.status !== 'active'}
                                    />
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground">
                    {selectedDomainIds.length} of {activeDomains.length} domain(s) selected
                  </p>
                </div>
              )}

              {/* Resolved materials summary */}
              {selectedSubcategoryId && (
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{resolvedMaterials?.length || 0}</span>
                  <span className="text-muted-foreground">material(s) in scope</span>
                  {categoryName && subcategoryName && (
                    <Badge variant="secondary" className="text-xs">
                      {categoryName} <ChevronRight className="h-3 w-3 inline mx-0.5" /> {subcategoryName}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Scope Summary */}
            {selectedSubcategoryId && hasDomains && (
              <div className="space-y-2">
                <Label>Scope Summary</Label>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>{selectedDomainIds.length} domain(s) · {selectedAreas.length} area(s) · {allZoneCodes.length} zone(s)</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setManageAreasOpen(true)}
                  >
                    <Settings2 className="h-3 w-3" /> Manage Areas
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t">
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!canCreate || createMut.isPending}
          >
            {createMut.isPending
              ? 'Creating…'
              : `Create Cycle (${selectedDomainIds.length} domains · ${resolvedMaterials?.length || 0} materials × ${allZoneCodes.length} zones)`
            }
          </Button>
        </div>
      </SheetContent>

      {selectedSubcategoryId && selectedSubcategory && (
        <SubcategoryAreasSheet
          open={manageAreasOpen}
          onOpenChange={setManageAreasOpen}
          subcategoryId={selectedSubcategoryId}
          subcategoryName={selectedSubcategory.name_en}
        />
      )}
    </Sheet>
  );
}

import { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Eye, Lock, Unlock, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import type { Json } from '@/integrations/supabase/types';
import type { InheritableDefaults } from '@/hooks/useMaterialsRegistry';

// ── Types ──────────────────────────────────────────

interface SpecOption {
  value: string;
  label_en: string;
  label_ar: string;
  code_digit: string;
}

interface SpecDraft {
  key: string;
  label_en: string;
  label_ar: string;
  options: SpecOption[];
}

interface AddSubcategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryCode2: string;
  categoryName: string;
  categoryDefaults: InheritableDefaults;
  onCreated: (id: string) => void;
}

// ── UOM options ──────────────────────────────────

const UOM_OPTIONS = [
  { value: 'unit', label: 'Unit' },
  { value: 'piece', label: 'Piece' },
  { value: 'm3', label: 'm³' },
  { value: 'ton', label: 'Ton' },
  { value: 'kg', label: 'kg' },
  { value: 'm2', label: 'm²' },
  { value: 'm', label: 'm' },
];

function uomLabel(val: string | null) {
  return UOM_OPTIONS.find((o) => o.value === val)?.label ?? val ?? '—';
}

// ── Helpers ────────────────────────────────────────

function autoKey(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function nextDigit(existingOptions: SpecOption[]): string {
  const used = new Set(existingOptions.map((o) => o.code_digit));
  for (let i = 1; i <= 9; i++) {
    if (!used.has(String(i))) return String(i);
  }
  return String(existingOptions.length + 1);
}

function nextVariantNo(existingOptions: string[]): string {
  return String(existingOptions.length + 1).padStart(2, '0');
}

// ── Inherited Field Component ──────────────────────

function InheritedField({
  label,
  inheritedValue,
  inheritedDisplay,
  overriding,
  children,
}: {
  label: string;
  inheritedValue: string | number | null;
  inheritedDisplay?: string;
  overriding: boolean;
  children: React.ReactNode;
}) {
  const display = inheritedDisplay ?? (inheritedValue != null ? String(inheritedValue) : '—');
  if (!overriding) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-muted-foreground" />
          {label}
        </Label>
        <div className="h-9 flex items-center px-3 rounded-md border bg-muted/40 text-sm">
          <span className="font-medium">{display}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">from category</span>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5">
        <Unlock className="h-3 w-3 text-primary" />
        {label}
      </Label>
      {children}
    </div>
  );
}

// ── Main Component ─────────────────────────────────

export function AddSubcategoryDialog({
  open, onOpenChange, categoryId, categoryCode2, categoryName, categoryDefaults, onCreated,
}: AddSubcategoryDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [subcategoryNo, setSubcategoryNo] = useState(1);
  const [saving, setSaving] = useState(false);

  // Override state
  const [overrideDefaults, setOverrideDefaults] = useState(false);
  const [defaultUom, setDefaultUom] = useState('');
  const [defaultMoq, setDefaultMoq] = useState<number | null>(null);
  const [defaultLeadTimeDays, setDefaultLeadTimeDays] = useState<number | null>(null);
  const [defaultDeliveryTimeDays, setDefaultDeliveryTimeDays] = useState<number | null>(null);
  const [defaultOrderWindowDays, setDefaultOrderWindowDays] = useState<number | null>(null);
  const [defaultOrderCutoffLocal, setDefaultOrderCutoffLocal] = useState('');

  // Spec definitions
  const [specs, setSpecs] = useState<SpecDraft[]>([]);
  const [addingSpec, setAddingSpec] = useState(false);
  const [newSpecLabel, setNewSpecLabel] = useState('');

  // Variant definition
  const [variantLabelEn, setVariantLabelEn] = useState('');
  const [variantLabelAr, setVariantLabelAr] = useState('');
  const [variantOptions, setVariantOptions] = useState<string[]>([]);
  const [newVariantOpt, setNewVariantOpt] = useState('');

  const reset = () => {
    setNameEn(''); setNameAr(''); setSubcategoryNo(1);
    setOverrideDefaults(false);
    setDefaultUom(''); setDefaultMoq(null); setDefaultLeadTimeDays(null);
    setDefaultDeliveryTimeDays(null); setDefaultOrderWindowDays(null); setDefaultOrderCutoffLocal('');
    setSpecs([]); setAddingSpec(false); setNewSpecLabel('');
    setVariantLabelEn(''); setVariantLabelAr(''); setVariantOptions([]); setNewVariantOpt('');
  };

  // ── Live code preview ──────────────────────────
  const subcatPad = String(subcategoryNo).padStart(2, '0');

  const codePreview = useMemo(() => {
    const domain = 'MAT';
    const cat = categoryCode2 || '??';
    const sub = subcatPad;
    const specDigits = specs.map((s) =>
      s.options.length > 0 ? s.options[0].code_digit : '?'
    ).join('');
    const specPlaceholder = specDigits || '?'.repeat(Math.max(specs.length, 0));
    const variantPart = variantOptions.length > 0 ? '01' : '??';
    const parts = [`${domain}`, `${cat}`, `${sub}`];
    if (specs.length > 0 || specPlaceholder) parts.push(specPlaceholder || '???');
    parts.push(variantPart);
    return parts.join('.');
  }, [categoryCode2, subcatPad, specs, variantOptions]);

  const codeExample = useMemo(() => {
    if (specs.length === 0 && variantOptions.length === 0) return null;
    const domain = 'MAT';
    const cat = categoryCode2 || '??';
    const sub = subcatPad;
    const specDigits = specs.map((s) =>
      s.options.length > 0 ? s.options[0].code_digit : '1'
    ).join('');
    const varPart = '01';
    return `${domain}.${cat}.${sub}.${specDigits || '1'}.${varPart}`;
  }, [categoryCode2, subcatPad, specs, variantOptions]);

  // ── Spec helpers ───────────────────────────────

  const addNewSpec = () => {
    const label = newSpecLabel.trim();
    if (!label) { toast.error('Spec axis label required'); return; }
    const key = autoKey(label);
    if (specs.some((s) => s.key === key)) { toast.error('Duplicate spec axis'); return; }
    setSpecs((prev) => [...prev, { key, label_en: label, label_ar: '', options: [] }]);
    setNewSpecLabel('');
    setAddingSpec(false);
  };

  const removeSpec = (idx: number) => setSpecs((prev) => prev.filter((_, i) => i !== idx));

  const updateSpecLabelAr = (idx: number, val: string) =>
    setSpecs((prev) => prev.map((s, i) => (i === idx ? { ...s, label_ar: val } : s)));

  const addSpecOption = (specIdx: number, labelEn: string, labelAr: string, codeDigit: string) => {
    if (!labelEn.trim()) return;
    const value = autoKey(labelEn);
    setSpecs((prev) =>
      prev.map((s, i) =>
        i === specIdx
          ? { ...s, options: [...s.options, { value, label_en: labelEn.trim(), label_ar: labelAr.trim(), code_digit: codeDigit.trim() }] }
          : s
      )
    );
  };

  const removeSpecOption = (specIdx: number, optIdx: number) =>
    setSpecs((prev) =>
      prev.map((s, i) =>
        i === specIdx ? { ...s, options: s.options.filter((_, oi) => oi !== optIdx) } : s
      )
    );

  // ── Variant helpers ────────────────────────────

  const addVariantOption = () => {
    const opt = newVariantOpt.trim();
    if (!opt) return;
    if (variantOptions.includes(opt)) { toast.error('Duplicate variant'); return; }
    setVariantOptions((prev) => [...prev, opt]);
    setNewVariantOpt('');
  };

  const removeVariantOption = (idx: number) =>
    setVariantOptions((prev) => prev.filter((_, i) => i !== idx));

  // ── Submit ─────────────────────────────────────

  const handleSubmit = async () => {
    if (!nameEn.trim()) { toast.error('Name (EN) required'); return; }

    const variantKey = autoKey(variantLabelEn) || 'size';
    const varDef = variantLabelEn.trim()
      ? { key: variantKey, label_en: variantLabelEn.trim(), label_ar: variantLabelAr.trim(), options: variantOptions }
      : {};

    setSaving(true);
    try {
      const insertData: Record<string, any> = {
        category_id: categoryId,
        subcategory_no: subcategoryNo,
        name_en: nameEn.trim(),
        name_ar: nameAr.trim() || null,
        spec_definitions: specs as unknown as Json,
        variant_definitions: varDef as unknown as Json,
        created_by: user?.id || null,
      };

      // Only include overridden fields, otherwise leave null to inherit
      if (overrideDefaults) {
        insertData.default_uom = defaultUom || null;
        insertData.default_moq = defaultMoq;
        insertData.default_lead_time_days = defaultLeadTimeDays;
        insertData.default_delivery_time_days = defaultDeliveryTimeDays;
        insertData.default_order_window_days = defaultOrderWindowDays;
        insertData.default_order_cutoff_local = defaultOrderCutoffLocal || null;
      }

      const { data, error } = await supabase
        .from('material_subcategories')
        .insert(insertData as any)
        .select('id')
        .single();

      if (error) throw error;

      // ── Auto-generate materials from spec × variant cartesian product ──
      const subcategoryId = data.id;
      const resolvedUom = (overrideDefaults && defaultUom) || categoryDefaults.default_uom || 'unit';

      // Build cartesian product of all spec axes
      type SpecCombo = { specs: Record<string, string>; specDigits: string; specLabels: string[] };
      let specCombos: SpecCombo[] = [{ specs: {}, specDigits: '', specLabels: [] }];

      for (const axis of specs) {
        if (axis.options.length === 0) continue;
        const next: SpecCombo[] = [];
        for (const combo of specCombos) {
          for (const opt of axis.options) {
            next.push({
              specs: { ...combo.specs, [axis.key]: opt.value },
              specDigits: combo.specDigits + opt.code_digit,
              specLabels: [...combo.specLabels, opt.label_en],
            });
          }
        }
        specCombos = next;
      }

      // Build variant list (or single default if none defined)
      const variants = variantOptions.length > 0
        ? variantOptions.map((v, i) => ({ label: v, no: i + 1 }))
        : [{ label: '', no: 1 }];

      const materialRows: Record<string, any>[] = [];
      let materialNo = 1;

      for (const combo of specCombos) {
        for (const variant of variants) {
          const variantNoPad = String(variant.no).padStart(2, '0');
          const code = `MAT.${categoryCode2}.${subcatPad}.${combo.specDigits || '0'}.${variantNoPad}`;

          // Build human-readable name
          const nameParts = [nameEn.trim()];
          if (combo.specLabels.length > 0) nameParts.push(combo.specLabels.join(', '));
          if (variant.label) nameParts.push(variant.label);
          const materialName = nameParts.join(': ');

          materialRows.push({
            subcategory_id: subcategoryId,
            material_no: materialNo,
            variant_no: variant.no,
            code,
            name: materialName,
            name_en: materialName,
            uom: resolvedUom,
            specs: combo.specs,
            status: 'active',
            created_by: user?.id || null,
          });
        }
        materialNo++;
      }

      if (materialRows.length > 0) {
        const { error: matErr } = await supabase.from('materials').insert(materialRows as any);
        if (matErr) {
          console.error('Auto-generate materials error:', matErr);
          toast.warning(`Subcategory created but failed to auto-generate ${materialRows.length} materials: ${matErr.message}`);
        } else {
          toast.success(`Auto-generated ${materialRows.length} material variant(s)`);
        }
      }

      toast.success(`Subcategory "${nameEn.trim()}" created`);
      queryClient.invalidateQueries({ queryKey: ['materials-registry'] });
      onCreated(data.id);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create subcategory');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Subcategory</DialogTitle>
          <DialogDescription>
            Define a material type under <strong>{categoryName}</strong>. Each subcategory defines the code structure, specification axes, and variant dimensions for its materials.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ── Live Code Preview ───────────────── */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <Eye className="h-3.5 w-3.5" />
              Code Structure Preview
            </div>
            <div className="font-mono text-lg tracking-wider text-foreground">
              {codePreview}
            </div>
            {codeExample && (
              <div className="text-xs text-muted-foreground">
                Example: <span className="font-mono">{codeExample}</span>
                {specs.length > 0 && (
                  <span className="ml-2">
                    ({specs.map((s) => s.options[0]?.label_en || '…').join(' · ')}
                    {variantOptions.length > 0 ? ` · ${variantOptions[0]}` : ''})
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground mt-1">
              <span><span className="font-mono">MAT</span> = Domain</span>
              <span><span className="font-mono">{categoryCode2 || '??'}</span> = Category</span>
              <span><span className="font-mono">{subcatPad}</span> = Subcategory</span>
              {specs.map((s, i) => (
                <span key={i}>
                  <span className="font-mono">{s.options[0]?.code_digit || '?'}</span> = {s.label_en}
                </span>
              ))}
              <span><span className="font-mono">{variantOptions.length > 0 ? '01' : '??'}</span> = {variantLabelEn || 'Variant'}</span>
            </div>
          </div>

          {/* ── Basic info ─────────────────────── */}
          <div className="grid grid-cols-[60px_1fr_1fr] gap-3">
            <div className="space-y-1.5">
              <Label>No.</Label>
              <Input
                type="number"
                min={1}
                value={subcategoryNo}
                onChange={(e) => setSubcategoryNo(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Name (EN)</Label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Ready-Mix Concrete" />
            </div>
            <div className="space-y-1.5">
              <Label>Name (AR)</Label>
              <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="خرسانة جاهزة" dir="rtl" />
            </div>
          </div>

          {/* ── Inherited Defaults ─────────────── */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Operational Defaults</Label>
              {!overrideDefaults ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                  onClick={() => {
                    setOverrideDefaults(true);
                    // Pre-fill with inherited values
                    setDefaultUom(categoryDefaults.default_uom || 'unit');
                    setDefaultMoq(categoryDefaults.default_moq);
                    setDefaultLeadTimeDays(categoryDefaults.default_lead_time_days);
                    setDefaultDeliveryTimeDays(categoryDefaults.default_delivery_time_days);
                    setDefaultOrderWindowDays(categoryDefaults.default_order_window_days);
                    setDefaultOrderCutoffLocal(categoryDefaults.default_order_cutoff_local || '');
                  }}
                >
                  <Settings2 className="h-3 w-3" />
                  Override
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-primary h-7"
                  onClick={() => setOverrideDefaults(false)}
                >
                  <Lock className="h-3 w-3" />
                  Reset to inherited
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InheritedField
                label="Default UOM"
                inheritedValue={categoryDefaults.default_uom}
                inheritedDisplay={uomLabel(categoryDefaults.default_uom)}
                overriding={overrideDefaults}
              >
                <Select value={defaultUom} onValueChange={setDefaultUom}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UOM_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </InheritedField>

              <InheritedField
                label="Default MOQ"
                inheritedValue={categoryDefaults.default_moq}
                overriding={overrideDefaults}
              >
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 10"
                  value={defaultMoq ?? ''}
                  onChange={(e) => setDefaultMoq(e.target.value ? Number(e.target.value) : null)}
                />
              </InheritedField>

              <InheritedField
                label="Lead Time (days)"
                inheritedValue={categoryDefaults.default_lead_time_days}
                overriding={overrideDefaults}
              >
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 3"
                  value={defaultLeadTimeDays ?? ''}
                  onChange={(e) => setDefaultLeadTimeDays(e.target.value ? Number(e.target.value) : null)}
                />
              </InheritedField>

              <InheritedField
                label="Delivery Time (days)"
                inheritedValue={categoryDefaults.default_delivery_time_days}
                overriding={overrideDefaults}
              >
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 1"
                  value={defaultDeliveryTimeDays ?? ''}
                  onChange={(e) => setDefaultDeliveryTimeDays(e.target.value ? Number(e.target.value) : null)}
                />
              </InheritedField>

              <InheritedField
                label="Order Window (days)"
                inheritedValue={categoryDefaults.default_order_window_days}
                overriding={overrideDefaults}
              >
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 7"
                  value={defaultOrderWindowDays ?? ''}
                  onChange={(e) => setDefaultOrderWindowDays(e.target.value ? Number(e.target.value) : null)}
                />
              </InheritedField>

              <InheritedField
                label="Order Cutoff (local)"
                inheritedValue={categoryDefaults.default_order_cutoff_local}
                overriding={overrideDefaults}
              >
                <Input
                  type="time"
                  value={defaultOrderCutoffLocal}
                  onChange={(e) => setDefaultOrderCutoffLocal(e.target.value)}
                />
              </InheritedField>
            </div>
          </div>

          <Separator />

          {/* ── SPEC AXES ──────────────────────── */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-semibold">Specification Axes</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Each axis becomes <strong>one digit</strong> in the material code. For example, Concrete might have
                axes like <em>Grade</em> (C25=1, C30=2, C35=3) and <em>Admixture</em> (None=0, Plasticizer=1).
                The digits combine: <span className="font-mono">MAT.CO.01.<strong>21</strong>.01</span> = C30 + Plasticizer.
              </p>
            </div>

            {specs.map((spec, si) => (
              <SpecAxisCard
                key={spec.key}
                spec={spec}
                axisIndex={si}
                onRemove={() => removeSpec(si)}
                onUpdateLabelAr={(v) => updateSpecLabelAr(si, v)}
                onAddOption={(le, la, cd) => addSpecOption(si, le, la, cd)}
                onRemoveOption={(oi) => removeSpecOption(si, oi)}
              />
            ))}

            {addingSpec ? (
              <div className="flex items-end gap-2 border rounded-lg p-3 bg-muted/20">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">Axis Label (EN)</Label>
                  <Input
                    value={newSpecLabel}
                    onChange={(e) => setNewSpecLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNewSpec())}
                    placeholder="e.g. Grade, Admixture, Slump"
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Key auto-generated: <span className="font-mono">{autoKey(newSpecLabel) || '…'}</span>
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={addNewSpec} className="h-8">
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingSpec(false); setNewSpecLabel(''); }} className="h-8">
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAddingSpec(true)} className="h-8 gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Spec Axis
              </Button>
            )}
          </div>

          <Separator />

          {/* ── VARIANT DIMENSION ──────────────── */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-semibold">Variant Dimension</Label>
              <p className="text-xs text-muted-foreground mt-1">
                The dimension that creates separate material rows — each option gets a <strong>2-digit variant number</strong> (01, 02, …).
                For example, for Concrete this could be <em>Slump (cm)</em> with options 10, 15, 20 → variant 01, 02, 03.
                For Blocks, this could be <em>Size (cm)</em> with 10, 15, 20, 25.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Dimension Label (EN)</Label>
                <Input
                  value={variantLabelEn}
                  onChange={(e) => setVariantLabelEn(e.target.value)}
                  placeholder="e.g. Slump (cm), Size (cm)"
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  Key: <span className="font-mono">{autoKey(variantLabelEn) || '…'}</span>
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Label (AR)</Label>
                <Input
                  value={variantLabelAr}
                  onChange={(e) => setVariantLabelAr(e.target.value)}
                  placeholder="الهبوط (سم)"
                  className="h-8 text-sm"
                  dir="rtl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Options (each becomes a material variant row)</Label>
              <div className="flex flex-wrap items-center gap-2">
                {variantOptions.map((opt, i) => (
                  <Badge key={i} variant="secondary" className="gap-1.5 font-mono cursor-pointer hover:bg-destructive/10" onClick={() => removeVariantOption(i)}>
                    <span className="text-muted-foreground text-[10px]">{nextVariantNo(variantOptions.slice(0, i))}</span>
                    {opt} ×
                  </Badge>
                ))}
                <div className="flex items-center gap-1.5">
                  <Input
                    value={newVariantOpt}
                    onChange={(e) => setNewVariantOpt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVariantOption())}
                    placeholder="e.g. 10, 15, 20"
                    className="w-28 h-7 text-sm"
                  />
                  <Button size="sm" variant="ghost" onClick={addVariantOption} className="h-7 px-2">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Subcategory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Spec Axis Card ───────────────────────────────── */

function SpecAxisCard({
  spec, axisIndex, onRemove, onUpdateLabelAr, onAddOption, onRemoveOption,
}: {
  spec: SpecDraft;
  axisIndex: number;
  onRemove: () => void;
  onUpdateLabelAr: (v: string) => void;
  onAddOption: (labelEn: string, labelAr: string, codeDigit: string) => void;
  onRemoveOption: (idx: number) => void;
}) {
  const [optLabelEn, setOptLabelEn] = useState('');
  const [optLabelAr, setOptLabelAr] = useState('');
  const [optCode, setOptCode] = useState('');

  const handleAdd = () => {
    if (!optLabelEn.trim()) { toast.error('Option label required'); return; }
    const digit = optCode.trim() || nextDigit(spec.options);
    onAddOption(optLabelEn, optLabelAr, digit);
    setOptLabelEn('');
    setOptLabelAr('');
    setOptCode('');
  };

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
            Position {axisIndex + 1} → digit in code
          </Badge>
          <span className="font-medium text-sm">{spec.label_en}</span>
          <span className="font-mono text-[10px] text-muted-foreground">({spec.key})</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={spec.label_ar}
            onChange={(e) => onUpdateLabelAr(e.target.value)}
            placeholder="AR label"
            className="w-28 h-7 text-xs"
            dir="rtl"
          />
          <Button size="sm" variant="ghost" onClick={onRemove} className="h-7 w-7 p-0 text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {spec.options.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground pl-3 font-medium">
            <span className="w-8 text-center">Digit</span>
            <span className="flex-1">Label (EN)</span>
            <span className="w-24">Label (AR)</span>
            <span className="w-5" />
          </div>
          {spec.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2 text-xs pl-3 py-0.5 rounded hover:bg-muted/50">
              <span className="font-mono w-8 text-center font-bold text-primary">{opt.code_digit}</span>
              <span className="flex-1">{opt.label_en}</span>
              <span className="w-24 text-muted-foreground text-right" dir="rtl">{opt.label_ar}</span>
              <Button size="sm" variant="ghost" onClick={() => onRemoveOption(oi)} className="h-5 w-5 p-0 text-destructive/60">
                ×
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5 pl-3">
        <div className="space-y-0.5 w-12">
          <Label className="text-[10px]">Digit</Label>
          <Input
            value={optCode || nextDigit(spec.options)}
            onChange={(e) => setOptCode(e.target.value)}
            className="h-7 text-xs font-mono text-center"
            maxLength={1}
            placeholder={nextDigit(spec.options)}
          />
        </div>
        <div className="space-y-0.5 flex-1">
          <Label className="text-[10px]">Label EN</Label>
          <Input
            value={optLabelEn}
            onChange={(e) => setOptLabelEn(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            className="h-7 text-xs"
            placeholder="e.g. C25, Regular, None"
          />
        </div>
        <div className="space-y-0.5 flex-1">
          <Label className="text-[10px]">Label AR</Label>
          <Input value={optLabelAr} onChange={(e) => setOptLabelAr(e.target.value)} className="h-7 text-xs" dir="rtl" placeholder="عادي" />
        </div>
        <Button size="sm" variant="secondary" onClick={handleAdd} className="h-7 px-2">
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
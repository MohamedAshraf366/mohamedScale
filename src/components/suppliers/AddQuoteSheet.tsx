import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Trash2, X, Search, Image as ImageIcon, ChevronLeft, ChevronRight, MapPin, Package, Paperclip, Building2, Edit2 } from 'lucide-react';
import { ZonePickerDialog } from './ZonePickerDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { type PickedMaterial } from '@/components/shared/MaterialStepPicker';
import { MaterialPickerDialog } from './MaterialPickerDialog';
import { MaterialAutocompleteCell } from './MaterialAutocompleteCell';
import { SupplierCombobox } from './SupplierCombobox';
import { OverrideCell } from './OverrideCell';
import { resolveMaterialDefaults } from '@/lib/resolveMaterialDefaults';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { resolveInherited } from '@/lib/resolve-inherited';
import { buildEqualAllocations } from '@/hooks/useDeliveryAllocations';
import { AiUploadStep, type AiExtractionResult, type AiExtractedRow } from './AiUploadStep';
import { QuoteValidityCard } from './QuoteValidityCard';
import { SupplierMatchPanel, type NewSupplierDraft } from './SupplierMatchPanel';
import { SupplierMismatchBanner } from './SupplierMismatchBanner';
import { AlertTriangle, AlertCircle, ChevronDown } from 'lucide-react';

export type { AiExtractionResult } from './AiUploadStep';

interface AiAlternative {
  material_id: string;
  material_code: string;
  material_name?: string;
  reason?: string;
}

interface QuoteLine {
  id: string;
  material: PickedMaterial | null;
  unit_price: number | null;
  notes: string;
  uom: string;
  /** Resolved inherited MOQ (from subcategory/category). Null = no default. */
  resolved_moq?: number | null;
  /** Per-line override of MOQ (UI only — currently informational). */
  moq_override?: number | null;
  /** Per-line override of UoM (UI only — currently informational). */
  uom_override?: string | null;
  /** Phase 2.3 — provenance of this row. Used by the supplier-change diff. */
  origin?: 'manual' | 'prefilled' | 'ai';
  aiDescription?: string;
  aiConfidence?: number;
  aiAlternatives?: AiAlternative[];
  aiVatRate?: number | null;
  aiPriceExcludingVat?: number | null;
  /** Per-row note from the source document. */
  aiNotes?: string | null;
  /** Inline-expand state for showing AI alternatives in place. */
  aiAltOpen?: boolean;
  /** Price-reconciliation flags from edge function (e.g. `vat_status_assumed`). */
  aiPriceFlags?: string[];
}

interface DeliveryLine {
  id: string;
  zoneCodes: string[];
  pricePerMoq: number | null;
  notes: string;
  isDefault: boolean;
  materialIds: string[];
}

export interface EditQuoteData {
  id: string;
  supplier_account_id: string;
  supplier_name: string | null;
  notes: string | null;
  lines: QuoteLine[];
  deliveryLines: DeliveryLine[];
}

interface AddQuoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  supplierAccountId?: string;
  supplierName?: string;
  /** When 'ai-upload' the sheet opens directly into the AI upload step. */
  mode?: 'manual' | 'ai-upload';
  aiResult?: AiExtractionResult | null;
  filePreviewUrls?: string[];
  editData?: EditQuoteData | null;
}

function createEmptyLine(origin: QuoteLine['origin'] = 'manual'): QuoteLine {
  return {
    id: crypto.randomUUID(),
    material: null,
    unit_price: null,
    notes: '',
    uom: 'unit',
    origin,
  };
}

/**
 * Phase 2.2 — guarantee exactly one trailing empty row at the bottom so users
 * can keep typing without clicking "Add". Strips any other empties.
 */
function ensureTrailingEmpty(lines: QuoteLine[]): QuoteLine[] {
  const withMaterial = lines.filter(l => l.material !== null);
  return [...withMaterial, createEmptyLine('manual')];
}

function createEmptyDeliveryLine(): DeliveryLine {
  return {
    id: crypto.randomUUID(),
    zoneCodes: [],
    pricePerMoq: null,
    notes: '',
    isDefault: true,
    materialIds: [],
  };
}

// ─── Compact Delivery Line Editor with Zone Picker Dialog ───
function DeliveryLineEditor({
  line,
  quoteMaterials,
  onUpdate,
  onRemove,
  isExisting,
}: {
  line: DeliveryLine;
  quoteMaterials: Array<{ id: string; name: string; moq?: number | null; uom?: string | null }>;
  onUpdate: (updated: DeliveryLine) => void;
  onRemove: () => void;
  isExisting?: boolean;
}) {
  const [zonePickerOpen, setZonePickerOpen] = useState(false);
  const [showMaterialOverride, setShowMaterialOverride] = useState(!line.isDefault);

  const toggleOverride = (checked: boolean) => {
    setShowMaterialOverride(checked);
    onUpdate({ ...line, isDefault: !checked, materialIds: [] });
  };

  const toggleMaterial = (id: string) => {
    const next = line.materialIds.includes(id)
      ? line.materialIds.filter(x => x !== id)
      : [...line.materialIds, id];
    onUpdate({ ...line, materialIds: next });
  };

  if (isExisting) {
    return (
      <div className="border rounded-lg p-3 bg-muted/10 border-dashed">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">📌 Existing Rate</span>
          <Badge variant="secondary" className="text-[10px]">Default</Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Zones: {line.zoneCodes.length} · Price: {line.pricePerMoq} SAR/MOQ
          {line.notes && ` · ${line.notes}`}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            Delivery Line
            {line.isDefault && <Badge variant="secondary" className="ml-2 text-[10px]">Default</Badge>}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={onRemove}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Compact zone + price row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8 shrink-0"
            onClick={() => setZonePickerOpen(true)}
          >
            <MapPin className="h-3 w-3 mr-1" />
            {line.zoneCodes.length > 0 ? `${line.zoneCodes.length} Zones` : 'Select Zones'}
          </Button>
          <div className="flex items-center gap-1 shrink-0">
            <Input
              type="number" min="0" step="0.01" placeholder="Price per trip"
              className="h-8 text-sm w-40"
              value={line.pricePerMoq ?? ''}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') return onUpdate({ ...line, pricePerMoq: null });
                const n = parseFloat(raw);
                if (Number.isNaN(n)) return;
                if (n < 0) return onUpdate({ ...line, pricePerMoq: 0 });
                onUpdate({ ...line, pricePerMoq: n });
              }}
              title="Price per trip — one trip delivers one MOQ load"
            />
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">SAR / trip</span>
          </div>
          {(() => {
            const picked = quoteMaterials.filter(m => line.materialIds.includes(m.id));
            const scope = line.isDefault ? quoteMaterials : picked;
            const moqs = scope.map(m => m.moq).filter((v): v is number => v != null);
            if (!moqs.length) return null;
            const min = Math.min(...moqs);
            const max = Math.max(...moqs);
            const label = min === max ? `${min.toLocaleString()}` : `${min.toLocaleString()}–${max.toLocaleString()}`;
            const uom = scope[0]?.uom || '';
            return (
              <Badge variant="outline" className="text-[10px] font-normal" title="1 trip = 1 MOQ load of the selected materials">
                MOQ: {label}{uom ? ` ${uom}` : ''} / trip
              </Badge>
            );
          })()}
          <Input
            placeholder="Notes"
            className="h-8 text-xs flex-1 min-w-[120px]"
            value={line.notes}
            onChange={e => onUpdate({ ...line, notes: e.target.value })}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          One trip delivers one MOQ load. e.g. if MOQ is 100 units and you need 250, that's 3 trips.
        </p>

        {/* Override for specific materials */}
        {quoteMaterials.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Switch checked={showMaterialOverride} onCheckedChange={toggleOverride} />
              <Label className="text-xs">Override for specific materials</Label>
            </div>
            {showMaterialOverride && (
              <div className="border rounded-md p-1.5 max-h-24 overflow-y-auto">
                {quoteMaterials.map(m => (
                  <label key={m.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={line.materialIds.includes(m.id)}
                      onChange={() => toggleMaterial(m.id)}
                      className="rounded"
                    />
                    <span className="text-xs flex-1 truncate">{m.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ZonePickerDialog
        open={zonePickerOpen}
        onOpenChange={setZonePickerOpen}
        selectedZoneCodes={line.zoneCodes}
        onConfirm={(zones) => onUpdate({ ...line, zoneCodes: zones })}
      />
    </>
  );
}

// ─── Inline New Supplier Card ───
function InlineNewSupplierCard({
  onCreated,
}: {
  onCreated: (accountId: string, name: string) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const { data: account, error: accErr } = await supabase
        .from('accounts')
        .insert({ display_name: name.trim(), status: 'active' })
        .select('id')
        .single();
      if (accErr) throw accErr;

      const { error: supErr } = await supabase
        .from('suppliers')
        .insert({ account_id: account.id } as any);
      if (supErr) throw supErr;

      if (phone.trim()) {
        await supabase.from('contacts').insert({
          account_id: account.id,
          full_name: name.trim(),
          phone: phone.trim(),
          is_primary: true,
        });
      }

      toast.success(`Supplier "${name.trim()}" created`);
      onCreated(account.id, name.trim());
    } catch (err: any) {
      toast.error('Failed to create supplier: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">New Supplier</span>
      </div>
      <Input placeholder="Supplier name *" value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
      <Input placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} className="h-8 text-sm" />
      <Button size="sm" disabled={!name.trim() || creating} onClick={handleCreate} className="w-full">
        {creating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
        Create & Select
      </Button>
    </div>
  );
}

// ─── Main Sheet ───
export function AddQuoteSheet({
  open,
  onOpenChange,
  onSuccess,
  supplierAccountId: fixedSupplierId,
  supplierName: fixedSupplierName,
  mode = 'manual',
  aiResult: externalAiResult,
  filePreviewUrls: externalPreviewUrls = [],
  editData,
}: AddQuoteSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Internal AI state — supports the in-sheet upload step. We still accept an
  // external aiResult for backwards-compat with callers that pre-extract.
  const [internalAiResult, setInternalAiResult] = useState<AiExtractionResult | null>(null);
  const [internalPreviewUrls, setInternalPreviewUrls] = useState<string[]>([]);
  const aiResult = externalAiResult ?? internalAiResult;
  const filePreviewUrls = externalPreviewUrls.length > 0 ? externalPreviewUrls : internalPreviewUrls;

  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState(fixedSupplierId || '');
  const [selectedSupplierName, setSelectedSupplierName] = useState(fixedSupplierName || '');
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  /**
   * Draft for a brand-new supplier when user picks "Create as new" in AI mode.
   * Insert is deferred to handleSubmit/Confirm so cancelling never leaves a
   * dangling supplier in the database.
   */
  const [newSupplierDraft, setNewSupplierDraft] = useState<NewSupplierDraft | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([createEmptyLine()]);
  const [deliveryLines, setDeliveryLines] = useState<DeliveryLine[]>([]);
  const [existingDeliveryLines, setExistingDeliveryLines] = useState<DeliveryLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [quoteNotes, setQuoteNotes] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [preFilled, setPreFilled] = useState(false);
  /** Phase 2.3 — supplier-change diff: confirm before discarding manual edits. */
  const prevSupplierIdRef = useRef<string>('');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLineId, setPickerLineId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const hasPreview = filePreviewUrls.length > 0;
  const isAiMode = !!aiResult;
  const isEditMode = !!editData;
  // Show the in-sheet upload step when caller asked for AI mode but no extraction yet
  const isAwaitingUpload = mode === 'ai-upload' && !aiResult && !isEditMode;

  const effectiveSupplierId = editData?.supplier_account_id || fixedSupplierId || selectedSupplierId;

  // Fetch existing delivery rates for selected supplier
  useEffect(() => {
    if (!effectiveSupplierId) {
      setExistingDeliveryLines([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('delivery_rates')
        .select('id, zone_codes, price_per_moq, notes, is_default, supplier_material_ids')
        .eq('supplier_account_id', effectiveSupplierId)
        .eq('is_default', true);
      if (data && data.length > 0) {
        setExistingDeliveryLines(data.map((r: any) => ({
          id: r.id,
          zoneCodes: r.zone_codes || [],
          pricePerMoq: Number(r.price_per_moq),
          notes: r.notes || '',
          isDefault: r.is_default,
          materialIds: r.supplier_material_ids || [],
        })));
      } else {
        setExistingDeliveryLines([]);
      }
    })();
  }, [effectiveSupplierId]);

  // Auto-pull supplier's existing materials when supplier is selected (new quote, not editing)
  useEffect(() => {
    if (!open || isEditMode || isAiMode || !effectiveSupplierId || preFilled) return;
    // Only pre-fill if lines are empty (just the default empty line)
    const hasUserData = lines.some(l => l.material !== null);
    if (hasUserData) return;

    (async () => {
      const { data: smData } = await supabase
        .from('supplier_materials')
        .select('material_id')
        .eq('supplier_account_id', effectiveSupplierId)
        .eq('is_current', true);

      if (!smData || smData.length === 0) return;

      const materialIds = [...new Set(smData.map(sm => sm.material_id))];
      const { data: materials } = await supabase
        .from('materials')
        .select('id, name, code, uom, default_moq, subcategory_id')
        .in('id', materialIds);

      // Fetch subcategory defaults as fallback
      const subcatIds = [...new Set((materials || []).map(m => m.subcategory_id).filter(Boolean))];
      let subcatMap: Record<string, Record<string, unknown>> = {};
      if (subcatIds.length > 0) {
        const { data: subcats } = await supabase
          .from('material_subcategories')
          .select('id, default_moq, default_uom')
          .in('id', subcatIds);
        subcatMap = Object.fromEntries((subcats || []).map(s => [s.id, s as Record<string, unknown>]));
      }

      if (materials && materials.length > 0) {
        const prefillLines: QuoteLine[] = materials.map(m => {
          const sub = m.subcategory_id ? subcatMap[m.subcategory_id] : null;
          const uom = resolveInherited<string>('default_uom', [m as any, sub], m.uom || 'unit');
          const moq = resolveInherited<number | null>('default_moq', [m as any, sub], null);
          return {
            id: crypto.randomUUID(),
            material: { id: m.id, name: m.name, code: m.code, uom, moq },
            unit_price: null,
            notes: '',
            uom,
            resolved_moq: moq,
            origin: 'prefilled',
          };
        });
        // Always keep one trailing empty row so users can keep typing
        setLines([...prefillLines, createEmptyLine('manual')]);
        setPreFilled(true);
        toast.info(`Pre-filled ${materials.length} material(s) from supplier's catalog`);
      }
    })();
  }, [open, effectiveSupplierId, isEditMode, isAiMode, preFilled]);

  // Phase 2.3 — Supplier-change diff. When user switches supplier mid-flow,
  // detect manual edits and confirm before clearing the prior catalog.
  useEffect(() => {
    if (!open || isEditMode || isAiMode) {
      prevSupplierIdRef.current = effectiveSupplierId || '';
      return;
    }
    const prev = prevSupplierIdRef.current;
    const next = effectiveSupplierId || '';
    if (!prev || prev === next) {
      prevSupplierIdRef.current = next;
      return;
    }
    const hasManualEdits = lines.some(l =>
      (l.origin === 'manual' && l.material) ||
      (l.origin === 'prefilled' && (l.unit_price != null || (l.notes && l.notes.trim() !== '')))
    );
    if (hasManualEdits) {
      const ok = window.confirm(
        `Replace pre-filled materials with the new supplier's catalog? Your manual edits and prices will be lost.`
      );
      if (!ok) {
        // User keeps lines as-is; only the supplier reference changes.
        prevSupplierIdRef.current = next;
        return;
      }
    }
    // Reset so the prefill effect re-pulls for the new supplier
    setLines([createEmptyLine('manual')]);
    setPreFilled(false);
    prevSupplierIdRef.current = next;
  }, [open, effectiveSupplierId, isEditMode, isAiMode]);

  // Pre-fill from edit data
  useEffect(() => {
    if (open && editData) {
      setSelectedSupplierId(editData.supplier_account_id);
      setSelectedSupplierName(editData.supplier_name || '');
      setLines(ensureTrailingEmpty(editData.lines));
      setDeliveryLines(editData.deliveryLines);
      setQuoteNotes(editData.notes || '');
      setAttachedFile(null);
    }
  }, [open, editData]);

  // Pre-fill from AI result
  useEffect(() => {
    if (open && aiResult && !editData) {
      const aiLines: QuoteLine[] = aiResult.rows.map((row) => {
        const fallbackUom = row.uom || 'unit';
        // Phase 2.4 — persist PRE-TAX price. Prefer the explicit excl field,
        // fall back to deriving excl from incl using the row's vat_rate
        // (default 15% if missing). Legacy `unit_price_including_tax`
        // payloads are treated as VAT-inclusive too.
        const vatRate = row.vat_rate ?? 0.15;
        const inclPrice = row.unit_price_including_vat ?? row.unit_price_including_tax ?? null;
        const exclPrice = row.unit_price_excluding_vat
          ?? (inclPrice != null ? inclPrice / (1 + vatRate) : null);
        const unitPrice = exclPrice != null ? Number(exclPrice.toFixed(4)) : null;
        const matchedName = row.material_name || row.description;
        return {
          id: crypto.randomUUID(),
          material: row.material_id
            ? {
                id: row.material_id,
                name: matchedName,
                code: row.material_code ?? null,
                uom: fallbackUom,
                moq: row.moq ?? null,
              }
            : null,
          unit_price: unitPrice,
          notes: row.notes ?? '',
          uom: fallbackUom,
          origin: 'ai',
          aiDescription: row.description,
          aiConfidence: row.confidence,
          aiAlternatives: row.metadata?.match?.candidate_alternatives ?? [],
          aiVatRate: row.vat_rate ?? null,
          aiPriceExcludingVat: row.unit_price_excluding_vat ?? null,
          aiNotes: row.notes ?? null,
          aiAltOpen: false,
          aiPriceFlags: row.metadata?.price?.flags ?? [],
        };
      });
      setLines(aiLines.length > 0 ? [...aiLines, createEmptyLine('manual')] : [createEmptyLine('manual')]);

      // Pre-fill delivery rates if the worker returned any
      const aiDelivery = aiResult.delivery_rates ?? [];
      if (aiDelivery.length > 0) {
        setDeliveryLines(
          aiDelivery.map((dr) => ({
            id: crypto.randomUUID(),
            zoneCodes: dr.zone_codes ?? [],
            pricePerMoq: dr.price_per_moq ?? null,
            notes: dr.notes ?? '',
            isDefault: dr.is_default ?? (!dr.material_ids || dr.material_ids.length === 0),
            materialIds: dr.material_ids ?? [],
          })),
        );
      } else {
        setDeliveryLines([]);
      }

      // Auto-select a high-confidence matched supplier (>= 0.9). Otherwise
      // leave selection empty so the user picks from candidates or enters
      // create-new mode (which now defers actual insertion to Confirm).
      if (aiResult.matched_supplier) {
        setSelectedSupplierId(aiResult.matched_supplier.account_id);
        setSelectedSupplierName(aiResult.matched_supplier.display_name || '');
        setNewSupplierDraft(null);
      } else if (aiResult.supplier_to_create?.account_id) {
        // Legacy worker compat
        setSelectedSupplierId(aiResult.supplier_to_create.account_id);
        setSelectedSupplierName(aiResult.supplier_to_create.display_name || '');
        setNewSupplierDraft(null);
      } else {
        setSelectedSupplierId('');
        setSelectedSupplierName('');
        setNewSupplierDraft(null);
      }
    } else if (open && !aiResult && !editData) {
      setSelectedSupplierId(fixedSupplierId || '');
      setSelectedSupplierName(fixedSupplierName || '');
      setLines([createEmptyLine()]);
      setDeliveryLines([]);
      setQuoteNotes('');
      setAttachedFile(null);
      setShowNewSupplier(false);
      setNewSupplierDraft(null);
      setPreFilled(false);
    }
  }, [open, aiResult, editData, fixedSupplierId, fixedSupplierName]);

  // Reset internal AI state and preview index when sheet closes
  useEffect(() => {
    if (!open) {
      setInternalAiResult(null);
      setInternalPreviewUrls([]);
      setPreviewIndex(0);
      setNewSupplierDraft(null);
    }
  }, [open]);

  useEffect(() => {
    if (open && !fixedSupplierId && !aiResult && !editData) fetchSuppliers();
  }, [open, fixedSupplierId, aiResult, editData]);

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const { data: supData } = await supabase.from('suppliers').select('account_id');
      if (supData) {
        const accountIds = supData.map(s => s.account_id);
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, display_name').is('deleted_at', null)
          .in('id', accountIds);
        setSuppliers(accounts?.map(a => ({ id: a.id, name: a.display_name || 'Unnamed' })) || []);
      }
    } catch {
      console.error('Failed to fetch suppliers');
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const openPickerForLine = (lineId: string) => {
    setPickerLineId(lineId);
    setPickerOpen(true);
  };

  const openPickerForNewLines = () => {
    setPickerLineId(null);
    setPickerOpen(true);
  };

  /** Toggle inline AI alternatives panel for a row (no dialog jump). */
  const toggleAltOpen = (lineId: string) => {
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, aiAltOpen: !l.aiAltOpen } : l,
    ));
  };

  /** Apply an alternative candidate to a row in place. */
  const applyAlternative = (lineId: string, alt: AiAlternative) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      return {
        ...l,
        material: {
          id: alt.material_id,
          name: alt.material_name || alt.material_code,
          code: alt.material_code,
          uom: l.uom || 'unit',
          moq: l.material?.moq ?? null,
        },
        aiAltOpen: false,
      };
    }));
  };

  /** Focus the price input for a given row id on the next tick. */
  const focusPriceInput = (lineId: string) => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>(`input[data-price-row="${lineId}"]`);
      if (el) { el.focus(); el.select(); }
    });
  };

  const handleMaterialPicked = async (material: PickedMaterial) => {
    if (!pickerLineId) return;
    const lineId = pickerLineId;
    const defaults = await resolveMaterialDefaults(material.id);
    const enriched = { ...material, uom: defaults.uom, moq: defaults.moq };
    setLines(prev => ensureTrailingEmpty(prev.map(l =>
      l.id === lineId
        ? { ...l, material: enriched, uom: defaults.uom, resolved_moq: defaults.moq, origin: 'manual' }
        : l,
    )));
    setPickerLineId(null);
    focusPriceInput(lineId);
  };

  const handleBulkMaterialsPicked = async (materials: PickedMaterial[]) => {
    const enriched = await Promise.all(
      materials.map(async (m) => {
        const d = await resolveMaterialDefaults(m.id);
        return { ...m, uom: d.uom, moq: d.moq, _defaults: d };
      }),
    );
    const newLines: QuoteLine[] = enriched.map((material) => ({
      id: crypto.randomUUID(),
      material: { id: material.id, name: material.name, code: material.code, uom: material.uom, moq: material.moq },
      unit_price: null,
      notes: '',
      uom: material._defaults.uom,
      resolved_moq: material._defaults.moq,
      origin: 'manual',
    }));
    setLines(prev => {
      const existing = prev.filter(l => l.material !== null);
      return ensureTrailingEmpty([...existing, ...newLines]);
    });
    if (newLines.length > 0) focusPriceInput(newLines[0].id);
  };

  /** In-cell autocomplete pick — material already has resolved UoM/MOQ. */
  const handleInlineMaterialPicked = (lineId: string, material: PickedMaterial) => {
    setLines(prev => ensureTrailingEmpty(prev.map(l =>
      l.id === lineId
        ? { ...l, material, uom: material.uom || 'unit', resolved_moq: material.moq ?? null, origin: 'manual' }
        : l,
    )));
    focusPriceInput(lineId);
  };

  const updateLine = (lineId: string, field: keyof QuoteLine, value: unknown) => {
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, [field]: value } : l
    ));
  };

  const removeLine = (lineId: string) => {
    setLines(prev => {
      const filtered = prev.filter(l => l.id !== lineId);
      return ensureTrailingEmpty(filtered.length === 0 ? [createEmptyLine('manual')] : filtered);
    });
  };

  const clearAllLines = () => {
    setLines([createEmptyLine('manual')]);
    setPreFilled(false);
    toast.info('All material lines cleared');
  };

  const addDeliveryLine = () => {
    setDeliveryLines(prev => [...prev, createEmptyDeliveryLine()]);
  };

  const updateDeliveryLine = (id: string, updated: DeliveryLine) => {
    setDeliveryLines(prev => prev.map(dl => dl.id === id ? updated : dl));
  };

  const removeDeliveryLine = (id: string) => {
    setDeliveryLines(prev => prev.filter(dl => dl.id !== id));
  };

  const quoteMaterials = useMemo(() =>
    lines.filter(l => l.material).map(l => ({
      id: l.material!.id,
      name: l.material!.name,
      moq: (l.resolved_moq ?? l.material!.moq) ?? null,
      uom: l.uom,
    })),
    [lines]
  );

  const validDeliveryLines = deliveryLines.filter(dl =>
    dl.zoneCodes.length > 0 && dl.pricePerMoq != null && dl.pricePerMoq > 0
  );

  const validLines = lines.filter(l => l.material);
  const hasMaterials = validLines.length > 0;
  const hasSupplier = !!effectiveSupplierId;
  const draftHasName = !!(
    newSupplierDraft &&
    (newSupplierDraft.name_en.trim() || newSupplierDraft.name_ar.trim())
  );
  const canSubmit = hasMaterials && hasSupplier && !isAiMode;
  // In AI mode the user must either pick an existing supplier OR have a
  // valid create-new draft (name required).
  const canSubmitAi = isAiMode && hasMaterials && (hasSupplier || draftHasName);

  const handleSubmit = async () => {
    // AI mode — commit via token, then optionally append delivery lines
    if (isAiMode && aiResult?.confirm_token) {
      setSubmitting(true);
      try {
        // ── Patch agent_confirmations.payload before committing ──
        // The edge function pre-stages an `acc_insert` (+ contact + supplier)
        // op when no high-confidence match exists. We rewrite those ops to
        // reflect the user's final choice so creation only happens here, on
        // Confirm — never on click in the panel.
        const token = aiResult.confirm_token;
        const { data: confRow, error: confFetchErr } = await supabase
          .from('agent_confirmations')
          .select('payload')
          .eq('token', token)
          .maybeSingle();
        if (confFetchErr) throw confFetchErr;

        const payload: any = confRow?.payload ?? {};
        const ops: any[] = Array.isArray(payload.ops) ? [...payload.ops] : [];

        const accIdx = ops.findIndex(o => o.op_id === 'acc_insert');
        const contactIdx = ops.findIndex(o => o.op_id === 'contact_primary_insert');
        const supIdx = ops.findIndex(o => o.op_id === 'supplier_insert');
        const stagedAccountId = accIdx >= 0 ? ops[accIdx]?.values?.id : null;

        if (selectedSupplierId && !newSupplierDraft) {
          // User picked an EXISTING supplier — drop create ops, rewire item
          // inserts to the picked account_id.
          const dropIds = new Set(['acc_insert', 'contact_primary_insert', 'supplier_insert']);
          const next = ops
            .filter(o => !dropIds.has(o.op_id))
            .map(o => {
              if (o.table === 'supplier_materials' && o.values?.supplier_account_id === stagedAccountId) {
                return { ...o, values: { ...o.values, supplier_account_id: selectedSupplierId } };
              }
              return o;
            });
          payload.ops = next;
        } else if (newSupplierDraft && draftHasName) {
          // User chose CREATE NEW — patch the staged ops with edited fields.
          const displayName = newSupplierDraft.name_en.trim() || newSupplierDraft.name_ar.trim();
          if (accIdx >= 0) {
            ops[accIdx] = {
              ...ops[accIdx],
              values: {
                ...ops[accIdx].values,
                display_name: displayName,
                display_name_ar: newSupplierDraft.name_ar.trim() || null,
                legal_name: newSupplierDraft.name_en.trim() || newSupplierDraft.name_ar.trim() || null,
                tax_number: newSupplierDraft.tax_number.trim() || null,
                website: newSupplierDraft.website.trim() || null,
              },
            };
          }
          // If a phone/email was added but no contact op was staged (extraction had no phone), inject one.
          const hasPhoneOrEmail = !!(newSupplierDraft.phone.trim() || newSupplierDraft.email.trim());
          if (hasPhoneOrEmail && stagedAccountId) {
            if (contactIdx >= 0) {
              ops[contactIdx] = {
                ...ops[contactIdx],
                values: {
                  ...ops[contactIdx].values,
                  full_name: displayName,
                  phone: newSupplierDraft.phone.trim() || null,
                  email: newSupplierDraft.email.trim() || null,
                },
              };
            } else if (accIdx >= 0) {
              ops.splice(accIdx + 1, 0, {
                op_id: 'contact_primary_insert',
                type: 'insert',
                table: 'contacts',
                values: {
                  account_id: stagedAccountId,
                  full_name: displayName,
                  phone: newSupplierDraft.phone.trim() || null,
                  email: newSupplierDraft.email.trim() || null,
                  is_primary: true,
                  prefers_whatsapp: true,
                  created_by: { __ref: 'actor.user_id' },
                  updated_by: { __ref: 'actor.user_id' },
                },
                returning: ['id'],
                assign: { poc_contact_id: 'id' },
              });
            }
          }
          if (supIdx >= 0) {
            ops[supIdx] = {
              ...ops[supIdx],
              values: {
                ...ops[supIdx].values,
                supplier_type: newSupplierDraft.supplier_type || 'store',
              },
            };
          }
          payload.ops = ops;
        }

        const { error: confUpdErr } = await supabase
          .from('agent_confirmations')
          .update({ payload })
          .eq('token', token);
        if (confUpdErr) throw confUpdErr;

        const { data, error } = await supabase.rpc('agent_commit_v1', {
          p_token: token,
        });
        if (error) throw error;
        const result = data as { ok: boolean; error?: string; supplier_quote_id?: string; supplier_account_id?: string };
        if (!result.ok) {
          toast.error(result.error || 'Failed to confirm');
          return;
        }

        // If user added delivery lines in the sheet, persist them now using
        // the same shape the manual flow uses so allocations + supply unit
        // generation work identically.
        const quoteId = result.supplier_quote_id;
        const supplierId = result.supplier_account_id || aiResult.supplier_to_create?.account_id;

        // Patch the freshly-created supplier_quote with the AI-extracted
        // valid_until date (column lives on supplier_quotes, not on the items).
        const validUntil = aiResult.validity?.valid_until;
        if (quoteId && validUntil && /^\d{4}-\d{2}-\d{2}$/.test(validUntil)) {
          await supabase
            .from('supplier_quotes')
            .update({ valid_until: validUntil })
            .eq('id', quoteId);
        }

        if (quoteId && supplierId && validDeliveryLines.length > 0) {
          try {
            const { data: insertedItems } = await supabase
              .from('supplier_materials')
              .select('id, material_id, unit_price, moq')
              .eq('supplier_quote_id', quoteId);

            const drRows = validDeliveryLines.map(dl => ({
              supplier_account_id: supplierId,
              zone_codes: dl.zoneCodes,
              price_per_moq: dl.pricePerMoq!,
              notes: dl.notes || null,
              is_default: dl.isDefault,
              supplier_material_ids: dl.isDefault ? [] : dl.materialIds,
              created_by: user?.id || null,
            }));
            await supabase.from('delivery_rates').insert(drRows as any);

            const dlRows = validDeliveryLines.map(dl => ({
              supplier_quote_id: quoteId,
              material_ids: dl.isDefault ? (insertedItems || []).map(sm => sm.material_id) : dl.materialIds,
              zone_codes: dl.zoneCodes,
              price_per_moq: dl.pricePerMoq!,
              notes: dl.notes || null,
            }));
            const { data: dlData } = await supabase
              .from('supplier_quote_delivery_lines')
              .insert(dlRows)
              .select('id, material_ids, zone_codes, price_per_moq');

            if (dlData && dlData.length > 0 && insertedItems && insertedItems.length > 0) {
              const allocRows = buildEqualAllocations({
                quoteId,
                deliveryLines: dlData as any,
                supplierMaterials: insertedItems.map(sm => ({
                  id: sm.id,
                  material_id: sm.material_id,
                  unit_price: sm.unit_price,
                  moq: sm.moq,
                })),
              });
              if (allocRows.length > 0) {
                await supabase.from('supplier_quote_delivery_allocations').insert(allocRows as any);
              }
            }
          } catch (deliveryErr) {
            console.error('[AddQuoteSheet] AI delivery persist error:', deliveryErr);
            toast.warning('Quote saved but delivery lines could not be persisted');
          }
        }

        toast.success('Supplier materials added successfully');
        queryClient.invalidateQueries({ queryKey: ['supplier-materials'] });
        queryClient.invalidateQueries({ queryKey: ['supplier-quotes'] });
        if (supplierId) queryClient.invalidateQueries({ queryKey: ['delivery-rates', supplierId] });
        onOpenChange(false);
        onSuccess?.();
      } catch (error) {
        console.error('[AddQuoteSheet] AI Confirmation error:', error);
        toast.error('Confirmation failed');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Edit mode
    if (isEditMode && editData) {
      await handleEditSubmit();
      return;
    }

    // Manual mode (new quote)
    const supplierId = effectiveSupplierId;
    if (!supplierId) return;

    const toInsert = validLines.filter(l => l.material);
    if (toInsert.length === 0) {
      toast.error('Add at least one material');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create parent supplier_quote
      const { data: quoteData, error: quoteErr } = await supabase
        .from('supplier_quotes')
        .insert({
          supplier_account_id: supplierId,
          status: 'submitted',
          source: 'manual',
          notes: quoteNotes || null,
          created_by: user?.id || null,
        })
        .select('id')
        .single();
      if (quoteErr) throw quoteErr;

      // 2. Insert material items
      const rows = toInsert.map(l => ({
        supplier_account_id: supplierId,
        supplier_quote_id: quoteData.id,
        material_id: l.material!.id,
        unit_price: l.unit_price,
        moq: null,
        lead_time_days: null,
        notes: l.notes || null,
        status: 'submitted' as const,
        quote_version: 0,
        created_by: user?.id || null,
      }));

      const { data: insertedItems, error } = await supabase.from('supplier_materials').insert(rows).select('id, material_id, unit_price, moq');
      if (error) throw error;

      // 3. Insert new delivery lines as delivery_rates
      if (validDeliveryLines.length > 0) {
        const drRows = validDeliveryLines.map(dl => ({
          supplier_account_id: supplierId,
          zone_codes: dl.zoneCodes,
          price_per_moq: dl.pricePerMoq!,
          notes: dl.notes || null,
          is_default: dl.isDefault,
          supplier_material_ids: dl.isDefault ? [] : dl.materialIds,
          created_by: user?.id || null,
        }));
        const { error: drErr } = await supabase.from('delivery_rates').insert(drRows as any);
        if (drErr) {
          console.error('[AddQuoteSheet] Delivery rate creation failed:', drErr);
          toast.warning('Quote saved but delivery rates could not be created');
        }
      }

      // 4. Also insert into supplier_quote_delivery_lines for quote tracking
      if (validDeliveryLines.length > 0) {
        const dlRows = validDeliveryLines.map(dl => ({
          supplier_quote_id: quoteData.id,
          material_ids: dl.isDefault ? toInsert.map(l => l.material!.id) : dl.materialIds,
          zone_codes: dl.zoneCodes,
          price_per_moq: dl.pricePerMoq!,
          notes: dl.notes || null,
        }));
        const { data: dlData, error: dlErr } = await supabase
          .from('supplier_quote_delivery_lines')
          .insert(dlRows)
          .select('id, material_ids, zone_codes, price_per_moq');
        
        if (!dlErr && dlData && dlData.length > 0 && insertedItems && insertedItems.length > 0) {
          try {
            const allocRows = buildEqualAllocations({
              quoteId: quoteData.id,
              deliveryLines: dlData as any,
              supplierMaterials: insertedItems.map(sm => ({
                id: sm.id,
                material_id: sm.material_id,
                unit_price: sm.unit_price,
                moq: sm.moq,
              })),
            });
            if (allocRows.length > 0) {
              await supabase.from('supplier_quote_delivery_allocations').insert(allocRows as any);
            }
          } catch (allocError) {
            console.error('[AddQuoteSheet] Allocation error (non-blocking):', allocError);
          }
        }
      }

      // 5. Upload attachment if present
      if (attachedFile && quoteData.id) {
        try {
          const filePath = `${supplierId}/${quoteData.id}/${attachedFile.name}`;
          const { error: uploadErr } = await supabase.storage
            .from('supplier-quotes')
            .upload(filePath, attachedFile);
          if (!uploadErr) {
            await supabase.from('attachments').insert({
              entity_type: 'supplier_quote',
              entity_id: quoteData.id,
              bucket: 'supplier-quotes',
              storage_path: filePath,
              file_name: attachedFile.name,
              mime_type: attachedFile.type,
              size_bytes: attachedFile.size,
              created_by: user?.id || null,
            });
          }
        } catch (attachErr) {
          console.error('[AddQuoteSheet] Attachment upload error:', attachErr);
          toast.warning('Quote saved but file attachment failed');
        }
      }

      toast.success(`Quote with ${rows.length} item(s) added`);
      queryClient.invalidateQueries({ queryKey: ['supplier-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-materials'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-rates', supplierId] });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('[AddQuoteSheet] Error:', error);
      toast.error('Failed to add quote');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!editData) return;
    const quoteId = editData.id;
    const supplierId = editData.supplier_account_id;
    const toUpsert = validLines.filter(l => l.material);

    if (toUpsert.length === 0) {
      toast.error('Add at least one material');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Update quote notes
      await supabase
        .from('supplier_quotes')
        .update({ notes: quoteNotes || null, updated_by: user?.id || null })
        .eq('id', quoteId);

      // 2. Delete existing materials for this quote and re-insert
      await supabase.from('supplier_materials').delete().eq('supplier_quote_id', quoteId);

      const rows = toUpsert.map(l => ({
        supplier_account_id: supplierId,
        supplier_quote_id: quoteId,
        material_id: l.material!.id,
        unit_price: l.unit_price,
        moq: null,
        lead_time_days: null,
        notes: l.notes || null,
        status: 'submitted' as const,
        quote_version: 0,
        created_by: user?.id || null,
      }));

      const { data: insertedItems, error } = await supabase.from('supplier_materials').insert(rows).select('id, material_id, unit_price, moq');
      if (error) throw error;

      // 3. Re-sync delivery lines: delete old, insert new
      await supabase.from('supplier_quote_delivery_allocations').delete().eq('supplier_quote_id', quoteId);
      await supabase.from('supplier_quote_delivery_lines').delete().eq('supplier_quote_id', quoteId);

      if (validDeliveryLines.length > 0) {
        const dlRows = validDeliveryLines.map(dl => ({
          supplier_quote_id: quoteId,
          material_ids: dl.isDefault ? toUpsert.map(l => l.material!.id) : dl.materialIds,
          zone_codes: dl.zoneCodes,
          price_per_moq: dl.pricePerMoq!,
          notes: dl.notes || null,
        }));
        const { data: dlData, error: dlErr } = await supabase
          .from('supplier_quote_delivery_lines')
          .insert(dlRows)
          .select('id, material_ids, zone_codes, price_per_moq');

        if (!dlErr && dlData && dlData.length > 0 && insertedItems && insertedItems.length > 0) {
          try {
            const allocRows = buildEqualAllocations({
              quoteId,
              deliveryLines: dlData as any,
              supplierMaterials: insertedItems.map(sm => ({
                id: sm.id,
                material_id: sm.material_id,
                unit_price: sm.unit_price,
                moq: sm.moq,
              })),
            });
            if (allocRows.length > 0) {
              await supabase.from('supplier_quote_delivery_allocations').insert(allocRows as any);
            }
          } catch (allocError) {
            console.error('[AddQuoteSheet] Edit allocation error (non-blocking):', allocError);
          }
        }
      }

      // 4. Upload attachment if present
      if (attachedFile) {
        try {
          const filePath = `${supplierId}/${quoteId}/${attachedFile.name}`;
          const { error: uploadErr } = await supabase.storage
            .from('supplier-quotes')
            .upload(filePath, attachedFile);
          if (!uploadErr) {
            await supabase.from('attachments').insert({
              entity_type: 'supplier_quote',
              entity_id: quoteId,
              bucket: 'supplier-quotes',
              storage_path: filePath,
              file_name: attachedFile.name,
              mime_type: attachedFile.type,
              size_bytes: attachedFile.size,
              created_by: user?.id || null,
            });
          }
        } catch (attachErr) {
          console.error('[AddQuoteSheet] Attachment upload error:', attachErr);
          toast.warning('Quote updated but file attachment failed');
        }
      }

      toast.success('Quote updated successfully');
      queryClient.invalidateQueries({ queryKey: ['supplier-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-materials'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-rates', supplierId] });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('[AddQuoteSheet] Edit error:', error);
      toast.error('Failed to update quote');
    } finally {
      setSubmitting(false);
    }
  };

  const existingMaterialIds = useMemo(() =>
    lines.filter(l => l.material).map(l => l.material!.id),
    [lines]
  );

  const aiSupplierName = aiResult?.supplier_to_create?.display_name
    || aiResult?.supplier?.name_en
    || aiResult?.supplier?.name_ar;

  // Width rules per the unified-sheet plan:
  //  - AI review (preview present)        → full-screen edge-to-edge
  //  - AI awaiting upload                 → narrow centered card
  //  - Manual / edit                      → 4xl (current)
  const sheetWidthClass = hasPreview
    ? 'w-screen max-w-none sm:max-w-none'
    : isAwaitingUpload
      ? 'w-full sm:max-w-2xl'
      : 'w-full sm:max-w-4xl';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          className={cn('flex flex-col p-0 h-full max-h-screen', sheetWidthClass)}
        >
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <SheetTitle>
              {isEditMode
                ? 'Edit Supplier Quote'
                : isAwaitingUpload
                  ? 'Upload Quote File'
                  : isAiMode
                    ? 'Review Extracted Quote'
                    : 'Add Supplier Quote'}
            </SheetTitle>
            <SheetDescription>
              {isEditMode
                ? 'Update materials and prices for this quotation'
                : isAwaitingUpload
                  ? 'Upload a PDF or image — the AI will extract materials, prices and delivery info, then you can review and edit before saving.'
                  : isAiMode
                    ? 'Review AI-extracted materials. Edit, re-match, or remove items before confirming.'
                    : 'Add materials with clean prices (no delivery, no tax), then optionally set delivery zones'}
            </SheetDescription>
          </SheetHeader>

          {isAwaitingUpload ? (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <AiUploadStep
                onResult={(result, urls) => {
                  setInternalAiResult(result);
                  setInternalPreviewUrls(urls);
                  setPreviewIndex(0);
                }}
                onCancel={() => onOpenChange(false)}
                expectedSupplierAccountId={fixedSupplierId ?? null}
              />
            </div>
          ) : (
          <div className={cn('flex-1 min-h-0 flex', hasPreview ? 'flex-row' : 'flex-col')}>
            {/* File Preview Panel */}
            {hasPreview && (
              <div className="w-1/2 shrink-0 border-r flex flex-col bg-muted/30 min-h-0">
                <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b text-xs text-muted-foreground bg-muted/80 backdrop-blur">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Page {previewIndex + 1} of {filePreviewUrls.length}
                  </span>
                  {filePreviewUrls.length > 1 && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={previewIndex === 0} onClick={() => setPreviewIndex(i => i - 1)}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={previewIndex >= filePreviewUrls.length - 1} onClick={() => setPreviewIndex(i => i + 1)}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-2">
                  <img src={filePreviewUrls[previewIndex]} alt={`Page ${previewIndex + 1}`} className="w-full object-contain rounded shadow-sm" />
                </div>
              </div>
            )}

            {/* Form Panel */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6">
                <div className="space-y-5 py-4">
                  {/* Supplier Selection */}
                  {isEditMode ? (
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Supplier (locked)</label>
                      <div className="p-2.5 rounded-md border bg-muted/30 text-sm font-medium" dir="auto">
                        {editData?.supplier_name || editData?.supplier_account_id}
                      </div>
                    </div>
                  ) : isAiMode ? (
                    <>
                      {fixedSupplierId && (
                        <SupplierMismatchBanner
                          expected={{ id: fixedSupplierId, name: fixedSupplierName || 'this supplier' }}
                          extracted={{
                            id: aiResult?.matched_supplier?.account_id ?? null,
                            name: aiResult?.matched_supplier?.display_name
                              ?? aiResult?.supplier?.name_en
                              ?? aiResult?.supplier?.name_ar
                              ?? null,
                          }}
                          mismatch={!!(aiResult?.warnings ?? []).find((w: any) => w?.type === 'supplier_mismatch')}
                          onUseExpected={() => {
                            setSelectedSupplierId(fixedSupplierId);
                            setSelectedSupplierName(fixedSupplierName || '');
                            setNewSupplierDraft(null);
                          }}
                          onUseExtracted={() => {
                            const m = aiResult?.matched_supplier;
                            if (m?.account_id) {
                              setSelectedSupplierId(m.account_id);
                              setSelectedSupplierName(m.display_name || '');
                              setNewSupplierDraft(null);
                            }
                          }}
                        />
                      )}
                      <SupplierMatchPanel
                        extracted={aiResult?.supplier}
                        candidates={aiResult?.supplier_candidates}
                        matched={aiResult?.matched_supplier}
                        selectedSupplierId={selectedSupplierId}
                        selectedSupplierName={selectedSupplierName}
                        onSelect={(id, name) => {
                          setSelectedSupplierId(id);
                          setSelectedSupplierName(name);
                        }}
                        newSupplierDraft={newSupplierDraft}
                        onNewSupplierDraftChange={setNewSupplierDraft}
                      />
                    </>
                  ) : fixedSupplierId ? (
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Supplier</label>
                      <div className="p-2.5 rounded-md border bg-muted/30 text-sm font-medium">
                        {fixedSupplierName || fixedSupplierId}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Supplier *</label>
                      <SupplierCombobox
                        value={selectedSupplierId}
                        valueName={selectedSupplierName}
                        onChange={(id, name) => {
                          setSelectedSupplierId(id);
                          setSelectedSupplierName(name);
                          setPreFilled(false);
                        }}
                      />
                    </div>
                  )}

                  {/* Pre-fill notice */}
                  {preFilled && !isEditMode && (
                    <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 shrink-0" />
                      Pre-filled from supplier's existing catalog. Prices left empty for you to fill.
                    </div>
                  )}

                  {/* AI: validity + document info */}
                  {isAiMode && (
                    <QuoteValidityCard validity={aiResult?.validity} document={aiResult?.document} />
                  )}

                  {/* AI: errors banner */}
                  {isAiMode && aiResult?.errors && aiResult.errors.length > 0 && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Extraction errors
                      </div>
                      <ul className="text-[11px] text-destructive/80 list-disc pl-5 space-y-0.5">
                        {aiResult.errors.map((e, i) => <li key={i}>{e.description}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* AI: warnings banner */}
                  {isAiMode && aiResult?.warnings && aiResult.warnings.length > 0 && (
                    <div className="rounded-md border border-warning/30 bg-warning/5 p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-warning">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {aiResult.warnings.length} warning{aiResult.warnings.length > 1 ? 's' : ''} from extraction
                      </div>
                      <ul className="text-[11px] text-muted-foreground list-disc pl-5 space-y-0.5">
                        {aiResult.warnings.slice(0, 5).map((w, i) => <li key={i}>{w.description}</li>)}
                        {aiResult.warnings.length > 5 && (
                          <li className="italic">+{aiResult.warnings.length - 5} more — see row badges</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* ── Materials Section ── */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Materials</label>
                      <div className="flex items-center gap-2">
                        {lines.some(l => l.material) && (
                          <Button type="button" variant="ghost" size="sm" onClick={clearAllLines}>
                            <X className="mr-1 h-3.5 w-3.5" />
                            Clear all
                          </Button>
                        )}
                        <Button type="button" variant="outline" size="sm" onClick={openPickerForNewLines}>
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Add Materials
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Type in the material cell to search, or use the <Search className="inline h-3 w-3" /> icon for the full catalog. Prices are <strong>pre-tax</strong>, <strong>pre-delivery</strong>.
                    </p>

                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px] text-center">#</TableHead>
                            <TableHead>Material</TableHead>
                            <TableHead className="w-[200px]">
                              Price (SAR)
                              <Badge variant="outline" className="ml-1.5 text-[9px] font-normal">pre-tax · pre-delivery</Badge>
                            </TableHead>
                            <TableHead className="w-[90px] text-right">MOQ</TableHead>
                            <TableHead className="w-[36px] " />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((line, idx) => (
                            <TableRow key={line.id} className={cn(
                              line.aiConfidence !== undefined && line.aiConfidence < 0.6 && 'bg-warning/5'
                            )}>
                              <TableCell className="text-center text-xs text-muted-foreground font-mono align-top pt-3">
                                <div className="flex flex-col items-center gap-1">
                                  <span>{idx + 1}</span>
                                  {line.material && line.origin === 'prefilled' && (
                                    <Badge variant="outline" className="text-[8px] px-1 py-0 font-normal text-muted-foreground" title="Pre-filled from supplier's catalog">Pre</Badge>
                                  )}
                                  {line.material && line.origin === 'ai' && (
                                    <Badge variant="outline" className="text-[8px] px-1 py-0 font-normal border-primary/40 text-primary" title="Imported from AI extraction">AI</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {line.material ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className="min-w-0 flex-1 overflow-hidden">
                                      <span className="text-sm font-medium block break-words leading-tight">{line.material.name}</span>
                                      {line.material.code && (
                                        <span className="text-xs text-muted-foreground font-mono block">{line.material.code}</span>
                                      )}
                                      {line.aiDescription && line.aiDescription !== line.material.name && (
                                        <p className="text-[11px] text-muted-foreground italic break-words leading-tight mt-0.5" dir="auto" title={line.aiDescription}>
                                          “{line.aiDescription}”
                                        </p>
                                      )}
                                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        {line.aiConfidence !== undefined && (
                                          <Badge variant="outline" className={cn(
                                            'text-[10px]',
                                            line.aiConfidence >= 0.85 ? 'bg-success/10 text-success border-success/30' :
                                            line.aiConfidence >= 0.6 ? 'bg-warning/10 text-warning border-warning/30' :
                                            'bg-destructive/10 text-destructive border-destructive/30'
                                          )}>
                                            {Math.round(line.aiConfidence * 100)}%
                                          </Badge>
                                        )}
                                        {line.aiAlternatives && line.aiAlternatives.length > 0 && (
                                          <Button
                                            type="button"
                                            variant="link"
                                            size="sm"
                                            className="h-auto p-0 text-[11px] gap-0.5"
                                            onClick={() => toggleAltOpen(line.id)}
                                          >
                                            {line.aiAltOpen ? 'Hide' : 'View'} {line.aiAlternatives.length} alternative{line.aiAlternatives.length > 1 ? 's' : ''}
                                            <ChevronDown className={cn('h-3 w-3 transition-transform', line.aiAltOpen && 'rotate-180')} />
                                          </Button>
                                        )}
                                        {line.aiPriceFlags?.includes('vat_status_assumed') && (
                                          <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30" title="VAT status was not specified in the document — 15% assumed">
                                            VAT assumed
                                          </Badge>
                                        )}
                                        {line.aiPriceFlags?.includes('total_price_mismatch') && (
                                          <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30" title="Quantity × unit price does not equal total — please verify">
                                            Total mismatch
                                          </Badge>
                                        )}
                                      </div>
                                      {line.aiNotes && (
                                        <p className="text-[11px] text-muted-foreground italic mt-0.5" dir="auto">
                                          📝 {line.aiNotes}
                                        </p>
                                      )}
                                      {line.aiAltOpen && line.aiAlternatives && line.aiAlternatives.length > 0 && (
                                        <div className="mt-1.5 space-y-1 rounded border bg-muted/30 p-1.5">
                                          {line.aiAlternatives.map(alt => (
                                            <button
                                              key={alt.material_id}
                                              type="button"
                                              onClick={() => applyAlternative(line.id, alt)}
                                              className="w-full rounded border bg-background px-2 py-1 text-left text-[11px] hover:bg-accent hover:border-primary/50 transition-colors"
                                            >
                                              <div className="font-mono text-[10px] text-primary">{alt.material_code}</div>
                                              {alt.material_name && (
                                                <div className="font-medium leading-tight" dir="auto">{alt.material_name}</div>
                                              )}
                                              {alt.reason && (
                                                <div className="text-muted-foreground italic mt-0.5" dir="auto">{alt.reason}</div>
                                              )}
                                            </button>
                                          ))}
                                          <button
                                            type="button"
                                            onClick={() => openPickerForLine(line.id)}
                                            className="w-full text-[10px] text-muted-foreground hover:text-foreground py-0.5"
                                          >
                                            Search full catalog…
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => openPickerForLine(line.id)} title="Re-match material">
                                      <Search className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {line.aiDescription && (
                                      <p className="text-xs text-muted-foreground italic break-words leading-tight" dir="auto" title={line.aiDescription}>
                                        “{line.aiDescription}”
                                      </p>
                                    )}
                                    <MaterialAutocompleteCell
                                      initialQuery={line.aiDescription ?? ''}
                                      placeholder="Type to search materials…"
                                      onPick={(m) => handleInlineMaterialPicked(line.id, m)}
                                      onOpenCatalog={() => openPickerForLine(line.id)}
                                    />
                                    {line.aiAlternatives && line.aiAlternatives.length > 0 && (
                                      <span className="text-[11px] text-muted-foreground" title={line.aiAlternatives.map(a => `${a.material_code} — ${a.material_name ?? ''}`).join('\n')}>
                                        {line.aiAlternatives.length} AI suggestion{line.aiAlternatives.length > 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Input
                                    data-price-row={line.id}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    className="h-10 text-base flex-1 min-w-[110px]"
                                    value={line.unit_price ?? ''}
                                    onChange={e => {
                                      const raw = e.target.value;
                                      if (raw === '') return updateLine(line.id, 'unit_price', null);
                                      const n = parseFloat(raw);
                                      if (Number.isNaN(n)) return;
                                      if (n < 0) {
                                        toast.error('Price cannot be negative');
                                        return updateLine(line.id, 'unit_price', 0);
                                      }
                                      updateLine(line.id, 'unit_price', n);
                                    }}
                                    onKeyDown={(e) => {
                                      const moveBy = (delta: number) => {
                                        e.preventDefault();
                                        const inputs = Array.from(
                                          (e.currentTarget.closest('table') as HTMLTableElement | null)?.querySelectorAll<HTMLInputElement>(
                                            'input[data-price-row]',
                                          ) ?? [],
                                        );
                                        const i = inputs.indexOf(e.currentTarget);
                                        const next = inputs[i + delta];
                                        if (next) { next.focus(); next.select(); }
                                      };
                                      if (e.key === 'Enter' || e.key === 'ArrowDown') return moveBy(1);
                                      if (e.key === 'ArrowUp') return moveBy(-1);
                                    }}
                                  />
                                  {line.material && (
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      /{line.uom}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-xs text-muted-foreground">
                                  {(line.resolved_moq ?? line.material?.moq) != null
                                    ? `${Number(line.resolved_moq ?? line.material!.moq).toLocaleString()}${line.uom ? ` ${line.uom}` : ''}`
                                    : '—'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeLine(line.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* ── Delivery Rates Section ── */}
                  {!isAwaitingUpload && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            Delivery Rates
                          </label>
                          <Button type="button" variant="outline" size="sm" onClick={addDeliveryLine}>
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add Delivery Line
                          </Button>
                        </div>

                        {/* Existing default delivery rates */}
                        {existingDeliveryLines.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Existing default rates for this supplier:</p>
                            {existingDeliveryLines.map(dl => (
                              <DeliveryLineEditor
                                key={dl.id}
                                line={dl}
                                quoteMaterials={quoteMaterials}
                                onUpdate={() => {}}
                                onRemove={() => {}}
                                isExisting
                              />
                            ))}
                          </div>
                        )}

                        {deliveryLines.length === 0 && existingDeliveryLines.length === 0 ? (
                          <div className="border rounded-lg border-dashed p-4 text-center">
                            <MapPin className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                            <p className="text-sm text-muted-foreground">No delivery lines yet</p>
                            <p className="text-xs text-muted-foreground">You can add delivery rates now or later</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {deliveryLines.map(dl => (
                              <DeliveryLineEditor
                                key={dl.id}
                                line={dl}
                                quoteMaterials={quoteMaterials}
                                onUpdate={(updated) => updateDeliveryLine(dl.id, updated)}
                                onRemove={() => removeDeliveryLine(dl.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* ── File Attachment ── */}
                  {!isAiMode && !isAwaitingUpload && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        <Paperclip className="h-4 w-4" />
                        Attach Quotation File
                        <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                      </label>
                      {attachedFile ? (
                        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/20">
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm flex-1 truncate">{attachedFile.name}</span>
                          <span className="text-xs text-muted-foreground">{(attachedFile.size / 1024).toFixed(0)} KB</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAttachedFile(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 p-3 border border-dashed rounded-md cursor-pointer hover:bg-muted/30 transition-colors">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Click to attach file</span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) setAttachedFile(file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {/* Quote-level Notes */}
                  {!isAwaitingUpload && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Quote Notes</label>
                      <Textarea
                        placeholder="Any notes about this quotation..."
                        className="resize-none"
                        rows={2}
                        value={quoteNotes}
                        onChange={e => setQuoteNotes(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t px-6 py-4 flex items-center justify-between shrink-0">
                <div className="text-sm text-muted-foreground">
                  {validLines.filter(l => l.material).length} item(s)
                  {validDeliveryLines.length > 0 && ` · ${validDeliveryLines.length} delivery line(s)`}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isAiMode ? !canSubmitAi || submitting : !canSubmit || submitting}
                  >
                    {submitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isEditMode ? 'Updating...' : isAiMode ? 'Confirming...' : 'Adding...'}
                      </>
                    ) : (
                      isEditMode
                        ? `Update Quote (${validLines.filter(l => l.material).length} items)`
                        : isAiMode
                          ? `Confirm ${validLines.filter(l => l.material).length} Item(s)`
                          : `Add Quote (${validLines.filter(l => l.material).length} items)`
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          )}
        </SheetContent>
      </Sheet>

      <MaterialPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={pickerLineId ? handleMaterialPicked : undefined}
        onBulkSelect={!pickerLineId ? handleBulkMaterialsPicked : undefined}
        excludeIds={existingMaterialIds}
        hideSupplierFilter
      />
    </>
  );
}
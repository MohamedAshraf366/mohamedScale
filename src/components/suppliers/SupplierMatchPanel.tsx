import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Loader2, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type {
  AiExtractedSupplier,
  AiSupplierCandidate,
} from "./AiUploadStep";

/**
 * Editable draft for a brand-new supplier built from the extracted block.
 * Persisted upward to the parent sheet so the actual insert can run inside
 * the Confirm action — never on click.
 */
export interface NewSupplierDraft {
  name_en: string;
  name_ar: string;
  tax_number: string;
  cr_no: string;
  phone: string;
  email: string;
  website: string;
  city: string;
  supplier_type: string;
}

export const EMPTY_NEW_SUPPLIER_DRAFT: NewSupplierDraft = {
  name_en: "",
  name_ar: "",
  tax_number: "",
  cr_no: "",
  phone: "",
  email: "",
  website: "",
  city: "",
  supplier_type: "store",
};

interface SupplierMatchPanelProps {
  extracted?: AiExtractedSupplier;
  candidates?: AiSupplierCandidate[];
  matched?: AiSupplierCandidate;
  selectedSupplierId: string;
  selectedSupplierName: string;
  /** "" means "create new". Set whenever user picks a candidate. */
  onSelect: (accountId: string, name: string) => void;
  /**
   * Set when the user enters create-new mode. Parent uses this draft at
   * Confirm time to insert the supplier (deferred). null clears it.
   */
  newSupplierDraft: NewSupplierDraft | null;
  onNewSupplierDraftChange: (draft: NewSupplierDraft | null) => void;
}

interface UpdatableField {
  key: "tax_number" | "website" | "phone" | "email";
  label: string;
  source: string;
  current: string | null;
  enabled: boolean;
}

function draftFromExtracted(
  extracted: AiExtractedSupplier | undefined,
): NewSupplierDraft {
  return {
    name_en: extracted?.name_en ?? "",
    name_ar: extracted?.name_ar ?? "",
    tax_number: extracted?.tax_number ?? "",
    cr_no: extracted?.cr_no != null ? String(extracted.cr_no) : "",
    phone: extracted?.phone ?? "",
    email: extracted?.email ?? "",
    website: extracted?.website ?? "",
    city: extracted?.city ?? "",
    supplier_type: extracted?.supplier_type || "store",
  };
}

/**
 * Mirrors the inline material-matching UX for the supplier extracted from the
 * quote. Shows the raw extracted block, lists scored candidates with a
 * "Create new" option, and — once a match is selected — offers to fill any
 * empty fields on that supplier with values found in the quote.
 *
 * IMPORTANT: clicking "Create as new supplier" no longer inserts into the
 * database. It opens an inline editable draft, pre-filled from extraction.
 * The parent sheet performs the actual insert as part of Confirm so we
 * don't create dangling suppliers if the user cancels.
 */
export function SupplierMatchPanel({
  extracted,
  candidates = [],
  matched,
  selectedSupplierId,
  selectedSupplierName,
  onSelect,
  newSupplierDraft,
  onNewSupplierDraftChange,
}: SupplierMatchPanelProps) {
  const { user } = useAuth();
  const [updateFields, setUpdateFields] = useState<UpdatableField[]>([]);
  const [savingUpdates, setSavingUpdates] = useState(false);

  const bestScore = candidates[0]?.confidence ?? 0;
  const looksNew = bestScore < 0.6;
  const isCreatingNew = newSupplierDraft !== null;

  // When a match is chosen, look up which fields are currently empty on the
  // existing record so we can offer to fill them from the quote (no overwrites).
  useEffect(() => {
    if (!selectedSupplierId || !extracted) {
      setUpdateFields([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: account } = await supabase
        .from("accounts")
        .select("id, tax_number, website, poc_contact_id")
        .eq("id", selectedSupplierId)
        .maybeSingle();
      if (!account || cancelled) return;

      let pocPhone: string | null = null;
      let pocEmail: string | null = null;
      if (account.poc_contact_id) {
        const { data: poc } = await supabase
          .from("contacts")
          .select("phone, email")
          .eq("id", account.poc_contact_id)
          .maybeSingle();
        pocPhone = poc?.phone ?? null;
        pocEmail = poc?.email ?? null;
      }

      const fields: UpdatableField[] = [];
      if (extracted.tax_number && !account.tax_number) {
        fields.push({
          key: "tax_number",
          label: "Tax number",
          source: extracted.tax_number,
          current: account.tax_number,
          enabled: true,
        });
      }
      if (extracted.website && !account.website) {
        fields.push({
          key: "website",
          label: "Website",
          source: extracted.website,
          current: account.website,
          enabled: true,
        });
      }
      if (extracted.phone && !pocPhone && account.poc_contact_id) {
        fields.push({
          key: "phone",
          label: "Primary phone",
          source: extracted.phone,
          current: pocPhone,
          enabled: true,
        });
      }
      if (extracted.email && !pocEmail && account.poc_contact_id) {
        fields.push({
          key: "email",
          label: "Primary email",
          source: extracted.email,
          current: pocEmail,
          enabled: true,
        });
      }
      if (!cancelled) setUpdateFields(fields);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSupplierId, extracted]);

  const enterCreateNewMode = () => {
    onSelect("", ""); // clear any selected match
    onNewSupplierDraftChange(draftFromExtracted(extracted));
  };

  const exitCreateNewMode = () => {
    onNewSupplierDraftChange(null);
  };

  const updateDraft = (patch: Partial<NewSupplierDraft>) => {
    if (!newSupplierDraft) return;
    onNewSupplierDraftChange({ ...newSupplierDraft, ...patch });
  };

  const toggleField = (key: UpdatableField["key"]) => {
    setUpdateFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f)),
    );
  };

  const handleSaveUpdates = async () => {
    const enabled = updateFields.filter((f) => f.enabled);
    if (enabled.length === 0) return;
    setSavingUpdates(true);
    try {
      const accountPatch: Record<string, string> = {};
      const contactPatch: Record<string, string> = {};
      for (const f of enabled) {
        if (f.key === "tax_number" || f.key === "website") {
          accountPatch[f.key] = f.source;
        } else if (f.key === "phone" || f.key === "email") {
          contactPatch[f.key] = f.source;
        }
      }
      if (Object.keys(accountPatch).length > 0) {
        const { error } = await supabase
          .from("accounts")
          .update({ ...accountPatch, updated_by: user?.id || null })
          .eq("id", selectedSupplierId);
        if (error) throw error;
      }
      if (Object.keys(contactPatch).length > 0) {
        const { data: acc } = await supabase
          .from("accounts")
          .select("poc_contact_id")
          .eq("id", selectedSupplierId)
          .maybeSingle();
        if (acc?.poc_contact_id) {
          const { error } = await supabase
            .from("contacts")
            .update({ ...contactPatch, updated_by: user?.id || null })
            .eq("id", acc.poc_contact_id);
          if (error) throw error;
        }
      }
      toast.success(`Updated ${enabled.length} field(s) on supplier`);
      setUpdateFields((prev) => prev.filter((f) => !f.enabled));
    } catch (err: any) {
      toast.error("Update failed: " + err.message);
    } finally {
      setSavingUpdates(false);
    }
  };

  const extractedName =
    extracted?.name_ar || extracted?.name_en || "Unknown supplier";

  // Which fields of the draft were carried over from the extraction (used to
  // dim those that were left blank, so the user can spot what to fill in).
  const extractedKeyset = useMemo(() => {
    const s = new Set<keyof NewSupplierDraft>();
    if (extracted?.name_en) s.add("name_en");
    if (extracted?.name_ar) s.add("name_ar");
    if (extracted?.tax_number) s.add("tax_number");
    if (extracted?.cr_no != null && String(extracted.cr_no).length > 0) s.add("cr_no");
    if (extracted?.phone) s.add("phone");
    if (extracted?.email) s.add("email");
    if (extracted?.website) s.add("website");
    if (extracted?.city) s.add("city");
    if (extracted?.supplier_type) s.add("supplier_type");
    return s;
  }, [extracted]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Supplier (from quote)</Label>

      <div className="rounded-md border bg-muted/20 p-3 space-y-3">
        {/* Extracted block */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium" dir="auto">
              {extractedName}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            {extracted?.tax_number && (
              <span className="font-mono">Tax: {extracted.tax_number}</span>
            )}
            {extracted?.cr_no && (
              <span className="font-mono">· CR: {extracted.cr_no}</span>
            )}
            {extracted?.phone && <span>· {extracted.phone}</span>}
            {extracted?.email && <span>· {extracted.email}</span>}
            {extracted?.city && <span>· {extracted.city}</span>}
            {extracted?.supplier_type && (
              <Badge variant="outline" className="text-[10px] py-0 h-4">
                {extracted.supplier_type}
              </Badge>
            )}
          </div>
        </div>

        {looksNew && candidates.length === 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground italic">
            <Sparkles className="h-3 w-3" />
            No close match in your suppliers — likely a new one.
          </p>
        )}

        {/* Candidate list */}
        <div className="space-y-1">
          {candidates.map((c, i) => {
            const selected =
              !isCreatingNew && selectedSupplierId === c.account_id;
            const score = Math.round(c.confidence * 100);
            return (
              <button
                key={c.account_id}
                type="button"
                onClick={() => {
                  onNewSupplierDraftChange(null);
                  onSelect(c.account_id, c.display_name);
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-left text-xs transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {selected ? (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <span
                      className={cn(
                        "h-3.5 w-3.5 rounded-full border shrink-0",
                        i === 0 && "border-primary",
                      )}
                    />
                  )}
                  <span className="truncate font-medium" dir="auto">
                    {c.display_name}
                  </span>
                  {i === 0 && (
                    <Badge variant="outline" className="text-[10px] py-0 h-4">
                      Best
                    </Badge>
                  )}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] py-0 h-4 shrink-0",
                    score >= 90 && "bg-success/10 text-success border-success/30",
                    score >= 60 &&
                      score < 90 &&
                      "bg-warning/10 text-warning border-warning/30",
                    score < 60 &&
                      "bg-destructive/10 text-destructive border-destructive/30",
                  )}
                >
                  {score}%
                </Badge>
              </button>
            );
          })}

          {/* Create new — enters edit mode, does NOT insert */}
          <button
            type="button"
            onClick={isCreatingNew ? exitCreateNewMode : enterCreateNewMode}
            className={cn(
              "w-full flex items-center justify-between gap-2 rounded border border-dashed px-2.5 py-1.5 text-left text-xs transition-colors",
              "hover:bg-muted/50",
              isCreatingNew && "border-primary bg-primary/5",
            )}
          >
            <span className="flex items-center gap-2">
              {isCreatingNew ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {isCreatingNew
                ? "Will create on Confirm — click to cancel"
                : "Create as new supplier"}
            </span>
          </button>
        </div>

        {/* Inline editable draft — pre-filled from extraction. Saved on Confirm. */}
        {isCreatingNew && newSupplierDraft && (
          <div className="rounded-md border border-primary/30 bg-background p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">New supplier details</span>
              <span className="text-[10px] text-muted-foreground italic">
                Created when you click Confirm
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <DraftField
                label="Name (EN)"
                value={newSupplierDraft.name_en}
                placeholder="Acme Trading Co."
                fromExtraction={extractedKeyset.has("name_en")}
                onChange={(v) => updateDraft({ name_en: v })}
              />
              <DraftField
                label="Name (AR)"
                value={newSupplierDraft.name_ar}
                placeholder="شركة..."
                dir="rtl"
                fromExtraction={extractedKeyset.has("name_ar")}
                onChange={(v) => updateDraft({ name_ar: v })}
              />
              <DraftField
                label="Tax number"
                value={newSupplierDraft.tax_number}
                placeholder="3001234567"
                fromExtraction={extractedKeyset.has("tax_number")}
                onChange={(v) => updateDraft({ tax_number: v })}
              />
              <DraftField
                label="CR number"
                value={newSupplierDraft.cr_no}
                placeholder="1010..."
                fromExtraction={extractedKeyset.has("cr_no")}
                onChange={(v) => updateDraft({ cr_no: v })}
              />
              <DraftField
                label="Phone"
                value={newSupplierDraft.phone}
                placeholder="+9665..."
                fromExtraction={extractedKeyset.has("phone")}
                onChange={(v) => updateDraft({ phone: v })}
              />
              <DraftField
                label="Email"
                value={newSupplierDraft.email}
                placeholder="info@..."
                fromExtraction={extractedKeyset.has("email")}
                onChange={(v) => updateDraft({ email: v })}
              />
              <DraftField
                label="Website"
                value={newSupplierDraft.website}
                placeholder="https://..."
                fromExtraction={extractedKeyset.has("website")}
                onChange={(v) => updateDraft({ website: v })}
              />
              <DraftField
                label="City"
                value={newSupplierDraft.city}
                placeholder="Riyadh"
                fromExtraction={extractedKeyset.has("city")}
                onChange={(v) => updateDraft({ city: v })}
              />
              <div className="space-y-1 col-span-2">
                <Label className="text-[10px] text-muted-foreground">
                  Supplier type
                </Label>
                <Select
                  value={newSupplierDraft.supplier_type || "store"}
                  onValueChange={(v) => updateDraft({ supplier_type: v })}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="store">Store</SelectItem>
                    <SelectItem value="factory">Factory</SelectItem>
                    <SelectItem value="distributor">Distributor</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="service_provider">Service provider</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!(newSupplierDraft.name_en || newSupplierDraft.name_ar) && (
              <p className="text-[11px] text-destructive">
                Provide a name (EN or AR) before confirming.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Update missing fields panel */}
      {updateFields.length > 0 && (
        <div className="rounded-md border border-dashed bg-success/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">
              Fill missing fields on this supplier?
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveUpdates}
              disabled={
                savingUpdates || updateFields.every((f) => !f.enabled)
              }
              className="h-6 text-xs"
            >
              {savingUpdates ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
          <div className="space-y-1">
            {updateFields.map((f) => (
              <label
                key={f.key}
                className="flex items-center gap-2 text-xs cursor-pointer"
              >
                <Checkbox
                  checked={f.enabled}
                  onCheckedChange={() => toggleField(f.key)}
                  className="h-3.5 w-3.5"
                />
                <span className="text-muted-foreground w-24 shrink-0">
                  {f.label}
                </span>
                <span className="font-medium truncate" dir="auto">
                  {f.source}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DraftField({
  label,
  value,
  placeholder,
  fromExtraction,
  onChange,
  dir,
}: {
  label: string;
  value: string;
  placeholder?: string;
  fromExtraction: boolean;
  onChange: (v: string) => void;
  dir?: "ltr" | "rtl" | "auto";
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
        {label}
        {fromExtraction ? (
          <span className="text-success">·</span>
        ) : (
          <span className="text-muted-foreground/60 italic">(empty)</span>
        )}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir ?? "auto"}
        className="h-7 text-xs"
      />
    </div>
  );
}

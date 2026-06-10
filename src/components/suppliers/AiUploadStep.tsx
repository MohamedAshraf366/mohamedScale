import { useRef, useState } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { pdfToImages, type PdfPageImage } from "@/lib/pdf-to-images";
import { ProcessingOverlay } from "./ProcessingOverlay";

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * One extracted material row from `quote-extract` edge function.
 * Mirrors the n8n shape for back-compat, plus per-row `notes` and price metadata.
 */
export interface AiExtractedRow {
  index: number;
  description: string;
  material_id: string | null;
  material_name?: string | null;
  material_code?: string | null;
  uom?: string | null;
  moq?: number | null;
  vat_rate?: number | null;
  unit_price_excluding_vat?: number | null;
  unit_price_including_vat: number;
  /** Legacy alias from older worker versions. */
  unit_price_including_tax?: number;
  confidence: number;
  /** Per-row note from the document (line-level remark). */
  notes?: string | null;
  metadata?: {
    match?: {
      method?: string;
      matched_fields?: string[];
      unmatched_fields?: string[];
      candidate_alternatives?: Array<{
        material_id: string;
        material_code: string;
        material_name?: string;
        reason?: string;
      }>;
      missing_or_ambiguous_fields?: string[];
    };
    price?: {
      raw_price_text?: string;
      unit_price_found?: number | null;
      vat_rate_found?: number | null;
      currency?: string;
      flags?: string[];
    };
    source_item?: {
      description?: string;
      quantity?: number | null;
      unit_price?: number | null;
      total_price?: number | null;
    };
  };
}

export interface AiSupplierCandidate {
  account_id: string;
  display_name: string;
  supplier_code?: string | null;
  confidence: number;
  matched_fields?: string[];
}

export interface AiExtractedSupplier {
  name_ar?: string | null;
  name_en?: string | null;
  cr_no?: number | string | null;
  tax_number?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  city?: string | null;
  supplier_type?: string | null;
}

export interface AiValidity {
  valid_until?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
}

export interface AiDocumentInfo {
  date?: string | null;
  document_type?: string | null;
  reference_number?: string | null;
}

export interface AiWarning {
  type: string;
  row_index?: number;
  description: string;
}

export interface AiExtractionResult {
  rows: AiExtractedRow[];
  delivery_rates?: Array<{
    zone_codes?: string[];
    zone_hint?: string | null;
    price_per_moq?: number | null;
    price_per_trip?: number | null;
    notes?: string | null;
    is_default?: boolean;
    material_ids?: string[];
  }>;
  /** Legacy: preview of supplier to create (when no match). Kept for back-compat. */
  supplier_to_create?: {
    account_id: string;
    display_name: string;
    supplier_type?: string;
  };
  /** Raw extracted supplier block from the document (always present in edge response). */
  supplier?: AiExtractedSupplier;
  /** Top supplier candidates scored against existing accounts. */
  supplier_candidates?: AiSupplierCandidate[];
  /** High-confidence single match (>= 0.9). */
  matched_supplier?: AiSupplierCandidate;
  document?: AiDocumentInfo;
  validity?: AiValidity;
  warnings?: AiWarning[];
  errors?: AiWarning[];
  title?: string;
  confirm_token: string;
}

interface AiUploadStepProps {
  onResult: (result: AiExtractionResult, previewUrls: string[]) => void;
  onCancel: () => void;
  /** When set, the edge function compares the extracted supplier against this id and emits a `supplier_mismatch` warning if it doesn't match. */
  expectedSupplierAccountId?: string | null;
}

export function AiUploadStep({ onResult, onCancel, expectedSupplierAccountId }: AiUploadStepProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");

  const validateFile = (file: File): boolean => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      toast.error("Please upload a PDF or image file (PNG, JPG, WEBP)");
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File size must be less than 10MB");
      return false;
    }
    return true;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && validateFile(file)) setSelectedFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && validateFile(file)) setSelectedFile(file);
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
    });

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setIsSubmitting(true);
    try {
      let images: Array<{ name: string; type: string; content: string }> = [];
      let previewUrls: string[] = [];
      const isPdf = selectedFile.type === "application/pdf";

      if (isPdf) {
        setProgressMessage("Converting PDF pages...");
        const pageImages: PdfPageImage[] = await pdfToImages(selectedFile, {
          scale: 2,
          quality: 0.85,
          onProgress: (done, total) =>
            setProgressMessage(`Converting page ${done}/${total}...`),
        });
        images = pageImages.map((img) => ({
          name: `${selectedFile.name}_page_${img.pageNumber}.jpg`,
          type: "image/jpeg",
          content: img.base64,
        }));
        previewUrls = pageImages.map((img) => img.dataUrl);
      } else {
        const base64 = await fileToBase64(selectedFile);
        images = [
          { name: selectedFile.name, type: selectedFile.type, content: base64 },
        ];
        previewUrls = [URL.createObjectURL(selectedFile)];
      }

      setProgressMessage("Analyzing with AI...");

      console.log("[AiUploadStep] Invoking quote-extract with", images.length, "image(s)");

      const { data: result, error } = await supabase.functions.invoke("quote-extract", {
        body: {
          actor_user_id: user?.id || "",
          images,
          ...(expectedSupplierAccountId ? { expected_supplier_account_id: expectedSupplierAccountId } : {}),
        },
      });

      if (error) throw error;
      console.log("[AiUploadStep] Edge response:", result);

      if (result?.status === "needs_confirmation" && result.confirm_token) {
        onResult(
          {
            ...result.confirm_preview,
            confirm_token: result.confirm_token,
          },
          previewUrls,
        );
        clearFile();
      } else if (result?.ok) {
        toast.success("Quote processed successfully");
        clearFile();
      } else {
        toast.error(result?.message || "Failed to process quote");
      }
    } catch (error) {
      console.error("[AiUploadStep] Error:", error);
      toast.error("Failed to upload quote");
    } finally {
      setIsSubmitting(false);
      setProgressMessage("");
    }
  };

  return (
    <>
      <ProcessingOverlay
        visible={isSubmitting}
        message="Analyzing your quote"
        progress={progressMessage}
      />

      <div className="flex h-full flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold">Upload Quote File</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a PDF or image of a supplier quote — we'll extract materials
              and prices automatically.
            </p>
          </div>

          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-8 transition-colors hover:border-muted-foreground/50"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {selectedFile ? (
              <div className="flex w-full items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFile}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
                <p className="mb-2 text-sm font-medium">
                  Drop your quote file here, or{" "}
                  <button
                    type="button"
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, PNG, JPG, WEBP (max 10MB)
                </p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedFile || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Analyze with AI
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

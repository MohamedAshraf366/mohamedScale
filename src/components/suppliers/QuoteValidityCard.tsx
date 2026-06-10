import { Calendar, FileText, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AiDocumentInfo, AiValidity } from "./AiUploadStep";

interface QuoteValidityCardProps {
  validity?: AiValidity;
  document?: AiDocumentInfo;
}

/**
 * Compact card surfacing quote validity (valid_until / payment terms / notes)
 * and source document info (date, type, reference) extracted by the worker.
 * Renders nothing when both inputs are empty.
 */
export function QuoteValidityCard({ validity, document }: QuoteValidityCardProps) {
  const hasValidity =
    !!validity?.valid_until || !!validity?.payment_terms || !!validity?.notes;
  const hasDoc =
    !!document?.date || !!document?.reference_number ||
    (document?.document_type && document.document_type !== "unknown");

  if (!hasValidity && !hasDoc) return null;

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileText className="h-4 w-4 text-muted-foreground" />
        Quote details
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {document?.date && (
          <Badge variant="outline" className="gap-1">
            <Calendar className="h-3 w-3" />
            Issued {document.date}
          </Badge>
        )}
        {document?.document_type && document.document_type !== "unknown" && (
          <Badge variant="outline">{document.document_type}</Badge>
        )}
        {document?.reference_number && (
          <Badge variant="outline" className="font-mono">
            Ref: {document.reference_number}
          </Badge>
        )}
        {validity?.valid_until && (
          <Badge variant="secondary" className="gap-1">
            <Calendar className="h-3 w-3" />
            Valid until {validity.valid_until}
          </Badge>
        )}
        {validity?.payment_terms && (
          <Badge variant="secondary">Payment: {validity.payment_terms}</Badge>
        )}
      </div>
      {validity?.notes && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground" dir="auto">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          {validity.notes}
        </p>
      )}
    </div>
  );
}

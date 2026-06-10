import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** The supplier the user opened the sheet from. */
  expected: { id: string; name: string } | null;
  /** The supplier the AI matched from the document, if any. */
  extracted: { id: string | null; name: string | null } | null;
  /** True if the edge function emitted a `supplier_mismatch` warning. */
  mismatch: boolean;
  onUseExpected: () => void;
  onUseExtracted: () => void;
}

/**
 * Header strip shown above the AddQuoteSheet when the user opened from a
 * specific supplier and uploaded a file. Confirms a match (green) or warns
 * about a mismatch (red) so the user can pick which supplier to use.
 */
export function SupplierMismatchBanner({
  expected,
  extracted,
  mismatch,
  onUseExpected,
  onUseExtracted,
}: Props) {
  if (!expected) return null;

  if (!mismatch) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Confirmed: this quote is from <strong>{expected.name}</strong>.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
      <div className="flex items-start gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Supplier mismatch</p>
          <p className="text-foreground/80">
            You opened this from <strong>{expected.name}</strong>. The quote appears to be from{' '}
            <strong>{extracted?.name ?? 'an unknown supplier'}</strong>. Pick which supplier this
            quote belongs to.
          </p>
        </div>
      </div>
      <div className="flex gap-2 pl-6">
        <Button size="sm" variant="outline" onClick={onUseExpected}>
          Use {expected.name}
        </Button>
        {extracted?.id && (
          <Button size="sm" variant="outline" onClick={onUseExtracted}>
            Use {extracted.name}
          </Button>
        )}
      </div>
    </div>
  );
}

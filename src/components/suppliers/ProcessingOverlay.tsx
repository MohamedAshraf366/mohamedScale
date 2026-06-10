import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface ProcessingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: string;
}

export function ProcessingOverlay({ visible, message = 'Processing...', progress }: ProcessingOverlayProps) {
  // Block navigation via beforeunload
  useEffect(() => {
    if (!visible) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-lg max-w-sm text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div>
          <p className="text-base font-semibold text-foreground">{message}</p>
          {progress && (
            <p className="text-sm text-muted-foreground mt-1">{progress}</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Please don't close or navigate away
        </p>
      </div>
    </div>
  );
}

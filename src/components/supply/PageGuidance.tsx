import { useState } from 'react';
import { HelpCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GuidanceSection {
  title: string;
  content: string;
}

interface PageGuidanceProps {
  pageTitle: string;
  summary: string;
  sections: GuidanceSection[];
  storageKey: string;
}

export function PageGuidance({ pageTitle, summary, sections, storageKey }: PageGuidanceProps) {
  const dismissedKey = `supply-guidance-dismissed-${storageKey}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissedKey) === '1');
  const [expanded, setExpanded] = useState(false);

  if (dismissed) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={() => {
          localStorage.removeItem(dismissedKey);
          setDismissed(false);
        }}
      >
        <HelpCircle className="h-4 w-4" />
        <span className="text-xs">How this page works</span>
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <HelpCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{pageTitle}</p>
            <p className="text-xs text-muted-foreground">{summary}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              localStorage.setItem(dismissedKey, '1');
              setDismissed(true);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-primary/10">
          {sections.map((s, i) => (
            <div key={i} className="space-y-1">
              <p className="text-xs font-semibold text-foreground">{s.title}</p>
              <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{s.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { AppLayout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  redirectHint?: string;
}

/**
 * Placeholder for paused / work-in-progress pages.
 * Renders a non-interactive shelf notice so users cannot trigger actions
 * on features that are temporarily out of scope.
 */
export function WipShelf({ title, description, redirectHint }: Props) {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-amber-500/15 flex items-center justify-center">
              <Construction className="h-6 w-6 text-amber-600" />
            </div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground max-w-md">
              {description ||
                'This page is paused and currently work in progress. Interactions are disabled until it is reactivated.'}
            </p>
            {redirectHint && (
              <p className="text-xs text-muted-foreground">{redirectHint}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

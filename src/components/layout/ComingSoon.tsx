import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ComingSoonProps {
  title: string;
  description?: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="container mx-auto px-4 py-16 flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Construction className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">{title}</h1>
          <p className="text-muted-foreground">
            {description || 'This feature is coming soon. Check back later!'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

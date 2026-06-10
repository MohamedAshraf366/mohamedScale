import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Region } from '@/hooks/useRegions';

interface RegionsListProps {
  regions: Region[];
  isLoading: boolean;
  selectedRegion: Region | null;
  onSelectRegion: (region: Region | null) => void;
  onZoomToRegion: (region: Region) => void;
}

export function RegionsList({ regions, isLoading, selectedRegion, onSelectRegion, onZoomToRegion }: RegionsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm">المناطق ({regions.length})</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {regions.map((region) => (
            <div
              key={region.id}
              className={cn(
                'group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors',
                'hover:bg-muted/50',
                selectedRegion?.id === region.id && 'bg-primary/10 border border-primary/20'
              )}
              onClick={() => onSelectRegion(selectedRegion?.id === region.id ? null : region)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="font-mono shrink-0">{region.code}</Badge>
                <span className="text-sm truncate" dir={region.name_ar ? 'rtl' : undefined}>
                  {region.name_ar || region.name_en}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-xs">{region.zones_count || 0}</Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); onZoomToRegion(region); }}
                >
                  <MapPin className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {regions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">لا توجد مناطق.</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

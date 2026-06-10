import { useState, useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import type { Zone } from '@/hooks/useZones';
import type { Region } from '@/hooks/useRegions';

interface ZonesListProps {
  zones: Zone[];
  isLoading: boolean;
  selectedRegion: Region | null;
  onZoomToZone: (zone: Zone) => void;
  onInspectZone: (zone: Zone) => void;
}

function zoneDisplayName(zone: Zone): string {
  return zone.name_ar || zone.name || 'بدون اسم';
}

export function ZonesList({ zones, isLoading, selectedRegion, onZoomToZone, onInspectZone }: ZonesListProps) {
  const filteredZones = selectedRegion ? zones.filter((z) => z.region_code === selectedRegion.code) : zones;
  const [search, setSearch] = useState('');
  const visibleZones = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filteredZones;
    return filteredZones.filter((z) =>
      z.code?.toLowerCase().includes(q) ||
      z.name?.toLowerCase().includes(q) ||
      z.name_ar?.includes(search.trim())
    );
  }, [filteredZones, search]);
  const searchEnabled = filteredZones.length > 10;

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <h3 className="font-semibold text-sm">
          Zones {selectedRegion ? `— ${selectedRegion.name_ar || selectedRegion.name_en}` : ''} ({filteredZones.length})
        </h3>
        {searchEnabled && (
          <Input
            placeholder="بحث..."
            className="h-7 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {visibleZones.map((zone) => (
            <div
              key={zone.id}
              className="group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => {
                onInspectZone(zone);
                onZoomToZone(zone);
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="font-mono text-[10px] shrink-0 px-1">
                  {zone.code || 'N/A'}
                </Badge>
                <span className="text-sm truncate" dir={zone.name_ar ? 'rtl' : undefined}>
                  {zoneDisplayName(zone)}
                </span>
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onZoomToZone(zone);
                }}
              >
                <MapPin className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {visibleZones.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {selectedRegion ? 'لا توجد مناطق.' : 'اختر منطقة لعرض الأحياء.'}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

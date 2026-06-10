import { useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip } from 'react-leaflet';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DeliveryRate } from '@/hooks/useDeliveryRates';
import type { Json } from '@/integrations/supabase/types';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const KSA_CENTER: [number, number] = [23.8859, 45.0792];

function toGeoJsonObject(json: Json | null | undefined): GeoJSON.GeoJsonObject | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const obj = json as Record<string, unknown>;
  if (typeof obj.type === 'string') return obj as unknown as GeoJSON.GeoJsonObject;
  return null;
}

interface Props {
  supplierLocation?: { lat: number; lng: number; zone_code?: string | null } | null;
  deliveryRates: DeliveryRate[];
}

export function DeliveryRateMapView({ supplierLocation, deliveryRates }: Props) {
  const { data: zones } = useQuery({
    queryKey: ['zones-with-geo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones')
        .select('id, name, code, boundary_geojson, region_code');
      if (error) throw error;
      return data || [];
    },
  });

  // Build a map: zone_code -> list of rates covering it
  const zoneRateMap = useMemo(() => {
    const map = new Map<string, DeliveryRate[]>();
    for (const rate of deliveryRates) {
      for (const zCode of rate.zone_codes) {
        const existing = map.get(zCode) || [];
        existing.push(rate);
        map.set(zCode, existing);
      }
    }
    return map;
  }, [deliveryRates]);

  const getZoneStyle = useCallback((zone: { code: string }): L.PathOptions => {
    const isCovered = zoneRateMap.has(zone.code);
    const isSupplierZone = supplierLocation?.zone_code === zone.code;

    if (isCovered && isSupplierZone) return { color: '#7c3aed', weight: 3, fillOpacity: 0.4, fillColor: '#22c55e' };
    if (isCovered) return { color: '#16a34a', weight: 2, fillOpacity: 0.3, fillColor: '#22c55e' };
    if (isSupplierZone) return { color: '#8b5cf6', weight: 3, fillOpacity: 0.3, fillColor: '#8b5cf6' };
    return { color: '#64748b', weight: 1, fillOpacity: 0.05, fillColor: '#94a3b8' };
  }, [zoneRateMap, supplierLocation]);

  const getTooltipContent = useCallback((zoneCode: string, zoneName: string) => {
    const rates = zoneRateMap.get(zoneCode);
    if (!rates || rates.length === 0) return zoneName;
    const prices = rates.map(r => `${r.price_per_moq.toLocaleString()} SAR`).join(', ');
    return `${zoneName}\n💰 ${prices}`;
  }, [zoneRateMap]);

  const coveredCount = zoneRateMap.size;
  const totalZones = zones?.length || 0;

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="secondary" className="gap-1">
          <MapPin className="h-3 w-3" />
          {coveredCount} / {totalZones} zones covered
        </Badge>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-green-500 bg-green-500/30 inline-block" />
            Covered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border border-slate-400 bg-slate-400/10 inline-block" />
            Not covered
          </span>
          {supplierLocation && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border-2 border-purple-500 bg-purple-500/40 inline-block" />
              Supplier
            </span>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="rounded-lg overflow-hidden border border-border h-[450px] relative z-0">
        <MapContainer
          center={supplierLocation ? [supplierLocation.lat, supplierLocation.lng] : KSA_CENTER}
          zoom={supplierLocation ? 8 : 5}
          className="h-full w-full"
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {(zones as any[])?.map(zone => {
            const geo = toGeoJsonObject(zone.boundary_geojson);
            if (!geo) return null;
            const label = zone.code || zone.name || 'Zone';
            return (
              <GeoJSON
                key={`view-${zone.code}-${zoneRateMap.has(zone.code)}`}
                data={geo}
                style={() => getZoneStyle(zone)}
                onEachFeature={(_, layer) => {
                  layer.bindTooltip(getTooltipContent(zone.code, label), {
                    permanent: false,
                    direction: 'top',
                    className: 'whitespace-pre-line',
                  });
                }}
              />
            );
          })}

          {supplierLocation && (
            <CircleMarker
              center={[supplierLocation.lat, supplierLocation.lng]}
              radius={8}
              pathOptions={{ color: '#7c3aed', fillColor: '#8b5cf6', fillOpacity: 0.9, weight: 3 }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]}>
                <span className="text-xs font-medium">Supplier Location</span>
              </Tooltip>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
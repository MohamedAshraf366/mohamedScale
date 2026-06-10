import { useEffect, useCallback, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Region } from '@/hooks/useRegions';
import type { Zone } from '@/hooks/useZones';
import type { LocationPin } from '@/pages/admin/RegionsZones';
import type { ZoneGroup } from '@/hooks/useZoneGroups';
import type { Json } from '@/integrations/supabase/types';
import { Building2, FolderOpen, Truck, MapPin, ExternalLink } from 'lucide-react';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const KSA_CENTER: [number, number] = [23.8859, 45.0792];
const KSA_ZOOM = 5;

const PIN_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  project: { fill: '#3b82f6', stroke: '#2563eb', label: 'Project' },
  customer: { fill: '#f97316', stroke: '#ea580c', label: 'Customer' },
  supplier: { fill: '#22c55e', stroke: '#16a34a', label: 'Supplier' },
  both: { fill: '#a855f7', stroke: '#9333ea', label: 'Project + Customer' },
  unknown: { fill: '#6b7280', stroke: '#4b5563', label: 'Unknown' },
};

interface RegionZoneMapProps {
  regions: Region[];
  zones: Zone[];
  selectedRegion: Region | null;
  selectedZones: Zone[];
  onRegionClick: (region: Region) => void;
  onZoneClick: (zone: Zone) => void;
  mapRef: React.MutableRefObject<L.Map | null>;
  locationPins?: LocationPin[];
  highlightedGroup?: ZoneGroup | null;
}

function toGeoJsonObject(json: Json | null | undefined): GeoJSON.GeoJsonObject | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const obj = json as Record<string, unknown>;
  if (typeof obj.type === 'string') return obj as unknown as GeoJSON.GeoJsonObject;
  return null;
}

function MapRefSetter({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

function getEntityLink(pin: LocationPin): string | null {
  if (pin.entity_type === 'project' && pin.entity_id) return `/sales/projects/${pin.entity_id}`;
  if (pin.entity_type === 'customer' && pin.entity_id) return `/customers/${pin.entity_id}`;
  if (pin.entity_type === 'supplier' && pin.entity_id) return `/suppliers/${pin.entity_id}`;
  if (pin.entity_type === 'both' && pin.entity_id) return `/sales/projects/${pin.entity_id}`;
  return null;
}

function EntityIcon({ type }: { type: string }) {
  if (type === 'project') return <FolderOpen className="h-3 w-3 text-blue-500" />;
  if (type === 'customer') return <Building2 className="h-3 w-3 text-orange-500" />;
  if (type === 'supplier') return <Truck className="h-3 w-3 text-green-500" />;
  if (type === 'both') return <FolderOpen className="h-3 w-3 text-purple-500" />;
  return <MapPin className="h-3 w-3 text-muted-foreground" />;
}

/** Display name – Arabic first */
function zoneTooltip(zone: Zone): string {
  return zone.name_ar || zone.name || zone.code || 'Zone';
}

function regionTooltip(region: Region): string {
  const label = region.name_ar || region.name_en;
  return `${region.code} — ${label}`;
}

export function RegionZoneMap({
  regions, zones, selectedRegion, selectedZones,
  onRegionClick, onZoneClick, mapRef, locationPins = [],
  highlightedGroup,
}: RegionZoneMapProps) {
  const [, setMapReady] = useState(false);
  const groupZoneCodes = highlightedGroup?.zone_codes || [];

  const getRegionStyle = useCallback(
    (region: Region): L.PathOptions => ({
      color: selectedRegion?.id === region.id ? '#f59e0b' : '#10b981',
      weight: selectedRegion?.id === region.id ? 3 : 2,
      fillOpacity: selectedRegion?.id === region.id ? 0.3 : 0.15,
      fillColor: selectedRegion?.id === region.id ? '#f59e0b' : '#10b981',
    }),
    [selectedRegion]
  );

  const getZoneStyle = useCallback(
    (zone: Zone): L.PathOptions => {
      const isSelected = selectedZones.some((z) => z.id === zone.id);
      const isInGroup = groupZoneCodes.includes(zone.code);
      if (isInGroup && highlightedGroup) {
        return { color: highlightedGroup.color, weight: 3, fillOpacity: 0.4, fillColor: highlightedGroup.color };
      }
      return {
        color: isSelected ? '#f59e0b' : '#3b82f6',
        weight: isSelected ? 3 : 2,
        fillOpacity: isSelected ? 0.4 : 0.25,
        fillColor: isSelected ? '#f59e0b' : '#3b82f6',
      };
    },
    [selectedZones, groupZoneCodes, highlightedGroup]
  );

  const visibleZones = selectedRegion ? zones.filter((z) => z.region_code === selectedRegion.code) : zones;
  const hasAnyPins = locationPins.length > 0;

  return (
    <div className="h-full w-full relative isolate">
      <MapContainer center={KSA_CENTER} zoom={KSA_ZOOM} className="h-full w-full" zoomControl whenReady={() => setMapReady(true)}>
        <MapRefSetter mapRef={mapRef} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {regions.map((region) => {
          const geoJson = toGeoJsonObject(region.boundary_geojson);
          if (!geoJson) return null;
          return (
            <GeoJSON
              key={`region-${region.id}-${selectedRegion?.id}`}
              data={geoJson}
              style={() => getRegionStyle(region)}
              onEachFeature={(_, layer) => {
                layer.bindTooltip(regionTooltip(region), { permanent: false, direction: 'top' });
                layer.on('click', () => onRegionClick(region));
              }}
            />
          );
        })}

        {visibleZones.map((zone) => {
          const geoJson = toGeoJsonObject(zone.boundary_geojson);
          if (!geoJson) return null;
          return (
            <GeoJSON
              key={`zone-${zone.id}-${selectedZones.map(z => z.id).join('-')}-${groupZoneCodes.join('-')}`}
              data={geoJson}
              style={() => getZoneStyle(zone)}
              onEachFeature={(_, layer) => {
                layer.bindTooltip(zoneTooltip(zone), { permanent: false, direction: 'top' });
                layer.on('click', () => onZoneClick(zone));
              }}
            />
          );
        })}

        {locationPins.map((pin) => {
          const colors = PIN_COLORS[pin.entity_type || 'unknown'] || PIN_COLORS.unknown;
          const hasZone = !!pin.zone_code;
          const link = getEntityLink(pin);
          return (
            <CircleMarker
              key={`loc-${pin.id}`}
              center={[pin.lat, pin.lng]}
              radius={7}
              pathOptions={{
                color: hasZone ? colors.stroke : '#dc2626',
                fillColor: colors.fill,
                fillOpacity: 0.85,
                weight: hasZone ? 2 : 3,
              }}
            >
              <Popup closeButton className="location-pin-popup">
                <div className="text-xs space-y-1.5 min-w-[180px] max-w-[240px]">
                  <div className="flex items-center gap-1.5 font-semibold text-sm">
                    <EntityIcon type={pin.entity_type} />
                    <span className="truncate">{pin.entity_name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{ backgroundColor: `${colors.fill}20`, color: colors.stroke }}>
                      {colors.label}
                    </span>
                    {pin.zone_code ? (
                      <span className="text-[10px] text-green-600 font-medium">✓ {pin.zone_code}</span>
                    ) : (
                      <span className="text-[10px] text-red-500 font-medium">✗ No zone</span>
                    )}
                  </div>
                  {pin.city && (
                    <div className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" />
                      {pin.city}
                    </div>
                  )}
                  {pin.address_text && (
                    <div className="text-muted-foreground truncate">{pin.address_text}</div>
                  )}
                  {link && (
                    <a href={link} className="flex items-center gap-1 text-primary hover:underline font-medium mt-1" target="_top">
                      <ExternalLink className="h-3 w-3" />
                      View details →
                    </a>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {hasAnyPins && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-background/90 backdrop-blur border rounded-lg p-2.5 text-xs space-y-1.5 shadow-md">
          <div className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">Legend</div>
          {Object.entries(PIN_COLORS).filter(([k]) => k !== 'unknown').map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: val.fill }} />
              <span>{val.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-transparent" />
            <span>No zone assigned</span>
          </div>
        </div>
      )}
    </div>
  );
}

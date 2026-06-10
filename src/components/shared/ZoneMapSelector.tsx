import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useZoneGroups } from '@/hooks/useZoneGroups';
import type { Json } from '@/integrations/supabase/types';
import { MapPin, Pencil, MousePointer, X, RotateCcw, Lasso, Hand, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const KSA_CENTER: [number, number] = [23.8859, 45.0792];

type InteractionMode = 'pan' | 'draw' | 'lasso' | 'select';

function toGeoJsonObject(json: Json | null | undefined): GeoJSON.GeoJsonObject | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const obj = json as Record<string, unknown>;
  if (typeof obj.type === 'string') return obj as unknown as GeoJSON.GeoJsonObject;
  return null;
}

function formatRadius(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

/* ------------------------------------------------------------------ */
/*  Circle draw handler                                                */
/* ------------------------------------------------------------------ */
function CircleDrawHandler({
  onCircleDrawn,
  enabled,
}: {
  onCircleDrawn: (center: [number, number], radius: number) => void;
  enabled: boolean;
}) {
  const map = useMap();
  const drawStartRef = useRef<L.LatLng | null>(null);
  const previewRef = useRef<L.Circle | null>(null);
  const labelRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!enabled) {
      previewRef.current?.remove();
      previewRef.current = null;
      labelRef.current?.remove();
      labelRef.current = null;
      drawStartRef.current = null;
      return;
    }

    map.dragging.disable();
    map.boxZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.enable();
    const container = map.getContainer();
    container.style.cursor = 'crosshair';

    const toLatLng = (ev: MouseEvent): L.LatLng => {
      const rect = container.getBoundingClientRect();
      const pt = L.point(ev.clientX - rect.left, ev.clientY - rect.top);
      return map.containerPointToLatLng(pt);
    };

    const onDown = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      drawStartRef.current = toLatLng(ev);
    };

    const onMove = (ev: MouseEvent) => {
      const start = drawStartRef.current;
      if (!start) return;
      ev.preventDefault();
      const cur = toLatLng(ev);
      const r = start.distanceTo(cur);

      if (previewRef.current) {
        previewRef.current.setRadius(r);
      } else {
        previewRef.current = L.circle(start, {
          radius: r,
          color: '#f59e0b',
          weight: 3,
          fillColor: '#f59e0b',
          fillOpacity: 0.15,
          dashArray: '8, 6',
        }).addTo(map);
      }

      const bearing = turf.bearing(
        turf.point([start.lng, start.lat]),
        turf.point([cur.lng, cur.lat])
      );
      const midDist = r / 2 / 1000;
      const midPt = turf.destination(turf.point([start.lng, start.lat]), midDist, bearing, { units: 'kilometers' });
      const [mLng, mLat] = midPt.geometry.coordinates;

      if (labelRef.current) {
        labelRef.current.setLatLng([mLat, mLng]);
        const el = labelRef.current.getElement();
        if (el) el.innerHTML = formatRadius(r);
      } else {
        const icon = L.divIcon({
          className: 'radius-label',
          html: formatRadius(r),
          iconSize: [80, 28],
          iconAnchor: [40, 14],
        });
        labelRef.current = L.marker([mLat, mLng], { icon, interactive: false }).addTo(map);
      }
    };

    const onUp = (ev: MouseEvent) => {
      const start = drawStartRef.current;
      if (!start) return;
      const cur = toLatLng(ev);
      const radiusMeters = start.distanceTo(cur);
      const radiusKm = radiusMeters / 1000;

      previewRef.current?.remove();
      previewRef.current = null;
      labelRef.current?.remove();
      labelRef.current = null;
      drawStartRef.current = null;

      if (radiusKm > 0.5) {
        onCircleDrawn([start.lat, start.lng], radiusKm);
      }
    };

    container.addEventListener('mousedown', onDown, true);
    container.addEventListener('mousemove', onMove, true);
    container.addEventListener('mouseup', onUp, true);

    return () => {
      container.removeEventListener('mousedown', onDown, true);
      container.removeEventListener('mousemove', onMove, true);
      container.removeEventListener('mouseup', onUp, true);
      map.dragging.enable();
      map.boxZoom.enable();
      map.doubleClickZoom.enable();
      container.style.cursor = '';
      previewRef.current?.remove();
      previewRef.current = null;
      labelRef.current?.remove();
      labelRef.current = null;
    };
  }, [enabled, map, onCircleDrawn]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  Freehand lasso draw handler                                        */
/* ------------------------------------------------------------------ */
function LassoDrawHandler({
  onLassoDrawn,
  enabled,
}: {
  onLassoDrawn: (polygon: GeoJSON.Feature) => void;
  enabled: boolean;
}) {
  const map = useMap();
  const drawingRef = useRef(false);
  const pointsRef = useRef<L.LatLng[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!enabled) {
      polylineRef.current?.remove();
      polylineRef.current = null;
      drawingRef.current = false;
      pointsRef.current = [];
      return;
    }

    map.dragging.disable();
    map.boxZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.enable();
    const container = map.getContainer();
    container.style.cursor = 'crosshair';

    const toLatLng = (ev: MouseEvent): L.LatLng => {
      const rect = container.getBoundingClientRect();
      const pt = L.point(ev.clientX - rect.left, ev.clientY - rect.top);
      return map.containerPointToLatLng(pt);
    };

    const onDown = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const ll = toLatLng(ev);
      drawingRef.current = true;
      pointsRef.current = [ll];
      polylineRef.current?.remove();
      polylineRef.current = L.polyline([ll], {
        color: '#f59e0b',
        weight: 3,
        dashArray: '6, 4',
      }).addTo(map);
    };

    const onMove = (ev: MouseEvent) => {
      if (!drawingRef.current) return;
      ev.preventDefault();
      const ll = toLatLng(ev);
      pointsRef.current.push(ll);
      polylineRef.current?.addLatLng(ll);
    };

    const onUp = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const pts = pointsRef.current;
      polylineRef.current?.remove();
      polylineRef.current = null;

      if (pts.length < 5) return;

      const coords = pts.map(p => [p.lng, p.lat]);
      coords.push(coords[0]);

      try {
        const polygon = turf.polygon([coords]);
        onLassoDrawn(polygon);
      } catch { /* invalid shape */ }
    };

    container.addEventListener('mousedown', onDown, true);
    container.addEventListener('mousemove', onMove, true);
    container.addEventListener('mouseup', onUp, true);

    return () => {
      container.removeEventListener('mousedown', onDown, true);
      container.removeEventListener('mousemove', onMove, true);
      container.removeEventListener('mouseup', onUp, true);
      map.dragging.enable();
      map.boxZoom.enable();
      map.doubleClickZoom.enable();
      container.style.cursor = '';
      polylineRef.current?.remove();
      polylineRef.current = null;
    };
  }, [enabled, map, onLassoDrawn]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  Main reusable component                                            */
/* ------------------------------------------------------------------ */
export interface ZoneMapSelectorProps {
  /** Currently selected zone codes */
  selectedZoneCodes: string[];
  /** Callback when selection changes */
  onSelectionChange: (zoneCodes: string[]) => void;
  /** Optional: zone codes that should appear as "locked/covered" (not clickable) */
  coveredZoneCodes?: string[];
  /** Optional: map of covered zone code → color to render each covered zone in its area's color */
  coveredZoneColors?: Record<string, string>;
  /** Optional: show zone group quick-select badges */
  showZoneGroups?: boolean;
  /** Height of the map area */
  mapHeight?: string;
  /** Optional class */
  className?: string;
  /** Layout: 'full' = side panel + map, 'compact' = map-only with floating controls */
  layout?: 'full' | 'compact';
  /** Color for selected zones on the map (default: #f59e0b) */
  activeColor?: string;
}

export function ZoneMapSelector({
  selectedZoneCodes,
  onSelectionChange,
  coveredZoneCodes: coveredProp = [],
  coveredZoneColors = {},
  showZoneGroups = true,
  mapHeight = '400px',
  className,
  layout = 'compact',
  activeColor = '#f59e0b',
}: ZoneMapSelectorProps) {
  const [mode, setMode] = useState<InteractionMode>('select');
  const [zoneSearch, setZoneSearch] = useState('');
  const selectedSet = useMemo(() => new Set(selectedZoneCodes), [selectedZoneCodes]);
  const coveredSet = useMemo(() => new Set(coveredProp), [coveredProp]);

  const { groups: zoneGroups } = useZoneGroups();

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

  // Use refs so GeoJSON click handlers (bound once in onEachFeature) always see latest values
  const selectedRef = useRef(selectedSet);
  selectedRef.current = selectedSet;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const coveredRef = useRef(coveredSet);
  coveredRef.current = coveredSet;
  const activeColorRef = useRef(activeColor);
  activeColorRef.current = activeColor;
  const coveredZoneColorsRef = useRef(coveredZoneColors);
  coveredZoneColorsRef.current = coveredZoneColors;

  const handleZoneClick = useCallback((zoneCode: string) => {
    if (coveredRef.current.has(zoneCode)) return;
    const next = new Set(selectedRef.current);
    if (next.has(zoneCode)) next.delete(zoneCode);
    else next.add(zoneCode);
    onSelectionChangeRef.current(Array.from(next));
  }, []);

  const selectZonesByGeometry = useCallback((geometry: GeoJSON.Feature | GeoJSON.Geometry) => {
    if (!zones) return;
    const next = new Set(selectedRef.current);
    (zones as any[]).forEach(zone => {
      if (coveredRef.current.has(zone.code)) return;
      const geo = toGeoJsonObject(zone.boundary_geojson);
      if (!geo) return;
      try {
        if (turf.booleanIntersects(geometry as any, geo as any)) {
          next.add(zone.code);
        }
      } catch { /* ignore */ }
    });
    onSelectionChangeRef.current(Array.from(next));
  }, [zones]);

  const handleCircleDrawn = useCallback((center: [number, number], radiusKm: number) => {
    const circlePolygon = turf.circle(
      turf.point([center[1], center[0]]),
      radiusKm,
      { steps: 64, units: 'kilometers' }
    );
    selectZonesByGeometry(circlePolygon);
  }, [selectZonesByGeometry]);

  const handleLassoDrawn = useCallback((polygon: GeoJSON.Feature) => {
    selectZonesByGeometry(polygon);
  }, [selectZonesByGeometry]);

  const clearSelection = () => onSelectionChange([]);

  // Groups toggle: if all zones in group are selected, remove them; otherwise add them
  const toggleZoneGroup = (groupId: string) => {
    const group = (zoneGroups || []).find((g: any) => g.id === groupId);
    if (!group) return;
    const codes: string[] = group.zone_codes || [];
    const next = new Set(selectedSet);
    const allSelected = codes.length > 0 && codes.every(c => selectedSet.has(c));
    if (allSelected) {
      codes.forEach(c => next.delete(c));
    } else {
      codes.forEach(c => { if (!coveredSet.has(c)) next.add(c); });
    }
    onSelectionChange(Array.from(next));
  };

  // Store layer refs for imperative style updates
  const layerMapRef = useRef<Map<string, L.Path>>(new Map());

  const getZoneStyle = useCallback((zone: { code: string }): L.PathOptions => {
    const isSelected = selectedSet.has(zone.code);
    const isCovered = coveredSet.has(zone.code);
    if (isCovered) {
      const c = coveredZoneColors[zone.code] || '#22c55e';
      return { color: c, weight: 2, fillOpacity: 0.3, fillColor: c };
    }
    if (isSelected) return { color: activeColor, weight: 3, fillOpacity: 0.4, fillColor: activeColor };
    return { color: '#64748b', weight: 1, fillOpacity: 0.08, fillColor: '#94a3b8' };
  }, [selectedSet, coveredSet, activeColor, coveredZoneColors]);

  // Imperatively update styles when selection or color changes
  useEffect(() => {
    layerMapRef.current.forEach((layer, code) => {
      const isSelected = selectedSet.has(code);
      const isCovered = coveredSet.has(code);
      if (isCovered) {
        const c = coveredZoneColors[code] || '#22c55e';
        layer.setStyle({ color: c, weight: 2, fillOpacity: 0.3, fillColor: c });
      }
      else if (isSelected) layer.setStyle({ color: activeColor, weight: 3, fillOpacity: 0.4, fillColor: activeColor });
      else layer.setStyle({ color: '#64748b', weight: 1, fillOpacity: 0.08, fillColor: '#94a3b8' });
    });
  }, [selectedSet, coveredSet, activeColor, coveredZoneColors]);

  const modeBar = (
    <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
      {([
        { key: 'pan' as const, icon: Hand, label: 'Pan' },
        { key: 'draw' as const, icon: Pencil, label: 'Circle' },
        { key: 'lasso' as const, icon: Lasso, label: 'Lasso' },
        { key: 'select' as const, icon: MousePointer, label: 'Click' },
      ]).map(m => (
        <Button
          key={m.key}
          type="button"
          variant={mode === m.key ? 'default' : 'ghost'}
          size="sm"
          className="flex-1 gap-1 text-xs h-7"
          onClick={() => setMode(m.key)}
        >
          <m.icon className="h-3.5 w-3.5" />
          {m.label}
        </Button>
      ))}
    </div>
  );

  const selectionSummary = (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-xs font-medium">
          <MapPin className="h-3.5 w-3.5" />
          {selectedZoneCodes.length} zone(s) selected
        </Label>
        {selectedZoneCodes.length > 0 && (
          <Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-xs text-destructive hover:text-destructive" onClick={clearSelection}>
            <RotateCcw className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
      {selectedZoneCodes.length > 0 && (
        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
          {selectedZoneCodes.map(zCode => {
            const zone = (zones as any[])?.find(z => z.code === zCode);
            return (
              <Badge
                key={zCode}
                variant="secondary"
                className="gap-1 text-xs cursor-pointer hover:bg-destructive/20 transition-colors"
                onClick={() => {
                  onSelectionChange(selectedZoneCodes.filter(c => c !== zCode));
                }}
              >
                {zone?.code || zCode}
                <X className="h-3 w-3" />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );

  const zoneGroupBadges = showZoneGroups && (zoneGroups || []).length > 0 ? (
    <div className="flex flex-wrap gap-1.5">
      {(zoneGroups || []).map((g: any) => {
        const codes: string[] = g.zone_codes || [];
        const allSelected = codes.length > 0 && codes.every((c: string) => selectedSet.has(c));
        return (
          <Badge
            key={g.id}
            variant={allSelected ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => toggleZoneGroup(g.id)}
          >
            {g.name}
          </Badge>
        );
      })}
    </div>
  ) : null;

  const mapContent = (
    <div className="relative rounded-lg overflow-hidden border border-border" style={{ height: mapHeight }}>
      {/* Radius label CSS */}
      <style>{`
        .radius-label {
          background: hsl(var(--background) / 0.92);
          border: 2px solid #f59e0b;
          border-radius: 6px;
          color: #f59e0b;
          font-weight: 700;
          font-size: 13px;
          text-align: center;
          line-height: 24px;
          backdrop-filter: blur(4px);
          pointer-events: none;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
      `}</style>

      {/* Mode instruction */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-background/90 backdrop-blur-sm border rounded-md px-3 py-1.5 text-xs font-medium shadow pointer-events-none select-none">
        {mode === 'pan' && 'Drag to pan · Scroll to zoom'}
        {mode === 'draw' && 'Click & drag to draw a selection circle'}
        {mode === 'lasso' && 'Click & drag to draw a freehand shape'}
        {mode === 'select' && 'Click zones to toggle · Shift+click to deselect'}
      </div>

      <MapContainer
        center={KSA_CENTER}
        zoom={5}
        className="h-full w-full"
        style={{ cursor: mode === 'pan' ? 'grab' : mode === 'select' ? 'pointer' : 'crosshair' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleDrawHandler onCircleDrawn={handleCircleDrawn} enabled={mode === 'draw'} />
        <LassoDrawHandler onLassoDrawn={handleLassoDrawn} enabled={mode === 'lasso'} />

        {(zones as any[])?.map(zone => {
          const geo = toGeoJsonObject(zone.boundary_geojson);
          if (!geo) return null;
          return (
            <GeoJSON
              key={`zone-${zone.code}`}
              data={geo}
              style={() => getZoneStyle(zone)}
              onEachFeature={(_, layer) => {
                layerMapRef.current.set(zone.code, layer as L.Path);
                layer.bindTooltip(zone.code || zone.name || 'Zone', { permanent: false, direction: 'top' });
                layer.on('click', () => {
                  handleZoneClick(zone.code);
                });
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );

  const zoneSearchResults = useMemo(() => {
    const q = zoneSearch.trim().toLowerCase();
    if (q.length < 2 || !zones) return [];
    return (zones as any[])
      .filter(z =>
        (z.name || '').toLowerCase().includes(q) ||
        (z.code || '').toLowerCase().includes(q) ||
        (z.region_code || '').toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [zoneSearch, zones]);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search zones by name, code, or region…"
          value={zoneSearch}
          onChange={(e) => setZoneSearch(e.target.value)}
          className="h-9 pl-8 text-sm"
        />
      </div>
      {zoneSearchResults.length > 0 && (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto rounded-md border p-2">
          {zoneSearchResults.map((z: any) => {
            const isSel = selectedSet.has(z.code);
            return (
              <Badge
                key={z.code}
                variant={isSel ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => {
                  if (isSel) onSelectionChange(selectedZoneCodes.filter(c => c !== z.code));
                  else onSelectionChange([...selectedZoneCodes, z.code]);
                }}
              >
                {z.code} · {z.name}
              </Badge>
            );
          })}
        </div>
      )}
      {zoneGroupBadges}
      {modeBar}
      {mapContent}
      {selectionSummary}
    </div>
  );
}

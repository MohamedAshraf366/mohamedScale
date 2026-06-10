import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCreateDeliveryRate, useDeliveryRates } from '@/hooks/useDeliveryRates';
import type { SupplierMaterial } from '@/hooks/useSupplierMaterials';
import type { Json } from '@/integrations/supabase/types';
import { Package, MapPin, Loader2, Pencil, MousePointer, X, RotateCcw, Lasso, Hand } from 'lucide-react';

const KSA_CENTER: [number, number] = [23.8859, 45.0792];

type InteractionMode = 'pan' | 'draw' | 'lasso' | 'select';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierAccountId: string;
  supplierMaterials: SupplierMaterial[];
  supplierLocation?: { lat: number; lng: number; zone_code?: string | null } | null;
}

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
/*  Circle draw handler with live radius label                         */
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
/*  Main dialog                                                        */
/* ------------------------------------------------------------------ */
export function DeliveryRateMapDialog({
  open, onOpenChange, supplierAccountId, supplierMaterials, supplierLocation,
}: Props) {
  const currentMaterials = supplierMaterials.filter(sm => sm.status !== 'rejected');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedZoneCodes, setSelectedZoneCodes] = useState<Set<string>>(new Set());
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<InteractionMode>('draw');

  const createRate = useCreateDeliveryRate();
  const { data: existingRates } = useDeliveryRates(supplierAccountId);

  useEffect(() => {
    if (open) {
      setSelectedMaterialIds(currentMaterials.map(m => m.id));
      setSelectedZoneCodes(new Set());
      setPrice('');
      setNotes('');
      setMode('pan');
    }
  }, [open]);

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

  const coveredZoneCodes = useMemo(() => {
    if (!existingRates || selectedMaterialIds.length === 0) return new Set<string>();
    const covered = new Set<string>();

    // A zone is "covered" if every selected material appears in at least one rate that includes that zone
    const allZoneCodes = new Set(existingRates.flatMap(r => r.zone_codes));

    allZoneCodes.forEach(zCode => {
      const allCovered = selectedMaterialIds.every(smId =>
        existingRates.some(r =>
          r.supplier_material_ids.includes(smId) && r.zone_codes.includes(zCode)
        )
      );
      if (allCovered) covered.add(zCode);
    });

    return covered;
  }, [existingRates, selectedMaterialIds]);

  const toggleMaterial = (id: string) => {
    setSelectedMaterialIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleZoneClick = useCallback((zoneCode: string, shiftKey: boolean) => {
    if (coveredZoneCodes.has(zoneCode)) return;

    setSelectedZoneCodes(prev => {
      const next = new Set(prev);
      if (mode === 'select') {
        if (shiftKey || next.has(zoneCode)) next.delete(zoneCode);
        else next.add(zoneCode);
      } else {
        if (next.has(zoneCode)) next.delete(zoneCode);
        else next.add(zoneCode);
      }
      return next;
    });
  }, [coveredZoneCodes, mode]);

  const selectZonesByGeometry = useCallback((geometry: GeoJSON.Feature | GeoJSON.Geometry) => {
    if (!zones) return;

    setSelectedZoneCodes(prev => {
      const next = new Set(prev);
      (zones as any[]).forEach(zone => {
        if (coveredZoneCodes.has(zone.code)) return;
        const geo = toGeoJsonObject(zone.boundary_geojson);
        if (!geo) return;
        try {
          if (turf.booleanIntersects(geometry as any, geo as any)) {
            next.add(zone.code);
          }
        } catch { /* ignore */ }
      });
      return next;
    });
  }, [zones, coveredZoneCodes]);

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

  const clearSelection = () => setSelectedZoneCodes(new Set());

  const getZoneStyle = useCallback((zone: { id: string; code: string }): L.PathOptions => {
    const isSelected = selectedZoneCodes.has(zone.code);
    const isCovered = coveredZoneCodes.has(zone.code);
    const isSupplierZone = supplierLocation?.zone_code === zone.code;

    if (isCovered) return { color: '#16a34a', weight: 2, fillOpacity: 0.3, fillColor: '#22c55e' };
    if (isSelected) return { color: '#f59e0b', weight: 3, fillOpacity: 0.4, fillColor: '#f59e0b' };
    if (isSupplierZone) return { color: '#8b5cf6', weight: 3, fillOpacity: 0.3, fillColor: '#8b5cf6' };
    return { color: '#64748b', weight: 1, fillOpacity: 0.08, fillColor: '#94a3b8' };
  }, [selectedZoneCodes, coveredZoneCodes, supplierLocation]);

  const handleSave = () => {
    if (!selectedMaterialIds.length || !selectedZoneCodes.size || !price) return;

    createRate.mutate({
      supplier_account_id: supplierAccountId,
      supplier_material_ids: selectedMaterialIds,
      zone_ids: Array.from(selectedZoneCodes),
      zone_codes: Array.from(selectedZoneCodes),
      price_per_moq: parseFloat(price),
      notes: notes || undefined,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Add Delivery Rates — Map View
          </DialogTitle>
        </DialogHeader>

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

        <div className="flex flex-1 min-h-0">
          {/* Left panel */}
          <div className="w-80 border-r flex flex-col shrink-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-5">
                {/* Materials checklist */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4" />
                    Materials ({selectedMaterialIds.length}/{currentMaterials.length})
                  </Label>
                  <div className="space-y-1">
                    {currentMaterials.map(sm => (
                      <label key={sm.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer text-sm">
                        <Checkbox
                          checked={selectedMaterialIds.includes(sm.id)}
                          onCheckedChange={() => toggleMaterial(sm.id)}
                        />
                        <span className="flex-1 truncate">{sm.material_name}</span>
                      </label>
                    ))}
                    {currentMaterials.length === 0 && (
                      <p className="text-sm text-muted-foreground py-2">No materials available</p>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="space-y-2">
                  <Label>Price per MOQ (SAR, pre-tax)</Label>
                  <Input
                    type="number" min="0" step="0.01"
                    placeholder="e.g. 150"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea placeholder="Delivery notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                </div>

                {/* Selected zones summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4" />
                      Selected Zones ({selectedZoneCodes.size})
                    </Label>
                    {selectedZoneCodes.size > 0 && (
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-destructive hover:text-destructive" onClick={clearSelection}>
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Clear all
                      </Button>
                    )}
                  </div>
                  {selectedZoneCodes.size > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {Array.from(selectedZoneCodes).map(zCode => {
                        const zone = (zones as any[])?.find(z => z.code === zCode);
                        return (
                          <Badge
                            key={zCode}
                            variant="secondary"
                            className="gap-1 text-xs cursor-pointer hover:bg-destructive/20 transition-colors"
                            onClick={() => setSelectedZoneCodes(prev => {
                              const next = new Set(prev);
                              next.delete(zCode);
                              return next;
                            })}
                          >
                            {zone?.code || zone?.name || zCode}
                            <X className="h-3 w-3" />
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Draw on the map or click zones to select
                    </p>
                  )}
                </div>

                {/* Legend */}
                <div className="space-y-1.5 pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Legend</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-sm border-2 border-amber-400 bg-amber-400/40" />
                    Selected
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-sm border-2 border-green-500 bg-green-500/30" />
                    Already covered
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-sm border border-slate-400 bg-slate-400/10" />
                    Available
                  </div>
                  {supplierLocation && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded-full border-2 border-purple-500 bg-purple-500/40" />
                      Supplier zone
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="p-4 border-t space-y-2">
              {/* Mode toggle – 3 modes */}
              <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
                <Button
                  variant={mode === 'pan' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 gap-1 text-xs h-8"
                  onClick={() => setMode('pan')}
                >
                  <Hand className="h-3.5 w-3.5" />
                  Pan
                </Button>
                <Button
                  variant={mode === 'draw' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 gap-1 text-xs h-8"
                  onClick={() => setMode('draw')}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Circle
                </Button>
                <Button
                  variant={mode === 'lasso' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 gap-1 text-xs h-8"
                  onClick={() => setMode('lasso')}
                >
                  <Lasso className="h-3.5 w-3.5" />
                  Lasso
                </Button>
                <Button
                  variant={mode === 'select' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 gap-1 text-xs h-8"
                  onClick={() => setMode('select')}
                >
                  <MousePointer className="h-3.5 w-3.5" />
                  Click
                </Button>
              </div>

              <Button
                className="w-full"
                disabled={!selectedMaterialIds.length || !selectedZoneCodes.size || !price || createRate.isPending}
                onClick={handleSave}
              >
                {createRate.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                ) : (
                  `Save ${selectedMaterialIds.length * selectedZoneCodes.size} rate(s)`
                )}
              </Button>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            {/* Top instruction bar */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-background/95 backdrop-blur-sm border rounded-lg px-4 py-2 text-sm font-medium shadow-lg pointer-events-none select-none">
              {mode === 'pan' && (
                <span className="flex items-center gap-2">
                  <Hand className="h-4 w-4 text-primary" />
                  Drag to pan · Scroll to zoom
                </span>
              )}
              {mode === 'draw' && (
                <span className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-amber-500" />
                  Click & drag to draw a selection circle · Click zones to fine-tune
                </span>
              )}
              {mode === 'lasso' && (
                <span className="flex items-center gap-2">
                  <Lasso className="h-4 w-4 text-amber-500" />
                  Click & drag to draw a freehand selection shape · Click zones to fine-tune
                </span>
              )}
              {mode === 'select' && (
                <span className="flex items-center gap-2">
                  <MousePointer className="h-4 w-4 text-primary" />
                  Click zones to select · Shift+click to deselect
                </span>
              )}
            </div>

            <MapContainer
              center={supplierLocation ? [supplierLocation.lat, supplierLocation.lng] : KSA_CENTER}
              zoom={supplierLocation ? 8 : 5}
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
                    key={`zone-${zone.code}-${selectedZoneCodes.has(zone.code)}-${coveredZoneCodes.has(zone.code)}`}
                    data={geo}
                    style={() => getZoneStyle(zone)}
                    onEachFeature={(_, layer) => {
                      layer.bindTooltip(zone.code || zone.name || 'Zone', { permanent: false, direction: 'top' });
                      layer.on('click', (e: L.LeafletMouseEvent) => {
                        handleZoneClick(zone.code, e.originalEvent?.shiftKey ?? false);
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
      </DialogContent>
    </Dialog>
  );
}

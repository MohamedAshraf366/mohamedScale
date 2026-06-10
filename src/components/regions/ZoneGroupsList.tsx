import { useState, useMemo, useCallback } from 'react';
import { Layers, Plus, Pencil, Trash2, Search, Hand, MousePointer, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { ZoneGroup } from '@/hooks/useZoneGroups';
import type { Zone } from '@/hooks/useZones';
import type { Json } from '@/integrations/supabase/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface ZoneGroupsListProps {
  groups: ZoneGroup[];
  isLoading: boolean;
  zones: Zone[];
  regionCode: string | null;
  selectedGroup: ZoneGroup | null;
  onSelectGroup: (g: ZoneGroup | null) => void;
  onSave: (g: Partial<ZoneGroup> & { name: string; region_code: string }) => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}

type GroupMapMode = 'pan' | 'select';

const PRESET_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const KSA_CENTER: [number, number] = [23.8859, 45.0792];

function zoneLabel(z: Zone): string {
  return z.name_ar || z.name || z.code;
}

function toGeoJsonObject(json: Json | null | undefined): GeoJSON.GeoJsonObject | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const obj = json as Record<string, unknown>;
  if (typeof obj.type === 'string') return obj as unknown as GeoJSON.GeoJsonObject;
  return null;
}

function getMapCenter(zones: Zone[]): [number, number] {
  for (const z of zones) {
    const geo = toGeoJsonObject(z.boundary_geojson);
    if (!geo) continue;
    try {
      const c = L.geoJSON(geo).getBounds().getCenter();
      return [c.lat, c.lng];
    } catch {
      continue;
    }
  }
  return KSA_CENTER;
}

export function ZoneGroupsList({
  groups, isLoading, zones, regionCode, selectedGroup,
  onSelectGroup, onSave, onDelete, isAdmin,
}: ZoneGroupsListProps) {
  const [editGroup, setEditGroup] = useState<Partial<ZoneGroup> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [zoneSearch, setZoneSearch] = useState('');
  const [mapMode, setMapMode] = useState<GroupMapMode>('select');

  const filteredGroups = regionCode ? groups.filter(g => g.region_code === regionCode) : groups;
  const availableZones = regionCode ? zones.filter(z => z.region_code === regionCode) : zones;

  const filteredZonesForPicker = useMemo(() => {
    if (!zoneSearch.trim()) return availableZones;
    const q = zoneSearch.toLowerCase();
    return availableZones.filter(z =>
      z.code?.toLowerCase().includes(q) ||
      z.name?.toLowerCase().includes(q) ||
      z.name_ar?.includes(q)
    );
  }, [availableZones, zoneSearch]);

  const selectedCodes = useMemo(() => new Set(editGroup?.zone_codes || []), [editGroup?.zone_codes]);
  const mapCenter = useMemo(() => getMapCenter(availableZones), [availableZones]);

  const toggleZoneInGroup = useCallback((zoneCode: string) => {
    if (!editGroup) return;
    const current = editGroup.zone_codes || [];
    const updated = current.includes(zoneCode)
      ? current.filter(c => c !== zoneCode)
      : [...current, zoneCode];
    setEditGroup({ ...editGroup, zone_codes: updated });
  }, [editGroup]);

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  const handleSave = () => {
    if (!editGroup?.name) return;
    onSave({
      ...editGroup,
      name: editGroup.name,
      region_code: editGroup.region_code || regionCode || 'RYD',
    } as any);
    setEditGroup(null);
    setZoneSearch('');
  };

  const selectAllVisible = () => {
    if (!editGroup) return;
    const codes = filteredZonesForPicker.map(z => z.code);
    const current = new Set(editGroup.zone_codes || []);
    codes.forEach(c => current.add(c));
    setEditGroup({ ...editGroup, zone_codes: Array.from(current) });
  };

  const deselectAllVisible = () => {
    if (!editGroup) return;
    const codes = new Set(filteredZonesForPicker.map(z => z.code));
    const remaining = (editGroup.zone_codes || []).filter(c => !codes.has(c));
    setEditGroup({ ...editGroup, zone_codes: remaining });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          مجموعات ({filteredGroups.length})
        </h3>
        {isAdmin && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => {
              setMapMode('select');
              setEditGroup({ name: '', zone_codes: [], color: '#3b82f6', region_code: regionCode || 'RYD' });
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredGroups.map((g) => {
            const isSelected = selectedGroup?.id === g.id;
            return (
              <div
                key={g.id}
                className={cn(
                  'group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/50',
                  isSelected && 'bg-primary/10 border border-primary/20'
                )}
                onClick={() => onSelectGroup(isSelected ? null : g)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                  <span className="text-sm truncate" dir={g.name_ar ? 'rtl' : undefined}>
                    {g.name_ar || g.name}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5">{g.zone_codes.length}</Badge>
                </div>
                {isAdmin && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMapMode('select');
                        setEditGroup(g);
                        setZoneSearch('');
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(g.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredGroups.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              {regionCode ? 'لا توجد مجموعات.' : 'اختر منطقة أولاً.'}
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={!!editGroup} onOpenChange={(open) => { if (!open) { setEditGroup(null); setZoneSearch(''); } }}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editGroup?.id ? 'Edit Group' : 'New Group'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 min-h-0 flex-1">
            <div className="space-y-3 min-h-0 flex flex-col">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Name (Arabic)</Label>
                  <Input
                    dir="rtl"
                    value={editGroup?.name_ar || ''}
                    onChange={e => setEditGroup(prev => prev ? { ...prev, name_ar: e.target.value } : prev)}
                    placeholder="شمال الرياض"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Name (English)</Label>
                  <Input
                    value={editGroup?.name || ''}
                    onChange={e => setEditGroup(prev => prev ? { ...prev, name: e.target.value } : prev)}
                    placeholder="e.g. North Riyadh"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      className={cn('w-7 h-7 rounded-full border-2 transition-all', editGroup?.color === c ? 'border-foreground scale-110 ring-2 ring-foreground/20' : 'border-transparent')}
                      style={{ backgroundColor: c }}
                      onClick={() => setEditGroup(prev => prev ? { ...prev, color: c } : prev)}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-md border overflow-hidden relative z-0 flex-1 min-h-[280px]">
                <div className="absolute top-2 left-2 z-[1000] bg-background/95 border rounded-md p-1 flex items-center gap-1">
                  <Button
                    size="icon"
                    variant={mapMode === 'pan' ? 'default' : 'ghost'}
                    className="h-7 w-7"
                    onClick={() => setMapMode('pan')}
                    title="Pan"
                  >
                    <Hand className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant={mapMode === 'select' ? 'default' : 'ghost'}
                    className="h-7 w-7"
                    onClick={() => setMapMode('select')}
                    title="Select zones"
                  >
                    <MousePointer className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditGroup(prev => prev ? { ...prev, zone_codes: [] } : prev)} title="Clear">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <MapContainer center={mapCenter} zoom={9} className="h-full w-full" scrollWheelZoom={true} dragging={mapMode === 'pan'}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {availableZones.map((z) => {
                    const geo = toGeoJsonObject(z.boundary_geojson);
                    if (!geo) return null;
                    const isIn = selectedCodes.has(z.code);
                    return (
                      <GeoJSON
                        key={`group-zone-${z.id}-${isIn}`}
                        data={geo}
                        style={() => ({
                          color: isIn ? (editGroup?.color || '#3b82f6') : '#64748b',
                          weight: isIn ? 3 : 1,
                          fillOpacity: isIn ? 0.35 : 0.08,
                          fillColor: isIn ? (editGroup?.color || '#3b82f6') : '#94a3b8',
                        })}
                        onEachFeature={(_, layer) => {
                          layer.bindTooltip(zoneLabel(z), { direction: 'top' });
                          layer.on('click', () => {
                            if (mapMode === 'select') toggleZoneInGroup(z.code);
                          });
                        }}
                      />
                    );
                  })}
                </MapContainer>
              </div>
              <p className="text-xs text-muted-foreground">Tools: Pan / Select. Click zones on map to add/remove.</p>
            </div>

            <div className="space-y-2 min-h-0 flex flex-col">
              <div className="flex items-center justify-between">
                <Label>Zones ({selectedCodes.size} selected)</Label>
                <div className="flex gap-1">
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={selectAllVisible}>Select all</Button>
                  <span className="text-muted-foreground text-xs">|</span>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={deselectAllVisible}>Clear visible</Button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-9 h-8 text-sm" placeholder="Search zones..." value={zoneSearch} onChange={e => setZoneSearch(e.target.value)} />
              </div>

              <ScrollArea className="border rounded-md p-2 flex-1">
                {filteredZonesForPicker.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No zones</p>
                ) : (
                  filteredZonesForPicker.map(z => {
                    const isIn = selectedCodes.has(z.code);
                    return (
                      <label key={z.id} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer">
                        <Checkbox checked={isIn} onCheckedChange={() => toggleZoneInGroup(z.code)} />
                        <span className="text-sm flex-1 truncate" dir={z.name_ar ? 'rtl' : undefined}>{zoneLabel(z)}</span>
                        <span className="text-xs text-muted-foreground font-mono">{z.code}</span>
                      </label>
                    );
                  })
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditGroup(null); setZoneSearch(''); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={!editGroup?.name}>{editGroup?.id ? 'Update' : 'Create'} Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the group. Zones won't be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

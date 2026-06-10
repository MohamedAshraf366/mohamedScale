import { useState, useRef, useCallback, useEffect } from 'react';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useRegions, type Region } from '@/hooks/useRegions';
import { useZones, type Zone } from '@/hooks/useZones';
import { useZoneGroups, type ZoneGroup } from '@/hooks/useZoneGroups';
import { useZoneImport } from '@/hooks/useZoneImport';
import { useAuth } from '@/contexts/AuthContext';
import { RegionZoneMap } from '@/components/regions/RegionZoneMap';
import { RegionsList } from '@/components/regions/RegionsList';
import { ZonesList } from '@/components/regions/ZonesList';
import { ZoneGroupsList } from '@/components/regions/ZoneGroupsList';
import { toast } from 'sonner';
import { Upload, AlertCircle, CheckCircle, AlertTriangle, MapPin, Wand2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Json } from '@/integrations/supabase/types';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

function toGeoJsonObject(json: Json | null | undefined): GeoJSON.GeoJsonObject | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const obj = json as Record<string, unknown>;
  if (typeof obj.type === 'string') return obj as unknown as GeoJSON.GeoJsonObject;
  return null;
}

export interface LocationPin {
  id: string;
  lat: number;
  lng: number;
  city: string | null;
  address_text: string | null;
  zone_code: string | null;
  entity_type: 'project' | 'customer' | 'supplier' | 'both' | 'unknown';
  entity_name: string | null;
  entity_id: string | null;
}

export default function RegionsZones() {
  const mapRef = useRef<L.Map | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [inspectedZone, setInspectedZone] = useState<Zone | null>(null);
  const [zoneNameArDraft, setZoneNameArDraft] = useState('');
  const [zoneNameDraft, setZoneNameDraft] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<ZoneGroup | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [forceOverride, setForceOverride] = useState(false);
  const [locationRefCount, setLocationRefCount] = useState<number | null>(null);
  const [showLocations, setShowLocations] = useState(false);
  const [locationFilter, setLocationFilter] = useState<'all' | 'project' | 'customer' | 'supplier'>('all');
  const [sidebarTab, setSidebarTab] = useState<'zones' | 'groups'>('zones');
  const [isAutoNaming, setIsAutoNaming] = useState(false);

  const { regions, isLoading: regionsLoading } = useRegions();
  const { zones, isLoading: zonesLoading, bulkImport, updateZone, checkLocationReferences } = useZones();
  const { groups, isLoading: groupsLoading, upsert: upsertGroup, remove: removeGroup } = useZoneGroups(selectedRegion?.code);
  const { importResult, handleFile, processContent, clearResult } = useZoneImport();

  useEffect(() => {
    if (!inspectedZone) {
      setZoneNameArDraft('');
      setZoneNameDraft('');
      return;
    }
    setZoneNameArDraft(inspectedZone.name_ar || '');
    setZoneNameDraft(inspectedZone.name || '');
  }, [inspectedZone]);

  // Fetch smart location pins
  const { data: locationPins = [] } = useQuery({
    queryKey: ['location-pins-smart'],
    queryFn: async () => {
      const { data: locs, error } = await supabase
        .from('locations')
        .select('id, lat, lng, city, address_text, zone_code')
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      if (error) throw error;

      // Get projects with location_id
      const { data: projects } = await supabase
        .from('projects')
        .select('id, location_id, name')
        .not('location_id', 'is', null)
        .is('deleted_at', null);

      // Get accounts with location_id (customers)
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, location_id, display_name')
        .not('location_id', 'is', null)
        .is('deleted_at', null);

      // Get suppliers
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('account_id')
        .not('account_id', 'is', null);

      const supplierAccountIds = new Set((suppliers || []).map((s: any) => s.account_id));

      const projectMap = new Map<string, { id: string; name: string }>();
      (projects || []).forEach((p: any) => { if (p.location_id) projectMap.set(p.location_id, { id: p.id, name: p.name }); });

      const accountMap = new Map<string, { id: string; name: string; isSupplier: boolean }>();
      (accounts || []).forEach((a: any) => {
        if (a.location_id) accountMap.set(a.location_id, {
          id: a.id,
          name: a.display_name,
          isSupplier: supplierAccountIds.has(a.id),
        });
      });

      return (locs || []).map((loc: any) => {
        const proj = projectMap.get(loc.id);
        const acct = accountMap.get(loc.id);
        let entity_type: LocationPin['entity_type'] = 'unknown';
        let entity_name: string | null = null;
        let entity_id: string | null = null;

        if (acct?.isSupplier) {
          entity_type = 'supplier';
          entity_name = acct.name;
          entity_id = acct.id;
        } else if (proj && acct) {
          entity_type = 'both';
          entity_name = proj.name;
          entity_id = proj.id;
        } else if (proj) {
          entity_type = 'project';
          entity_name = proj.name;
          entity_id = proj.id;
        } else if (acct) {
          entity_type = 'customer';
          entity_name = acct.name;
          entity_id = acct.id;
        }

        return { ...loc, entity_type, entity_name, entity_id } as LocationPin;
      });
    },
    enabled: showLocations,
  });

  const filteredPins = locationFilter === 'all'
    ? locationPins
    : locationPins.filter(p => p.entity_type === locationFilter || p.entity_type === 'both');

  const handleRegionSelect = useCallback((region: Region | null) => {
    setSelectedRegion(region);
    setSelectedGroup(null);
    setInspectedZone(null);
    if (region && region.center_lat && region.center_lng && mapRef.current) {
      mapRef.current.setView([region.center_lat, region.center_lng], 10);
    }
  }, []);

  const handleZoneClick = useCallback((zone: Zone) => {
    setInspectedZone(zone);
    const geoJson = toGeoJsonObject(zone.boundary_geojson);
    if (geoJson && mapRef.current) {
      try { mapRef.current.fitBounds(L.geoJSON(geoJson).getBounds()); } catch { /* ignore */ }
    }
  }, []);

  const handleZoomToRegion = useCallback((region: Region) => {
    if (region.center_lat && region.center_lng && mapRef.current) {
      mapRef.current.setView([region.center_lat, region.center_lng], 10);
    } else {
      const geoJson = toGeoJsonObject(region.boundary_geojson);
      if (geoJson && mapRef.current) {
        try { mapRef.current.fitBounds(L.geoJSON(geoJson).getBounds()); } catch { /* ignore */ }
      }
    }
  }, []);

  const handleZoomToZone = useCallback((zone: Zone) => {
    const geoJson = toGeoJsonObject(zone.boundary_geojson);
    if (geoJson && mapRef.current) {
      try { mapRef.current.fitBounds(L.geoJSON(geoJson).getBounds()); } catch { /* ignore */ }
    }
  }, []);

  const handleAutoName = async () => {
    setIsAutoNaming(true);
    let totalUpdated = 0;
    let totalRemaining = 999;
    let batchNum = 0;
    
    try {
      // Process in batches of 10 to avoid edge function timeout
      while (totalRemaining > 0 && batchNum < 10) {
        batchNum++;
        toast.info(`Auto-naming batch ${batchNum}... (${totalRemaining} remaining)`);
        const { data, error } = await supabase.functions.invoke('geocode-zones', {
          body: { limit: 10 },
        });
        if (error) throw error;
        totalUpdated += data?.updated || 0;
        totalRemaining = data?.remaining ?? 0;
        if (data?.errors?.length > 0) {
          console.warn(`Batch ${batchNum} errors:`, data.errors);
        }
        if ((data?.updated || 0) === 0 && (data?.remaining || 0) > 0) {
          // All remaining zones failed geocoding
          toast.warning(`Stopped: remaining ${totalRemaining} zones could not be geocoded.`);
          break;
        }
      }
      toast.success(`Done! Updated ${totalUpdated} zones across ${batchNum} batches.`);
    } catch (e: any) {
      toast.error(`Auto-name failed: ${e.message}`);
    } finally {
      setIsAutoNaming(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFile(file);
    try {
      const count = await checkLocationReferences();
      setLocationRefCount(count);
    } catch { setLocationRefCount(0); }
    setForceOverride(false);
    setImportDialogOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    if (!importResult?.valid || importResult.zones.length === 0) return;
    try {
      await bulkImport.mutateAsync({ 
        zones: importResult.zones, 
        regions: Array.from(importResult.regions),
        forceOverride,
      });
      setImportDialogOpen(false);
      clearResult();
      setLocationRefCount(null);
      toast.success(`Imported ${importResult.zones.length} zones successfully`);
    } catch (error: any) {
      if (error?.message?.startsWith('SAFEGUARD:')) {
        const count = parseInt(error.message.split(':')[1]);
        setLocationRefCount(count);
      }
    }
  };

  const loadDefaultData = async () => {
    try {
      const res = await fetch('/zones_clean.geojson');
      const text = await res.text();
      processContent(text);
      try {
        const count = await checkLocationReferences();
        setLocationRefCount(count);
      } catch { setLocationRefCount(0); }
      setForceOverride(false);
      setImportDialogOpen(true);
    } catch {
      toast.error('Failed to load default data');
    }
  };

  const needsOverride = (locationRefCount ?? 0) > 0;
  const canImport = importResult?.valid && (!needsOverride || forceOverride);

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="flex flex-col h-[calc(100vh-4rem)]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h1 className="text-xl font-bold">Regions & Zones</h1>
            <div className="flex items-center gap-3">
              {/* Location pins toggle */}
              <div className="flex items-center gap-2">
                <Switch id="show-locations" checked={showLocations} onCheckedChange={setShowLocations} />
                <Label htmlFor="show-locations" className="text-sm flex items-center gap-1 cursor-pointer">
                  <MapPin className="h-3.5 w-3.5" />
                  Locations
                </Label>
              </div>

              {/* Location filter */}
              {showLocations && (
                <Tabs value={locationFilter} onValueChange={(v) => setLocationFilter(v as any)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="all" className="text-xs px-2 h-6">All</TabsTrigger>
                    <TabsTrigger value="project" className="text-xs px-2 h-6">Projects</TabsTrigger>
                    <TabsTrigger value="customer" className="text-xs px-2 h-6">Customers</TabsTrigger>
                    <TabsTrigger value="supplier" className="text-xs px-2 h-6">Suppliers</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              {/* Admin-only buttons */}
              {isAdmin && (
                <>
                  <Button onClick={handleAutoName} variant="outline" size="sm" disabled={isAutoNaming}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    {isAutoNaming ? 'Naming...' : 'Auto-name Zones'}
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".geojson,.json" className="hidden" onChange={handleFileSelect} />
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Import GeoJSON
                  </Button>
                  <Button onClick={loadDefaultData} variant="ghost" size="sm">
                    Load Default
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Map */}
            <div className="flex-1">
              <RegionZoneMap
                regions={regions}
                zones={zones}
                selectedRegion={selectedRegion}
                selectedZones={inspectedZone ? [inspectedZone] : []}
                onRegionClick={handleRegionSelect}
                onZoneClick={handleZoneClick}
                mapRef={mapRef}
                locationPins={showLocations ? filteredPins : []}
                highlightedGroup={selectedGroup}
              />
            </div>

            {/* Sidebar */}
            <div className="w-72 border-l flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <RegionsList
                  regions={regions}
                  isLoading={regionsLoading}
                  selectedRegion={selectedRegion}
                  onSelectRegion={handleRegionSelect}
                  onZoomToRegion={handleZoomToRegion}
                />
              </div>

              {/* Tabs for Zones / Groups */}
              <div className="border-t">
                <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as any)}>
                  <TabsList className="w-full rounded-none h-9">
                    <TabsTrigger value="zones" className="flex-1 text-xs">Zones</TabsTrigger>
                    <TabsTrigger value="groups" className="flex-1 text-xs">Groups</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex-1 border-t overflow-hidden">
                {sidebarTab === 'zones' ? (
                  <ZonesList
                    zones={zones}
                    isLoading={zonesLoading}
                    selectedRegion={selectedRegion}
                    onZoomToZone={handleZoomToZone}
                    onInspectZone={setInspectedZone}
                  />
                ) : (
                  <ZoneGroupsList
                    groups={groups}
                    isLoading={groupsLoading}
                    zones={zones}
                    regionCode={selectedRegion?.code || null}
                    selectedGroup={selectedGroup}
                    onSelectGroup={setSelectedGroup}
                    onSave={(g) => upsertGroup.mutate(g)}
                    onDelete={(id) => removeGroup.mutate(id)}
                    isAdmin={isAdmin}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Zone Info / Edit Dialog */}
        <Dialog open={!!inspectedZone} onOpenChange={(open) => { if (!open) setInspectedZone(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{inspectedZone?.name_ar || inspectedZone?.name || inspectedZone?.code || 'Zone'}</DialogTitle>
              <DialogDescription>Zone details and edit options</DialogDescription>
            </DialogHeader>

            {inspectedZone && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Code</Label>
                  <div className="text-sm font-mono">{inspectedZone.code}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Region</Label>
                  <div className="text-sm">{inspectedZone.region_code}</div>
                </div>

                {isAdmin ? (
                  <>
                    <div className="space-y-1">
                      <Label>Name (Arabic)</Label>
                      <Input dir="rtl" value={zoneNameArDraft} onChange={(e) => setZoneNameArDraft(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Name (English)</Label>
                      <Input value={zoneNameDraft} onChange={(e) => setZoneNameDraft(e.target.value)} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Name (Arabic)</Label>
                      <div className="text-sm" dir="rtl">{inspectedZone.name_ar || '—'}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Name (English)</Label>
                      <div className="text-sm">{inspectedZone.name || '—'}</div>
                    </div>
                  </>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setInspectedZone(null)}>Close</Button>
              {isAdmin && inspectedZone && (
                <Button
                  onClick={() => {
                    updateZone.mutate({
                      id: inspectedZone.id,
                      name: zoneNameDraft || undefined,
                      name_ar: zoneNameArDraft || null,
                    });
                    setInspectedZone({
                      ...inspectedZone,
                      name: zoneNameDraft || null,
                      name_ar: zoneNameArDraft || null,
                    });
                  }}
                  disabled={!zoneNameDraft && !zoneNameArDraft}
                >
                  Save changes
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Confirmation Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Zones from GeoJSON</DialogTitle>
              <DialogDescription>{importResult?.summary}</DialogDescription>
            </DialogHeader>

            {importResult?.errors && importResult.errors.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {importResult.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            {importResult?.valid && !needsOverride && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle className="h-4 w-4" />
                <span>All features validated. This will replace all existing zones.</span>
              </div>
            )}

            {needsOverride && (
              <div className="space-y-3 border border-amber-300 rounded-lg p-3 bg-amber-50 dark:bg-amber-950/20">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    <strong>{locationRefCount}</strong> location{locationRefCount !== 1 ? 's' : ''} currently reference zones that will be replaced. Their zone assignments will be cleared.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="force-override"
                    checked={forceOverride}
                    onCheckedChange={(checked) => setForceOverride(checked === true)}
                  />
                  <label htmlFor="force-override" className="text-sm cursor-pointer">
                    I understand, proceed anyway
                  </label>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setImportDialogOpen(false); clearResult(); setLocationRefCount(null); }}>
                Cancel
              </Button>
              <Button onClick={handleConfirmImport} disabled={!canImport || bulkImport.isPending}>
                {bulkImport.isPending ? 'Importing...' : `Import ${importResult?.zones.length || 0} Zones`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </AppLayout>
  );
}

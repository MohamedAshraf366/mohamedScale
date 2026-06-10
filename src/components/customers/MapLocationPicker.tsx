import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { Icon, LatLng } from 'leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Loader2, Link2, ExternalLink, MapPinned, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { detectZoneForPoint, type ZoneDetectionResult } from '@/lib/geo-utils';
import { normalizeCountry, normalizeCity } from '@/lib/geo-enums';
import { supabase } from '@/integrations/supabase/client';
import 'leaflet/dist/leaflet.css';


// Fix for default marker icon in React-Leaflet
const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface LocationResult {
  address_text: string;
  city: string;
  country: string;
  place_name: string;
  place_id: string;
  lat: number;
  lng: number;
  address_link: string;
  region_code: string;
  zone_code: string | null;
  zone_name: string | null;
}

interface MapLocationPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onLocationSelect: (location: LocationResult) => void;
}

// Generate Google Maps link from coordinates
const generateGoogleMapsLink = (lat: number, lng: number): string => {
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

// Parse coordinates from various Google Maps URL formats
const parseGoogleMapsLink = (url: string): { lat: number; lng: number } | null => {
  try {
    // Format: https://www.google.com/maps?q=24.7136,46.6753
    const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (qMatch) {
      return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
    }

    // Format: https://www.google.com/maps/place/.../@24.7136,46.6753,17z/...
    const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) {
      return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
    }

    // Format: https://maps.google.com/?ll=24.7136,46.6753
    const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (llMatch) {
      return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
    }

    // Format: https://www.google.com/maps/dir/.../24.7136,46.6753/...
    const dirMatch = url.match(/\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (dirMatch) {
      return { lat: parseFloat(dirMatch[1]), lng: parseFloat(dirMatch[2]) };
    }

    return null;
  } catch {
    return null;
  }
};

// Component to handle map click events
function MapClickHandler({ onLocationClick }: { onLocationClick: (latlng: LatLng) => void }) {
  useMapEvents({
    click: (e) => {
      onLocationClick(e.latlng);
    },
  });
  return null;
}

export const MapLocationPicker = ({
  initialLat,
  initialLng,
  onLocationSelect,
}: MapLocationPickerProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [googleLink, setGoogleLink] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
    initialLat && initialLng ? [initialLat, initialLng] : null
  );
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    initialLat && initialLng ? [initialLat, initialLng] : [24.7136, 46.6753] // Default: Riyadh
  );
  const [currentLink, setCurrentLink] = useState<string>(
    initialLat && initialLng ? generateGoogleMapsLink(initialLat, initialLng) : ''
  );
  const [detectedZone, setDetectedZone] = useState<ZoneDetectionResult | null>(null);

  // Auto-detect zone for coordinates
  const autoDetectZone = async (lat: number, lng: number): Promise<ZoneDetectionResult | null> => {
    try {
      const result = await detectZoneForPoint(lat, lng);
      setDetectedZone(result);
      return result;
    } catch {
      setDetectedZone(null);
      return null;
    }
  };

  // Reverse geocode coordinates to address using Nominatim
  const reverseGeocode = async (lat: number, lng: number): Promise<LocationResult | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      const address = data.address || {};
      const rawCity = address.city || address.town || address.village || address.municipality || '';
      const rawCountry = address.country || '';
      const normalizedCity = normalizeCity(rawCity);
      const normalizedCountry = normalizeCountry(rawCountry);
      // If city didn't match the enum, prepend it to address_text
      let addressText = data.display_name || '';
      if (rawCity && !normalizedCity) {
        addressText = addressText || rawCity;
      }
      
      const zone = await autoDetectZone(lat, lng);
      return {
        address_text: addressText,
        city: normalizedCity || '',
        country: normalizedCountry,
        place_name: address.building || address.amenity || address.shop || address.road || '',
        place_id: String(data.place_id || ''),
        lat,
        lng,
        address_link: generateGoogleMapsLink(lat, lng),
        region_code: zone?.region_code || '',
        zone_code: zone?.zone_code ?? null,
        zone_name: zone?.zone_name ?? null,
      };
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return null;
    }
  };

  // Search for a location by text using Nominatim
  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );
      
      if (!response.ok) return;
      
      const results = await response.json();
      if (results.length > 0) {
        const result = results[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        const address = result.address || {};
        const addressLink = generateGoogleMapsLink(lat, lng);
        const rawCity = address.city || address.town || address.village || address.municipality || '';
        const normalizedCity = normalizeCity(rawCity);
        const normalizedCountry = normalizeCountry(address.country || '');
        let addressText = result.display_name || '';
        if (rawCity && !normalizedCity) {
          addressText = addressText || rawCity;
        }
        
        setMarkerPosition([lat, lng]);
        setMapCenter([lat, lng]);
        setCurrentLink(addressLink);

        const zone = await autoDetectZone(lat, lng);
        
        const location: LocationResult = {
          address_text: addressText,
          city: normalizedCity || '',
          country: normalizedCountry,
          place_name: address.building || address.amenity || address.shop || address.road || '',
          place_id: String(result.place_id || ''),
          lat,
          lng,
          address_link: addressLink,
          region_code: zone?.region_code || '',
          zone_code: zone?.zone_code ?? null,
          zone_name: zone?.zone_name ?? null,
        };
        
        onLocationSelect(location);
      }
    } catch (error) {
      console.error('Location search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle map click
  const handleMapClick = async (latlng: LatLng) => {
    const { lat, lng } = latlng;
    setMarkerPosition([lat, lng]);
    setCurrentLink(generateGoogleMapsLink(lat, lng));
    setIsGeocoding(true);
    
    const location = await reverseGeocode(lat, lng);
    setIsGeocoding(false);
    
    if (location) {
      onLocationSelect(location);
    }
  };

  // Resolve a shortened Google Maps link via the edge function (no temp DB row)
  const resolveShortLinkViaEdge = async (url: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const { data: result, error } = await supabase.functions.invoke('resolve-project-locations', {
        body: { resolve_only: true, address_link: url },
      });

      if (error) {
        console.error('Edge function error:', error);
        return null;
      }

      if (result?.success && result?.coords) {
        return { lat: result.coords.lat, lng: result.coords.lng };
      }
      return null;
    } catch (e) {
      console.error('resolveShortLinkViaEdge error:', e);
      return null;
    }
  };

  // Handle Google Maps link paste
  const handleGoogleLinkPaste = async () => {
    if (!googleLink.trim()) return;
    
    setLinkError('');
    setLinkSuccess(false);
    setIsGeocoding(true);

    let urlToProcess = googleLink.trim();
    
    // If it's a shortened link, resolve via edge function
    const isShortLink = /maps\.app\.goo\.gl|goo\.gl|bit\.ly/i.test(urlToProcess);
    if (isShortLink) {
      const resolved = await resolveShortLinkViaEdge(urlToProcess);
      if (resolved) {
        // We already have coords and a location row — reverse geocode for display
        const { lat, lng } = resolved;
        setMarkerPosition([lat, lng]);
        setMapCenter([lat, lng]);
        setCurrentLink(generateGoogleMapsLink(lat, lng));

        const location = await reverseGeocode(lat, lng);
        setIsGeocoding(false);
        if (location) {
          onLocationSelect(location);
          setLinkSuccess(true);
        }
        return;
      } else {
        setIsGeocoding(false);
        setLinkError('Could not resolve this shortened link. Try pasting the full Google Maps URL.');
        return;
      }
    }

    const coords = parseGoogleMapsLink(urlToProcess);
    
    if (!coords) {
      setIsGeocoding(false);
      setLinkError('Could not extract coordinates from this link. Try pasting the full Google Maps URL.');
      return;
    }
    
    const { lat, lng } = coords;
    setMarkerPosition([lat, lng]);
    setMapCenter([lat, lng]);
    setCurrentLink(generateGoogleMapsLink(lat, lng));
    
    const location = await reverseGeocode(lat, lng);
    setIsGeocoding(false);
    
    if (location) {
      onLocationSelect(location);
      setLinkSuccess(true);
    }
  };

  return (
    <div className="space-y-3">
      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-9">
          <TabsTrigger value="search" className="text-xs gap-1">
            <Search className="h-3 w-3" />
            Search
          </TabsTrigger>
          <TabsTrigger value="paste" className="text-xs gap-1">
            <Link2 className="h-3 w-3" />
            Paste Link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for a location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={searchLocation}
              disabled={isSearching}
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="paste" className="mt-2 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Paste Google Maps link..."
                value={googleLink}
              onChange={(e) => {
                  setGoogleLink(e.target.value);
                  setLinkError('');
                  setLinkSuccess(false);
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (pasted && (pasted.includes('google') || pasted.includes('goo.gl') || pasted.includes('maps'))) {
                    setTimeout(() => {
                      setGoogleLink(pasted);
                      // Auto-trigger apply
                      const btn = (e.target as HTMLElement).parentElement?.parentElement?.querySelector('button');
                      btn?.click();
                    }, 50);
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleGoogleLinkPaste()}
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleGoogleLinkPaste}
              disabled={isGeocoding}
            >
              {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>
          {linkError && (
            <p className="text-xs text-destructive">{linkError}</p>
          )}
          {linkSuccess && !linkError && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Location detected successfully
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Map container */}
      <div className="relative rounded-lg overflow-hidden border border-border h-[250px]">
        <MapContainer
          center={mapCenter}
          zoom={13}
          className="h-full w-full"
          key={`${mapCenter[0]}-${mapCenter[1]}`}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onLocationClick={handleMapClick} />
          {markerPosition && (
            <Marker position={markerPosition} icon={defaultIcon} />
          )}
        </MapContainer>
        
        {/* Loading overlay */}
        {isGeocoding && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Getting address...
            </div>
          </div>
        )}
      </div>

      {/* Zone detection badge */}
      {detectedZone ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs gap-1">
            <MapPinned className="h-3 w-3" />
            Zone: {detectedZone.zone_name || detectedZone.zone_code}
          </Badge>
        </div>
      ) : markerPosition ? (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300">
            <MapPinned className="h-3 w-3" />
            No zone detected
          </Badge>
        </div>
      ) : null}

      {/* Helper text and generated link */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <p className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          Click on the map to select a location
        </p>
        {currentLink && (
          <a
            href={currentLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Open in Google Maps
          </a>
        )}
      </div>
    </div>
  );
};

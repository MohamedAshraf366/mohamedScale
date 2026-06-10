import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Layout from '@/components/Layout';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, MapPin, Phone, Mail, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Supplier {
  id: string;
  name: string;
  supplier_code: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
}

interface SupplierZone {
  id: string;
  zone_name: string;
  delivery_price: number;
}

// Fix default marker icon issue with Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Component to handle map flying to location
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      map.flyTo(center, zoom);
    }
  }, [center, zoom, map]);
  
  return null;
}

const SuppliersMap = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierZones, setSupplierZones] = useState<SupplierZone[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([24.7136, 46.6753]); // Riyadh coordinates
  const [mapZoom, setMapZoom] = useState(11);

  // Custom marker icon created inside component
  const customIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="width: 30px; height: 30px; border-radius: 50%; background-color: #3b82f6; border: 3px solid white; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (selectedSupplier) {
      fetchSupplierZones(selectedSupplier.id);
    }
  }, [selectedSupplier]);


  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (!error && data) {
      setSuppliers(data);
    }
  };

  const fetchSupplierZones = async (supplierId: string) => {
    const { data, error } = await supabase
      .from('supplier_zones')
      .select('*')
      .eq('supplier_id', supplierId);

    if (!error && data) {
      setSupplierZones(data);
    }
  };

  const handleMarkerClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    if (supplier.latitude && supplier.longitude) {
      setMapCenter([supplier.latitude, supplier.longitude]);
      setMapZoom(13);
    }
  };

  const renderRating = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground">No rating</span>;
    return (
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < rating ? 'fill-accent text-accent' : 'text-muted'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-foreground">Suppliers Map</h1>
          <Badge variant="secondary" className="text-sm">
            {suppliers.length} Suppliers
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-0">
                <div className="h-[600px] rounded-lg overflow-hidden">
                  <MapContainer
                    center={[24.7136, 46.6753]}
                    zoom={11}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapController center={mapCenter} zoom={mapZoom} />
                    {suppliers.map((supplier) => {
                      if (supplier.latitude && supplier.longitude) {
                        return (
                          <Marker
                            key={supplier.id}
                            position={[supplier.latitude, supplier.longitude]}
                            icon={customIcon}
                            eventHandlers={{
                              click: () => handleMarkerClick(supplier),
                            }}
                          >
                            <Popup>
                              <div className="text-sm">
                                <h3 className="font-semibold">{supplier.name}</h3>
                                <p className="text-muted-foreground">{supplier.supplier_code}</p>
                              </div>
                            </Popup>
                          </Marker>
                        );
                      }
                      return null;
                    })}
                  </MapContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Supplier Details Panel */}
          <div className="lg:col-span-1">
            {selectedSupplier ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Supplier Details</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedSupplier(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">
                      {selectedSupplier.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedSupplier.supplier_code}
                    </p>
                  </div>

                  {selectedSupplier.contact_person && (
                    <div>
                      <p className="text-sm font-medium text-foreground">Contact Person</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedSupplier.contact_person}
                      </p>
                    </div>
                  )}

                  {selectedSupplier.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{selectedSupplier.phone}</span>
                    </div>
                  )}

                  {selectedSupplier.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{selectedSupplier.email}</span>
                    </div>
                  )}

                  {selectedSupplier.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">
                        {selectedSupplier.location}
                        {selectedSupplier.city && `, ${selectedSupplier.city}`}
                      </span>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Rating</p>
                    {renderRating(selectedSupplier.rating)}
                  </div>

                  {/* Supplier Zones */}
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-sm mb-3 text-foreground">
                      Coverage Zones & Delivery Prices
                    </h4>
                    {supplierZones.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Zone</TableHead>
                            <TableHead className="text-right">Price (SAR)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {supplierZones.map((zone) => (
                            <TableRow key={zone.id}>
                              <TableCell className="font-medium">{zone.zone_name}</TableCell>
                              <TableCell className="text-right">
                                {zone.delivery_price.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No zones configured
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-[600px] text-center space-y-2">
                  <MapPin className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click on a marker to view supplier details
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SuppliersMap;

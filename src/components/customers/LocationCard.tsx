import { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, MapPin, ChevronDown, ChevronUp, Map } from 'lucide-react';
import { CustomerFormData } from '@/lib/customer-schema';
import { MapLocationPicker, LocationResult } from './MapLocationPicker';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface LocationCardProps {
  form: UseFormReturn<CustomerFormData>;
  onRemove: () => void;
}

export const LocationCard = ({ form, onRemove }: LocationCardProps) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(true);

  const handleLocationSelect = (location: LocationResult) => {
    form.setValue('location.address_text', location.address_text);
    form.setValue('location.city', location.city);
    form.setValue('location.country', location.country);
    form.setValue('location.place_name', location.place_name);
    form.setValue('location.place_id', location.place_id);
    form.setValue('location.lat', location.lat);
    form.setValue('location.lng', location.lng);
    form.setValue('location.region_code', location.region_code || 'RYD');
    form.setValue('location.zone_code', location.zone_code);
  };

  const currentLat = form.watch('location.lat');
  const currentLng = form.watch('location.lng');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map Picker Section */}
        <Collapsible open={isMapOpen} onOpenChange={setIsMapOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between mb-2">
              <span className="flex items-center gap-2">
                <Map className="h-4 w-4" />
                Select on Map
              </span>
              {isMapOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <MapLocationPicker
              initialLat={currentLat}
              initialLng={currentLng}
              onLocationSelect={handleLocationSelect}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Address Text */}
        <FormField
          control={form.control}
          name="location.address_text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Main Street, Building A" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* City & Country */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="location.city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="Riyadh" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location.country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <Input placeholder="Saudi Arabia" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Advanced Options */}
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              Advanced Options
              {isAdvancedOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="location.address_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Link (Google Maps URL)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://maps.google.com/..." {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="location.place_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Place Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Business Bay Tower" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location.place_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Place ID</FormLabel>
                    <FormControl>
                      <Input placeholder="OSM Place ID" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="location.lat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="24.7136"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === '' ? null : parseFloat(val));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location.lng"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="46.6753"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === '' ? null : parseFloat(val));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

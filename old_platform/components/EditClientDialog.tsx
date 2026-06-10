import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { logAudit } from '@/lib/auditLogger';
import { Building2, User, Phone, MapPin, Tag } from 'lucide-react';

interface Client {
  id: string;
  company_name: string;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  city: string | null;
  district: string | null;
  interest_level: string | null;
  assigned_to: string | null;
  notes: string | null;
  segment_id: string | null;
}

interface Segment {
  id: string;
  name: string;
  color: string | null;
}

interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onSuccess: () => void;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export function EditClientDialog({
  open,
  onOpenChange,
  client,
  onSuccess,
}: EditClientDialogProps) {
  const [companyName, setCompanyName] = useState('');
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [primaryContactPhone, setPrimaryContactPhone] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [segmentsRes, profilesRes] = await Promise.all([
        supabase.from('client_segments').select('*').order('name'),
        supabase.from('profiles').select('id, full_name, email').order('full_name')
      ]);
      if (segmentsRes.data) setSegments(segmentsRes.data);
      if (profilesRes.data) setProfiles(profilesRes.data);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (client) {
      setCompanyName(client.company_name || '');
      setPrimaryContactName(client.primary_contact_name || '');
      setPrimaryContactPhone(client.primary_contact_phone || '');
      setCity(client.city || '');
      setDistrict(client.district || '');
      
      setAssignedTo(client.assigned_to || '');
      setNotes(client.notes || '');
      setSegmentId(client.segment_id || '');
    }
  }, [client, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client) return;

    if (!companyName.trim()) {
      toast.error('Company name is required');
      return;
    }

    setSaving(true);

    try {
      const oldValues = {
        company_name: client.company_name,
        primary_contact_name: client.primary_contact_name,
        primary_contact_phone: client.primary_contact_phone,
        city: client.city,
        district: client.district,
        assigned_to: client.assigned_to,
        notes: client.notes,
        segment_id: client.segment_id,
      };
      
      const newValues = {
        company_name: companyName.trim(),
        primary_contact_name: primaryContactName.trim() || null,
        primary_contact_phone: primaryContactPhone.trim() || null,
        city: city.trim() || null,
        district: district.trim() || null,
        assigned_to: assignedTo.trim() || null,
        notes: notes.trim() || null,
        segment_id: segmentId || null,
      };

      const { error } = await supabase
        .from('clients')
        .update(newValues)
        .eq('id', client.id);

      if (error) throw error;
      
      // Log audit for client update
      await logAudit({
        action: 'updated',
        module: 'Clients',
        recordId: client.id,
        recordName: companyName.trim(),
        oldValues,
        newValues,
      });
      
      toast.success('Client updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error updating client:', err);
      toast.error('Failed to update client');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="companyName" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Company Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryContactName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Primary Contact
              </Label>
              <Input
                id="primaryContactName"
                value={primaryContactName}
                onChange={(e) => setPrimaryContactName(e.target.value)}
                placeholder="Contact name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="primaryContactPhone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone
              </Label>
              <Input
                id="primaryContactPhone"
                value={primaryContactPhone}
                onChange={(e) => setPrimaryContactPhone(e.target.value)}
                placeholder="Phone number"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                City
              </Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="district">District</Label>
              <Input
                id="district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="District"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="segment" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Segment
            </Label>
            <Select value={segmentId} onValueChange={setSegmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select segment" />
              </SelectTrigger>
              <SelectContent>
                {segments.map((seg) => (
                  <SelectItem key={seg.id} value={seg.id}>
                    {seg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedTo">Owner</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.full_name || profile.email || profile.id}>
                    {profile.full_name || profile.email || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

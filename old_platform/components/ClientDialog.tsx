import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, User, Phone, UserCheck } from 'lucide-react';

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface ClientSegment {
  id: string;
  name: string;
  color: string | null;
}

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segments: ClientSegment[];
  onCreate: (data: {
    company_name: string;
    segment_id: string | null;
    primary_contact_name: string;
    primary_contact_phone: string;
    city: string;
    district?: string;
    assigned_to?: string;
    notes?: string;
  }) => Promise<{ id: string; company_name: string }>;
  onSuccess?: (client: { id: string; company_name: string }) => void;
}

const ClientDialog = ({
  open,
  onOpenChange,
  segments,
  onCreate,
  onSuccess,
}: ClientDialogProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  // Form state
  const [companyName, setCompanyName] = useState('');
  const [segmentId, setSegmentId] = useState<string>('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch profiles and set default owner to current user
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');
      if (data) {
        setProfiles(data);
        // Set default owner to current user
        if (user && !assignedTo) {
          const currentUserProfile = data.find(p => p.id === user.id);
          if (currentUserProfile) {
            setAssignedTo(currentUserProfile.full_name || currentUserProfile.email || currentUserProfile.id);
          }
        }
      }
    };
    fetchProfiles();
  }, [user]);

  const resetForm = () => {
    setCompanyName('');
    setSegmentId('');
    setContactName('');
    setContactPhone('');
    // Reset owner to current user
    if (user) {
      const currentUserProfile = profiles.find(p => p.id === user.id);
      if (currentUserProfile) {
        setAssignedTo(currentUserProfile.full_name || currentUserProfile.email || currentUserProfile.id);
      } else {
        setAssignedTo('');
      }
    } else {
      setAssignedTo('');
    }
    setNotes('');
  };

  const handleSubmit = async () => {
    // Validation
    if (!companyName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Client Name is required',
        variant: 'destructive',
      });
      return;
    }
    if (!segmentId) {
      toast({
        title: 'Validation Error',
        description: 'Client Segment is required',
        variant: 'destructive',
      });
      return;
    }
    if (!contactName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Contact Name is required',
        variant: 'destructive',
      });
      return;
    }
    if (!contactPhone.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Contact Phone is required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const newClient = await onCreate({
        company_name: companyName.trim(),
        segment_id: segmentId,
        primary_contact_name: contactName.trim(),
        primary_contact_phone: contactPhone.trim(),
        city: '',
        assigned_to: assignedTo.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      toast({
        title: 'Client Created',
        description: `${newClient.company_name} has been added successfully.`,
      });

      resetForm();
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess(newClient);
      }
      
      // Navigate to the new client profile
      navigate(`/client-profile/${encodeURIComponent(newClient.company_name)}`);
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create client',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="flex flex-col p-0 gap-0"
        style={{ 
          maxHeight: '90vh', 
          width: 'min(900px, 92vw)',
          maxWidth: 'min(900px, 92vw)'
        }}
      >
        <div className="px-6 pt-6 pb-4 border-b shrink-0 bg-background">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Add New Client
          </DialogTitle>
          <DialogDescription className="mt-1.5">
            Create a new client account. Required fields are marked with *.
          </DialogDescription>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {/* Client Name */}
            <div className="space-y-2">
              <Label htmlFor="company_name" className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                Client Name *
              </Label>
              <Input
                id="company_name"
                placeholder="e.g., Al Futtaim Group"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            {/* Segment */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Client Segment *
              </Label>
              <Select value={segmentId} onValueChange={setSegmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select segment..." />
                </SelectTrigger>
                <SelectContent>
                  {segments.map((seg) => (
                    <SelectItem key={seg.id} value={seg.id}>
                      <span className="flex items-center gap-2">
                        {seg.color && (
                          <span 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: seg.color }}
                          />
                        )}
                        {seg.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            {/* Primary Contact Section */}
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-3">Primary Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="contact_name" className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Name *
                  </Label>
                  <Input
                    id="contact_name"
                    placeholder="Contact name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone" className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    Phone *
                  </Label>
                  <Input
                    id="contact_phone"
                    placeholder="+971 50 123 4567"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Owner Field */}
            <div className="border-t pt-4 mt-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <UserCheck className="h-4 w-4" />
                  Owner
                </Label>
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
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 px-6 py-4 border-t bg-background shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Client'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default ClientDialog;

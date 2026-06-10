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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { User, Phone, Briefcase, Star, Mail } from 'lucide-react';

interface Contact {
  id: string;
  contact_name: string;
  phone: string;
  email?: string | null;
  role: string | null;
  is_primary: boolean;
}

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  editingContact: Contact | null;
  initialValues?: { contact_name: string; phone: string };
  onSuccess: () => void;
}

const roles = [
  { value: 'Owner', label: 'Owner' },
  { value: 'Engineer', label: 'Engineer' },
  { value: 'Procurement', label: 'Procurement' },
  { value: 'Site', label: 'Site' },
  { value: 'Other', label: 'Other' },
];

export function AddContactDialog({
  open,
  onOpenChange,
  clientId,
  editingContact,
  initialValues,
  onSuccess,
}: AddContactDialogProps) {
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditing = !!editingContact;

  useEffect(() => {
    if (editingContact) {
      setContactName(editingContact.contact_name);
      setPhone(editingContact.phone);
      setEmail(editingContact.email || '');
      setRole(editingContact.role || '');
      setIsPrimary(editingContact.is_primary);
    } else if (initialValues) {
      setContactName(initialValues.contact_name);
      setPhone(initialValues.phone);
      setEmail('');
      setRole('');
      setIsPrimary(false);
    } else {
      setContactName('');
      setPhone('');
      setEmail('');
      setRole('');
      setIsPrimary(false);
    }
  }, [editingContact, initialValues, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientId) {
      toast.error('Client ID is required');
      return;
    }

    if (!contactName.trim() || !phone.trim()) {
      toast.error('Name and phone are required');
      return;
    }

    setSaving(true);

    try {
      // If setting as primary, unset existing primary first
      if (isPrimary && (!editingContact || !editingContact.is_primary)) {
        await supabase
          .from('client_contacts')
          .update({ is_primary: false })
          .eq('client_id', clientId)
          .eq('is_primary', true);
      }

      if (isEditing) {
        const { error } = await supabase
          .from('client_contacts')
          .update({
            contact_name: contactName.trim(),
            phone: phone.trim(),
            email: email.trim() || null,
            role: role || null,
            is_primary: isPrimary,
          })
          .eq('id', editingContact.id);

        if (error) throw error;
        toast.success('Contact updated');
      } else {
        const { error } = await supabase
          .from('client_contacts')
          .insert({
            client_id: clientId,
            contact_name: contactName.trim(),
            phone: phone.trim(),
            email: email.trim() || null,
            role: role || null,
            is_primary: isPrimary,
          });

        if (error) throw error;
        toast.success('Contact added');
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error saving contact:', err);
      if (err.message?.includes('idx_client_contacts_primary')) {
        toast.error('Only one contact can be primary. Please unset the current primary first.');
      } else {
        toast.error(isEditing ? 'Failed to update contact' : 'Failed to add contact');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="contactName" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contactName"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Enter contact name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Role
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role (optional)" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2 py-2">
            <Checkbox
              id="isPrimary"
              checked={isPrimary}
              onCheckedChange={(checked) => setIsPrimary(checked === true)}
            />
            <Label 
              htmlFor="isPrimary" 
              className="text-sm font-normal cursor-pointer flex items-center gap-2"
            >
              <Star className="h-4 w-4 text-primary" />
              Set as Primary Contact
            </Label>
          </div>
          
          {isPrimary && !editingContact?.is_primary && (
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
              This will replace the current primary contact. The previous primary contact will become a secondary contact.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : isEditing ? 'Update Contact' : 'Add Contact'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

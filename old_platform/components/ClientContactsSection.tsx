import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Phone, Plus, Star, Trash2, Pencil, Briefcase, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { AddContactDialog } from './AddContactDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Contact {
  id: string;
  contact_name: string;
  phone: string;
  email?: string | null;
  role: string | null;
  is_primary: boolean;
  created_at: string;
}

interface ClientContactsSectionProps {
  clientId: string | null;
  legacyPersonNames?: string[];
  legacyContactInfo?: string[];
  hideHeader?: boolean;
  initialContactName?: string | null;
  initialContactPhone?: string | null;
  onInitialContactMigrated?: () => void;
  onContactsChanged?: () => void;
}

const roleLabels: Record<string, string> = {
  'Owner': 'Owner',
  'Engineer': 'Engineer',
  'Procurement': 'Procurement',
  'Site': 'Site',
  'Other': 'Other',
};

export function ClientContactsSection({ 
  clientId, 
  legacyPersonNames = [], 
  legacyContactInfo = [],
  hideHeader = false,
  initialContactName,
  initialContactPhone,
  onInitialContactMigrated,
  onContactsChanged
}: ClientContactsSectionProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [editingInitialContact, setEditingInitialContact] = useState(false);

  const fetchContacts = async () => {
    if (!clientId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('client_contacts')
        .select('*')
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setContacts(data || []);
      onContactsChanged?.();
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [clientId]);

  const handleAddContact = () => {
    setEditingContact(null);
    setDialogOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setEditingInitialContact(false);
    setDialogOpen(true);
  };

  const handleEditInitialContact = () => {
    // Create a pseudo-contact object for editing the initial contact
    setEditingContact({
      id: 'initial',
      contact_name: initialContactName || '',
      phone: initialContactPhone || '',
      email: null,
      role: null,
      is_primary: false,
      created_at: new Date().toISOString(),
    });
    setEditingInitialContact(true);
    setDialogOpen(true);
  };

  const handleInitialContactSaved = async () => {
    // After saving initial contact as a proper contact, refresh and notify parent
    await fetchContacts();
    onInitialContactMigrated?.();
  };

  const handleDeleteClick = (contact: Contact) => {
    setContactToDelete(contact);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!contactToDelete) return;

    try {
      const { error } = await supabase
        .from('client_contacts')
        .delete()
        .eq('id', contactToDelete.id);

      if (error) throw error;
      toast.success('Contact deleted');
      fetchContacts();
    } catch (err) {
      console.error('Error deleting contact:', err);
      toast.error('Failed to delete contact');
    } finally {
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    }
  };

  const handleSetPrimary = async (contact: Contact) => {
    if (contact.is_primary) return;

    try {
      // The unique partial index ensures only one primary per client
      // First unset existing primary
      await supabase
        .from('client_contacts')
        .update({ is_primary: false })
        .eq('client_id', clientId)
        .eq('is_primary', true);

      // Set new primary
      const { error } = await supabase
        .from('client_contacts')
        .update({ is_primary: true })
        .eq('id', contact.id);

      if (error) throw error;
      toast.success(`${contact.contact_name} set as primary contact`);
      fetchContacts();
    } catch (err) {
      console.error('Error setting primary contact:', err);
      toast.error('Failed to set primary contact');
    }
  };

  const primaryContact = contacts.find(c => c.is_primary);
  const secondaryContacts = contacts.filter(c => !c.is_primary);

  // Check if the initial client phone is already in the contacts list
  const initialPhoneAlreadyExists = initialContactPhone && contacts.some(
    c => c.phone === initialContactPhone
  );

  // Check if we have any contacts (new, legacy, or initial)
  const hasNoContacts = contacts.length === 0 && 
    legacyPersonNames.length === 0 && 
    legacyContactInfo.length === 0 && 
    !initialContactPhone;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-muted rounded-xl" />
            <div className="h-16 bg-muted rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const contactsContent = (
    <div className="space-y-4">
      {hasNoContacts ? (
        <div className="p-12 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Users className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="font-medium mb-1">No contacts yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Add contacts to keep track of key people.</p>
          {clientId && (
            <Button size="sm" onClick={handleAddContact} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add First Contact
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Primary Contact */}
          {primaryContact && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Primary Contact</p>
              <ContactCard 
                contact={primaryContact} 
                isPrimary 
                onEdit={handleEditContact}
                onDelete={handleDeleteClick}
                onSetPrimary={handleSetPrimary}
              />
            </div>
          )}

          {/* Secondary Contacts */}
          {secondaryContacts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Other Contacts</p>
              <div className="space-y-2">
                {secondaryContacts.map(contact => (
                  <ContactCard 
                    key={contact.id} 
                    contact={contact}
                    onEdit={handleEditContact}
                    onDelete={handleDeleteClick}
                    onSetPrimary={handleSetPrimary}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Initial client contact (from clients table) - show if not already in contacts list */}
          {initialContactPhone && !initialPhoneAlreadyExists && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                {initialContactName ? (
                  <span className="text-muted-foreground font-semibold">
                    {initialContactName.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <Phone className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {initialContactName && <p className="font-medium truncate">{initialContactName}</p>}
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Phone className="h-3.5 w-3.5" />
                  {initialContactPhone}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                onClick={handleEditInitialContact}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Legacy contacts (from communication_log) - only show if no new contacts exist */}
          {contacts.length === 0 && (legacyPersonNames.length > 0 || legacyContactInfo.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Contacts from Communications
              </p>
              {legacyPersonNames.map((name, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{name}</p>
                    {legacyContactInfo[i] && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Phone className="h-3.5 w-3.5" />
                        {legacyContactInfo[i]}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">Legacy</Badge>
                </div>
              ))}
              {legacyContactInfo.slice(legacyPersonNames.length).map((info, i) => (
                <div key={`contact-${i}`} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-muted-foreground">{info}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      {hideHeader ? (
        <>
          <div className="flex items-center justify-between mb-4">
            {clientId && (
              <Button size="sm" variant="outline" onClick={handleAddContact} className="gap-1.5 ml-auto">
                <Plus className="h-4 w-4" />
                Add Contact
              </Button>
            )}
          </div>
          {contactsContent}
        </>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Contacts
              </CardTitle>
              {clientId && (
                <Button size="sm" variant="outline" onClick={handleAddContact} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add Contact
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {contactsContent}
          </CardContent>
        </Card>
      )}

      <AddContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        editingContact={editingInitialContact ? null : editingContact}
        initialValues={editingInitialContact ? {
          contact_name: initialContactName || '',
          phone: initialContactPhone || '',
        } : undefined}
        onSuccess={editingInitialContact ? handleInitialContactSaved : fetchContacts}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {contactToDelete?.contact_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface ContactCardProps {
  contact: Contact;
  isPrimary?: boolean;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onSetPrimary: (contact: Contact) => void;
}

function ContactCard({ contact, isPrimary, onEdit, onDelete, onSetPrimary }: ContactCardProps) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group">
      <div className={`h-12 w-12 rounded-full flex items-center justify-center font-semibold ${
        isPrimary ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
      }`}>
        {contact.contact_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{contact.contact_name}</p>
          {isPrimary && (
            <Badge className="bg-primary/15 text-primary border-primary/25 shrink-0">
              <Star className="h-3 w-3 mr-1" />
              Primary
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />
            {contact.phone}
          </p>
          {contact.email && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {contact.email}
            </p>
          )}
          {contact.role && (
            <Badge variant="outline" className="text-xs">
              <Briefcase className="h-3 w-3 mr-1" />
              {roleLabels[contact.role] || contact.role}
            </Badge>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8">
            <Pencil className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(contact)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          {!isPrimary && (
            <DropdownMenuItem onClick={() => onSetPrimary(contact)}>
              <Star className="h-4 w-4 mr-2" />
              Set as Primary
            </DropdownMenuItem>
          )}
          <DropdownMenuItem 
            onClick={() => onDelete(contact)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

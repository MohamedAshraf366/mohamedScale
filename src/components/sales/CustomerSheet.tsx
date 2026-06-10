import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Globe,
  Clock,
  Edit,
  FileText,
  CreditCard,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomerSheetProps {
  accountId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const lifecycleStageColors: Record<string, string> = {
  lead: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  prospect: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  qualified: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  customer: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  churned: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export function CustomerSheet({ accountId, open, onOpenChange }: CustomerSheetProps) {
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer-detail', accountId],
    queryFn: async () => {
      if (!accountId) return null;

      // Fetch account with customer data
      const { data: accountData, error: accountError } = await supabase
        .from('accounts')
        .select(`
          *,
          customer:customers!inner (
            lifecycle_stage,
            pricing_tier,
            credit_limit,
            payment_terms_days,
            notes,
            assigned_to
          ),
          location:locations (
            id,
            address_text,
            city,
            country,
            address_link
          )
        `)
        .eq('id', accountId).is('deleted_at', null)
        .maybeSingle();

      if (accountError) throw accountError;
      if (!accountData) return null;

      // Fetch contacts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('account_id', accountId)
        .order('is_primary', { ascending: false });

      // Fetch projects
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, status')
        .eq('customer_account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        ...accountData,
        contacts: contacts || [],
        projects: projects || [],
      };
    },
    enabled: !!accountId && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !customer ? (
          <div className="pt-6 text-center text-muted-foreground">
            Customer not found
          </div>
        ) : (
          <>
            <SheetHeader className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <SheetTitle className="text-xl flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {customer.display_name || customer.legal_name || 'Unnamed'}
                  </SheetTitle>
                  {customer.legal_name && customer.legal_name !== customer.display_name && (
                    <p className="text-sm text-muted-foreground">{customer.legal_name}</p>
                  )}
                </div>
                <Button variant="outline" size="sm" disabled>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant="secondary"
                  className={cn(lifecycleStageColors[customer.customer?.lifecycle_stage] || '')}
                >
                  {customer.customer?.lifecycle_stage || 'lead'}
                </Badge>
                <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                  {customer.status}
                </Badge>
              </div>
            </SheetHeader>

            <Tabs defaultValue="details" className="mt-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="contacts">
                  Contacts ({customer.contacts.length})
                </TabsTrigger>
                <TabsTrigger value="projects">
                  Projects ({customer.projects.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6 mt-4">
                {/* Account Info */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Account Information</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {customer.tax_number && (
                      <div>
                        <p className="text-muted-foreground text-xs">Tax Number</p>
                        <p>{customer.tax_number}</p>
                      </div>
                    )}
                    {customer.website && (
                      <div>
                        <p className="text-muted-foreground text-xs">Website</p>
                        <a 
                          href={customer.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Globe className="h-3 w-3" />
                          Visit
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location */}
                {customer.location && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Location
                      </h4>
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                        {customer.location.address_text && (
                          <p>{customer.location.address_text}</p>
                        )}
                        <p className="text-muted-foreground">
                          {[customer.location.city, customer.location.country]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                        {customer.location.address_link && (
                          <a
                            href={customer.location.address_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs"
                          >
                            View on map →
                          </a>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Customer Settings */}
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Billing & Terms
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {customer.customer?.pricing_tier && (
                      <div>
                        <p className="text-muted-foreground text-xs">Pricing Tier</p>
                        <p className="capitalize">{customer.customer.pricing_tier}</p>
                      </div>
                    )}
                    {customer.customer?.payment_terms_days && (
                      <div>
                        <p className="text-muted-foreground text-xs">Payment Terms</p>
                        <p>{customer.customer.payment_terms_days} days</p>
                      </div>
                    )}
                    {customer.customer?.credit_limit && (
                      <div>
                        <p className="text-muted-foreground text-xs">Credit Limit</p>
                        <p>SAR {Number(customer.customer.credit_limit).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {(customer.notes || customer.customer?.notes) && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Notes
                      </h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {customer.notes || customer.customer?.notes}
                      </p>
                    </div>
                  </>
                )}

                {/* Timestamps */}
                <Separator />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created: {format(new Date(customer.created_at), 'MMM d, yyyy')}
                  </p>
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Updated: {format(new Date(customer.updated_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="contacts" className="space-y-4 mt-4">
                {customer.contacts.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No contacts added yet
                  </p>
                ) : (
                  customer.contacts.map((contact: any) => (
                    <div
                      key={contact.id}
                      className="bg-muted/50 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{contact.full_name}</p>
                        {contact.is_primary && (
                          <Badge variant="secondary" className="text-xs">Primary</Badge>
                        )}
                      </div>
                      {contact.role_title && (
                        <p className="text-sm text-muted-foreground">{contact.role_title}</p>
                      )}
                      <div className="flex flex-wrap gap-3 text-sm">
                        {contact.phone && (
                          <a 
                            href={`tel:${contact.phone}`}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </a>
                        )}
                        {contact.email && (
                          <a 
                            href={`mailto:${contact.email}`}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="projects" className="space-y-4 mt-4">
                {customer.projects.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No projects yet
                  </p>
                ) : (
                  customer.projects.map((project: any) => (
                    <div
                      key={project.id}
                      className="bg-muted/50 rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{project.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {project.status}
                      </Badge>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

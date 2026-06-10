import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Eye,
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';

interface Template {
  id: string;
  waba_id: string;
  template_id: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  components: object[];
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface WabaAccount {
  id: string;
  waba_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
  APPROVED: { label: 'Approved', variant: 'default', icon: CheckCircle },
  PENDING: { label: 'Pending', variant: 'secondary', icon: Clock },
  REJECTED: { label: 'Rejected', variant: 'destructive', icon: XCircle },
};

const categoryLabels: Record<string, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utility',
  AUTHENTICATION: 'Authentication',
};

export default function WhatsAppTemplates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; template: Template | null }>({
    open: false,
    template: null,
  });

  // Fetch WABA accounts
  const { data: wabaAccounts } = useQuery({
    queryKey: ['waba-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waba_accounts_safe' as any)
        .select('*')
        .eq('status', 'active');
      if (error) throw error;
      return data as unknown as WabaAccount[];
    },
  });

  const activeWaba = wabaAccounts?.[0];

  // Fetch templates
  const { data: templates, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['message-templates', activeWaba?.waba_id],
    queryFn: async () => {
      if (!activeWaba?.waba_id) return [];
      
      const { data, error } = await supabase.functions.invoke('manage-templates', {
        method: 'GET',
        body: undefined,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Fallback to direct DB query
      const { data: dbTemplates, error: dbError } = await supabase
        .from('message_templates')
        .select('*')
        .eq('waba_id', activeWaba.waba_id)
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      return dbTemplates as Template[];
    },
    enabled: !!activeWaba?.waba_id,
  });

  // Sync templates from Meta
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!activeWaba?.waba_id) throw new Error('No active WABA');
      
      const { data, error } = await supabase.functions.invoke('manage-templates', {
        method: 'GET',
      });

      // The function syncs when called with ?sync=true but we'll refetch anyway
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Templates synced from Meta');
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: async (template: Template) => {
      const { data, error } = await supabase.functions.invoke('manage-templates', {
        method: 'DELETE',
      });
      
      // Also delete from local DB
      await supabase
        .from('message_templates')
        .delete()
        .eq('id', template.id);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Template deleted');
      setDeleteDialog({ open: false, template: null });
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  // Filter templates
  const filteredTemplates = templates?.filter((t) => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.language.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];

  if (!activeWaba) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No WhatsApp Account Connected</h3>
            <p className="text-muted-foreground mb-4">
              Connect a WhatsApp Business account to manage message templates.
            </p>
            <Button onClick={() => navigate('/whatsapp/onboard')}>
              Connect WhatsApp
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Message Templates</h1>
          <p className="text-muted-foreground">
            Create and manage WhatsApp message templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || isRefetching}
          >
            {(syncMutation.isPending || isRefetching) ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync from Meta
          </Button>
          <Button onClick={() => navigate('/whatsapp/templates/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={categoryFilter === null ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCategoryFilter(null)}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setCategoryFilter(cat)}
                >
                  {categoryLabels[cat]}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 flex-1" />
                </div>
              ))}
            </div>
          ) : filteredTemplates?.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No templates found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || categoryFilter
                  ? 'Try adjusting your filters'
                  : 'Create your first message template'}
              </p>
              {!searchQuery && !categoryFilter && (
                <Button onClick={() => navigate('/whatsapp/templates/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates?.map((template) => {
                  const statusInfo = statusConfig[template.status] || statusConfig.PENDING;
                  const StatusIcon = statusInfo.icon;

                  return (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div className="font-medium">{template.name}</div>
                        {template.rejection_reason && (
                          <p className="text-xs text-destructive mt-1">
                            {template.rejection_reason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categoryLabels[template.category] || template.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="uppercase">{template.language}</TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant} className="gap-1">
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(template.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/whatsapp/templates/${template.id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteDialog({ open: true, template })}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, template: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the template "{deleteDialog.template?.name}"? 
              This action cannot be undone and will also remove it from Meta's servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog.template && deleteMutation.mutate(deleteDialog.template)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

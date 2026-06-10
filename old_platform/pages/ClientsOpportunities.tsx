import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
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
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  FolderPlus,
  Target,
  CalendarPlus,
  Building2,
  Phone,
  MapPin,
  Users,
  TrendingUp,
  Clock,
  RefreshCw,
  Star,
  Filter,
  X,
  Trash2,
  Pencil,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useClients, ClientData } from '@/hooks/useClients';
import ProjectDialog from '@/components/ProjectDialog';
import OpportunityDialog from '@/components/OpportunityDialog';
import FollowUpDialog from '@/components/FollowUpDialog';
import ClientDialog from '@/components/ClientDialog';
import { OverallInterestBadge } from '@/components/OverallInterestBadge';
import { cn } from '@/lib/utils';


const ClientsOpportunities = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clients, segments, loading, refresh, createClient, deleteClients } = useClients();
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [interestFilter, setInterestFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  
  // Dialogs
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [opportunityDialogOpen, setOpportunityDialogOpen] = useState(false);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  
  const hasActiveFilters = searchQuery !== '' || segmentFilter !== 'all' || interestFilter !== 'all' || cityFilter !== 'all' || ownerFilter !== 'all';
  
  const clearAllFilters = () => {
    setSearchQuery('');
    setSegmentFilter('all');
    setInterestFilter('all');
    setCityFilter('all');
    setOwnerFilter('all');
  };
  
  // Get unique cities for filter
  const uniqueCities = useMemo(() => {
    const cities = clients.map(c => c.city).filter(Boolean) as string[];
    return [...new Set(cities)].sort();
  }, [clients]);
  
  // Get unique owners for filter
  const uniqueOwners = useMemo(() => {
    const owners = clients.map(c => c.assigned_to).filter(Boolean) as string[];
    return [...new Set(owners)].sort();
  }, [clients]);
  
  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          client.company_name?.toLowerCase().includes(query) ||
          client.primary_contact_name?.toLowerCase().includes(query) ||
          client.primary_contact_phone?.includes(query) ||
          client.city?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Segment filter
      if (segmentFilter !== 'all' && client.segment_name !== segmentFilter) {
        return false;
      }
      
      // Interest filter
      if (interestFilter !== 'all' && client.interest_level !== interestFilter) {
        return false;
      }
      
      // City filter
      if (cityFilter !== 'all' && client.city !== cityFilter) {
        return false;
      }
      
      // Owner filter
      if (ownerFilter !== 'all' && client.assigned_to !== ownerFilter) {
        return false;
      }
      
      return true;
    });
  }, [clients, searchQuery, segmentFilter, interestFilter, cityFilter, ownerFilter]);
  
  
  const getSegmentBadge = (name: string | null, color: string | null) => {
    if (!name) return null;
    return (
      <Badge 
        variant="outline" 
        style={{ 
          backgroundColor: color ? `${color}20` : undefined,
          borderColor: color ? `${color}50` : undefined,
          color: color || undefined,
        }}
      >
        {name}
      </Badge>
    );
  };
  
  const handleViewProfile = (client: ClientData) => {
    navigate(`/client-profile/${encodeURIComponent(client.company_name)}`);
  };
  
  const handleAddProject = (client: ClientData) => {
    setSelectedClient(client);
    setProjectDialogOpen(true);
  };
  
  const handleAddOpportunity = (client: ClientData) => {
    setSelectedClient(client);
    setOpportunityDialogOpen(true);
  };
  
  const handleAddFollowUp = (client: ClientData) => {
    setSelectedClient(client);
    setFollowUpDialogOpen(true);
  };
  
  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredClients.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };
  
  const handleSelectClient = (clientId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(clientId);
    } else {
      newSelected.delete(clientId);
    }
    setSelectedIds(newSelected);
  };
  
  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteClients(Array.from(selectedIds), clients);
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      toast.success(`Successfully deleted ${result.deletedCount} client(s) and all related data.`);
    } catch (error) {
      console.error('Error deleting clients:', error);
      toast.error('Failed to delete clients');
    } finally {
      setIsDeleting(false);
    }
  };
  
  const isAllSelected = filteredClients.length > 0 && selectedIds.size === filteredClients.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredClients.length;
  
  // Summary stats - count all clients equally (no legacy distinction)
  const stats = useMemo(() => {
    const pipelineClients = clients.filter(c => c.is_in_pipeline).length;
    const coldLeadClients = clients.filter(c => c.is_cold_lead).length;
    
    return {
      totalClients: clients.length,
      pipelineClients,
      coldLeadClients,
      activeOpportunities: clients.reduce((sum, c) => sum + c.active_opportunities, 0),
      openFollowUps: clients.reduce((sum, c) => sum + c.open_follow_ups, 0),
    };
  }, [clients]);

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('nav.clientsOpportunities', 'Clients & Opportunities')}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your clients, projects, and opportunities
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refresh()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => setClientDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalClients}</p>
                  <p className="text-xs text-muted-foreground">Total Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pipelineClients}</p>
                  <p className="text-xs text-muted-foreground">In Pipeline</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Target className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeOpportunities}</p>
                  <p className="text-xs text-muted-foreground">Active Opportunities</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.openFollowUps}</p>
                  <p className="text-xs text-muted-foreground">Open Follow-ups</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Segment Filter */}
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Segments</SelectItem>
                  {segments.map((seg) => (
                    <SelectItem key={seg.id} value={seg.name}>
                      {seg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Interest Filter */}
              <Select value={interestFilter} onValueChange={setInterestFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Interest" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Interest</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Not interested">Not interested</SelectItem>
                </SelectContent>
              </Select>
              
              {/* City Filter */}
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="City" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {uniqueCities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Owner Filter */}
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {uniqueOwners.map((owner) => (
                    <SelectItem key={owner} value={owner}>
                      {owner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedIds.size} client{selectedIds.size > 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear Selection
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Selected
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Clients Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="p-12 text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Clients Found</h3>
                <p className="text-muted-foreground mb-4">
                  {hasActiveFilters 
                    ? 'No clients match your filters. Try adjusting your search.'
                    : 'Start by adding communications to build your client list.'}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearAllFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                          aria-label="Select all"
                          className={isSomeSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                        />
                      </TableHead>
                      <TableHead className="min-w-[200px]">Client Name</TableHead>
                      <TableHead className="min-w-[120px]">Segment</TableHead>
                      <TableHead className="min-w-[100px]">City</TableHead>
                      <TableHead className="min-w-[150px]">Primary Contact</TableHead>
                      <TableHead className="min-w-[120px]">Overall Interest</TableHead>
                      <TableHead className="text-center min-w-[80px]">Opportunities</TableHead>
                      <TableHead className="text-center min-w-[80px]">Follow-ups</TableHead>
                      <TableHead className="min-w-[150px]">Last Activity</TableHead>
                      <TableHead className="min-w-[100px]">Owner</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow key={client.id} className={cn("group", selectedIds.has(client.id) && "bg-primary/5")}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(client.id)}
                            onCheckedChange={(checked) => handleSelectClient(client.id, checked as boolean)}
                            aria-label={`Select ${client.company_name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleViewProfile(client)}
                            className="font-medium text-left hover:text-primary hover:underline"
                          >
                            {client.company_name}
                          </button>
                          {client.total_communications > 1 && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              <RefreshCw className="h-3 w-3 mr-1" />
                              {client.total_communications}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {getSegmentBadge(client.segment_name, client.segment_color)}
                        </TableCell>
                        <TableCell>
                          {client.city && (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {client.city}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {client.primary_contact_name && (
                              <p className="text-sm">{client.primary_contact_name}</p>
                            )}
                            {client.primary_contact_phone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {client.primary_contact_phone}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <OverallInterestBadge level={client.overall_interest_level} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={client.active_opportunities > 0 ? 'default' : 'secondary'}>
                            {client.active_opportunities}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={client.open_follow_ups > 0 ? 'outline' : 'secondary'} className={cn(
                            client.open_follow_ups > 0 && 'border-amber-500/50 text-amber-600'
                          )}>
                            {client.open_follow_ups}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {client.last_activity_date ? (
                            <div className="space-y-0.5">
                              <p className="text-sm">
                                {formatDistanceToNow(new Date(client.last_activity_date), { addSuffix: true })}
                              </p>
                              {client.last_activity_type && (
                                <p className="text-xs text-muted-foreground">
                                  {client.last_activity_type}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{client.assigned_to || '-'}</span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewProfile(client)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAddProject(client)}>
                                <FolderPlus className="h-4 w-4 mr-2" />
                                Add Projectxxxxxxxxxxxxxxxxxxxx
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAddOpportunity(client)}>
                                <Target className="h-4 w-4 mr-2" />
                                Add Opportunity
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAddFollowUp(client)}>
                                <CalendarPlus className="h-4 w-4 mr-2" />
                                Add Follow-up
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Client Dialog */}
      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        segments={segments}
        onCreate={async (data) => {
          const result = await createClient({
            company_name: data.company_name,
            segment_id: data.segment_id,
            primary_contact_name: data.primary_contact_name,
            primary_contact_phone: data.primary_contact_phone,
            city: data.city,
            district: data.district,
            assigned_to: data.assigned_to,
            notes: data.notes,
          });
          return result;
        }}
        onSuccess={() => {
          refresh();
        }}
      />
      
      {/* Other Dialogs */}
      {selectedClient && (
        <>
          <ProjectDialog
            open={projectDialogOpen}
            onOpenChange={setProjectDialogOpen}
            clientId={selectedClient.id}
            clientName={selectedClient.company_name}
            onSuccess={() => {
              refresh();
              setSelectedClient(null);
            }}
            onCreate={async (data) => {
              // Need to first ensure client exists in clients table
              // For legacy data, we create the client first
              const { supabase } = await import('@/lib/supabase');
              
              // Check if client exists
              let clientId = selectedClient.id;
              const { data: existingClient } = await supabase
                .from('clients')
                .select('id')
                .eq('company_name', selectedClient.company_name)
                .maybeSingle();
              
              if (!existingClient) {
                // Create client first
                const { data: newClient, error: clientError } = await supabase
                  .from('clients')
                  .insert({
                    company_name: selectedClient.company_name,
                    primary_contact_name: selectedClient.primary_contact_name,
                    primary_contact_phone: selectedClient.primary_contact_phone,
                    city: selectedClient.city,
                    interest_level: selectedClient.interest_level,
                    assigned_to: selectedClient.assigned_to,
                  })
                  .select()
                  .single();
                
                if (clientError) throw clientError;
                clientId = newClient.id;
              } else {
                clientId = existingClient.id;
              }
              
              // Now create project
              const { data: project, error } = await supabase
                .from('projects')
                .insert({
                  client_id: clientId,
                  ...data,
                })
                .select()
                .single();
              
              if (error) throw error;
              return project;
            }}
          />
          
          <OpportunityDialog
            open={opportunityDialogOpen}
            onOpenChange={setOpportunityDialogOpen}
            clientId={selectedClient.id}
            clientName={selectedClient.company_name}
            onSuccess={() => {
              refresh();
              setSelectedClient(null);
            }}
            onCreate={async (data) => {
              const { supabase } = await import('@/lib/supabase');
              
              // Check if client exists
              let clientId = selectedClient.id;
              const { data: existingClient } = await supabase
                .from('clients')
                .select('id')
                .eq('company_name', selectedClient.company_name)
                .maybeSingle();
              
              if (!existingClient) {
                // Create client first
                const { data: newClient, error: clientError } = await supabase
                  .from('clients')
                  .insert({
                    company_name: selectedClient.company_name,
                    primary_contact_name: selectedClient.primary_contact_name,
                    primary_contact_phone: selectedClient.primary_contact_phone,
                    city: selectedClient.city,
                    interest_level: selectedClient.interest_level,
                    assigned_to: selectedClient.assigned_to,
                  })
                  .select()
                  .single();
                
                if (clientError) throw clientError;
                clientId = newClient.id;
              } else {
                clientId = existingClient.id;
              }
              
              // Create opportunity
              const { data: opp, error } = await supabase
                .from('opportunities')
                .insert({
                  client_id: clientId,
                  ...data,
                })
                .select()
                .single();
              
              if (error) throw error;
              return opp;
            }}
          />
        </>
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Client{selectedIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected client{selectedIds.size > 1 ? 's' : ''} and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default ClientsOpportunities;

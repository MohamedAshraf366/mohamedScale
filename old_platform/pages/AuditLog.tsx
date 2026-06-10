import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AuditChangeDetailsDialog } from '@/components/AuditChangeDetailsDialog';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Search, RefreshCw, History, User, Clock, FileText, Layers, ChevronRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface AuditLogEntry {
  id: string;
  created_at: string;
  action: string;
  module: string;
  record_id: string;
  record_name: string | null;
  user_id: string;
  old_values: any;
  new_values: any;
  changes: Record<string, { old: any; new: any }> | null;
  description: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

const MODULES = [
  'Communications',
  'Pipeline',
  'Materials',
  'Suppliers',
  'Follow-ups',
  'Tasks',
  'Categories',
  'Scale KPIs',
  'Users',
  'Settings',
  'System',
];

const ACTIONS = [
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'status_changed', label: 'Status Changed' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'role_changed', label: 'Role Changed' },
  { value: 'auto_created', label: 'Auto Created' },
];

const AuditLog = () => {
  const [loading, setLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [changedByFilter, setChangedByFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  // For details dialog
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  // Unique users for filter
  const [uniqueUsers, setUniqueUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, actionFilter, moduleFilter, changedByFilter, startDate, endDate, auditLogs]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      // Fetch user profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(d => d.user_id))];

        const { data: profilesResult } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        const profilesMap = new Map(profilesResult?.map(p => [p.id, p]) || []);

        const enrichedData = data.map(log => ({
          ...log,
          changes: log.changes as Record<string, { old: any; new: any }> | null,
          profiles: profilesMap.get(log.user_id) || null,
        })) as AuditLogEntry[];

        setAuditLogs(enrichedData);
        
        // Extract unique users for filter
        const users = profilesResult?.map(p => ({
          id: p.id,
          name: p.full_name || 'Unknown',
          email: p.email || '',
        })) || [];
        setUniqueUsers(users);
      } else {
        setAuditLogs([]);
        setUniqueUsers([]);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...auditLogs];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.record_name?.toLowerCase().includes(search) ||
        log.record_id?.toLowerCase().includes(search) ||
        log.module?.toLowerCase().includes(search) ||
        log.description?.toLowerCase().includes(search) ||
        log.profiles?.full_name?.toLowerCase().includes(search) ||
        log.profiles?.email?.toLowerCase().includes(search) ||
        log.action.toLowerCase().includes(search)
      );
    }

    // Action filter
    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === actionFilter);
    }

    // Module filter
    if (moduleFilter !== 'all') {
      filtered = filtered.filter(log => log.module === moduleFilter);
    }

    // Changed by filter
    if (changedByFilter !== 'all') {
      filtered = filtered.filter(log => log.user_id === changedByFilter);
    }

    // Date range filter
    if (startDate) {
      filtered = filtered.filter(log => 
        new Date(log.created_at) >= startDate
      );
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => 
        new Date(log.created_at) <= endOfDay
      );
    }

    setFilteredLogs(filtered);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setActionFilter('all');
    setModuleFilter('all');
    setChangedByFilter('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const getActionBadgeColor = (action: string): string => {
    switch (action.toLowerCase()) {
      case 'created':
        return 'bg-green-500/15 text-green-600 border-green-500/30';
      case 'auto_created':
        return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
      case 'updated':
        return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
      case 'deleted':
        return 'bg-red-500/15 text-red-600 border-red-500/30';
      case 'status_changed':
        return 'bg-purple-500/15 text-purple-600 border-purple-500/30';
      case 'assigned':
        return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
      case 'role_changed':
        return 'bg-orange-500/15 text-orange-600 border-orange-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getModuleBadgeColor = (module: string) => {
    const colors: Record<string, string> = {
      'Communications': 'bg-blue-500/15 text-blue-600 border-blue-500/30',
      'Pipeline': 'bg-purple-500/15 text-purple-600 border-purple-500/30',
      'Materials': 'bg-amber-500/15 text-amber-600 border-amber-500/30',
      'Suppliers': 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
      'Follow-ups': 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30',
      'Tasks': 'bg-teal-500/15 text-teal-600 border-teal-500/30',
      'Categories': 'bg-pink-500/15 text-pink-600 border-pink-500/30',
      'Scale KPIs': 'bg-orange-500/15 text-orange-600 border-orange-500/30',
      'Users': 'bg-red-500/15 text-red-600 border-red-500/30',
      'Settings': 'bg-slate-500/15 text-slate-600 border-slate-500/30',
      'System': 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30',
    };
    return colors[module] || 'bg-muted text-muted-foreground';
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    const str = String(value);
    return str.length > 30 ? str.slice(0, 30) + '...' : str;
  };

  const renderChangeSummary = (log: AuditLogEntry) => {
    if (log.action === 'created' || log.action === 'auto_created') {
      return (
        <div className="text-sm text-muted-foreground">
          New record created
        </div>
      );
    }

    if (log.action === 'deleted') {
      return (
        <div className="text-sm text-destructive">
          Record deleted
        </div>
      );
    }

    if (log.changes) {
      const changeEntries = Object.entries(log.changes as Record<string, { old: any; new: any }>);
      const displayCount = 2;
      const visibleChanges = changeEntries.slice(0, displayCount);
      const hasMore = changeEntries.length > displayCount;

      return (
        <div className="text-sm space-y-1">
          {visibleChanges.map(([field, change]) => (
            <div key={field} className="flex flex-wrap gap-1 items-center">
              <span className="font-medium capitalize text-muted-foreground">
                {field.replace(/_/g, ' ')}:
              </span>
              <span className="text-destructive/70">{formatValue(change?.old)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-primary">{formatValue(change?.new)}</span>
            </div>
          ))}
          {hasMore && (
            <div className="text-xs text-muted-foreground/70 italic">
              +{changeEntries.length - displayCount} more changes
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="text-sm text-muted-foreground">
        {log.description || 'No details'}
      </div>
    );
  };

  const openDetails = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setDetailsDialogOpen(true);
  };

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <History className="h-8 w-8" />
              Audit Log
            </h1>
            <p className="text-muted-foreground mt-1">
              Complete history of all changes and activities across the platform
            </p>
          </div>
          <Button onClick={fetchAuditLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter and search audit log entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Record, user, ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="action-filter">Action</Label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger id="action-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {ACTIONS.map(action => (
                      <SelectItem key={action.value} value={action.value}>
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="module-filter">Module</Label>
                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                  <SelectTrigger id="module-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    {MODULES.map(mod => (
                      <SelectItem key={mod} value={mod}>{mod}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="changed-by-filter">Changed By</Label>
                <Select value={changedByFilter} onValueChange={setChangedByFilter}>
                  <SelectTrigger id="changed-by-filter">
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {uniqueUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} {user.email && `(${user.email})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'MMM dd, yyyy') : 'Select'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'MMM dd, yyyy') : 'Select'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {filteredLogs.length} of {auditLogs.length} entries
              </div>
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Timestamp
                    </div>
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Action
                    </div>
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Module
                    </div>
                  </TableHead>
                  <TableHead className="w-[180px]">Record</TableHead>
                  <TableHead className="w-[160px]">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Changed By
                    </div>
                  </TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading audit logs...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No audit log entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow 
                      key={log.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetails(log)}
                    >
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <div className="font-medium">
                            {format(new Date(log.created_at), 'MMM dd, yyyy')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), 'HH:mm:ss')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionBadgeColor(log.action)} variant="outline">
                          {log.action.toUpperCase().replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getModuleBadgeColor(log.module)} variant="outline">
                          {log.module}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium truncate max-w-[160px]" title={log.record_name || 'Unknown'}>
                          {log.record_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[160px]" title={log.record_id}>
                          {log.record_id?.slice(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="font-medium truncate max-w-[140px]">
                            {log.profiles?.full_name || 'Unknown'}
                          </div>
                          {log.profiles?.email && (
                            <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                              {log.profiles.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        {renderChangeSummary(log)}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetails(log);
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      </div>

      <AuditChangeDetailsDialog 
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        log={selectedLog}
      />
    </Layout>
  );
};

export default AuditLog;

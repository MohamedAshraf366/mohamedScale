import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, CalendarIcon, AlertTriangle, ShieldAlert, Clock, ArrowUpDown, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface StrategicBlocker {
  id: string;
  title: string;
  description: string | null;
  area: string;
  priority: 'High' | 'Medium' | 'Low';
  mitigation_owner: string | null;
  target_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

type SortField = 'priority' | 'target_date' | 'area' | 'title';
type SortDirection = 'asc' | 'desc';

const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };

const AREA_OPTIONS = ['Sales', 'Supply', 'Operations', 'Financial', 'Custom'];

// Pillar color mapping
const getAreaBadge = (area: string) => {
  switch (area) {
    case 'Sales':
      return 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400';
    case 'Supply':
      return 'bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400';
    case 'Operations':
      return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400';
    case 'Financial':
      return 'bg-purple-500/15 text-purple-600 border-purple-500/30 dark:text-purple-400';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'High':
      return 'bg-destructive/15 text-destructive border-destructive/30';
    case 'Medium':
      return 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400';
    case 'Low':
      return 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const AdminIssuesRisks = () => {
  const { t } = useTranslation();
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';

  const [blockers, setBlockers] = useState<StrategicBlocker[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBlocker, setEditingBlocker] = useState<StrategicBlocker | null>(null);
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');

  // Users for mitigation owner dropdown
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    area: 'Sales',
    priority: 'Medium' as 'High' | 'Medium' | 'Low',
    mitigation_owner: '',
    target_date: null as Date | null,
  });

  useEffect(() => {
    fetchBlockers();
    fetchUsers();
  }, []);

  const fetchBlockers = async () => {
    try {
      const { data, error } = await supabase
        .from('strategic_blockers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBlockers(data as StrategicBlocker[] || []);
    } catch (error) {
      console.error('Error fetching blockers:', error);
      toast.error('Failed to load strategic blockers');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedBlockers = [...blockers].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'priority':
        comparison = priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
        break;
      case 'target_date':
        if (!a.target_date && !b.target_date) comparison = 0;
        else if (!a.target_date) comparison = 1;
        else if (!b.target_date) comparison = -1;
        else comparison = new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
        break;
      case 'area':
        comparison = a.area.localeCompare(b.area);
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const filteredBlockers = sortedBlockers.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (b.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesArea = areaFilter === 'all' || b.area === areaFilter;
    return matchesSearch && matchesArea;
  });

  // Split into open and closed
  const openBlockers = filteredBlockers.filter(b => b.status === 'open');
  const closedBlockers = filteredBlockers.filter(b => b.status !== 'open');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        area: formData.area,
        priority: formData.priority,
        mitigation_owner: formData.mitigation_owner || null,
        target_date: formData.target_date ? format(formData.target_date, 'yyyy-MM-dd') : null,
      };

      if (editingBlocker) {
        const { error } = await supabase
          .from('strategic_blockers')
          .update(payload)
          .eq('id', editingBlocker.id);

        if (error) throw error;
        toast.success('Blocker updated successfully');
      } else {
        const { error } = await supabase
          .from('strategic_blockers')
          .insert(payload);

        if (error) throw error;
        toast.success('Blocker added successfully');
      }

      setDialogOpen(false);
      resetForm();
      fetchBlockers();
    } catch (error) {
      console.error('Error saving blocker:', error);
      toast.error('Failed to save blocker');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blocker?')) return;

    try {
      const { error } = await supabase
        .from('strategic_blockers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Blocker deleted successfully');
      fetchBlockers();
    } catch (error) {
      console.error('Error deleting blocker:', error);
      toast.error('Failed to delete blocker');
    }
  };

  const handleEdit = (blocker: StrategicBlocker) => {
    setEditingBlocker(blocker);
    setFormData({
      title: blocker.title,
      description: blocker.description || '',
      area: blocker.area,
      priority: blocker.priority,
      mitigation_owner: blocker.mitigation_owner || '',
      target_date: blocker.target_date ? new Date(blocker.target_date) : null,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingBlocker(null);
    setFormData({
      title: '',
      description: '',
      area: 'Sales',
      priority: 'Medium',
      mitigation_owner: '',
      target_date: null,
    });
  };

  // Stats
  const stats = {
    critical: blockers.filter(b => b.priority === 'High').length,
    total: blockers.length,
    pending: blockers.filter(b => b.status === 'open').length,
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link to="/admin/issues-risks" className="hover:text-primary transition-colors">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {t('admin.issuesRisks', 'Issues & Risks')}
              </h1>
            </Link>
            <p className="text-muted-foreground mt-1">
              Track strategic blockers and mitigation plans
            </p>
          </div>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Issue
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingBlocker ? 'Edit Issue' : 'Add New Issue'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Strategic blocker title"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe the issue or risk"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Area *</Label>
                      <Select
                        value={formData.area}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, area: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AREA_OPTIONS.map(area => (
                            <SelectItem key={area} value={area}>{area}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Priority *</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v as 'High' | 'Medium' | 'Low' }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-destructive" />
                              High
                            </span>
                          </SelectItem>
                          <SelectItem value="Medium">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              Medium
                            </span>
                          </SelectItem>
                          <SelectItem value="Low">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              Low
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Mitigation Owner</Label>
                    <Select
                      value={formData.mitigation_owner}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, mitigation_owner: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                      <SelectContent>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.full_name || user.id}>
                            {user.full_name || 'Unknown User'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Target Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.target_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.target_date ? format(formData.target_date, 'PPP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.target_date || undefined}
                          onSelect={(d) => setFormData(prev => ({ ...prev, target_date: d || null }))}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1">
                      {editingBlocker ? 'Update' : 'Add'} Issue
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border border-destructive/20 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">High Priority</p>
                  <p className="text-3xl font-bold text-destructive">{stats.critical}</p>
                </div>
                <ShieldAlert className="h-8 w-8 text-destructive/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-amber-500/20 bg-amber-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Open Items</p>
                  <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Blockers</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Search blockers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Areas</SelectItem>
              {AREA_OPTIONS.map(area => (
                <SelectItem key={area} value={area}>{area}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Open Issues & Risks */}
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Open Issues & Risks
              <Badge variant="secondary" className="ml-2">{openBlockers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : openBlockers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No open issues found
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead
                        className="font-semibold cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('title')}
                      >
                        <div className="flex items-center gap-1">Title <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead
                        className="font-semibold cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('area')}
                      >
                        <div className="flex items-center gap-1">Area <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead
                        className="font-semibold cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('priority')}
                      >
                        <div className="flex items-center gap-1">Priority <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead className="font-semibold">Mitigation Owner</TableHead>
                      <TableHead
                        className="font-semibold cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('target_date')}
                      >
                        <div className="flex items-center gap-1">Target Date <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      {isAdmin && <TableHead className="w-24"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openBlockers.map(blocker => {
                      const isCritical = blocker.priority === 'High';
                      return (
                        <TableRow
                          key={blocker.id}
                          className={cn(
                            "hover:bg-muted/20",
                            isCritical && "bg-destructive/5 animate-pulse"
                          )}
                        >
                          <TableCell>
                            <div className="max-w-[300px]">
                              <button 
                                onClick={() => handleEdit(blocker)}
                                className="font-medium text-left hover:text-primary hover:underline transition-colors"
                              >
                                {blocker.title}
                              </button>
                              {blocker.description && (
                                <div className="text-xs text-muted-foreground truncate">{blocker.description}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("border", getAreaBadge(blocker.area))}>
                              {blocker.area}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("border", getPriorityBadge(blocker.priority))}>
                              {blocker.priority}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {blocker.mitigation_owner || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {blocker.target_date ? format(new Date(blocker.target_date), 'MMM d, yyyy') : '-'}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(blocker)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(blocker.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Closed Issues & Risks */}
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Closed Issues & Risks
              <Badge variant="secondary" className="ml-2">{closedBlockers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : closedBlockers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No closed issues yet
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold">Title</TableHead>
                      <TableHead className="font-semibold">Area</TableHead>
                      <TableHead className="font-semibold">Priority</TableHead>
                      <TableHead className="font-semibold">Mitigation Owner</TableHead>
                      <TableHead className="font-semibold">Target Date</TableHead>
                      {isAdmin && <TableHead className="w-24"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closedBlockers.map(blocker => (
                      <TableRow key={blocker.id} className="hover:bg-muted/20 opacity-75">
                        <TableCell>
                          <div className="max-w-[300px]">
                            <button 
                              onClick={() => handleEdit(blocker)}
                              className="font-medium text-left hover:text-primary hover:underline transition-colors line-through"
                            >
                              {blocker.title}
                            </button>
                            {blocker.description && (
                              <div className="text-xs text-muted-foreground truncate">{blocker.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("border", getAreaBadge(blocker.area))}>
                            {blocker.area}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("border", getPriorityBadge(blocker.priority))}>
                            {blocker.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {blocker.mitigation_owner || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {blocker.target_date ? format(new Date(blocker.target_date), 'MMM d, yyyy') : '-'}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(blocker)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(blocker.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminIssuesRisks;
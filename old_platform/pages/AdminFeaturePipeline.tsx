import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, CalendarIcon, ArrowUpDown, Layers, Zap, Settings } from 'lucide-react';
import { format, parse } from 'date-fns';
import { cn } from '@/lib/utils';

interface Feature {
  id: string;
  bucket: 'Platform Features' | 'Automations & Integrations' | 'Process Improvements';
  title: string;
  description: string | null;
  priority: 'High' | 'Medium' | 'Low';
  expected_date: string | null;
  status: 'Not Started' | 'In Progress' | 'Completed';
  display_order: number;
  created_at: string;
  updated_at: string;
}

type SortField = 'priority' | 'expected_date' | 'status' | 'title';
type SortDirection = 'asc' | 'desc';

const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
const statusOrder = { 'In Progress': 1, 'Not Started': 2, 'Completed': 3 };

const AdminFeaturePipeline = () => {
  const { t } = useTranslation();
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    bucket: 'Platform Features' as Feature['bucket'],
    title: '',
    description: '',
    priority: 'Medium' as Feature['priority'],
    expected_date: null as Date | null,
    status: 'Not Started' as Feature['status'],
  });

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('feature_pipeline')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setFeatures(data as Feature[] || []);
    } catch (error) {
      console.error('Error fetching features:', error);
      toast.error('Failed to load features');
    } finally {
      setLoading(false);
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

  const sortedFeatures = [...features].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'priority':
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
      case 'status':
        comparison = statusOrder[a.status] - statusOrder[b.status];
        break;
      case 'expected_date':
        if (!a.expected_date && !b.expected_date) comparison = 0;
        else if (!a.expected_date) comparison = 1;
        else if (!b.expected_date) comparison = -1;
        else comparison = new Date(a.expected_date).getTime() - new Date(b.expected_date).getTime();
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const filteredFeatures = sortedFeatures.filter(f => 
    f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const featureData = {
        bucket: formData.bucket,
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        expected_date: formData.expected_date ? format(formData.expected_date, 'yyyy-MM-dd') : null,
        status: formData.status,
        display_order: editingFeature ? editingFeature.display_order : features.length,
      };

      if (editingFeature) {
        const { error } = await supabase
          .from('feature_pipeline')
          .update(featureData)
          .eq('id', editingFeature.id);

        if (error) throw error;
        toast.success('Feature updated successfully');
      } else {
        const { error } = await supabase
          .from('feature_pipeline')
          .insert(featureData);

        if (error) throw error;
        toast.success('Feature added successfully');
      }

      setDialogOpen(false);
      resetForm();
      fetchFeatures();
    } catch (error) {
      console.error('Error saving feature:', error);
      toast.error('Failed to save feature');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feature?')) return;

    try {
      const { error } = await supabase
        .from('feature_pipeline')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Feature deleted successfully');
      fetchFeatures();
    } catch (error) {
      console.error('Error deleting feature:', error);
      toast.error('Failed to delete feature');
    }
  };

  const handleEdit = (feature: Feature) => {
    setEditingFeature(feature);
    setFormData({
      bucket: feature.bucket,
      title: feature.title,
      description: feature.description || '',
      priority: feature.priority,
      expected_date: feature.expected_date ? parse(feature.expected_date, 'yyyy-MM-dd', new Date()) : null,
      status: feature.status,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingFeature(null);
    setFormData({
      bucket: 'Platform Features',
      title: '',
      description: '',
      priority: 'Medium',
      expected_date: null,
      status: 'Not Started',
    });
  };

  const getPriorityBadge = (priority: Feature['priority']) => {
    const variants = {
      'High': 'bg-destructive/10 text-destructive border-destructive/20',
      'Medium': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      'Low': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    };
    return <Badge variant="outline" className={variants[priority]}>{priority}</Badge>;
  };

  const getStatusBadge = (status: Feature['status']) => {
    const variants = {
      'Not Started': 'bg-muted text-muted-foreground',
      'In Progress': 'bg-primary/10 text-primary',
      'Completed': 'bg-emerald-500/10 text-emerald-500',
    };
    return <Badge variant="secondary" className={variants[status]}>{status}</Badge>;
  };

  const getBucketIcon = (bucket: Feature['bucket']) => {
    switch (bucket) {
      case 'Platform Features': return <Layers className="h-4 w-4" />;
      case 'Automations & Integrations': return <Zap className="h-4 w-4" />;
      case 'Process Improvements': return <Settings className="h-4 w-4" />;
    }
  };

  const groupedFeatures = {
    'Platform Features': filteredFeatures.filter(f => f.bucket === 'Platform Features'),
    'Automations & Integrations': filteredFeatures.filter(f => f.bucket === 'Automations & Integrations'),
    'Process Improvements': filteredFeatures.filter(f => f.bucket === 'Process Improvements'),
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {t('admin.featurePipeline', 'Feature Pipeline')}
            </h1>
            <p className="text-muted-foreground mt-1">
              Track development priorities and feature roadmap
            </p>
          </div>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Feature
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingFeature ? 'Edit Feature' : 'Add New Feature'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Bucket</Label>
                    <Select value={formData.bucket} onValueChange={(v) => setFormData(prev => ({ ...prev, bucket: v as Feature['bucket'] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Platform Features">Platform Features</SelectItem>
                        <SelectItem value="Automations & Integrations">Automations & Integrations</SelectItem>
                        <SelectItem value="Process Improvements">Process Improvements</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={formData.priority} onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v as Feature['priority'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as Feature['status'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Not Started">Not Started</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Expected Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.expected_date && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.expected_date ? format(formData.expected_date, 'PPP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.expected_date || undefined} onSelect={(d) => setFormData(prev => ({ ...prev, expected_date: d || null }))} /></PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="flex-1">Cancel</Button>
                    <Button type="submit" className="flex-1">{editingFeature ? 'Update' : 'Add'} Feature</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search */}
        <Input placeholder="Search features..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />

        {/* Feature Buckets */}
        {Object.entries(groupedFeatures).map(([bucket, bucketFeatures]) => (
          <Card key={bucket} className="border border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                {getBucketIcon(bucket as Feature['bucket'])}
                {bucket}
                <Badge variant="secondary" className="ml-2">{bucketFeatures.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bucketFeatures.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No features in this bucket</p>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold cursor-pointer hover:text-foreground" onClick={() => handleSort('title')}>
                          <div className="flex items-center gap-1">Title <ArrowUpDown className="h-3 w-3" /></div>
                        </TableHead>
                        <TableHead className="font-semibold cursor-pointer hover:text-foreground" onClick={() => handleSort('priority')}>
                          <div className="flex items-center gap-1">Priority <ArrowUpDown className="h-3 w-3" /></div>
                        </TableHead>
                        <TableHead className="font-semibold cursor-pointer hover:text-foreground" onClick={() => handleSort('status')}>
                          <div className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></div>
                        </TableHead>
                        <TableHead className="font-semibold cursor-pointer hover:text-foreground" onClick={() => handleSort('expected_date')}>
                          <div className="flex items-center gap-1">Expected Date <ArrowUpDown className="h-3 w-3" /></div>
                        </TableHead>
                        {isAdmin && <TableHead className="w-24"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bucketFeatures.map(feature => (
                        <TableRow key={feature.id} className="hover:bg-muted/20">
                          <TableCell>
                            <div className="font-medium">{feature.title}</div>
                            {feature.description && <div className="text-xs text-muted-foreground truncate max-w-[300px]">{feature.description}</div>}
                          </TableCell>
                          <TableCell>{getPriorityBadge(feature.priority)}</TableCell>
                          <TableCell>{getStatusBadge(feature.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {feature.expected_date ? format(parse(feature.expected_date, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy') : '-'}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(feature)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(feature.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
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
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminFeaturePipeline;

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PageGuidance } from '@/components/supply/PageGuidance';
import { ISSUES_GUIDANCE } from '@/components/supply/guidance-content';
import { AppLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, AlertTriangle, CheckCircle2, ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  useSupplierIssues, useCreateSupplierIssue, useUpdateSupplierIssue,
  type IssueStatus, type IssueSeverity, type IssueType,
} from '@/hooks/useSupplierIssues';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const SEVERITY_COLORS: Record<string, string> = {
  minor: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  major: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
  investigating: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  escalated: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
  resolved: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
  closed: 'bg-muted text-muted-foreground',
};

export default function IssuesPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | 'all'>('all');
  const { data: issues = [], isLoading } = useSupplierIssues({ status: statusFilter, severity: severityFilter });
  const createIssue = useCreateSupplierIssue();
  const updateIssue = useUpdateSupplierIssue();

  // Fetch suppliers for the create dialog dropdown
  const { data: supplierOptions = [] } = useQuery({
    queryKey: ['supplier-options-for-issues'],
    queryFn: async () => {
      const { data: visibleAccounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, display_name').is('deleted_at', null)

      if (accountsError) throw accountsError;

      const accountIds = (visibleAccounts || []).map((account) => account.id);
      if (accountIds.length === 0) return [];

      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('account_id')
        .in('account_id', accountIds);

      if (suppliersError) throw suppliersError;

      const accMap = new Map((visibleAccounts || []).map(a => [a.id, a.display_name]));
      return (suppliers || []).map((s: any) => ({
        id: s.account_id as string,
        name: accMap.get(s.account_id) || s.account_id.slice(0, 8),
      })).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

   const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);
   const [createOpen, setCreateOpen] = useState(false);
  const [newIssue, setNewIssue] = useState({
    supplier_account_id: '',
    issue_type: 'delay' as IssueType,
    severity: 'minor' as IssueSeverity,
    description: '',
  });

  const [resolveDialog, setResolveDialog] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  const handleCreate = async () => {
    if (!newIssue.supplier_account_id) return;
    await createIssue.mutateAsync({
      ...newIssue,
      reported_by: user?.id,
    });
    setCreateOpen(false);
    setNewIssue({ supplier_account_id: '', issue_type: 'delay', severity: 'minor', description: '' });
  };

  const handleResolve = async () => {
    if (!resolveDialog) return;
    await updateIssue.mutateAsync({
      id: resolveDialog,
      status: 'resolved',
      resolution_notes: resolveNotes || null,
      resolved_at: new Date().toISOString(),
    });
    setResolveDialog(null);
    setResolveNotes('');
  };

  const handleEscalate = async (id: string) => {
    await updateIssue.mutateAsync({ id, status: 'escalated' });
  };

  return (
    <ProtectedRoute>
      <AppLayout title="Supplier Issues">
        <div className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Supplier Issues</h1>
              <p className="text-sm text-muted-foreground">Track and resolve supplier performance issues</p>
            </div>
            <Button className="gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Report Issue
            </Button>
          </div>

          <PageGuidance {...ISSUES_GUIDANCE} />

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="minor">Minor</SelectItem>
                <SelectItem value="major">Major</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : issues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No issues found
                    </TableCell>
                  </TableRow>
                ) : (
                  issues.map(issue => (
                    <TableRow key={issue.id}>
                      <TableCell className="font-medium">{issue.supplier_name || issue.supplier_account_id.slice(0, 8)}</TableCell>
                      <TableCell className="capitalize text-sm">{issue.issue_type}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={SEVERITY_COLORS[issue.severity]}>
                          {issue.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[issue.status]}>
                          {issue.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {issue.description || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(issue.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {issue.status !== 'resolved' && issue.status !== 'closed' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => setResolveDialog(issue.id)}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Resolve
                              </Button>
                              {issue.status !== 'escalated' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => handleEscalate(issue.id)}
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  Escalate
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Create Issue Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report Supplier Issue</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Supplier</label>
                <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={supplierPopoverOpen} className="mt-1 w-full justify-between font-normal">
                      {newIssue.supplier_account_id
                        ? supplierOptions.find(s => s.id === newIssue.supplier_account_id)?.name || 'Unknown'
                        : 'Search supplier...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Type supplier name..." />
                      <CommandList>
                        <CommandEmpty>No supplier found.</CommandEmpty>
                        <CommandGroup>
                          {supplierOptions.map(s => (
                            <CommandItem
                              key={s.id}
                              value={s.name}
                              onSelect={() => {
                                setNewIssue(prev => ({ ...prev, supplier_account_id: s.id }));
                                setSupplierPopoverOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", newIssue.supplier_account_id === s.id ? "opacity-100" : "opacity-0")} />
                              {s.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Select value={newIssue.issue_type} onValueChange={(v) => setNewIssue(prev => ({ ...prev, issue_type: v as IssueType }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['delay', 'quality', 'pricing', 'communication', 'documentation', 'coverage', 'validity', 'other'] as IssueType[]).map(t => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Severity</label>
                  <Select value={newIssue.severity} onValueChange={(v) => setNewIssue(prev => ({ ...prev, severity: v as IssueSeverity }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['minor', 'major', 'critical'] as IssueSeverity[]).map(s => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                placeholder="Describe the issue..."
                value={newIssue.description}
                onChange={(e) => setNewIssue(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createIssue.isPending || !newIssue.supplier_account_id}>
                Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Resolve Dialog */}
        <Dialog open={!!resolveDialog} onOpenChange={(o) => !o && setResolveDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolve Issue</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="Resolution notes..."
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveDialog(null)}>Cancel</Button>
              <Button onClick={handleResolve} disabled={updateIssue.isPending}>Resolve</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppLayout>
    </ProtectedRoute>
  );
}

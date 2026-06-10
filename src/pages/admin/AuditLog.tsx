import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Search, RefreshCw, Eye, Undo2, ArrowRight, User as UserIcon, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  diffActivity, summarizeActivity, entityLabel, formatValue, labelField,
} from '@/lib/audit-format';

interface ActivityRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  old_data: any;
  new_data: any;
  created_at: string;
}

const actionMeta: Record<string, { label: string; cls: string }> = {
  insert: { label: 'Created', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  update: { label: 'Updated', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  delete: { label: 'Deleted', cls: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
};

function AuditLogPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selected, setSelected] = useState<ActivityRow | null>(null);
  const [confirmRevert, setConfirmRevert] = useState<ActivityRow | null>(null);

  const { data: entityTypes } = useQuery({
    queryKey: ['activity-log-entity-types'],
    queryFn: async () => {
      const { data } = await supabase
        .from('activity_log')
        .select('entity_type')
        .limit(1000);
      const set = new Set((data ?? []).map((r: any) => r.entity_type));
      return Array.from(set).sort();
    },
  });

  const { data: rows, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['activity-log', entityFilter, actionFilter, search],
    queryFn: async () => {
      let q = supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (entityFilter !== 'all') q = q.eq('entity_type', entityFilter);
      if (actionFilter !== 'all') q = q.eq('action', actionFilter);
      if (search.trim()) q = q.ilike('entity_id', `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

  // Resolve actor names in one batched query
  const actorIds = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach(r => r.actor_id && set.add(r.actor_id));
    return Array.from(set);
  }, [rows]);

  const { data: actorMap } = useQuery({
    queryKey: ['activity-log-actors', actorIds.join(',')],
    queryFn: async () => {
      if (!actorIds.length) return {};
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', actorIds);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.id.slice(0, 8); });
      return map;
    },
    enabled: actorIds.length > 0,
  });

  const revertMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('revert_activity_entry' as any, { p_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Change reverted — a new audit entry was recorded');
      qc.invalidateQueries({ queryKey: ['activity-log'] });
      setConfirmRevert(null);
      setSelected(null);
    },
    onError: (e: any) => {
      toast.error(`Could not revert: ${e.message}`);
    },
  });

  const renderActor = (id: string | null) => {
    if (!id) return <span className="inline-flex items-center gap-1 text-muted-foreground italic"><Bot className="h-3 w-3" /> system</span>;
    const name = actorMap?.[id];
    return (
      <span className="inline-flex items-center gap-1.5">
        <UserIcon className="h-3 w-3 text-muted-foreground" />
        {name ?? <span className="font-mono text-xs">{id.slice(0, 8)}…</span>}
      </span>
    );
  };

  return (
    <AppLayout title="Audit Log">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Every database write is captured automatically. Click a row to see exactly what changed,
            and roll back any single change with one click.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by record ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All tables" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tables</SelectItem>
              {entityTypes?.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="insert">Created</SelectItem>
              <SelectItem value="update">Updated</SelectItem>
              <SelectItem value="delete">Deleted</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">When</TableHead>
                <TableHead className="w-[100px]">Action</TableHead>
                <TableHead>What happened</TableHead>
                <TableHead className="w-[180px]">By</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !rows?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No activity found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(r => {
                  const meta = actionMeta[r.action] ?? { label: r.action, cls: 'bg-muted' };
                  const summary = summarizeActivity(r.action, r.entity_type, r.old_data, r.new_data);
                  const changeCount = r.action === 'update'
                    ? diffActivity(r.old_data, r.new_data).length
                    : null;
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                      <TableCell className="text-xs text-muted-foreground" title={new Date(r.created_at).toLocaleString()}>
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={meta.cls}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{summary}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span className="font-mono">{r.entity_type}</span>
                          {changeCount !== null && changeCount > 1 && (
                            <span>· {changeCount} field{changeCount === 1 ? '' : 's'}</span>
                          )}
                          <span>· #{r.entity_id.slice(0, 8)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{renderActor(r.actor_id)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setConfirmRevert(r); }}
                          className="h-7 px-2 text-xs"
                          title="Revert this single change"
                        >
                          <Undo2 className="h-3 w-3 mr-1" /> Revert
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Showing latest 200 entries. Reverting a change creates its own audit entry — nothing is ever erased from history.
        </p>
      </div>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selected && (() => {
            const meta = actionMeta[selected.action] ?? { label: selected.action, cls: 'bg-muted' };
            const summary = summarizeActivity(selected.action, selected.entity_type, selected.old_data, selected.new_data);
            const changes = diffActivity(selected.old_data, selected.new_data);
            const label = entityLabel(selected.entity_type, selected.new_data ?? selected.old_data);
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                    <span className="font-mono text-sm">{selected.entity_type}</span>
                    {label && <span className="text-sm text-muted-foreground">· {label}</span>}
                  </SheetTitle>
                  <SheetDescription>{summary}</SheetDescription>
                </SheetHeader>

                <div className="space-y-5 mt-5">
                  <div className="grid grid-cols-2 gap-3 text-sm rounded-md border bg-muted/30 p-3">
                    <div>
                      <div className="text-xs text-muted-foreground">By</div>
                      <div>{renderActor(selected.actor_id)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">When</div>
                      <div>{new Date(selected.created_at).toLocaleString()}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-muted-foreground">Record ID</div>
                      <div className="font-mono text-xs break-all">{selected.entity_id}</div>
                    </div>
                  </div>

                  {selected.action === 'update' && (
                    changes.length > 0 ? (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Field changes ({changes.length})</h4>
                        <div className="rounded-md border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[180px]">Field</TableHead>
                                <TableHead>Before</TableHead>
                                <TableHead className="w-[24px]"></TableHead>
                                <TableHead>After</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {changes.map(c => (
                                <TableRow key={c.field}>
                                  <TableCell className="font-medium text-sm">{c.label}</TableCell>
                                  <TableCell className="text-sm text-destructive/80 break-words max-w-[180px]">
                                    {formatValue(c.before)}
                                  </TableCell>
                                  <TableCell><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
                                  <TableCell className="text-sm text-emerald-700 dark:text-emerald-400 break-words max-w-[180px]">
                                    {formatValue(c.after)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No business-field changes (only system bookkeeping was touched).
                      </p>
                    )
                  )}

                  {selected.action === 'insert' && selected.new_data && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Initial values</h4>
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableBody>
                            {Object.entries(selected.new_data)
                              .filter(([k, v]) =>
                                v !== null && v !== '' &&
                                !['created_at','updated_at','created_by','updated_by','id','metadata'].includes(k))
                              .slice(0, 30)
                              .map(([k, v]) => (
                                <TableRow key={k}>
                                  <TableCell className="font-medium text-sm w-[180px]">{labelField(k)}</TableCell>
                                  <TableCell className="text-sm break-words">{formatValue(v)}</TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {selected.action === 'delete' && selected.old_data && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Last known values (before deletion)</h4>
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableBody>
                            {Object.entries(selected.old_data)
                              .filter(([k, v]) =>
                                v !== null && v !== '' &&
                                !['created_at','updated_at','created_by','updated_by','id','metadata'].includes(k))
                              .slice(0, 30)
                              .map(([k, v]) => (
                                <TableRow key={k}>
                                  <TableCell className="font-medium text-sm w-[180px]">{labelField(k)}</TableCell>
                                  <TableCell className="text-sm break-words">{formatValue(v)}</TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Reverting will create a new audit entry — your history stays complete.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmRevert(selected)}
                      className="gap-1.5"
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Revert this change
                    </Button>
                  </div>

                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Raw snapshot (JSON)
                    </summary>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <div className="text-xs font-semibold mb-1">old_data</div>
                        <pre className="text-[10px] bg-muted rounded p-2 overflow-x-auto max-h-60">
                          {selected.old_data ? JSON.stringify(selected.old_data, null, 2) : '—'}
                        </pre>
                      </div>
                      <div>
                        <div className="text-xs font-semibold mb-1">new_data</div>
                        <pre className="text-[10px] bg-muted rounded p-2 overflow-x-auto max-h-60">
                          {selected.new_data ? JSON.stringify(selected.new_data, null, 2) : '—'}
                        </pre>
                      </div>
                    </div>
                  </details>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Revert confirmation */}
      <AlertDialog open={!!confirmRevert} onOpenChange={(o) => !o && setConfirmRevert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert this change?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRevert && (() => {
                const a = confirmRevert.action;
                if (a === 'insert') return 'This will delete the row that was created.';
                if (a === 'delete') return 'This will re-create the deleted row from its last snapshot.';
                if (a === 'update') return 'This will restore the row to its values before this change.';
                return null;
              })()}
              {' '}A new audit entry will be added so the history stays complete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRevert && revertMutation.mutate(confirmRevert.id)}
              disabled={revertMutation.isPending}
            >
              {revertMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Undo2 className="h-3.5 w-3.5 mr-1" />}
              Revert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

export default function AuditLog() {
  return (
    <ProtectedRoute>
      <AuditLogPage />
    </ProtectedRoute>
  );
}

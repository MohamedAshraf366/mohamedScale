import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Beaker, Loader2, RotateCcw, Check } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useSandbox } from '@/contexts/SandboxContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SandboxSession {
  id: string;
  user_id: string;
  label: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
}

interface JournalCounts {
  inserts: number;
  updates: number;
  deletes: number;
  tables: string[];
}

export default function SandboxAdmin() {
  const { sessionId, enable, revert, promote, loading } = useSandbox();

  const { data: sessions = [], refetch, isLoading } = useQuery({
    queryKey: ['sandbox-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_sandbox_sessions' as any)
        .select('*')
        .order('started_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as SandboxSession[];
    },
  });

  const [counts, setCounts] = useState<Record<string, JournalCounts>>({});

  useEffect(() => {
    (async () => {
      if (!sessions.length) return;
      const ids = sessions.map((s) => s.id);
      const { data } = await supabase
        .from('sandbox_journal' as any)
        .select('session_id, op, table_name')
        .in('session_id', ids);
      const rows = (data ?? []) as unknown as { session_id: string; op: string; table_name: string }[];
      const acc: Record<string, JournalCounts> = {};
      for (const r of rows) {
        const c = acc[r.session_id] ?? { inserts: 0, updates: 0, deletes: 0, tables: [] };
        if (r.op === 'insert') c.inserts++;
        else if (r.op === 'update') c.updates++;
        else if (r.op === 'delete') c.deletes++;
        if (!c.tables.includes(r.table_name)) c.tables.push(r.table_name);
        acc[r.session_id] = c;
      }
      setCounts(acc);
    })();
  }, [sessions]);

  // Sandbox is available to all authenticated users; the page only shows the
  // current user's own sessions (RLS-enforced).

  const handleRevert = async (id: string) => {
    if (id === sessionId) {
      await revert();
    } else {
      const { data, error } = await supabase.rpc('sandbox_revert' as any, { p_session_id: id });
      if (error) toast.error(error.message);
      else {
        const r = data as any;
        toast.success(`Rolled back ${r?.reverted ?? 0} change(s)`);
      }
    }
    refetch();
  };

  const handlePromote = async (id: string) => {
    if (id === sessionId) {
      await promote();
    } else {
      const { error } = await supabase.rpc('sandbox_promote' as any, { p_session_id: id });
      if (error) toast.error(error.message);
      else toast.success('Session kept');
    }
    refetch();
  };

  return (
    <AppLayout title="Sandbox Sessions">
      <div className="container max-w-5xl py-6 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Beaker className="h-5 w-5 text-amber-600" />
                Per-User Sandbox
              </CardTitle>
              {!sessionId && (
                <Button onClick={() => enable()} disabled={loading} size="sm">
                  Start new session
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Sandbox mode tracks every insert, update, and delete you make through the app.
              At the end of a session you can <strong>keep</strong> the changes (make them
              permanent) or <strong>roll them back</strong> (undo everything).
            </p>
            <p>
              Other users are not affected. Tracking only applies to writes you make while
              your sandbox is ON.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {!isLoading && sessions.length === 0 && (
              <p className="text-sm text-muted-foreground">No sandbox sessions yet.</p>
            )}
            {sessions.map((s) => {
              const c = counts[s.id];
              const isActive = s.id === sessionId;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{s.label ?? s.id.slice(0, 8)}</span>
                      <Badge
                        variant={s.status === 'open' ? 'default' : 'secondary'}
                        className={isActive ? 'bg-amber-500 text-white' : ''}
                      >
                        {isActive ? 'ACTIVE' : s.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Started {format(new Date(s.started_at), 'PPp')}
                      {s.ended_at && <> · Ended {format(new Date(s.ended_at), 'PPp')}</>}
                    </div>
                    {c && (
                      <div className="text-xs text-muted-foreground">
                        {c.inserts} insert · {c.updates} update · {c.deletes} delete · across{' '}
                        {c.tables.length} table(s)
                      </div>
                    )}
                  </div>
                  {s.status === 'open' && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePromote(s.id)}
                        className="gap-1"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Keep
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevert(s.id)}
                        className="gap-1 text-destructive hover:text-destructive"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Roll back
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

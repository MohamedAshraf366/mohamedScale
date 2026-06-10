import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const STORAGE_KEY = 'sandbox.session_id';

interface SandboxContextValue {
  enabled: boolean;
  sessionId: string | null;
  loading: boolean;
  /** Start a new sandbox session for the current user. */
  enable: (label?: string) => Promise<void>;
  /** Promote (keep) the current session as permanent. */
  promote: () => Promise<void>;
  /** Roll back the current session. */
  revert: () => Promise<{ reverted: number; skipped: number } | null>;
  /** Re-issue the session var on the current connection (call after auth refresh). */
  reactivate: () => Promise<void>;
}

const SandboxContext = createContext<SandboxContextValue | undefined>(undefined);

export const SandboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Restore session id from local storage on mount/user change.
  // Sandbox is available to ALL signed-in users — every user gets their own per-user journal.
  useEffect(() => {
    if (!user) {
      setSessionId(null);
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    // Verify the session is still open & owned by us
    (async () => {
      const { data } = await supabase
        .from('user_sandbox_sessions' as any)
        .select('id, status, user_id')
        .eq('id', stored)
        .maybeSingle();
      const row = data as any;
      if (row && row.status === 'open' && row.user_id === user.id) {
        setSessionId(stored);
        await supabase.rpc('set_sandbox_session' as any, { p_session_id: stored });
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    })();
  }, [user]);

  const reactivate = useCallback(async () => {
    if (!sessionId) return;
    await supabase.rpc('set_sandbox_session' as any, { p_session_id: sessionId });
  }, [sessionId]);

  const enable = useCallback(async (label?: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('open_sandbox_session' as any, {
        p_label: label ?? `Session ${new Date().toLocaleString()}`,
      });
      if (error) throw error;
      const id = data as unknown as string;
      localStorage.setItem(STORAGE_KEY, id);
      setSessionId(id);
      toast.success('Sandbox ON — your changes will be tracked');
    } catch (e: any) {
      toast.error(`Failed to start sandbox: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const promote = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('sandbox_promote' as any, { p_session_id: sessionId });
      if (error) throw error;
      localStorage.removeItem(STORAGE_KEY);
      setSessionId(null);
      toast.success('Sandbox session kept — changes are now permanent');
    } catch (e: any) {
      toast.error(`Failed to keep session: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const revert = useCallback(async () => {
    if (!sessionId) return null;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('sandbox_revert' as any, { p_session_id: sessionId });
      if (error) throw error;
      const result = data as any;
      localStorage.removeItem(STORAGE_KEY);
      setSessionId(null);
      toast.success(`Rolled back ${result?.reverted ?? 0} change(s)${result?.skipped ? ` — skipped ${result.skipped}` : ''}`);
      return { reverted: result?.reverted ?? 0, skipped: result?.skipped ?? 0 };
    } catch (e: any) {
      toast.error(`Rollback failed: ${e.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  return (
    <SandboxContext.Provider
      value={{
        enabled: !!sessionId,
        sessionId,
        loading,
        enable,
        promote,
        revert,
        reactivate,
      }}
    >
      {children}
    </SandboxContext.Provider>
  );
};

export const useSandbox = () => {
  const ctx = useContext(SandboxContext);
  if (!ctx) throw new Error('useSandbox must be used within SandboxProvider');
  return ctx;
};

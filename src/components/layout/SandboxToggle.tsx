import { useState } from 'react';
import { Beaker, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useSandbox } from '@/contexts/SandboxContext';
import { Link } from 'react-router-dom';

/**
 * Top-bar admin toggle for the per-user Sandbox.
 *
 * - When OFF: shows a "Start Sandbox" button (admin-only).
 * - When ON: shows a chip + buttons to roll back or keep the current session.
 */
export function SandboxToggle() {
  const { user } = useAuth();
  const { enabled, loading, enable, revert, promote, sessionId } = useSandbox();
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [confirmPromote, setConfirmPromote] = useState(false);

  if (!user) return null;

  if (!enabled) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => enable()}
        disabled={loading}
        className="gap-1.5 border-amber-500/40 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-950"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Beaker className="h-3.5 w-3.5" />}
        Sandbox: OFF
      </Button>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Link
          to="/sandbox"
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
          title={`Active session: ${sessionId?.slice(0, 8)}…`}
        >
          <Beaker className="h-3.5 w-3.5" />
          SANDBOX
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmPromote(true)}
          disabled={loading}
          className="h-7 px-2 text-xs"
        >
          Keep
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmRevert(true)}
          disabled={loading}
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
        >
          Roll back
        </Button>
      </div>

      <AlertDialog open={confirmRevert} onOpenChange={setConfirmRevert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Roll back this sandbox session?</AlertDialogTitle>
            <AlertDialogDescription>
              All inserts, updates, and deletes you made during this session will be reversed.
              Rows that were modified by other users after your changes may be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => revert()}>Roll back</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmPromote} onOpenChange={setConfirmPromote}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keep this sandbox session?</AlertDialogTitle>
            <AlertDialogDescription>
              All changes you made will become permanent. The change journal for this session
              will be discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => promote()}>Keep changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

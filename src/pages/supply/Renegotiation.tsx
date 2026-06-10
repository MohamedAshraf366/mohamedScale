import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PageGuidance } from '@/components/supply/PageGuidance';
import { RENEGOTIATION_GUIDANCE } from '@/components/supply/guidance-content';
import { AppLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import {
  useRenegotiationCases, useUpdateRenegotiationCase,
  type RenegotiationStatus,
} from '@/hooks/useRenegotiationCases';
import { useSendOutreach } from '@/hooks/useSupplyOutreach';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
  outreach_sent: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  quote_received: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30',
  under_review: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  resolved: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
  cancelled: 'bg-muted text-muted-foreground',
};

const STATUS_LABELS: Record<RenegotiationStatus, string> = {
  open: 'Open',
  outreach_sent: 'Outreach Sent',
  quote_received: 'Quote Received',
  under_review: 'Under Review',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
};

export default function RenegotiationPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<RenegotiationStatus | 'all'>('all');
  const { data: cases = [], isLoading } = useRenegotiationCases({ status: statusFilter });
  const updateCase = useUpdateRenegotiationCase();
  const sendOutreach = useSendOutreach();

  const [resolveDialog, setResolveDialog] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  // Outreach dialog
  const [outreachDialog, setOutreachDialog] = useState<{
    caseId: string;
    supplierAccountId: string;
  } | null>(null);
  const [outreachPhone, setOutreachPhone] = useState('');
  const [outreachBody, setOutreachBody] = useState('');

  const handleResolve = async () => {
    if (!resolveDialog) return;
    await updateCase.mutateAsync({
      id: resolveDialog,
      status: 'resolved',
      resolution_notes: resolveNotes || null,
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id,
    });
    setResolveDialog(null);
    setResolveNotes('');
  };

  const handleCancel = async (id: string) => {
    await updateCase.mutateAsync({ id, status: 'cancelled' });
  };

  const handleAdvanceStatus = async (id: string, currentStatus: RenegotiationStatus) => {
    const nextMap: Partial<Record<RenegotiationStatus, RenegotiationStatus>> = {
      open: 'outreach_sent',
      outreach_sent: 'quote_received',
      quote_received: 'under_review',
    };
    const next = nextMap[currentStatus];
    if (next) {
      await updateCase.mutateAsync({
        id,
        status: next,
        ...(currentStatus === 'open' ? { assigned_to: user?.id } : {}),
      });
    }
  };

  const getNextLabel = (status: RenegotiationStatus): string | null => {
    const map: Partial<Record<RenegotiationStatus, string>> = {
      open: 'Start Outreach',
      outreach_sent: 'Mark Quote Received',
      quote_received: 'Send to Review',
    };
    return map[status] || null;
  };

  // ── Outreach via Fatai ──
  const handleOpenOutreach = async (caseId: string, supplierAccountId: string) => {
    let phone = '';
    try {
      const { data: account } = await supabase
        .from('accounts')
        .select('poc_contact_id')
        .eq('id', supplierAccountId).is('deleted_at', null)
        .single();
      if (account?.poc_contact_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('phone')
          .eq('id', account.poc_contact_id)
          .single();
        phone = contact?.phone || '';
      }
    } catch {}

    setOutreachPhone(phone);
    setOutreachBody('');
    setOutreachDialog({ caseId, supplierAccountId });
  };

  const handleSendOutreach = async () => {
    if (!outreachDialog || !outreachPhone) return;

    await sendOutreach.mutateAsync({
      action: 'renegotiation_outreach',
      to: outreachPhone,
      body: outreachBody || undefined,
      renegotiation_case_id: outreachDialog.caseId,
      supplier_account_id: outreachDialog.supplierAccountId,
    });

    setOutreachDialog(null);
  };

  /** Parse delivery status from case notes */
  const parseDeliveryStatus = (notes: string | null): string | null => {
    if (!notes) return null;
    const match = notes.match(/Delivery: (\w+) at /);
    return match ? match[1] : null;
  };

  return (
    <ProtectedRoute>
      <AppLayout title="Renegotiations">
        <div className="space-y-6 p-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Renegotiations</h1>
            <p className="text-sm text-muted-foreground">
              Active renegotiation cases triggered by validity expiry, price changes, or manual request
            </p>
          </div>

          <PageGuidance {...RENEGOTIATION_GUIDANCE} />

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {(Object.keys(STATUS_LABELS) as RenegotiationStatus[]).map(s => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outreach</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : cases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No renegotiation cases
                    </TableCell>
                  </TableRow>
                ) : (
                  cases.map(c => {
                    const deliveryStatus = parseDeliveryStatus(c.notes);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.supplier_name || c.supplier_account_id.slice(0, 8)}</TableCell>
                        <TableCell className="text-sm capitalize">{c.trigger_type.replace(/_/g, ' ')}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{c.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[c.status]}>
                            {STATUS_LABELS[c.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {deliveryStatus ? (
                            <span className="text-xs text-muted-foreground capitalize">{deliveryStatus}</span>
                          ) : c.status === 'outreach_sent' ? (
                            <span className="text-xs text-muted-foreground">Sent</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {c.notes || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {/* Send outreach via Fatai for open/outreach_sent */}
                            {(c.status === 'open' || c.status === 'outreach_sent') && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleOpenOutreach(c.id, c.supplier_account_id)}
                                disabled={sendOutreach.isPending}
                              >
                                <MessageSquare className="h-3 w-3" />
                                WhatsApp
                              </Button>
                            )}
                            {getNextLabel(c.status) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleAdvanceStatus(c.id, c.status)}
                              >
                                {getNextLabel(c.status)}
                              </Button>
                            )}
                            {c.status !== 'resolved' && c.status !== 'cancelled' && (
                              <>
                                {(c.status === 'under_review' || c.status === 'quote_received') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => setResolveDialog(c.id)}
                                  >
                                    Resolve
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-muted-foreground"
                                  onClick={() => handleCancel(c.id)}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Outreach Dialog */}
        <Dialog open={!!outreachDialog} onOpenChange={(o) => !o && setOutreachDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Send Renegotiation Outreach
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Supplier Phone (WhatsApp)</label>
                <Input
                  placeholder="+966XXXXXXXXX"
                  value={outreachPhone}
                  onChange={(e) => setOutreachPhone(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Custom message (optional)</label>
                <Textarea
                  placeholder="Leave empty to use the default renegotiation message..."
                  value={outreachBody}
                  onChange={(e) => setOutreachBody(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOutreachDialog(null)}>Cancel</Button>
              <Button
                onClick={handleSendOutreach}
                disabled={sendOutreach.isPending || !outreachPhone}
                className="gap-1"
              >
                {sendOutreach.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send via WhatsApp
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Resolve Dialog */}
        <Dialog open={!!resolveDialog} onOpenChange={(o) => !o && setResolveDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolve Case</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="Resolution notes..."
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveDialog(null)}>Cancel</Button>
              <Button onClick={handleResolve} disabled={updateCase.isPending}>Resolve</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppLayout>
    </ProtectedRoute>
  );
}

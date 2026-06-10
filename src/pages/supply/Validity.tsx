import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PageGuidance } from '@/components/supply/PageGuidance';
import { VALIDITY_GUIDANCE } from '@/components/supply/guidance-content';
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
import {
  Loader2, Send, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCcw,
  MessageSquare, Check, AlertCircle,
} from 'lucide-react';
import { useSupplierQuotes } from '@/hooks/useSupplierQuotes';
import {
  useSupplierQuoteValidity,
  useCreateValidityRecord,
  useUpdateValidityRecord,
  deriveValidityLabel,
  type DerivedValidityLabel,
  type SupplierQuoteValidityRecord,
} from '@/hooks/useSupplierQuoteValidity';
import { useCreateRenegotiationCase } from '@/hooks/useRenegotiationCases';
import { useSendOutreach } from '@/hooks/useSupplyOutreach';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const VALIDITY_COLORS: Record<DerivedValidityLabel, string> = {
  active: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
  expiring_soon: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  awaiting_supplier: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  supplier_changed: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
  awaiting_management: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30',
  expired: 'bg-destructive/10 text-destructive border-destructive/30',
};

const VALIDITY_LABELS: Record<DerivedValidityLabel, string> = {
  active: 'Active',
  expiring_soon: 'Expiring Soon',
  awaiting_supplier: 'Awaiting Supplier',
  supplier_changed: 'Supplier Changed',
  awaiting_management: 'Awaiting Management',
  expired: 'Expired',
};

/** Extract delivery status from validity/case notes */
function parseDeliveryStatus(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/Delivery: (\w+) at /);
  return match ? match[1] : null;
}

const DELIVERY_ICONS: Record<string, { icon: typeof Check; className: string; label: string }> = {
  sent: { icon: Send, className: 'text-muted-foreground', label: 'Sent' },
  delivered: { icon: Check, className: 'text-blue-600', label: 'Delivered' },
  read: { icon: CheckCircle2, className: 'text-green-600', label: 'Read' },
  failed: { icon: AlertCircle, className: 'text-destructive', label: 'Failed' },
};

export default function ValidityPage() {
  const { user, roles } = useAuth();
  const isManagementOrAdmin = roles?.includes('management') || roles?.includes('admin');
  const qc = useQueryClient();
  const [filterLabel, setFilterLabel] = useState<DerivedValidityLabel | 'all'>('all');
  const { data: quotes = [], isLoading: quotesLoading } = useSupplierQuotes('approved');
  const { data: validityRecords = [], isLoading: validityLoading } = useSupplierQuoteValidity();
  const createValidity = useCreateValidityRecord();
  const updateValidity = useUpdateValidityRecord();
  const createRenego = useCreateRenegotiationCase();
  const sendOutreach = useSendOutreach();

  // Outreach dialog
  const [outreachDialog, setOutreachDialog] = useState<{
    quoteId: string;
    supplierAccountId: string;
    validityRecordId?: string;
    action: 'validity_confirmation' | 'follow_up';
  } | null>(null);
  const [outreachPhone, setOutreachPhone] = useState('');
  const [outreachBody, setOutreachBody] = useState('');

  // Management dialog
  const [mgmtDialog, setMgmtDialog] = useState<{ record: SupplierQuoteValidityRecord; quoteId: string } | null>(null);
  const [mgmtNotes, setMgmtNotes] = useState('');
  const [mgmtNewDate, setMgmtNewDate] = useState('');
  const [mgmtLoading, setMgmtLoading] = useState(false);

  // Response dialog
  const [responseDialog, setResponseDialog] = useState<{ quoteId: string; record?: SupplierQuoteValidityRecord } | null>(null);
  const [responseType, setResponseType] = useState<'no_change' | 'changed'>('no_change');
  const [responseNotes, setResponseNotes] = useState('');

  const isLoading = quotesLoading || validityLoading;

  // Build validity map: quoteId -> latest record
  const validityMap = new Map<string, SupplierQuoteValidityRecord>();
  for (const rec of validityRecords) {
    const existing = validityMap.get(rec.supplier_quote_id);
    if (!existing || new Date(rec.created_at) > new Date(existing.created_at)) {
      validityMap.set(rec.supplier_quote_id, rec);
    }
  }

  // Enrich quotes with derived validity
  const enrichedQuotes = quotes.map(q => {
    const latestRecord = validityMap.get(q.id) || null;
    const label = deriveValidityLabel(q.valid_until, latestRecord);
    return { ...q, validityLabel: label, validityRecord: latestRecord };
  });

  const filteredQuotes = filterLabel === 'all'
    ? enrichedQuotes
    : enrichedQuotes.filter(q => q.validityLabel === filterLabel);

  // ── Outreach via Fatai ──
  const handleOpenOutreach = async (
    quoteId: string,
    supplierAccountId: string,
    validityRecordId?: string,
    action: 'validity_confirmation' | 'follow_up' = 'validity_confirmation'
  ) => {
    // Try to pre-fill phone from supplier's POC contact
    let phone = '';
    try {
      const { data: account } = await supabase
        .from('accounts')
        .select('poc_contact_id').is('deleted_at', null)
        .eq('id', supplierAccountId)
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
    setOutreachDialog({ quoteId, supplierAccountId, validityRecordId, action });
  };

  const handleSendOutreach = async () => {
    if (!outreachDialog || !outreachPhone) {
      toast.error('Phone number is required');
      return;
    }

    await sendOutreach.mutateAsync({
      action: outreachDialog.action,
      to: outreachPhone,
      body: outreachBody || undefined,
      supplier_quote_id: outreachDialog.quoteId,
      validity_record_id: outreachDialog.validityRecordId,
      supplier_account_id: outreachDialog.supplierAccountId,
    });

    setOutreachDialog(null);
  };

  // ── Manual response ──
  const handleRecordResponse = async () => {
    if (!responseDialog) return;
    const { quoteId, record } = responseDialog;

    if (responseType === 'no_change') {
      if (record) {
        await updateValidity.mutateAsync({
          id: record.id,
          status: 'supplier_confirmed',
          supplier_responded_at: new Date().toISOString(),
          supplier_response: responseNotes || 'No change confirmed',
        });
      } else {
        await createValidity.mutateAsync({
          supplier_quote_id: quoteId,
          status: 'supplier_confirmed',
          notes: responseNotes || 'No change confirmed',
        });
      }
    } else {
      if (record) {
        await updateValidity.mutateAsync({
          id: record.id,
          status: 'supplier_changed',
          supplier_responded_at: new Date().toISOString(),
          supplier_response: responseNotes || 'Price/terms changed',
        });
      } else {
        await createValidity.mutateAsync({
          supplier_quote_id: quoteId,
          status: 'supplier_changed',
          notes: responseNotes || 'Price/terms changed',
        });
      }

      const quote = quotes.find(q => q.id === quoteId);
      if (quote) {
        await createRenego.mutateAsync({
          supplier_account_id: quote.supplier_account_id,
          original_quote_id: quoteId,
          trigger_type: 'validity_expiry',
          notes: responseNotes || 'Supplier reported price/terms change during validity check',
          created_by: user?.id,
        });
      }
    }

    setResponseDialog(null);
    setResponseNotes('');
  };

  // ── Management decision ──
  const handleManagementDecision = async (approve: boolean) => {
    if (!mgmtDialog) return;
    setMgmtLoading(true);
    try {
      await updateValidity.mutateAsync({
        id: mgmtDialog.record.id,
        status: approve ? 'management_approved' : 'expired',
        management_decided_at: new Date().toISOString(),
        management_decided_by: user?.id,
        management_decision: approve ? 'approved' : 'rejected',
        notes: mgmtNotes || null,
        new_valid_until: approve && mgmtNewDate ? mgmtNewDate : undefined,
      });

      if (approve && mgmtNewDate) {
        await supabase
          .from('supplier_quotes')
          .update({ valid_until: mgmtNewDate, updated_by: user?.id || null })
          .eq('id', mgmtDialog.quoteId);
        qc.invalidateQueries({ queryKey: ['supplier-quotes'] });
      }

      if (!approve) {
        const quote = quotes.find(q => q.id === mgmtDialog.quoteId);
        if (quote) {
          await createRenego.mutateAsync({
            supplier_account_id: quote.supplier_account_id,
            original_quote_id: mgmtDialog.quoteId,
            trigger_type: 'validity_expiry',
            notes: mgmtNotes || 'Management rejected no-change confirmation',
            created_by: user?.id,
          });
        }
      }
    } finally {
      setMgmtLoading(false);
      setMgmtDialog(null);
      setMgmtNotes('');
      setMgmtNewDate('');
    }
  };

  return (
    <ProtectedRoute>
      <AppLayout title="Quote Validity">
        <div className="space-y-6 p-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Quote Validity</h1>
            <p className="text-sm text-muted-foreground">
              Monitor approved quote validity, send outreach via WhatsApp, and manage confirmations
            </p>
          </div>

          <PageGuidance {...VALIDITY_GUIDANCE} />

          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            <Select value={filterLabel} onValueChange={(v) => setFilterLabel(v as any)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {(Object.keys(VALIDITY_LABELS) as DerivedValidityLabel[]).map(k => (
                  <SelectItem key={k} value={k}>{VALIDITY_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outreach</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredQuotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No approved quotes found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuotes.map(q => {
                    const deliveryStatus = parseDeliveryStatus(q.validityRecord?.notes || null);
                    const DeliveryIcon = deliveryStatus ? DELIVERY_ICONS[deliveryStatus] : null;

                    return (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">{q.supplier_name || '—'}</TableCell>
                        <TableCell className="text-sm">{q.items.length} item{q.items.length !== 1 ? 's' : ''}</TableCell>
                        <TableCell className="text-sm">
                          {q.valid_until
                            ? new Date(q.valid_until).toLocaleDateString()
                            : <span className="text-muted-foreground">Not set</span>
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={VALIDITY_COLORS[q.validityLabel]}>
                            {VALIDITY_LABELS[q.validityLabel]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {DeliveryIcon ? (
                            <span className={`flex items-center gap-1 text-xs ${DeliveryIcon.className}`}>
                              <DeliveryIcon.icon className="h-3 w-3" />
                              {DeliveryIcon.label}
                            </span>
                          ) : q.validityRecord?.outreach_method?.includes('fatai') ? (
                            <span className="text-xs text-muted-foreground">Sent</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(q.validityLabel === 'expiring_soon' || q.validityLabel === 'expired' || q.validityLabel === 'active') && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleOpenOutreach(
                                  q.id,
                                  q.supplier_account_id,
                                  q.validityRecord?.id,
                                  'validity_confirmation'
                                )}
                                disabled={sendOutreach.isPending}
                              >
                                <MessageSquare className="h-3 w-3" />
                                Send Confirmation
                              </Button>
                            )}
                            {q.validityLabel === 'awaiting_supplier' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => setResponseDialog({ quoteId: q.id, record: q.validityRecord || undefined })}
                                >
                                  <RefreshCcw className="h-3 w-3" />
                                  Record Response
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => handleOpenOutreach(
                                    q.id,
                                    q.supplier_account_id,
                                    q.validityRecord?.id,
                                    'follow_up'
                                  )}
                                  disabled={sendOutreach.isPending}
                                >
                                  <Send className="h-3 w-3" />
                                  Follow Up
                                </Button>
                              </>
                            )}
                            {q.validityLabel === 'awaiting_management' && q.validityRecord && isManagementOrAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => setMgmtDialog({ record: q.validityRecord!, quoteId: q.id })}
                              >
                                <Clock className="h-3 w-3" />
                                Management Decision
                              </Button>
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
                {outreachDialog?.action === 'follow_up' ? 'Send Follow-Up' : 'Send Validity Confirmation'}
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
                <p className="text-xs text-muted-foreground mt-1">
                  E.164 format preferred. Message will be sent via WhatsApp through Fatai.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Custom message (optional)</label>
                <Textarea
                  placeholder="Leave empty to use the default Arabic message..."
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

        {/* Record Response Dialog */}
        <Dialog open={!!responseDialog} onOpenChange={(o) => !o && setResponseDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Supplier Response</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={responseType} onValueChange={(v) => setResponseType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_change">
                    <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> No Change</span>
                  </SelectItem>
                  <SelectItem value="changed">
                    <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-600" /> Price/Terms Changed</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Notes..."
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResponseDialog(null)}>Cancel</Button>
              <Button onClick={handleRecordResponse} disabled={updateValidity.isPending || createValidity.isPending}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Management Decision Dialog */}
        <Dialog open={!!mgmtDialog} onOpenChange={(o) => !o && setMgmtDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Management Decision</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">New validity date (if approving)</label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                  value={mgmtNewDate}
                  onChange={(e) => setMgmtNewDate(e.target.value)}
                />
              </div>
              <Textarea
                placeholder="Decision notes..."
                value={mgmtNotes}
                onChange={(e) => setMgmtNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleManagementDecision(false)}
                disabled={mgmtLoading}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject / Renegotiate
              </Button>
              <Button
                onClick={() => handleManagementDecision(true)}
                disabled={mgmtLoading || !mgmtNewDate}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppLayout>
    </ProtectedRoute>
  );
}

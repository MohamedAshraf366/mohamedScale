import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Shield,
  Package,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingDown,
  FileCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useRenegotiations,
  useManagementApproval,
  Renegotiation,
} from '@/hooks/useRenegotiations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const ManagementApproval = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [bulkApproving, setBulkApproving] = useState(false);

  const { data: pendingApprovals, isLoading } = useRenegotiations('pending_management');
  const managementApproval = useManagementApproval();

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!pendingApprovals) return;
    if (selectedIds.size === pendingApprovals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingApprovals.map(r => r.id)));
    }
  };

  const calculateSavings = (current: number | null, target: number | null) => {
    if (!current || !target || current === 0) return null;
    return ((current - target) / current * 100);
  };

  const calculateTotalPotentialSavings = () => {
    if (!pendingApprovals) return 0;
    const selectedItems = pendingApprovals.filter(r => selectedIds.has(r.id));
    return selectedItems.reduce((total, r) => {
      const savings = r.current_price && r.supply_head_target 
        ? r.current_price - r.supply_head_target 
        : 0;
      return total + savings;
    }, 0);
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    
    setBulkApproving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const approvals = pendingApprovals
        ?.filter(r => selectedIds.has(r.id))
        .map(r => ({
          id: r.id,
          management_approved_target: r.supply_head_target,
          management_reviewed_by: user.user?.id,
          management_reviewed_at: new Date().toISOString(),
          approval_status: 'approved' as const,
        })) || [];

      for (const approval of approvals) {
        await supabase
          .from('material_renegotiations')
          .update({
            management_approved_target: approval.management_approved_target,
            management_reviewed_by: approval.management_reviewed_by,
            management_reviewed_at: approval.management_reviewed_at,
            approval_status: approval.approval_status,
          })
          .eq('id', approval.id);
      }

      queryClient.invalidateQueries({ queryKey: ['renegotiations'] });
      toast.success(`${approvals.length} renegotiation(s) approved`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to approve renegotiations');
    } finally {
      setBulkApproving(false);
    }
  };

  const handleSingleApprove = async (renegotiation: Renegotiation) => {
    await managementApproval.mutateAsync({
      id: renegotiation.id,
      approved: true,
      management_approved_target: renegotiation.supply_head_target || undefined,
    });
  };

  const openRejectDialog = (id: string) => {
    setRejectingId(id);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectionReason.trim()) return;

    await managementApproval.mutateAsync({
      id: rejectingId,
      approved: false,
      rejection_reason: rejectionReason,
    });

    setRejectDialogOpen(false);
    setRejectingId(null);
    setRejectionReason('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-purple-500" />
            {t('renegotiation.managementQueue', 'Management Approval Queue')}
            {pendingApprovals?.length ? (
              <Badge variant="secondary" className="ml-2">{pendingApprovals.length}</Badge>
            ) : null}
          </CardTitle>
          
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{selectedIds.size}</span> selected
                <span className="mx-2">•</span>
                Potential Savings: <span className="font-medium text-green-600">
                  {calculateTotalPotentialSavings().toFixed(2)}
                </span>
              </div>
              <Button 
                onClick={handleBulkApprove} 
                disabled={bulkApproving}
                className="bg-green-600 hover:bg-green-700"
              >
                <FileCheck className="h-4 w-4 mr-2" />
                Bulk Approve ({selectedIds.size})
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !pendingApprovals?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t('renegotiation.noApprovals', 'No pending approvals')}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === pendingApprovals.length && pendingApprovals.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Current Price</TableHead>
                    <TableHead className="text-right">Target Price</TableHead>
                    <TableHead className="text-right">Potential Savings</TableHead>
                    <TableHead>Supply Head Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingApprovals.map((renegotiation) => {
                    const savings = calculateSavings(
                      renegotiation.current_price,
                      renegotiation.supply_head_target
                    );
                    
                    return (
                      <TableRow 
                        key={renegotiation.id}
                        className={cn(
                          selectedIds.has(renegotiation.id) && 'bg-primary/5'
                        )}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(renegotiation.id)}
                            onCheckedChange={() => toggleSelection(renegotiation.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{renegotiation.materials?.name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">
                                {renegotiation.materials?.category}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {renegotiation.current_price?.toFixed(2) || '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-primary font-medium">
                          {renegotiation.supply_head_target?.toFixed(2) || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {savings !== null ? (
                            <div className="flex items-center justify-end gap-1">
                              <TrendingDown className="h-3 w-3 text-green-600" />
                              <span className={cn(
                                'font-medium',
                                savings > 0 ? 'text-green-600' : 'text-red-600'
                              )}>
                                {savings.toFixed(1)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="text-sm text-muted-foreground truncate">
                            {renegotiation.supply_head_notes || '—'}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleSingleApprove(renegotiation)}
                              disabled={managementApproval.isPending}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => openRejectDialog(renegotiation.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Reject Renegotiation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Explain why this renegotiation is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || managementApproval.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagementApproval;
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  MoreHorizontal, 
  Pencil, 
  ArrowRight, 
  Archive, 
  Trash2,
  Lock,
  Unlock,
  XCircle,
  CalendarPlus,
  Copy,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface Opportunity {
  id: string;
  name: string;
  stage: string;
  interest_level?: string | null;
  is_deal?: boolean | null;
  deal_id?: string | null;
  is_locked?: boolean | null;
  is_closed?: boolean | null;
  won?: boolean | null;
  has_initial_conversation?: boolean;
  client_id: string;
  project_id: string;
  expected_value?: number | null;
  notes?: string | null;
}

interface OpportunityActionsMenuProps {
  opportunity: Opportunity;
  onEdit: () => void;
  onConvertToDeal: () => void;
  onAddFollowUp?: () => void;
  onPreview?: () => void;
  onRefresh: () => void;
}

export const OpportunityActionsMenu = ({
  opportunity,
  onEdit,
  onConvertToDeal,
  onAddFollowUp,
  onPreview,
  onRefresh,
}: OpportunityActionsMenuProps) => {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [cancelOrderDialogOpen, setCancelOrderDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Check if opportunity can be converted to deal
  const canConvertToDeal = () => {
    return !opportunity.is_deal && !opportunity.is_closed;
  };

  // Handle delete
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // First, delete related follow_up_history records (they reference communication_log)
      const { data: commLogs } = await supabase
        .from('communication_log')
        .select('id')
        .eq('opportunity_id', opportunity.id);

      if (commLogs && commLogs.length > 0) {
        const commLogIds = commLogs.map(c => c.id);
        await supabase
          .from('follow_up_history')
          .delete()
          .in('communication_log_id', commLogIds);
      }

      // Delete communication_log records
      await supabase
        .from('communication_log')
        .delete()
        .eq('opportunity_id', opportunity.id);

      // Delete activities linked to this opportunity
      await supabase
        .from('activities')
        .delete()
        .eq('opportunity_id', opportunity.id);

      // Delete opportunity_materials
      await supabase
        .from('opportunity_materials')
        .delete()
        .eq('opportunity_id', opportunity.id);

      // Now delete the opportunity
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', opportunity.id);

      if (error) throw error;

      toast.success('Opportunity deleted');
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      onRefresh();
    } catch (error) {
      console.error('Error deleting opportunity:', error);
      toast.error('Failed to delete opportunity');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // Handle archive (mark as closed lost)
  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({
          is_closed: true,
          won: false,
          closed_at: new Date().toISOString(),
        })
        .eq('id', opportunity.id);

      if (error) throw error;

      toast.success('Opportunity archived');
      onRefresh();
    } catch (error) {
      console.error('Error archiving opportunity:', error);
      toast.error('Failed to archive opportunity');
    } finally {
      setIsArchiving(false);
      setArchiveDialogOpen(false);
    }
  };

  // Handle duplicate opportunity
  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      // Get the next opportunity number for naming
      const { data: existingOpps } = await supabase
        .from('opportunities')
        .select('name')
        .eq('client_id', opportunity.client_id)
        .order('created_at', { ascending: false });
      
      const oppCount = (existingOpps?.length || 0) + 1;
      const newName = `Opportunity ${String(oppCount).padStart(2, '0')}`;

      const { error } = await supabase
        .from('opportunities')
        .insert({
          client_id: opportunity.client_id,
          project_id: opportunity.project_id,
          name: newName,
          stage: opportunity.stage || 'Discovery',
          interest_level: opportunity.interest_level,
          expected_value: opportunity.expected_value,
          notes: opportunity.notes,
        });

      if (error) throw error;

      toast.success('Opportunity duplicated', {
        description: `Created "${newName}"`,
      });
      onRefresh();
    } catch (error) {
      console.error('Error duplicating opportunity:', error);
      toast.error('Failed to duplicate opportunity');
    } finally {
      setIsDuplicating(false);
    }
  };

  // Handle unlock - reverts to editable opportunity
  const handleUnlock = async () => {
    setIsUnlocking(true);
    try {
      // Also update the operations order to cancelled since it's being unlinked
      if (opportunity.deal_id) {
        await supabase
          .from('operations_orders')
          .update({ status: 'cancelled' })
          .eq('deal_id', opportunity.deal_id);
      }

      const { error } = await supabase
        .from('opportunities')
        .update({
          is_deal: false,
          is_locked: false,
          is_closed: false,
          won: null,
          closed_at: null,
          deal_id: null,
          converted_to_deal_at: null,
        })
        .eq('id', opportunity.id);

      if (error) throw error;

      // Invalidate deals cache
      queryClient.invalidateQueries({ queryKey: ['client-deals'] });

      toast.success('Opportunity unlocked', {
        description: 'You can now edit and convert this opportunity again.',
      });
      onRefresh();
    } catch (error) {
      console.error('Error unlocking opportunity:', error);
      toast.error('Failed to unlock opportunity');
    } finally {
      setIsUnlocking(false);
      setUnlockDialogOpen(false);
    }
  };

  // Handle cancel order - marks as Closed Lost and keeps deal link
  const handleCancelOrder = async () => {
    setIsCancelling(true);
    try {
      // Update opportunity to Closed Lost
      const { error: oppError } = await supabase
        .from('opportunities')
        .update({
          stage: 'Closed Lost',
          is_closed: true,
          won: false,
          closed_at: new Date().toISOString(),
        })
        .eq('id', opportunity.id);

      if (oppError) throw oppError;

      // Update the operations order status to Cancelled if deal_id exists
      if (opportunity.deal_id) {
        const { error: orderError } = await supabase
          .from('operations_orders')
          .update({
            status: 'cancelled',
          })
          .eq('deal_id', opportunity.deal_id);

        if (orderError) {
          console.error('Error updating order status:', orderError);
        }
      }

      // Invalidate deals cache
      queryClient.invalidateQueries({ queryKey: ['client-deals'] });

      toast.success('Order cancelled', {
        description: 'The deal has been marked as cancelled.',
      });
      onRefresh();
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Failed to cancel order');
    } finally {
      setIsCancelling(false);
      setCancelOrderDialogOpen(false);
    }
  };

  // If opportunity is a locked deal, show locked menu with unlock options
  if (opportunity.is_deal && opportunity.is_locked) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Deal created - Click for options</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="sr-only">Open locked menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onPreview && (
              <DropdownMenuItem 
                onClick={onPreview}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview
              </DropdownMenuItem>
            )}
            
            <DropdownMenuItem 
              onClick={() => setUnlockDialogOpen(true)}
              className="gap-2"
            >
              <Unlock className="h-4 w-4" />
              Unlock Opportunity
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={() => setCancelOrderDialogOpen(true)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <XCircle className="h-4 w-4" />
              Cancel Order
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Unlock Confirmation Dialog */}
        <AlertDialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unlock Opportunity</AlertDialogTitle>
              <AlertDialogDescription>
                This will unlink "{opportunity.name}" from its deal, cancel the associated order, 
                and allow you to edit and convert to deal again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isUnlocking}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleUnlock}
                disabled={isUnlocking}
              >
                {isUnlocking ? 'Unlocking...' : 'Unlock'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Order Confirmation Dialog */}
        <AlertDialog open={cancelOrderDialogOpen} onOpenChange={setCancelOrderDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Order</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark "{opportunity.name}" as Closed Lost and cancel the associated order. 
                This action indicates the client has cancelled the deal.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCancelling}>Go Back</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Order'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onEdit} className="gap-2">
            <Pencil className="h-4 w-4" />
            Edit Opportunity
          </DropdownMenuItem>

          {onAddFollowUp && (
            <DropdownMenuItem onClick={onAddFollowUp} className="gap-2">
              <CalendarPlus className="h-4 w-4" />
              Add Follow-up
            </DropdownMenuItem>
          )}

          {canConvertToDeal() && (
            <DropdownMenuItem 
              onClick={onConvertToDeal} 
              className="gap-2 text-emerald-600 focus:text-emerald-600"
            >
              <ArrowRight className="h-4 w-4" />
              Convert to Deal
            </DropdownMenuItem>
          )}

          <DropdownMenuItem 
            onClick={handleDuplicate}
            className="gap-2"
            disabled={isDuplicating}
          >
            <Copy className="h-4 w-4" />
            {isDuplicating ? 'Duplicating...' : 'Duplicate'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem 
            onClick={() => setArchiveDialogOpen(true)}
            className="gap-2"
            disabled={opportunity.is_closed}
          >
            <Archive className="h-4 w-4" />
            Archive
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={() => setDeleteDialogOpen(true)}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Opportunity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{opportunity.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Opportunity</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark "{opportunity.name}" as closed/lost. You can still view it in the opportunities list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isArchiving}
            >
              {isArchiving ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default OpportunityActionsMenu;

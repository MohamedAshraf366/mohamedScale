import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { ListTodo, Pencil, Trash2, Target, Package, Building2, Plus, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import FollowUpTimeline from '@/components/FollowUpTimeline';
import { PreviousInteractionsSection } from '@/components/PreviousInteractionsSection';
import IssueReportDialog from '@/components/IssueReportDialog';

interface Communication {
  id: string;
  company_name: string | null;
  person_name: string | null;
  category: string | null;
  contact_info: string | null;
  communication_channels: string | null;
  summary: string | null;
  quotation_required: boolean | null;
  action: string | null;
  follow_up_date: string | null;
  status: string;
  communication_date: string;
  notes: string | null;
  assigned_to: string | null;
  current_phase: string | null;
  outcome_notes: string | null;
  interest_level: string | null;
  other_projects: string | null;
}

interface MaterialPrice {
  id: string;
  material_id: string;
  material_name: string;
  current_purchase_price: number | null;
}

interface MaterialNeed {
  id: string;
  material_id: string;
  material_name: string;
  notes: string | null;
}

interface FollowUpHistoryEntry {
  id: string;
  follow_up_date: string;
  status_after: string | null;
  notes: string | null;
  action: string | null;
  created_at: string;
  user_id: string;
  communication_log_id: string;
  creator_name?: string;
}

interface CommunicationDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communication: Communication | null;
  materialPrices: MaterialPrice[];
  materialNeeds: MaterialNeed[];
  followUps: FollowUpHistoryEntry[];
  followUpHistoryLoading: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddFollowUp: () => void;
  onEditFollowUp: (followUp: FollowUpHistoryEntry) => void;
  onRefreshFollowUps: () => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Closed':
      return 'bg-green-500/15 text-green-600 border-green-500/30';
    case 'In Follow-up':
      return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
    case 'Open':
    default:
      return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
  }
};

const getInterestLevelColor = (level: string | null) => {
  switch (level) {
    case 'High':
      return 'bg-green-500/15 text-green-600 border-green-500/30';
    case 'Medium':
      return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30';
    case 'Low':
      return 'bg-orange-500/15 text-orange-600 border-orange-500/30';
    case 'Not interested':
      return 'bg-red-500/15 text-red-600 border-red-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export function CommunicationDetailsModal({
  open,
  onOpenChange,
  communication,
  materialPrices,
  materialNeeds,
  followUps,
  followUpHistoryLoading,
  onEdit,
  onDelete,
  onAddFollowUp,
  onEditFollowUp,
  onRefreshFollowUps,
}: CommunicationDetailsModalProps) {
  const navigate = useNavigate();
  const [hasInitialFocus, setHasInitialFocus] = useState(false);
  const previousOpenRef = useRef(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);

  // Reset initial focus state when modal opens fresh
  useEffect(() => {
    if (open && !previousOpenRef.current) {
      // Modal just opened
      setHasInitialFocus(false);
    }
    previousOpenRef.current = open;
  }, [open]);

  // Mark as focused after first render with followUps
  useEffect(() => {
    if (open && !hasInitialFocus && followUps.length > 0 && !followUpHistoryLoading) {
      // Allow timeline to render and scroll, then mark as focused
      const timer = setTimeout(() => {
        setHasInitialFocus(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [open, hasInitialFocus, followUps.length, followUpHistoryLoading]);

  if (!communication) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Communication Details
            </DialogTitle>
            <TooltipProvider>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        navigate(`/tasks?communication_id=${communication.id}`);
                      }}
                    >
                      <ListTodo className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View Tasks</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      onClick={() => setIssueDialogOpen(true)}
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Report Issue</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={onEdit}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={onDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="px-6 py-4 space-y-5">
            {/* Communication Summary */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="text-sm font-medium">
                    {format(new Date(communication.communication_date), 'MMMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="mt-0.5">
                    <Badge className={getStatusColor(communication.status)}>
                      {communication.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Company</Label>
                <p className="text-sm font-medium">{communication.company_name || '-'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Person</Label>
                  <p className="text-sm">{communication.person_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Communication Channel</Label>
                  <p className="text-sm">{communication.communication_channels || '-'}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Outcome / Result */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Target className="h-4 w-4 text-primary" />
                Outcome / Result
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Visit / Communication Outcome</Label>
                <p className="text-sm whitespace-pre-wrap">{communication.outcome_notes || '-'}</p>
              </div>
            </div>

            {/* Interest Level */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <Label className="text-xs text-muted-foreground">Interest Level</Label>
              <div className="flex items-center gap-2 mt-1">
                {communication.interest_level ? (
                  <Badge className={getInterestLevelColor(communication.interest_level)}>
                    {communication.interest_level}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
              </div>
            </div>

            {/* Materials / Needs */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4 text-primary" />
                Materials / Needs
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Client's Current Purchase Prices</Label>
                {materialPrices.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {materialPrices.map((price) => (
                      <div key={price.id} className="flex items-center justify-between text-sm bg-background/50 rounded px-2 py-1.5">
                        <span>{price.material_name}</span>
                        <span className="font-medium">
                          {price.current_purchase_price !== null ? `SAR ${price.current_purchase_price.toLocaleString()}` : '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No prices recorded</p>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Requested Materials or Items</Label>
                {materialNeeds.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {materialNeeds.map((need) => (
                      <div key={need.id} className="text-sm bg-background/50 rounded px-2 py-1.5">
                        <span className="font-medium">{need.material_name}</span>
                        {need.notes && <span className="text-muted-foreground ml-2">- {need.notes}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No materials requested</p>
                )}
              </div>
            </div>

            {/* Projects */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-primary" />
                Projects
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Other Projects for This Client</Label>
                <p className="text-sm whitespace-pre-wrap">{communication.other_projects || '-'}</p>
              </div>
            </div>

            {/* Quotation Required + Assigned To */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Quotation Required</Label>
                <p className="text-sm">{communication.quotation_required ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Assigned To</Label>
                <p className="text-sm">{communication.assigned_to || '-'}</p>
              </div>
            </div>

            <Separator />

            {/* Follow-up Timeline */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold">Follow-up Timeline</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddFollowUp}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Follow-up
                </Button>
              </div>
              <FollowUpTimeline
                followUps={followUps}
                onEdit={onEditFollowUp}
                onRefresh={onRefreshFollowUps}
                loading={followUpHistoryLoading}
                autoFocusActive={!hasInitialFocus}
                showInitialHighlight={!hasInitialFocus}
              />
            </div>

            {/* Previous Interactions */}
            <PreviousInteractionsSection
              companyName={communication.company_name}
              currentCommunicationId={communication.id}
            />
          </div>
        </ScrollArea>
      </DialogContent>

      {/* Issue Report Dialog */}
      <IssueReportDialog
        open={issueDialogOpen}
        onOpenChange={setIssueDialogOpen}
        source="manual_sales"
      />
    </Dialog>
  );
}

export default CommunicationDetailsModal;

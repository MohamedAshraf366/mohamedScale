import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { 
  MoreHorizontal, 
  Eye, 
  CheckCircle2, 
  MessageSquare, 
  XCircle,
  Trash2,
  ArrowRight,
  Pencil,
} from 'lucide-react';
import type { SupplierMaterialStatus } from '@/hooks/useSupplierMaterials';

interface SupplierMaterialActionsProps {
  currentStatus: SupplierMaterialStatus;
  onStatusChange: (status: SupplierMaterialStatus) => void;
  onEdit?: () => void;
  onDelete: () => void;
}

export function SupplierMaterialActions({
  currentStatus,
  onStatusChange,
  onEdit,
  onDelete,
}: SupplierMaterialActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover w-48">
        {/* Status transitions based on current state */}
        {currentStatus === 'submitted' && (
          <DropdownMenuItem onClick={() => onStatusChange('under_review')}>
            <Eye className="mr-2 h-4 w-4" />
            Start Review
          </DropdownMenuItem>
        )}
        
        {currentStatus === 'under_review' && (
          <>
            <DropdownMenuItem onClick={() => onStatusChange('shortlisted')}>
              <CheckCircle2 className="mr-2 h-4 w-4 text-teal-500" />
              Shortlist
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange('approved')}>
              <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
              Approve
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange('negotiating')}>
              <MessageSquare className="mr-2 h-4 w-4 text-purple-500" />
              Negotiate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange('rejected')}>
              <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
              Reject
            </DropdownMenuItem>
          </>
        )}
        
        {currentStatus === 'negotiating' && (
          <>
            <DropdownMenuItem onClick={() => onStatusChange('shortlisted')}>
              <CheckCircle2 className="mr-2 h-4 w-4 text-teal-500" />
              Shortlist
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange('approved')}>
              <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
              Approve
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange('rejected')}>
              <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
              Reject
            </DropdownMenuItem>
          </>
        )}
        
        {currentStatus === 'shortlisted' && (
          <>
            <DropdownMenuItem onClick={() => onStatusChange('approved')}>
              <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
              Approve
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange('under_review')}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Back to Review
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange('rejected')}>
              <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
              Reject
            </DropdownMenuItem>
          </>
        )}
        
        {currentStatus === 'approved' && (
          <DropdownMenuItem onClick={() => onStatusChange('under_review')}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Re-review
          </DropdownMenuItem>
        )}
        
        {currentStatus === 'rejected' && (
          <DropdownMenuItem onClick={() => onStatusChange('under_review')}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Re-review
          </DropdownMenuItem>
        )}

        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Quote
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

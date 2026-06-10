import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SupplierMaterialStatus } from '@/hooks/useSupplierMaterials';

interface SupplierMaterialStatusBadgeProps {
  status: SupplierMaterialStatus;
  className?: string;
}

const statusConfig: Record<SupplierMaterialStatus, { label: string; className: string }> = {
  submitted: {
    label: 'Submitted',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  under_review: {
    label: 'Under Review',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  negotiating: {
    label: 'Negotiating',
    className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  shortlisted: {
    label: 'Shortlisted',
    className: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-muted text-muted-foreground border-border/50',
  },
};

export function SupplierMaterialStatusBadge({ status, className }: SupplierMaterialStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.submitted;
  
  return (
    <Badge
      variant="outline"
      className={cn('font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  );
}

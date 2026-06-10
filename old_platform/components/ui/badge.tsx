import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-pill border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "text-foreground border-border/50 bg-white/50 dark:bg-card/50",
        success: "border-transparent bg-success/15 text-success dark:bg-success/20",
        warning: "border-transparent bg-accent/15 text-accent dark:bg-accent/20",
        // Status variants - Orange for Open/Action, Green for Closed
        statusOpen: "border-status-open/30 bg-status-open/15 text-status-open font-semibold",
        statusQuotation: "border-status-quotation/30 bg-status-quotation/15 text-status-quotation font-semibold",
        statusClosed: "border-status-closed/30 bg-status-closed/15 text-status-closed font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

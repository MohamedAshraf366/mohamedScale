import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  to: string;
  title: string;
  icon: React.ElementType;
  active?: boolean;
  onClick?: () => void;
};

export function SidebarNavItem({ to, title, icon: Icon, active, onClick }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={to}
          onClick={onClick}
          className={cn(
            "flex h-8 items-center rounded-md transition-colors",
            "text-sidebar-foreground/80",
            "hover:bg-sidebar-accent hover:text-sidebar-foreground",
            active && "bg-sidebar-accent text-sidebar-foreground",
            "px-1.5"
          )}
        >
          {/* icon slot: fixed width keeps alignment perfect */}
          <span className="w-8 grid place-items-center shrink-0">
            <Icon className="h-4 w-4" />
          </span>

          {/* label: take no width when collapsed, expand smoothly on hover */}
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap text-sm font-normal",
              "opacity-0 max-w-0",
              "group-hover/sidebar:opacity-100 group-hover/sidebar:max-w-[140px]",
              "transition-[opacity,max-width] duration-150"
            )}
          >
            {title}
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="group-hover/sidebar:hidden">
        {title}
      </TooltipContent>
    </Tooltip>
  );
}

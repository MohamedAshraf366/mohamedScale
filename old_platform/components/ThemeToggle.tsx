import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface ThemeToggleProps {
  collapsed?: boolean;
  showLabel?: boolean;
  isRTL?: boolean;
}

export function ThemeToggle({ collapsed = false, showLabel = true, isRTL = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 px-3 py-2.5 h-auto text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground rounded-lg"
            onClick={toggleTheme}
          >
            <Sun className="h-5 w-5 flex-shrink-0 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 flex-shrink-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            {showLabel && (
              <span className={cn(
                "text-sm whitespace-nowrap transition-opacity duration-200",
                collapsed ? "opacity-0 group-hover:opacity-100" : "opacity-100"
              )}>
                {theme === "dark" ? t('theme.light', 'Light Mode') : t('theme.dark', 'Dark Mode')}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        {collapsed && (
          <TooltipContent 
            side={isRTL ? 'left' : 'right'} 
            className="bg-sidebar text-sidebar-foreground border-sidebar-border group-hover:hidden"
            sideOffset={8}
          >
            {theme === "dark" ? t('theme.light', 'Light Mode') : t('theme.dark', 'Dark Mode')}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

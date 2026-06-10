import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  GitCompareArrows,
  Home,
  Users,
  BarChart3,
  Kanban,
  Boxes,
  Building2,
  ShoppingCart,
  Truck,
  ScrollText,
  ShieldCheck,
  Settings,
  LogOut,
  Sun,
  Moon,
  User,
  ListChecks,
  PackageSearch,
  Bot,
  Map,
  MapPin,
  Hash,
  FileText,
  Unlock,
  Handshake,
  CircleDollarSign,
  Layers,
  ShieldAlert,
  ClockAlert,
  RefreshCcw,
  FlaskConical,
  LayoutDashboard,
  Beaker,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";

import { cn } from "@/lib/utils";
import logoHorizontal from "@/assets/scale-logo-horizontal.svg";
import logoVertical from "@/assets/scale-logo-vertical.svg";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarNavItem } from "@/components/layout/sidebar/SidebarNavItem";
import { SandboxToggle } from "@/components/layout/SandboxToggle";
import type { ModuleConfig, ModuleKey } from "@/components/layout/sidebar/sidebar-types";

const isRouteActive = (currentPath: string, itemUrl: string) => {
  if (itemUrl === "/") return currentPath === "/";
  return currentPath.startsWith(itemUrl);
};

function getModuleForPath(pathname: string): ModuleKey | null {
  if (pathname.startsWith("/sales")) return "sales";
  if (["/materials", "/suppliers", "/supplier-materials", "/supply"].some((p) => pathname.startsWith(p))) return "supply";
  if (["/orders", "/deliveries"].some((p) => pathname.startsWith(p))) return "operations";
  if (pathname.startsWith("/admin") || pathname.startsWith("/settings")) return "admin";
  return null;
}

export function SmartSidebar() {
  const location = useLocation();
  const { signOut, user, profile } = useAuth();
  const { theme, setTheme } = useTheme();
  
  const [activeModule, setActiveModule] = useState<ModuleKey | null>(null);

  const modules: ModuleConfig[] = useMemo(
    () => [
      {
        key: "sales",
        label: "Sales",
        icon: Handshake,
        activeClassName: "bg-primary/20 text-primary",
        items: [
          { title: "Dashboard", url: "/sales/dashboard", icon: CircleDollarSign },
          { title: "Pipeline", url: "/sales/pipeline", icon: Kanban },
          { title: "Tasks", url: "/sales/tasks", icon: ListChecks },
          { title: "Customers", url: "/sales/customers", icon: Users },
          { title: "Migration Compare", url: "/sales/migration-compare", icon: GitCompareArrows },
        ],
      },
      {
        key: "supply",
        label: "Supply",
        icon: Layers,
        activeClassName: "bg-emerald-500/20 text-emerald-500",
        items: [
          { title: "Dashboard", url: "/supply/dashboard", icon: LayoutDashboard },
          { title: "Domains", url: "/supply/domains", icon: Layers },
          { title: "Coverage", url: "/supply/coverage", icon: MapPin },
          { title: "Quotations", url: "/supplier-materials", icon: PackageSearch },
          { title: "Suppliers", url: "/suppliers", icon: Building2 },
          { title: "Materials", url: "/materials", icon: Boxes },
          { title: "Cycles (paused)", url: "/supply/unlock", icon: Unlock },
        ],
      },
      {
        key: "operations",
        label: "Operations",
        icon: ShoppingCart,
        activeClassName: "bg-blue-500/20 text-blue-500",
        items: [
          { title: "Orders", url: "/orders", icon: ShoppingCart },
          { title: "Deliveries", url: "/deliveries", icon: Truck },
        ],
      },
      {
        key: "admin",
        label: "Admin",
        icon: ShieldCheck,
        activeClassName: "bg-violet-500/20 text-violet-500",
        items: [
          { title: "Agent Actions", url: "/admin/agent-actions", icon: Bot },
          { title: "Agent Schema", url: "/admin/agent-schema", icon: Bot },
          { title: "Audit Log", url: "/admin/audit", icon: ScrollText },
          { title: "Users", url: "/admin/users", icon: Users },
          { title: "Margins", url: "/admin/margins", icon: CircleDollarSign },
          { title: "Regions & Zones", url: "/admin/regions-zones", icon: Map },
          { title: "Coding System", url: "/admin/coding-system", icon: Hash },
          { title: "Quote Templates", url: "/admin/quote-templates", icon: FileText },
          { title: "WhatsApp Test Panel", url: "/admin/whatsapp-test", icon: FlaskConical },
          { title: "Sandbox", url: "/admin/sandbox", icon: Beaker },
          { title: "Settings", url: "/settings", icon: Settings },
        ],
      },
    ],
    []
  );

  // Always keep the current section expanded based on route.
  useEffect(() => {
    const derived = getModuleForPath(location.pathname);
    setActiveModule(derived);
  }, [location.pathname]);

  const activeModuleConfig = modules.find((m) => m.key === activeModule);
  const isHomeActive = location.pathname === "/";

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "group/sidebar fixed left-0 top-0 z-40 flex h-screen flex-col overflow-hidden border-r",
          "w-[56px] hover:w-56",
          "transition-all duration-200 ease-out",
          "bg-sidebar text-sidebar-foreground border-sidebar-border"
        )}
      >
        {/* Logo */}
        <div className="px-3 py-3 h-12 flex items-center">
          <Link to="/" className="flex items-center relative h-6 w-full">
            <img
              src={logoVertical}
              alt="Scale"
              className="h-6 w-auto absolute left-0 opacity-100 group-hover/sidebar:opacity-0 transition-opacity duration-150"
              loading="eager"
            />
            <img
              src={logoHorizontal}
              alt="Scale"
              className="h-6 w-auto absolute left-0 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150"
              loading="eager"
            />
          </Link>
        </div>

        <div className="flex-1 px-1.5 py-1 overflow-y-auto overflow-x-hidden">
          {/* Home */}
          <div className="mb-1.5">
            <SidebarNavItem
              to="/"
              title="Home"
              icon={Home}
              active={isHomeActive}
              onClick={() => setActiveModule(null)}
            />
          </div>

          {/* Section Tabs */}
          <div className="flex flex-col group-hover/sidebar:flex-row items-center justify-center group-hover/sidebar:justify-start gap-0.5 px-0.5 mb-1.5 transition-all duration-150">
            {modules.map((module) => {
              const Icon = module.icon;
              const isActive = activeModule === module.key;
              return (
                <Tooltip key={module.key}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setActiveModule(module.key)}
                      className={cn(
                        "h-8 w-8 rounded-md grid place-items-center transition-all duration-150",
                        "text-sidebar-foreground/80",
                        "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                        isActive && module.activeClassName
                      )}
                      aria-label={module.label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="group-hover/sidebar:hidden">
                    {module.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Section Items */}
          {activeModuleConfig && (
            <div className="py-0.5">
              <div
                className={cn(
                  "text-[9px] font-medium tracking-wide uppercase px-2 mb-1 whitespace-nowrap",
                  "text-sidebar-foreground/50",
                  "opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150"
                )}
              >
                {activeModuleConfig.label}
              </div>

              <nav className="space-y-0.5">
                {activeModuleConfig.items.map((item) => (
                  <SidebarNavItem
                    key={item.url + item.title}
                    to={item.url}
                    title={item.title}
                    icon={item.icon}
                    active={isRouteActive(location.pathname, item.url)}
                  />
                ))}
              </nav>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-1.5 mt-auto space-y-0.5">
          {/* Theme Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className={cn(
                  "flex h-8 items-center rounded-md transition-colors",
                  "text-sidebar-foreground/80",
                  "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  "px-1.5 w-full"
                )}
              >
                <span className="w-8 grid place-items-center shrink-0">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </span>
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap text-sm font-normal",
                    "opacity-0 max-w-0",
                    "group-hover/sidebar:opacity-100 group-hover/sidebar:max-w-[140px]",
                    "transition-[opacity,max-width] duration-150"
                  )}
                >
                  {theme === "dark" ? "Light" : "Dark"}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="group-hover/sidebar:hidden">
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </TooltipContent>
          </Tooltip>



          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/profile"
                className={cn(
                  "flex h-8 items-center rounded-md transition-colors",
                  "text-sidebar-foreground/80",
                  "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  "px-1.5"
                )}
              >
                <span className="w-8 grid place-items-center shrink-0">
                  <User className="h-4 w-4" />
                </span>
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap text-sm font-normal truncate",
                    "opacity-0 max-w-0",
                    "group-hover/sidebar:opacity-100 group-hover/sidebar:max-w-[140px]",
                    "transition-[opacity,max-width] duration-150"
                  )}
                >
                  {profile?.full_name || user?.email || "Profile"}
                </span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="group-hover/sidebar:hidden">
              {profile?.full_name || user?.email || "Profile"}
            </TooltipContent>
          </Tooltip>

          {/* Sandbox toggle (admin-only, renders nothing for others) */}
          <div className="px-1.5 group-hover/sidebar:block hidden">
            <SandboxToggle />
          </div>

          {/* Sign out */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={signOut}
                className={cn(
                  "flex h-8 items-center rounded-md transition-colors",
                  "text-sidebar-foreground/60",
                  "hover:bg-destructive/10 hover:text-destructive",
                  "px-1.5 w-full"
                )}
              >
                <span className="w-8 grid place-items-center shrink-0">
                  <LogOut className="h-4 w-4" />
                </span>
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap text-sm font-normal",
                    "opacity-0 max-w-0",
                    "group-hover/sidebar:opacity-100 group-hover/sidebar:max-w-[140px]",
                    "transition-[opacity,max-width] duration-150"
                  )}
                >
                  Sign Out
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="group-hover/sidebar:hidden">
              Sign Out
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}

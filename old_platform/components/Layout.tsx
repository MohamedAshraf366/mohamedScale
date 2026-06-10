import { ReactNode, useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  LayoutDashboard, 
  Package, 
  Building2, 
  MessageSquare, 
  CheckSquare,
  TrendingUp,
  LogOut,
  BarChart3,
  Users,
  LineChart,
  Languages,
  History,
  Home,
  Target,
  Truck,
  Bell,
  Menu,
  Rocket,
  X,
  RefreshCw,
  Shield,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import scaleLogoHorizontal from '@/assets/scale-logo-orange.svg';
import scaleLogoVertical from '@/assets/scale-logo-vertical.svg';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import FollowUpNotifications from '@/components/FollowUpNotifications';
import { useDeviceType } from '@/hooks/useDeviceType';
import { SafeRenderWrapper } from '@/components/SafeRenderWrapper';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { ThemeToggle } from '@/components/ThemeToggle';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const Layout = ({ children }: LayoutProps) => {
  const { signOut, user, userRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isAdmin = userRole === 'admin';
  const isRTL = i18n.language === 'ar';
  const { isTablet, isMobile, isReady } = useDeviceType();
  
  // Mobile/Tablet sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Swipe gesture handlers
  const handleSwipeRight = useCallback(() => {
    if ((isMobile || isTablet) && !sidebarOpen) {
      // For RTL, swipe right closes sidebar
      if (isRTL) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    }
  }, [isMobile, isTablet, sidebarOpen, isRTL]);

  const handleSwipeLeft = useCallback(() => {
    if ((isMobile || isTablet) && sidebarOpen) {
      // For RTL, swipe left opens sidebar
      if (isRTL) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    }
  }, [isMobile, isTablet, sidebarOpen, isRTL]);

  // Enable swipe gestures on mobile/tablet only
  useSwipeGesture({
    onSwipeRight: handleSwipeRight,
    onSwipeLeft: handleSwipeLeft,
    threshold: 50,
    edgeThreshold: 30,
    enabled: isMobile || isTablet,
  });
  
  // Close sidebar on navigation for mobile/tablet
  useEffect(() => {
    if (isMobile || isTablet) {
      setSidebarOpen(false);
    }
  }, [location.pathname, isMobile, isTablet]);
  
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [isRTL, i18n.language]);
  
  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en');
  };

  // Define route paths for each section
  const salesRoutes = ['/dashboard', '/scale-kpis', '/clients', '/client-profile', '/tasks', '/pipeline'];
  const supplyRoutes = ['/materials', '/suppliers', '/suppliers-map', '/supply-dashboard', '/supply-analytics', '/logistics', '/supply', '/supply/materials', '/supply/unlock', '/supply/confirmations', '/supply/renegotiations', '/supply/issues'];
  const operationsRoutes = ['/operations', '/logistics'];
  const adminRoutes = ['/admin', '/audit-log', '/user-management', '/notification-settings'];

  // Determine active section based on current route
  const getActiveSection = (): 'sales' | 'supply' | 'operations' | 'admin' | 'home' => {
    if (location.pathname.startsWith('/admin')) return 'admin';
    if (adminRoutes.some(route => location.pathname.startsWith(route))) return 'admin';
    if (operationsRoutes.some(route => location.pathname.startsWith(route))) return 'operations';
    if (supplyRoutes.some(route => location.pathname.startsWith(route))) return 'supply';
    if (salesRoutes.some(route => location.pathname.startsWith(route))) return 'sales';
    return 'home';
  };

  const activeSection = getActiveSection();

  const salesGroup: NavGroup = {
    label: t('nav.salesGroup', 'SALES'),
    items: [
      { path: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
      { path: '/clients', label: t('nav.clientsOpportunities', 'Clients & Opportunities'), icon: Users },
      { path: '/tasks', label: t('nav.tasksList'), icon: CheckSquare },
      { path: '/pipeline', label: t('nav.pipeline'), icon: TrendingUp },
    ],
  };

  const supplyGroup: NavGroup = {
    label: t('nav.supplyGroup', 'SUPPLY'),
    items: [
      { path: '/supply-dashboard', label: t('nav.supplyDashboard', 'Dashboard'), icon: LayoutDashboard },
      { path: '/supply', label: t('nav.supplyOverview', 'Supply Overview'), icon: Target },
      { path: '/supply/materials', label: t('nav.supplyMaterials', 'Supply Materials'), icon: Package },
      { path: '/supply/renegotiations', label: t('nav.renegotiations', 'Renegotiations'), icon: RefreshCw },
      { path: '/supply/issues', label: t('nav.issueTracker', 'Issue Tracker'), icon: AlertTriangle },
      { path: '/supply-analytics', label: t('nav.supplyAnalytics', 'Supply Analytics'), icon: BarChart3 },
      { path: '/materials', label: t('nav.materials'), icon: Package },
      { path: '/suppliers', label: t('nav.suppliersManufacturers', 'Suppliers & Manufacturers'), icon: Building2 },
    ],
  };

  const operationsGroup: NavGroup = {
    label: t('nav.operationsGroup', 'OPERATIONS'),
    items: [
      { path: '/operations', label: t('nav.operations', 'Operations'), icon: Settings },
      { path: '/logistics', label: t('nav.logistics', 'Logistics'), icon: Truck },
    ],
  };

  const adminGroup: NavGroup = {
    label: t('nav.adminGroup', 'ADMIN'),
    items: [
      { path: '/admin/quarterly-plans', label: t('admin.quarterlyPlans', 'Quarterly Dev Plans'), icon: BarChart3 },
      { path: '/admin/issues-risks', label: t('admin.issuesRisks', 'Issues & Risks'), icon: AlertTriangle },
      { path: '/admin/approvals', label: t('admin.managementApprovals', 'Management Approvals'), icon: CheckSquare },
      { path: '/admin/feature-pipeline', label: t('admin.featurePipeline', 'Feature Pipeline'), icon: Rocket },
      { path: '/audit-log', label: t('nav.auditLog'), icon: History },
      { path: '/notification-settings', label: t('nav.notificationSettings', 'Notifications'), icon: Bell },
      ...(isAdmin ? [{ path: '/user-management', label: t('nav.userManagement'), icon: Users }] : []),
    ],
  };

  // Show only the active section's nav items
  const getVisibleNavGroups = (): NavGroup[] => {
    if (activeSection === 'home') {
      return [];
    }
    if (activeSection === 'sales') {
      return [salesGroup];
    }
    if (activeSection === 'supply') {
      return [supplyGroup];
    }
    if (activeSection === 'operations') {
      return [operationsGroup];
    }
    if (activeSection === 'admin') {
      return [adminGroup];
    }
    return [];
  };

  const navGroups = getVisibleNavGroups();

  const isActive = (path: string) => location.pathname === path;
  const isOnHub = location.pathname === '/';


  // Determine sidebar behavior based on device
  const shouldShowOverlay = isMobile || isTablet;
  const sidebarVisible = shouldShowOverlay ? sidebarOpen : true;

  // Safe render check - show loading state if device info not ready
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const SidebarContent = () => (
    <>
      {/* Logo Section with Home Button */}
      <div className="p-4 border-b border-sidebar-border/30 flex items-center justify-between h-[80px] relative overflow-hidden">
        {/* Close button for mobile/tablet */}
        {shouldShowOverlay && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground/75 z-10"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        
        {/* Home Button - shown when collapsed (desktop only) */}
        {!shouldShowOverlay && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/"
                  className={cn(
                    "absolute transition-all duration-200 ease-out opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-90",
                    isOnHub && "ring-2 ring-primary/50 rounded-lg"
                  )}
                >
                  <img 
                    src={scaleLogoVertical} 
                    alt="Scale" 
                    className="h-14 w-auto"
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent 
                side={isRTL ? 'left' : 'right'} 
                className="bg-sidebar text-sidebar-foreground border-sidebar-border"
                sideOffset={8}
              >
                {t('nav.home', 'Home')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {/* Expanded state - Logo with Home link */}
        <Link
          to="/"
          className={cn(
            "transition-all duration-200 ease-out flex items-center gap-2",
            shouldShowOverlay 
              ? "opacity-100 scale-100" 
              : "absolute opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
          )}
        >
          <img 
            src={scaleLogoHorizontal} 
            alt="Scale" 
            className="h-8 w-auto"
          />
        </Link>
      </div>

      {/* Home Button with Section Badge */}
      <div className="px-2 pt-4 pb-2">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/"
                onClick={() => shouldShowOverlay && setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  isOnHub
                    ? 'bg-sidebar-accent text-sidebar-foreground'
                    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <Home className={cn(
                  "h-5 w-5 flex-shrink-0 transition-transform duration-200 hover:scale-110",
                  isOnHub && 'text-sidebar-primary'
                )} />
                <span className={cn(
                  "font-medium text-sm whitespace-nowrap transition-opacity duration-200",
                  shouldShowOverlay ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  {t('nav.home', 'Home')}
                </span>
              </Link>
            </TooltipTrigger>
            {!shouldShowOverlay && (
              <TooltipContent 
                side={isRTL ? 'left' : 'right'} 
                className="bg-sidebar text-sidebar-foreground border-sidebar-border group-hover:hidden"
                sideOffset={8}
              >
                {t('nav.home', 'Home')}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Section Switch Icons - Stacked vertically when collapsed */}
        <div className={cn(
          "mt-3 mx-1 flex flex-col gap-1 p-1 bg-sidebar-accent/30 rounded-lg transition-all duration-200",
          shouldShowOverlay ? "flex-row" : "group-hover:flex-row"
        )}>
          {[
            { value: 'sales', label: t('nav.salesBadge', 'Sales'), icon: TrendingUp, color: 'text-primary bg-primary/20', route: '/dashboard' },
            { value: 'supply', label: t('nav.supplyBadge', 'Supply'), icon: Package, color: 'text-emerald-500 bg-emerald-500/20', route: '/materials' },
            { value: 'operations', label: t('nav.operationsBadge', 'Operations'), icon: Settings, color: 'text-orange-500 bg-orange-500/20', route: '/operations' },
            { value: 'admin', label: t('nav.adminBadge', 'Admin'), icon: Shield, color: 'text-violet-500 bg-violet-500/20', route: '/admin/quarterly-plans' },
          ].map((section) => {
            const Icon = section.icon;
            const isActiveSection = activeSection === section.value;
            
            return (
              <TooltipProvider key={section.value} delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={section.route}
                      onClick={() => {
                        localStorage.setItem('scale-last-section', section.value);
                        if (shouldShowOverlay) setSidebarOpen(false);
                      }}
                      className={cn(
                        'p-2 rounded-md transition-all flex-shrink-0',
                        isActiveSection
                          ? section.color
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent 
                    side={isRTL ? 'left' : 'right'} 
                    className="bg-sidebar text-sidebar-foreground border-sidebar-border"
                    sideOffset={8}
                  >
                    {section.label}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
      
      {/* Navigation Groups */}
      <nav className="flex-1 py-2 px-2 space-y-4 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {navGroups.map((group, groupIndex) => (
          <div 
            key={group.label} 
            className="animate-fade-in"
            style={{ animationDelay: `${groupIndex * 50}ms`, animationFillMode: 'both' }}
          >
            {/* Group Label - only visible when expanded */}
            <div className={cn(
              "px-3 py-2 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider transition-opacity duration-200 whitespace-nowrap overflow-hidden",
              shouldShowOverlay ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              {group.label}
            </div>
            
            {/* Group Items */}
            <div className="space-y-1">
              {group.items.map((item, itemIndex) => (
                <TooltipProvider key={item.path} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.path}
                        onClick={() => shouldShowOverlay && setSidebarOpen(false)}
                        className={cn(
                          "group/nav flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 animate-fade-in",
                          isActive(item.path)
                            ? 'bg-sidebar-accent text-sidebar-foreground'
                            : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                        )}
                        style={{ animationDelay: `${(groupIndex * 50) + (itemIndex * 30)}ms`, animationFillMode: 'both' }}
                      >
                        <item.icon className={cn(
                          "h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover/nav:scale-110",
                          isActive(item.path) && 'text-sidebar-primary'
                        )} />
                        <span className={cn(
                          "font-medium text-sm whitespace-nowrap transition-opacity duration-200",
                          shouldShowOverlay ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}>
                          {item.label}
                        </span>
                      </Link>
                    </TooltipTrigger>
                    {!shouldShowOverlay && (
                      <TooltipContent 
                        side={isRTL ? 'left' : 'right'} 
                        className="bg-sidebar text-sidebar-foreground border-sidebar-border group-hover:hidden"
                        sideOffset={8}
                      >
                        {item.label}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="p-2 border-t border-sidebar-border/30 space-y-1">
        {/* Notification Bell */}
        <div className={cn(
          "flex px-1 py-1",
          shouldShowOverlay ? "justify-start" : "justify-center group-hover:justify-start"
        )}>
          <FollowUpNotifications />
        </div>
        {/* Language Toggle */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-3 py-2.5 h-auto text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground rounded-lg"
                onClick={toggleLanguage}
              >
                <Languages className="h-5 w-5 flex-shrink-0" />
                <span className={cn(
                  "text-sm whitespace-nowrap transition-opacity duration-200",
                  shouldShowOverlay ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  {i18n.language === 'en' ? 'العربية' : 'English'}
                </span>
              </Button>
            </TooltipTrigger>
            {!shouldShowOverlay && (
              <TooltipContent 
                side={isRTL ? 'left' : 'right'} 
                className="bg-sidebar text-sidebar-foreground border-sidebar-border group-hover:hidden"
                sideOffset={8}
              >
                {i18n.language === 'en' ? 'العربية' : 'English'}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Theme Toggle */}
        <ThemeToggle collapsed={!shouldShowOverlay} showLabel={true} isRTL={isRTL} />

        {/* User Email - only when expanded */}
        <div className={cn(
          "px-3 py-2 text-xs text-sidebar-foreground/50 truncate transition-opacity duration-200",
          shouldShowOverlay ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          {user?.email}
        </div>

        {/* Sign Out */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-3 py-2.5 h-auto text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground rounded-lg"
                onClick={signOut}
              >
                <LogOut className="h-5 w-5 flex-shrink-0" />
                <span className={cn(
                  "text-sm whitespace-nowrap transition-opacity duration-200",
                  shouldShowOverlay ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  {t('nav.signOut')}
                </span>
              </Button>
            </TooltipTrigger>
            {!shouldShowOverlay && (
              <TooltipContent 
                side={isRTL ? 'left' : 'right'} 
                className="bg-sidebar text-sidebar-foreground border-sidebar-border group-hover:hidden"
                sideOffset={8}
              >
                {t('nav.signOut')}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </>
  );

  return (
    <div className="min-h-[100dvh] flex w-full overflow-hidden">
      {/* Mobile/Tablet Overlay */}
      {shouldShowOverlay && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Mobile/Tablet Menu Button */}
      {shouldShowOverlay && (
        <button
          onClick={() => setSidebarOpen(true)}
          className={cn(
            "fixed top-4 z-30 p-3 bg-sidebar text-sidebar-foreground rounded-lg shadow-lg transition-all duration-300",
            isRTL ? "right-4" : "left-4",
            sidebarOpen && "opacity-0 pointer-events-none"
          )}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Swipe Indicator - Shows edge hint on mobile/tablet */}
      {shouldShowOverlay && !sidebarOpen && (
        <div 
          className={cn(
            "fixed top-1/2 -translate-y-1/2 z-20 w-1 h-16 rounded-full bg-primary/30 transition-opacity duration-300",
            isRTL ? "right-0" : "left-0"
          )}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-sidebar flex flex-col transition-all duration-300 ease-out",
          shouldShowOverlay 
            ? cn(
                "fixed inset-y-0 z-50 w-64 transform shadow-2xl",
                isRTL ? "right-0" : "left-0",
                sidebarOpen 
                  ? "translate-x-0" 
                  : isRTL ? "translate-x-full" : "-translate-x-full"
              )
            : "group w-[72px] hover:w-64 overflow-hidden"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden gradient-bg scroll-container-primary",
          shouldShowOverlay && "w-full",
          // Add top padding for mobile/tablet to account for menu button
          shouldShowOverlay && "pt-16",
          // Tablet should not be full-bleed
          isTablet && "px-6"
        )}
      >
        <SafeRenderWrapper>
          <div className="min-h-full animate-page-enter">
            {children}
          </div>
        </SafeRenderWrapper>
      </main>
    </div>
  );
};

export default Layout;

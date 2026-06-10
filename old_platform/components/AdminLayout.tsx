import { ReactNode, useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  LogOut,
  Languages,
  Home,
  Menu,
  X,
  Calendar,
  AlertTriangle,
  CheckSquare,
  Rocket,
  Shield,
  ChevronLeft,
  TrendingUp,
  Package,
  Settings,
  Workflow,
} from 'lucide-react';
import scaleLogoHorizontal from '@/assets/scale-logo-orange.svg';
import scaleLogoVertical from '@/assets/scale-logo-vertical.svg';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useDeviceType } from '@/hooks/useDeviceType';
import { SafeRenderWrapper } from '@/components/SafeRenderWrapper';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';

interface AdminLayoutProps {
  children: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hasBadge?: boolean;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { signOut, user, userRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { isTablet, isMobile, isReady } = useDeviceType();
  
  // Mobile/Tablet sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Real-time pending approvals count for badge
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  
  // Fetch pending approvals count
  useEffect(() => {
    const fetchPendingCount = async () => {
      const { count } = await supabase
        .from('material_renegotiations')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'pending_management');
      
      setPendingApprovalsCount(count || 0);
    };

    fetchPendingCount();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('admin-approvals')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'material_renegotiations',
        },
        () => {
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  
  // Swipe gesture handlers
  const handleSwipeRight = useCallback(() => {
    if ((isMobile || isTablet) && !sidebarOpen) {
      if (isRTL) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    }
  }, [isMobile, isTablet, sidebarOpen, isRTL]);

  const handleSwipeLeft = useCallback(() => {
    if ((isMobile || isTablet) && sidebarOpen) {
      if (isRTL) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    }
  }, [isMobile, isTablet, sidebarOpen, isRTL]);

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

  // Section switch options (unified across all sidebars)
  const appSections = [
    { value: 'sales', label: t('nav.salesBadge', 'Sales'), icon: TrendingUp, color: 'text-primary bg-primary/20', route: '/dashboard' },
    { value: 'supply', label: t('nav.supplyBadge', 'Supply'), icon: Package, color: 'text-emerald-500 bg-emerald-500/20', route: '/materials' },
    { value: 'operations', label: t('nav.operationsBadge', 'Operations'), icon: Settings, color: 'text-orange-500 bg-orange-500/20', route: '/logistics' },
    { value: 'admin', label: t('nav.adminBadge', 'Admin'), icon: Shield, color: 'text-violet-500 bg-violet-500/20', route: '/admin/quarterly-plans' },
  ];

  const navItems: NavItem[] = [
    { 
      path: '/admin/process', 
      label: t('admin.processImprovement', 'Process Improvement'), 
      icon: Workflow 
    },
    { 
      path: '/admin/quarterly-plans', 
      label: t('admin.quarterlyPlans', 'Quarterly Dev Plans'), 
      icon: Calendar 
    },
    { 
      path: '/admin/issues-risks', 
      label: t('admin.issuesRisks', 'Issues & Risks'), 
      icon: AlertTriangle 
    },
    { 
      path: '/admin/approvals', 
      label: t('admin.managementApprovals', 'Management Approvals'), 
      icon: CheckSquare,
      hasBadge: true 
    },
    { 
      path: '/admin/feature-pipeline', 
      label: t('admin.featurePipeline', 'Feature Pipeline'), 
      icon: Rocket 
    },
  ];

  const isActive = (path: string) => location.pathname === path;

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
                  className="absolute transition-all duration-200 ease-out opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-90"
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

      {/* Back to Home + Admin Badge */}
      <div className="px-2 pt-4 pb-2">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/"
                onClick={() => shouldShowOverlay && setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <ChevronLeft className="h-5 w-5 flex-shrink-0 transition-transform duration-200 hover:scale-110" />
                <span className={cn(
                  "font-medium text-sm whitespace-nowrap transition-opacity duration-200",
                  shouldShowOverlay ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  {t('nav.backToHome', 'Back to Home')}
                </span>
              </Link>
            </TooltipTrigger>
            {!shouldShowOverlay && (
              <TooltipContent 
                side={isRTL ? 'left' : 'right'} 
                className="bg-sidebar text-sidebar-foreground border-sidebar-border group-hover:hidden"
                sideOffset={8}
              >
                {t('nav.backToHome', 'Back to Home')}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Section Switch Icons - Stacked vertically when collapsed */}
        <div className={cn(
          "mt-3 mx-1 flex flex-col gap-1 p-1 bg-sidebar-accent/30 rounded-lg transition-all duration-200",
          shouldShowOverlay ? "flex-row" : "group-hover:flex-row"
        )}>
          {appSections.map((section) => {
            const Icon = section.icon;
            const isActiveSection = section.value === 'admin'; // Admin is always active in AdminLayout
            
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
      
      {/* Navigation Group */}
      <nav className="flex-1 py-2 px-2 space-y-4 overflow-y-auto overflow-x-hidden scrollbar-thin">
        <div className="animate-fade-in">
          {/* Group Label */}
          <div className={cn(
            "px-3 py-2 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider transition-opacity duration-200 whitespace-nowrap overflow-hidden",
            shouldShowOverlay ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            {t('admin.sectionTitle', 'ADMIN')}
          </div>
          
          {/* Nav Items */}
          <div className="space-y-1">
            {navItems.map((item, itemIndex) => (
              <TooltipProvider key={item.path} delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.path}
                      onClick={() => shouldShowOverlay && setSidebarOpen(false)}
                      className={cn(
                        "group/nav flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 animate-fade-in relative",
                        isActive(item.path)
                          ? 'bg-sidebar-accent text-sidebar-foreground'
                          : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      )}
                      style={{ animationDelay: `${itemIndex * 30}ms`, animationFillMode: 'both' }}
                    >
                      <div className="relative">
                        <item.icon className={cn(
                          "h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover/nav:scale-110",
                          isActive(item.path) && 'text-sidebar-primary'
                        )} />
                        {/* Red dot badge for Management Approvals */}
                        {item.hasBadge && pendingApprovalsCount > 0 && (
                          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-destructive rounded-full animate-pulse" />
                        )}
                      </div>
                      <span className={cn(
                        "font-medium text-sm whitespace-nowrap transition-opacity duration-200",
                        shouldShowOverlay ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}>
                        {item.label}
                      </span>
                      {/* Badge count when expanded */}
                      {item.hasBadge && pendingApprovalsCount > 0 && (
                        <span className={cn(
                          "ml-auto text-xs font-semibold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full transition-opacity duration-200",
                          shouldShowOverlay ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}>
                          {pendingApprovalsCount}
                        </span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  {!shouldShowOverlay && (
                    <TooltipContent 
                      side={isRTL ? 'left' : 'right'} 
                      className="bg-sidebar text-sidebar-foreground border-sidebar-border group-hover:hidden"
                      sideOffset={8}
                    >
                      <span className="flex items-center gap-2">
                        {item.label}
                        {item.hasBadge && pendingApprovalsCount > 0 && (
                          <span className="text-xs font-semibold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
                            {pendingApprovalsCount}
                          </span>
                        )}
                      </span>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      </nav>

      {/* Footer Actions */}
      <div className="p-2 border-t border-sidebar-border/30 space-y-1">
        {/* Language Toggle */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleLanguage}
                className={cn(
                  "w-full justify-start gap-3 text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  !shouldShowOverlay && "px-3"
                )}
              >
                <Languages className="h-5 w-5 flex-shrink-0" />
                <span className={cn(
                  "font-medium text-sm whitespace-nowrap transition-opacity duration-200",
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
        <ThemeToggle 
          collapsed={!shouldShowOverlay} 
          showLabel={true}
          isRTL={isRTL}
        />

        {/* User Email */}
        {user && (
          <div className={cn(
            "px-3 py-2 text-xs text-sidebar-foreground/40 truncate transition-opacity duration-200",
            shouldShowOverlay ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            {user.email}
          </div>
        )}
        
        {/* Sign Out */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className={cn(
                  "w-full justify-start gap-3 text-sidebar-foreground/75 hover:bg-destructive/10 hover:text-destructive",
                  !shouldShowOverlay && "px-3"
                )}
              >
                <LogOut className="h-5 w-5 flex-shrink-0" />
                <span className={cn(
                  "font-medium text-sm whitespace-nowrap transition-opacity duration-200",
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
    <div className="min-h-screen bg-background flex w-full safe-container">
      {/* Overlay for mobile/tablet */}
      {shouldShowOverlay && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Mobile/Tablet menu button */}
      {shouldShowOverlay && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className={cn(
            "fixed top-4 z-30 p-2 rounded-lg bg-sidebar text-sidebar-foreground shadow-lg hover:bg-sidebar-accent transition-all duration-200",
            isRTL ? "right-4" : "left-4"
          )}
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Sidebar */}
      {sidebarVisible && (
        <aside
          className={cn(
            "bg-sidebar flex flex-col h-screen transition-all duration-300 ease-out group border-r border-sidebar-border/30",
            shouldShowOverlay
              ? cn(
                  "fixed top-0 bottom-0 z-50 w-64",
                  isRTL ? "right-0" : "left-0"
                )
              : "sticky top-0 w-16 hover:w-64"
          )}
        >
          <SidebarContent />
        </aside>
      )}

      {/* Main Content */}
      <main className={cn(
        "flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden",
        shouldShowOverlay && "pt-16"
      )}>
        <SafeRenderWrapper>
          <div className="w-full">
            {children}
          </div>
        </SafeRenderWrapper>
      </main>
    </div>
  );
};

export default AdminLayout;

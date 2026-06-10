import { useState, useEffect, Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoadingScreen from "@/components/LoadingScreen";
import { BackToTop } from "@/components/BackToTop";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";
import { PageSafeWrapper } from "@/components/SafeRenderWrapper";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Loader2 } from "lucide-react";

// Lazy load heavy pages for better tablet/mobile performance
const HomeHub = lazy(() => import("./pages/HomeHub"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Materials = lazy(() => import("./pages/Materials"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const SuppliersMap = lazy(() => import("./pages/SuppliersMap"));
const Communications = lazy(() => import("./pages/Communications"));
const ClientsOpportunities = lazy(() => import("./pages/ClientsOpportunities"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Pipeline = lazy(() => import("./pages/Pipeline"));

const AuditLog = lazy(() => import("./pages/AuditLog"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const ClientProfile = lazy(() => import("./pages/ClientProfile"));
const SupplyDashboard = lazy(() => import("./pages/SupplyDashboard"));
const SupplyAnalytics = lazy(() => import("./pages/SupplyAnalytics"));
const Logistics = lazy(() => import("./pages/Logistics"));
const SupplyOverview = lazy(() => import("./pages/SupplyOverview"));
const SupplyUnlock = lazy(() => import("./pages/SupplyUnlock"));
const SupplyConfirmations = lazy(() => import("./pages/SupplyConfirmations"));
const SupplyRenegotiations = lazy(() => import("./pages/SupplyRenegotiations"));
const SupplyMaterials = lazy(() => import("./pages/SupplyMaterials"));
const ManagementApproval = lazy(() => import("./pages/ManagementApproval"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));

const IssueResolutionDashboard = lazy(() => import("./pages/IssueResolutionDashboard"));
const AdminMigration = lazy(() => import("./pages/AdminMigration"));
const Operations = lazy(() => import("./pages/Operations"));
const AdminQuarterlyPlans = lazy(() => import("./pages/AdminQuarterlyPlans"));
const AdminIssuesRisks = lazy(() => import("./pages/AdminIssuesRisks"));
const AdminApprovals = lazy(() => import("./pages/AdminApprovals"));
const AdminFeaturePipeline = lazy(() => import("./pages/AdminFeaturePipeline"));
const AdminProcessImprovement = lazy(() => import("./pages/AdminProcessImprovement"));

const queryClient = new QueryClient();

// Page loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <PageSafeWrapper>
      {children}
    </PageSafeWrapper>
  );
};

const App = () => {
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);

  return (
    <>
      {showLoadingScreen && (
        <LoadingScreen 
          minDuration={2000} 
          onLoadingComplete={() => setShowLoadingScreen(false)} 
        />
      )}
    <ThemeProvider defaultTheme="system" storageKey="scale-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BackToTop />
          <ScrollProgressBar />
          <BrowserRouter>
            <AuthProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/auth" element={<PageSafeWrapper><Auth /></PageSafeWrapper>} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <HomeHub />
                      </ProtectedRoute>
                    }
                  />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supply-dashboard"
                  element={
                    <ProtectedRoute>
                      <SupplyDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supply"
                  element={
                    <ProtectedRoute>
                      <SupplyOverview />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supply/unlock"
                  element={
                    <ProtectedRoute>
                      <SupplyUnlock />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supply/confirmations"
                  element={
                    <ProtectedRoute>
                      <SupplyConfirmations />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supply/renegotiations"
                  element={
                    <ProtectedRoute>
                      <SupplyRenegotiations />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supply/management-approval"
                  element={
                    <ProtectedRoute>
                      <ManagementApproval />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supply/materials"
                  element={
                    <ProtectedRoute>
                      <SupplyMaterials />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/materials"
                  element={
                    <ProtectedRoute>
                      <Materials />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/suppliers"
                  element={
                    <ProtectedRoute>
                      <Suppliers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/suppliers-map"
                  element={
                    <ProtectedRoute>
                      <SuppliersMap />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supply-analytics"
                  element={
                    <ProtectedRoute>
                      <SupplyAnalytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/logistics"
                  element={
                    <ProtectedRoute>
                      <Logistics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/communications"
                  element={
                    <ProtectedRoute>
                      <Communications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clients"
                  element={
                    <ProtectedRoute>
                      <ClientsOpportunities />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tasks"
                  element={
                    <ProtectedRoute>
                      <Tasks />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pipeline"
                  element={
                    <ProtectedRoute>
                      <Pipeline />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/audit-log"
                  element={
                    <ProtectedRoute>
                      <AuditLog />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/user-management"
                  element={
                    <ProtectedRoute>
                      <UserManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/client-profile/:clientId"
                  element={
                    <ProtectedRoute>
                      <ClientProfile />
                    </ProtectedRoute>
                  }
                />
                  <Route
                    path="/notification-settings"
                    element={
                      <ProtectedRoute>
                        <NotificationSettings />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/supply/issues"
                    element={
                      <ProtectedRoute>
                        <IssueResolutionDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/migration"
                    element={
                      <ProtectedRoute>
                        <AdminMigration />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/operations"
                    element={
                      <ProtectedRoute>
                      <Operations />
                    </ProtectedRoute>
                  }
                />
                  <Route
                    path="/admin/quarterly-plans"
                    element={
                      <ProtectedRoute>
                        <AdminQuarterlyPlans />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/quarterly-plan"
                    element={
                      <ProtectedRoute>
                        <AdminQuarterlyPlans />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/issues-risks"
                    element={
                      <ProtectedRoute>
                        <AdminIssuesRisks />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/risks"
                    element={
                      <ProtectedRoute>
                        <AdminIssuesRisks />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/approvals"
                    element={
                      <ProtectedRoute>
                        <AdminApprovals />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/feature-pipeline"
                    element={
                      <ProtectedRoute>
                        <AdminFeaturePipeline />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/process"
                    element={
                      <ProtectedRoute>
                        <AdminProcessImprovement />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<PageSafeWrapper><NotFound /></PageSafeWrapper>} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
    </>
  );
};

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { SandboxProvider } from "@/contexts/SandboxContext";
import { SandboxBorder } from "@/components/layout/SandboxBorder";

import { ProtectedRoute } from "@/components/ProtectedRoute";

import { lazy, Suspense } from "react";

const queryClient = new QueryClient();

/* ================= Main ================= */
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));

/* ================= Sales ================= */
const SalesCustomers = lazy(() => import("./pages/sales/SalesCustomers"));
const Pipeline = lazy(() => import("./pages/sales/Pipeline"));
const OpportunityDetail = lazy(() => import("./pages/sales/OpportunityDetail"));
const Tasks = lazy(() => import("./pages/sales/Tasks"));
const SalesDashboard = lazy(() => import("./pages/sales/SalesDashboard"));
const SalesTargets = lazy(() => import("./pages/sales/SalesTargets"));
const ProjectDetail = lazy(() => import("./pages/sales/ProjectDetail"));
const SalesActivityPreview = lazy(() => import("./pages/sales/SalesActivityPreview"));
const OrphanAccountsReview = lazy(() => import("./pages/sales/OrphanAccountsReview"));
const CustomerProfile = lazy(() => import("./pages/CustomerProfile"));
const MigrationCompare = lazy(() => import("./pages/sales/MigrationCompare"));

/* ================= Supply ================= */
const Materials = lazy(() => import("./pages/Materials"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const SupplierDetail = lazy(() => import("./pages/SupplierDetail"));
const SupplierMaterials = lazy(() => import("./pages/SupplierMaterials"));
const UnlockPage = lazy(() => import("./pages/supply/Unlock"));
const DomainsPage = lazy(() => import("./pages/supply/Domains"));
const ValidityPage = lazy(() => import("./pages/supply/Validity"));
const IssuesPage = lazy(() => import("./pages/supply/Issues"));
const RenegotiationPage = lazy(() => import("./pages/supply/Renegotiation"));
const CoveragePage = lazy(() => import("./pages/supply/Coverage"));
const SupplyDashboard = lazy(() => import("./pages/supply/Dashboard"));

/* ================= Operations ================= */
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const Deliveries = lazy(() => import("./pages/Deliveries"));


/* ================= Admin ================= */
const AgentActions = lazy(() => import("./pages/admin/AgentActions"));
const AuditLog = lazy(() => import("./pages/admin/AuditLog"));
const Users = lazy(() => import("./pages/admin/Users"));
const RegionsZones = lazy(() => import("./pages/admin/RegionsZones"));
const CodingSystem = lazy(() => import("./pages/admin/CodingSystem"));
const QuoteTemplates = lazy(() => import("./pages/admin/QuoteTemplates"));
const MigrationTrigger = lazy(() => import("./pages/admin/MigrationTrigger"));
const AgentSchema = lazy(() => import("./pages/admin/AgentSchema"));
const AddonsRegistry = lazy(() => import("./pages/admin/AddonsRegistry"));
const Settings = lazy(() => import("./pages/Settings"));
const SandboxAdmin = lazy(() => import("./pages/admin/Sandbox"));
const WhatsAppTestPanel = lazy(() => import("./pages/admin/WhatsAppTestPanel"));
const MarginsAdmin = lazy(() => import("./pages/admin/Margins"));

/* ================= WhatsApp ================= */
const WhatsAppLayout = lazy(() => import("./pages/whatsapp/WhatsAppLayout"));
const WhatsAppOnboard = lazy(() => import("./pages/whatsapp/WhatsAppOnboard"));
const WhatsAppInbox = lazy(() => import("./pages/whatsapp/WhatsAppInbox"));
const WhatsAppTemplates = lazy(() => import("./pages/whatsapp/WhatsAppTemplates"));
const WhatsAppTemplateEditor = lazy(() => import("./pages/whatsapp/WhatsAppTemplateEditor"));
const WhatsAppSettings = lazy(() => import("./pages/whatsapp/WhatsAppSettings"));

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <SandboxProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <SandboxBorder />

            <BrowserRouter>
              <Suspense fallback={<div style={{ padding: 20 }}>Loading...</div>}>
                <Routes>

                  {/* Main */}
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/profile" element={<UserProfile />} />

                  {/* Sales */}
                  <Route path="/sales" element={<Navigate to="/sales/dashboard" replace />} />
                  <Route path="/sales/dashboard" element={<SalesDashboard />} />
                  <Route path="/sales/targets" element={<SalesTargets />} />
                  <Route path="/sales/pipeline" element={<Pipeline />} />
                  <Route path="/sales/tasks" element={<Tasks />} />
                  <Route path="/sales/opportunities/:id" element={<OpportunityDetail />} />
                  <Route path="/sales/customers" element={<SalesCustomers />} />
                  <Route path="/sales/customers/:id" element={<CustomerProfile />} />
                  <Route path="/sales/projects/:id" element={<ProjectDetail />} />
                  <Route path="/sales/_preview" element={<SalesActivityPreview />} />
                  <Route path="/sales/_orphan-review" element={<OrphanAccountsReview />} />
                  <Route path="/sales/_review" element={<OrphanAccountsReview />} />
                  <Route path="/sales/migration-compare" element={<MigrationCompare />} />

                  {/* Legacy */}
                  <Route path="/customers" element={<Navigate to="/sales/customers" replace />} />
                  <Route path="/customers/:id" element={<Navigate to="/sales/customers/:id" replace />} />
                  <Route path="/pipeline" element={<Navigate to="/sales/customers" replace />} />
                  <Route path="/tasks" element={<Navigate to="/sales/customers" replace />} />

                  {/* Supply */}
                  <Route path="/supply" element={<Navigate to="/supply/domains" replace />} />
                  <Route path="/supply/domains" element={<DomainsPage />} />
                  <Route path="/supply/domains/:id" element={<DomainsPage />} />
                  <Route path="/supply/dashboard" element={<SupplyDashboard />} />
                  <Route path="/materials" element={<Materials />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/suppliers/:id" element={<SupplierDetail />} />
                  <Route path="/supplier-materials" element={<SupplierMaterials />} />
                  <Route path="/supply/unlock" element={<UnlockPage />} />
                  <Route path="/supply/validity" element={<ValidityPage />} />
                  <Route path="/supply/issues" element={<IssuesPage />} />
                  <Route path="/supply/renegotiation" element={<RenegotiationPage />} />
                  <Route path="/supply/fatai-test" element={<Navigate to="/admin/whatsapp-test" replace />} />
                  <Route path="/admin/ai-quote-reader" element={<Navigate to="/admin/whatsapp-test" replace />} />
                  <Route path="/supply/coverage" element={<CoveragePage />} />
                  <Route path="/supply/units" element={<Navigate to="/supply/unlock" replace />} />

                  {/* Operations */}
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/orders/:id" element={<OrderDetail />} />
                  <Route path="/deliveries" element={<Deliveries />} />

                  {/* Admin */}
                  <Route path="/admin/agent-actions" element={<AgentActions />} />
                  <Route path="/admin/audit" element={<AuditLog />} />
                  <Route path="/admin/users" element={<Users />} />
                  <Route path="/admin/regions-zones" element={<RegionsZones />} />
                  <Route path="/admin/coding-system" element={<CodingSystem />} />
                  <Route path="/admin/quote-templates" element={<QuoteTemplates />} />
                  <Route path="/admin/migration" element={<MigrationTrigger />} />
                  <Route path="/admin/agent-schema" element={<AgentSchema />} />
                  <Route path="/admin/addons" element={<AddonsRegistry />} />
                  <Route path="/admin/sandbox" element={<SandboxAdmin />} />
                  <Route path="/sandbox" element={<SandboxAdmin />} />
                  <Route path="/admin/whatsapp-test" element={<WhatsAppTestPanel />} />
                  <Route path="/admin/margins" element={<MarginsAdmin />} />
                  <Route path="/materials/addons" element={<AddonsRegistry />} />
                  <Route path="/settings" element={<Settings />} />

                  {/* WhatsApp */}
                  <Route path="/whatsapp" element={<ProtectedRoute><WhatsAppLayout /></ProtectedRoute>}>
                    <Route index element={<WhatsAppInbox />} />
                    <Route path="onboard" element={<WhatsAppOnboard />} />
                    <Route path="inbox" element={<WhatsAppInbox />} />
                    <Route path="inbox/:conversationId" element={<WhatsAppInbox />} />
                    <Route path="templates" element={<WhatsAppTemplates />} />
                    <Route path="templates/new" element={<WhatsAppTemplateEditor />} />
                    <Route path="templates/:templateId" element={<WhatsAppTemplateEditor />} />
                    <Route path="settings" element={<WhatsAppSettings />} />
                  </Route>

                  {/* Legal */}
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />

                </Routes>
              </Suspense>

            </BrowserRouter>

          </TooltipProvider>
        </SandboxProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
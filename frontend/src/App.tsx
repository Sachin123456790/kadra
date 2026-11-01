import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/angainor/AuthProvider";
import { ThemeProvider } from "@/components/angainor/ThemeProvider";
import { AuthGuard } from "@/components/angainor/AuthGuard";
import { RoleGuard } from "@/components/angainor/RoleGuard";
import { AppLayout } from "@/components/angainor/AppLayout";
import FundOverview from "./pages/FundOverview";
import WaterfallTermsPage from "./pages/WaterfallTermsPage";
import InvestorsPage from "./pages/InvestorsPage";
import InvestorOnboardingDetailPage from "./pages/InvestorOnboardingDetailPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import SettlementPage from "./pages/SettlementPage";
import TransfersPage from "./pages/TransfersPage";
import CapTablePage from "./pages/CapTablePage";
import DistributionPage from "./pages/DistributionPage";
import AuditPage from "./pages/AuditPage";
import DocumentsPage from "./pages/DocumentsPage";
import AdminJobsPage from "./pages/AdminJobsPage";
import InvestorDashboard from "./pages/InvestorDashboard";
import InvestorSubscriptions from "./pages/InvestorSubscriptions";
import InvestorCapTable from "./pages/InvestorCapTable";
import InvestorDistributions from "./pages/InvestorDistributions";
import InvestorTransfers from "./pages/InvestorTransfers";
import InvestorProfile from "./pages/InvestorProfile";
import InvestorCapitalAccount from "./pages/InvestorCapitalAccount";
import InvestorDocuments from "./pages/InvestorDocuments";
import InvestorOnboardingPage from "./pages/InvestorOnboardingPage";
import LandingPage from "./pages/LandingPage";
import { DEMO_MODE } from "./config/constants";
import { Navigate } from "react-router-dom";
import PrivacyAndControlPage from "./pages/PrivacyAndControlPage";
import LoginPage from "./pages/LoginPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import HelpSupportPage from "./pages/HelpSupportPage";
import NotFound from "./pages/NotFound";
import SandboxApp from './sandbox/SandboxApp';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => import.meta.env.VITE_SANDBOX_MODE === 'true' ? <SandboxApp /> : (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={DEMO_MODE ? <Navigate to="/login" replace /> : <LandingPage />} />
            <Route path="/privacy" element={<PrivacyAndControlPage />} />
            <Route
              path="*"
              element={
                <AuthGuard>
                  <AppLayout>
                    <Routes>
                      {/* Admin routes */}
                      <Route path="/dashboard" element={<RoleGuard allow="admin"><FundOverview /></RoleGuard>} />
                      <Route path="/waterfall" element={<RoleGuard allow="admin"><WaterfallTermsPage /></RoleGuard>} />
                      <Route path="/investors" element={<RoleGuard allow="admin"><InvestorsPage /></RoleGuard>} />
                      <Route path="/investors/:investorId/onboarding" element={<RoleGuard allow="admin"><InvestorOnboardingDetailPage /></RoleGuard>} />
                      <Route path="/subscriptions" element={<RoleGuard allow="admin"><SubscriptionsPage /></RoleGuard>} />
                      <Route path="/settlement" element={<RoleGuard allow="admin"><SettlementPage /></RoleGuard>} />
                      <Route path="/transfers" element={<RoleGuard allow="admin"><TransfersPage /></RoleGuard>} />
                      <Route path="/cap-table" element={<RoleGuard allow="admin"><CapTablePage /></RoleGuard>} />
                      <Route path="/distribution" element={<RoleGuard allow="admin"><DistributionPage /></RoleGuard>} />
                      <Route path="/documents" element={<RoleGuard allow="admin"><DocumentsPage /></RoleGuard>} />
                      <Route path="/audit" element={<RoleGuard allow="admin"><AuditPage /></RoleGuard>} />
                      <Route path="/admin/jobs" element={<RoleGuard allow="admin"><AdminJobsPage /></RoleGuard>} />
                      {/* Shared routes (admin + investor) */}
                      <Route path="/notifications" element={<NotificationsPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/help" element={<HelpSupportPage />} />
                      {/* Investor routes */}
                      <Route path="/investor" element={<RoleGuard allow="investor"><InvestorDashboard /></RoleGuard>} />
                      <Route path="/investor/onboarding" element={<RoleGuard allow="investor"><InvestorOnboardingPage /></RoleGuard>} />
                      <Route path="/investor/capital-account" element={<RoleGuard allow="investor"><InvestorCapitalAccount /></RoleGuard>} />
                      <Route path="/investor/documents" element={<RoleGuard allow="investor"><InvestorDocuments /></RoleGuard>} />
                      <Route path="/investor/subscriptions" element={<RoleGuard allow="investor"><InvestorSubscriptions /></RoleGuard>} />
                      <Route path="/investor/cap-table" element={<RoleGuard allow="investor"><InvestorCapTable /></RoleGuard>} />
                      <Route path="/investor/distributions" element={<RoleGuard allow="investor"><InvestorDistributions /></RoleGuard>} />
                      <Route path="/investor/transfers" element={<RoleGuard allow="investor"><InvestorTransfers /></RoleGuard>} />
                      <Route path="/investor/profile" element={<RoleGuard allow="investor"><InvestorProfile /></RoleGuard>} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </AuthGuard>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

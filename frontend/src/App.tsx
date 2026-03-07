import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/kadra/AuthProvider";
import { AuthGuard } from "@/components/kadra/AuthGuard";
import { AppLayout } from "@/components/kadra/AppLayout";
import FundOverview from "./pages/FundOverview";
import InvestorsPage from "./pages/InvestorsPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import SettlementPage from "./pages/SettlementPage";
import TransfersPage from "./pages/TransfersPage";
import CapTablePage from "./pages/CapTablePage";
import DistributionPage from "./pages/DistributionPage";
import AuditPage from "./pages/AuditPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="*"
              element={
                <AuthGuard>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<FundOverview />} />
                      <Route path="/investors" element={<InvestorsPage />} />
                      <Route path="/subscriptions" element={<SubscriptionsPage />} />
                      <Route path="/settlement" element={<SettlementPage />} />
                      <Route path="/transfers" element={<TransfersPage />} />
                      <Route path="/cap-table" element={<CapTablePage />} />
                      <Route path="/distribution" element={<DistributionPage />} />
                      <Route path="/audit" element={<AuditPage />} />
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
  </QueryClientProvider>
);

export default App;

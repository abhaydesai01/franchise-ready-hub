import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Pipeline from "@/pages/Pipeline";
import Leads from "@/pages/Leads";
import LeadProfile from "@/pages/LeadProfile";
import Calls from "@/pages/Calls";
import Proposals from "@/pages/Proposals";
import Automation from "@/pages/Automation";
import Clients from "@/pages/Clients";
import CalendarPage from "@/pages/Calendar";
import SettingsPage from "@/pages/Settings";
import Alerts from "@/pages/Alerts";
import Analytics from "@/pages/Analytics";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import ProposalViewPage from "@/pages/ProposalViewPage";
import WhatsAppInbox from "@/pages/WhatsAppInbox";
import { useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/proposals/view/:token" element={<ProposalViewPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pipeline"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Pipeline />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/leads"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Leads />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/leads/:id"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <LeadProfile />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Alerts />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Analytics />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/calls"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Calls />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/proposals"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Proposals />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/automation"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Automation />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Clients />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <CalendarPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/calendar"
            element={
              <ProtectedRoute>
                <Navigate to="/settings?tab=calendar" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SettingsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/whatsapp"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <WhatsAppInbox />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

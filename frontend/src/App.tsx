import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { ToastProvider } from "@/components/ToastProvider";
import { GlassNav } from "@/components/ui";
import { ProductTour, TourProvider } from "@/tour";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { AppointmentsPage } from "@/pages/AppointmentsPage";
import { ChannelsPage } from "@/pages/ChannelsPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { FeedbackPage } from "@/pages/FeedbackPage";
import { HoursPage } from "@/pages/HoursPage";
import { InboxPage } from "@/pages/InboxPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { PlatformPage } from "@/pages/PlatformPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { UsersPage } from "@/pages/UsersPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";

function RealtimeBridge() {
  const { token } = useAuth();
  useRealtimeEvents(Boolean(token));
  return null;
}

function AppLayout() {
  return (
    <TourProvider>
      <div className="min-h-screen">
        <RealtimeBridge />
        <GlassNav />
        <main className="mx-auto max-w-shell px-5 py-6 sm:px-10 sm:py-8 lg:px-16">
          <Outlet />
        </main>
        <ProductTour />
      </div>
    </TourProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/appointments" element={<AppointmentsPage />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/hours" element={<HoursPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/platform" element={<PlatformPage />} />
              <Route path="/feedback" element={<FeedbackPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/channels" element={<ChannelsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}

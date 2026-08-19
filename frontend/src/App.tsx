import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { ClerkSessionBridge } from "@/auth/ClerkSessionBridge";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { ToastProvider } from "@/components/ToastProvider";
import { GlassNav } from "@/components/ui";
import { ThemeProvider } from "@/theme";
import { ProductTour, TourProvider } from "@/tour";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { AppointmentsPage } from "@/pages/AppointmentsPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { ChannelsPage } from "@/pages/ChannelsPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { FeedbackPage } from "@/pages/FeedbackPage";
import { HomePage } from "@/pages/HomePage";
import { HoursPage } from "@/pages/HoursPage";
import { InboxPage } from "@/pages/InboxPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { PlatformPage } from "@/pages/PlatformPage";
import { PublicBookingPage } from "@/pages/PublicBookingPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { StaffPage } from "@/pages/StaffPage";
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
      <RealtimeBridge />
      <GlassNav />
      <ProductTour />
    </TourProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ClerkSessionBridge />
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/book/:key" element={<PublicBookingPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/appointments" element={<AppointmentsPage />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/staff" element={<StaffPage />} />
                <Route path="/hours" element={<HoursPage />} />
                <Route path="/settings" element={<Navigate to="/settings/salon" replace />} />
                <Route path="/settings/:section" element={<SettingsPage />} />
                <Route path="/account" element={<Navigate to="/settings/account" replace />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/platform" element={<PlatformPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route
                  path="/notifications"
                  element={<Navigate to="/notifications/send" replace />}
                />
                <Route path="/notifications/:section" element={<NotificationsPage />} />
                <Route path="/channels" element={<ChannelsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

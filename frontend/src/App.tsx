import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { CommandPalette } from "@/components/CommandPalette";
import { ToastProvider } from "@/components/ToastProvider";
import { GlassNav } from "@/components/ui";
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
import { ThemeProvider } from "@/theme/ThemeProvider";

function RealtimeBridge() {
  const { token } = useAuth();
  useRealtimeEvents(Boolean(token));
  return null;
}

function AppLayout() {
  return (
    <div className="min-h-screen lg:flex">
      <RealtimeBridge />
      <GlassNav />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/appointments" element={<AppointmentsPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/inbox" element={<InboxPage />} />
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
    </ThemeProvider>
  );
}

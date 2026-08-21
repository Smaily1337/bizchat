import { apiFetch, API_BASE, ApiError, getToken } from "./client";
import type {
  Appointment,
  Business,
  Channel,
  Conversation,
  Customer,
  CustomerTag,
  DashboardAnalytics,
  DashboardSummary,
  Feedback,
  GrantLicensePayload,
  GrantLicenseResult,
  InboxMessage,
  KnowledgeItem,
  LicenseKey,
  LicenseUsage,
  NotificationLogEntry,
  NotificationSettings,
  NotificationTemplate,
  Owner,
  PlanCatalogItem,
  PlatformAccount,
  PlatformBusiness,
  PlatformPageviewStats,
  RedeemLicenseResult,
  CreateLicenseKeyPayload,
  Service,
  StaffMember,
  TimeOff,
  WaitlistEntry,
  WorkingHours,
} from "./types";

export { API_BASE } from "./client";

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ access_token: string }>("/api/auth/login/json", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (body: {
    email: string;
    password: string;
    name?: string;
    business_name: string;
  }) =>
    apiFetch<{ access_token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => apiFetch<Owner>("/api/auth/me"),
  updateMe: (body: { name: string | null }) =>
    apiFetch<Owner>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  changePassword: (current_password: string, new_password: string) =>
    apiFetch<{ message: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
  config: () =>
    apiFetch<{
      google_oauth_enabled: boolean;
      clerk_enabled: boolean;
      registration_enabled: boolean;
    }>("/api/auth/config"),
  clerkExchange: async (clerkJwt: string) => {
    const res = await fetch(`${API_BASE}/api/auth/clerk`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clerkJwt}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new ApiError(res.status, await res.text());
    }
    return res.json() as Promise<{ access_token: string }>;
  },
  verifyEmail: (token: string) =>
    apiFetch<{ message: string }>(
      `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
      { method: "POST" },
    ),
  resendVerification: () =>
    apiFetch<{ message: string }>("/api/auth/resend-verification", {
      method: "POST",
    }),
};

export const usersApi = {
  list: () => apiFetch<Owner[]>("/api/users"),
  create: (body: {
    email: string;
    password: string;
    name?: string;
    role: string;
  }) =>
    apiFetch<Owner>("/api/users", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (
    id: string,
    body: Partial<{
      email: string;
      name: string | null;
      role: string;
      is_active: boolean;
    }>,
  ) =>
    apiFetch<Owner>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  resetPassword: (id: string, password?: string) =>
    apiFetch<{ message: string; temporary_password: string | null }>(
      `/api/users/${id}/reset-password`,
      {
        method: "POST",
        body: JSON.stringify(password ? { password } : {}),
      },
    ),
  remove: (id: string) =>
    apiFetch<void>(`/api/users/${id}`, { method: "DELETE" }),
};

export const businessApi = {
  get: () => apiFetch<Business>("/api/business"),
  usage: () => apiFetch<LicenseUsage>("/api/business/usage"),
  update: (body: Record<string, unknown>) =>
    apiFetch<Business>("/api/business", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  saveGeminiConfig: (body: { gemini_api_key?: string; gemini_model?: string }) =>
    apiFetch<{ ok: boolean; message: string }>("/api/business/gemini-config", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  redeemLicense: (key: string) =>
    apiFetch<RedeemLicenseResult>("/api/business/redeem-license", {
      method: "POST",
      body: JSON.stringify({ key }),
    }),
};


export const channelsApi = {
  status: () =>
    apiFetch<{
      channels: { id: string; name: string; configured: boolean; detail: string }[];
      meta_default_business_id_set: boolean;
      meta_verify_token: string;
    }>("/api/channels/status"),
  linkMeta: (accessToken: string) =>
    apiFetch<{ ok: boolean; page_id: string; page_name: string }>(`/api/business/meta-link`, {
      method: "POST",
      body: JSON.stringify({ access_token: accessToken }),
    }),
  directConnectMeta: (body: { page_id: string; access_token: string; page_name?: string }) =>
    apiFetch<{ ok: boolean; page_id: string; page_name: string }>(`/api/business/meta-direct-connect`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getMetaDetails: () =>
    apiFetch<{
      connected: boolean;
      page_id?: string;
      page_name?: string;
      about?: string;
      description?: string;
      phone?: string;
      website?: string;
      emails?: string[];
      picture_url?: string;
      followers_count?: number;
      error?: string;
    }>("/api/business/meta-details"),
  updateMetaPage: (body: { about?: string; description?: string; phone?: string; website?: string }) =>
    apiFetch<{ ok: boolean; result?: unknown }>("/api/business/meta-page-update", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  changeMetaPicture: (picture_url: string) =>
    apiFetch<{ ok: boolean; result?: unknown }>("/api/business/meta-page-picture", {
      method: "POST",
      body: JSON.stringify({ picture_url }),
    }),
  disconnectMeta: () =>
    apiFetch<{ ok: boolean; message: string }>("/api/business/meta-disconnect", {
      method: "POST",
    }),
};


export const appointmentsApi = {
  list: (params?: { from_at?: string; to_at?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.from_at) q.set("from_at", params.from_at);
    if (params?.to_at) q.set("to_at", params.to_at);
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return apiFetch<Appointment[]>(`/api/appointments${qs ? `?${qs}` : ""}`);
  },
  create: (body: Record<string, unknown>) =>
    apiFetch<Appointment>("/api/appointments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    apiFetch<Appointment>(`/api/appointments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  cancel: (id: string, reason?: string) =>
    apiFetch<Appointment>(
      `/api/appointments/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`,
      { method: "DELETE" },
    ),
};

export const servicesApi = {
  list: () => apiFetch<Service[]>("/api/services"),
  create: (body: Record<string, unknown>) =>
    apiFetch<Service>("/api/services", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    apiFetch<Service>(`/api/services/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiFetch<void>(`/api/services/${id}`, { method: "DELETE" }),
};

export const customersApi = {
  list: () => apiFetch<Customer[]>("/api/customers"),
  create: (body: {
    name?: string;
    phone?: string;
    email?: string;
    messenger_psid?: string;
    instagram_id?: string;
    telegram_id?: string;
  }) =>
    apiFetch<Customer>("/api/customers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (
    id: string,
    body: Partial<{
      name: string | null;
      phone: string | null;
      email: string | null;
      messenger_psid: string | null;
      instagram_id: string | null;
      telegram_id: string | null;
    }>,
  ) =>
    apiFetch<Customer>(`/api/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiFetch<void>(`/api/customers/${id}`, { method: "DELETE" }),
  setTags: (customerId: string, tagIds: string[]) =>
    apiFetch<CustomerTag[]>(`/api/tags/customers/${customerId}`, {
      method: "PUT",
      body: JSON.stringify({ tag_ids: tagIds }),
    }),
  importCsv: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/customers/import`, {
      method: "POST",
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || "Import failed");
    }
    return res.json() as Promise<{
      created: number;
      updated: number;
      skipped: number;
      errors: string[];
    }>;
  },
};

export const tagsApi = {
  list: () => apiFetch<CustomerTag[]>("/api/tags"),
  create: (body: { name: string; color?: string | null }) =>
    apiFetch<CustomerTag>("/api/tags", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: { name?: string; color?: string | null }) =>
    apiFetch<CustomerTag>(`/api/tags/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiFetch<void>(`/api/tags/${id}`, { method: "DELETE" }),
};

export const staffApi = {
  list: () => apiFetch<StaffMember[]>("/api/staff"),
  create: (body: { name: string; avatar_url?: string | null; color?: string; sort_order?: number }) =>
    apiFetch<StaffMember>("/api/staff", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<StaffMember> & Record<string, unknown>) =>
    apiFetch<StaffMember>(`/api/staff/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiFetch<void>(`/api/staff/${id}`, { method: "DELETE" }),
};

export const publicBookingApi = {
  business: (key: string) =>
    apiFetch<{
      id: string;
      name: string;
      timezone: string;
      public_slug: string | null;
      deposit_percent: number;
      booking_url: string | null;
    }>(`/api/public/${key}`),
  services: (key: string) =>
    apiFetch<
      Array<{
        id: string;
        name: string;
        duration_min: number;
        price: string | number;
        description: string | null;
      }>
    >(`/api/public/${key}/services`),
  staff: (key: string) =>
    apiFetch<Array<{ id: string; name: string; color: string | null }>>(
      `/api/public/${key}/staff`,
    ),
  availability: (key: string, serviceId: string, day: string, staffId?: string) => {
    const q = new URLSearchParams({
      service_id: serviceId,
      day,
    });
    if (staffId) q.set("staff_id", staffId);
    return apiFetch<{
      slots: Array<{ start_at: string; end_at: string; available: boolean }>;
    }>(`/api/public/${key}/availability?${q}`);
  },
  book: (
    key: string,
    body: {
      service_id: string;
      start_at: string;
      name: string;
      phone?: string;
      email?: string;
      staff_id?: string;
      notes?: string;
    },
  ) =>
    apiFetch<{
      appointment_id: string;
      status: string;
      deposit_status: string;
      deposit_amount: string | number | null;
      checkout_url: string | null;
      message: string;
    }>(`/api/public/${key}/book`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const hoursApi = {
  list: () => apiFetch<WorkingHours[]>("/api/working-hours"),
  replace: (days: Array<Record<string, unknown>>) =>
    apiFetch<WorkingHours[]>("/api/working-hours", {
      method: "PUT",
      body: JSON.stringify({ days }),
    }),
  listTimeOff: () => apiFetch<TimeOff[]>("/api/time-off"),
  createTimeOff: (body: Record<string, unknown>) =>
    apiFetch<TimeOff>("/api/time-off", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  removeTimeOff: (id: string) =>
    apiFetch<void>(`/api/time-off/${id}`, { method: "DELETE" }),
};

export const knowledgeApi = {
  list: () => apiFetch<KnowledgeItem[]>("/api/knowledge"),
  create: (body: Record<string, unknown>) =>
    apiFetch<KnowledgeItem>("/api/knowledge", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiFetch<void>(`/api/knowledge/${id}`, { method: "DELETE" }),
};

export const feedbackApi = {
  list: (alertsOnly = false) =>
    apiFetch<Feedback[]>(
      `/api/feedback${alertsOnly ? "?alerts_only=true" : ""}`,
    ),
  create: (body: { appointment_id: string; score: number; comment?: string }) =>
    apiFetch<Feedback>("/api/feedback", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const waitlistApi = {
  list: () => apiFetch<WaitlistEntry[]>("/api/waitlist"),
  notify: (id: string) =>
    apiFetch<WaitlistEntry>(`/api/waitlist/${id}/notify`, { method: "POST" }),
  cancel: (id: string) =>
    apiFetch<void>(`/api/waitlist/${id}`, { method: "DELETE" }),
};

export const dashboardApi = {
  summary: () => apiFetch<DashboardSummary>("/api/dashboard/summary"),
  analytics: (days = 7) =>
    apiFetch<DashboardAnalytics>(`/api/dashboard/analytics?days=${days}`),
};

export const notificationsApi = {
  settings: () => apiFetch<NotificationSettings>("/api/notifications/settings"),
  updateSettings: (body: Partial<NotificationSettings>) =>
    apiFetch<NotificationSettings>("/api/notifications/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  templates: () =>
    apiFetch<NotificationTemplate[]>("/api/notifications/templates"),
  createTemplate: (body: Record<string, unknown>) =>
    apiFetch<NotificationTemplate>("/api/notifications/templates", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateTemplate: (id: string, body: Record<string, unknown>) =>
    apiFetch<NotificationTemplate>(`/api/notifications/templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  removeTemplate: (id: string) =>
    apiFetch<void>(`/api/notifications/templates/${id}`, { method: "DELETE" }),
  preview: (body: string, appointmentId?: string) =>
    apiFetch<{ rendered: string }>("/api/notifications/preview", {
      method: "POST",
      body: JSON.stringify({ body, appointment_id: appointmentId || null }),
    }),
  send: (body: {
    appointment_id?: string;
    customer_id?: string;
    channel?: string;
    template_id?: string;
    body?: string;
  }) =>
    apiFetch<NotificationLogEntry>("/api/notifications/send", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  log: (limit = 100) =>
    apiFetch<NotificationLogEntry[]>(`/api/notifications/log?limit=${limit}`),
};

export const inboxApi = {
  conversations: () =>
    apiFetch<Conversation[]>("/api/inbox/conversations"),
  messages: (id: string) =>
    apiFetch<InboxMessage[]>(`/api/inbox/conversations/${id}/messages`),
  reply: (id: string, text: string) =>
    apiFetch<InboxMessage>(`/api/inbox/conversations/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  start: (body: {
    customer_id: string;
    text: string;
    channel?: Channel;
  }) =>
    apiFetch<{
      conversation: Conversation;
      message: InboxMessage;
      delivered: boolean;
      detail: string | null;
    }>("/api/inbox/start", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  importMessenger: (limit = 50) =>
    apiFetch<{
      page_id: string;
      threads_seen: number;
      skipped_threads: number;
      customers_created: number;
      conversations_created: number;
      messages_created: number;
      imported_names: string[];
    }>(`/api/inbox/import-messenger?limit=${limit}`, { method: "POST" }),
  importMessengerPsids: (text: string) =>
    apiFetch<{
      page_id: string;
      threads_seen: number;
      skipped_threads: number;
      customers_created: number;
      conversations_created: number;
      messages_created: number;
      imported_names: string[];
    }>("/api/inbox/import-messenger-psids", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
};

export const platformApi = {
  listAccounts: () => apiFetch<PlatformAccount[]>("/api/platform/accounts"),
  createAccount: (body: {
    email: string;
    name?: string;
    role?: string;
    business_id?: string;
    business_name?: string;
    is_platform_admin?: boolean;
  }) =>
    apiFetch<{
      account: PlatformAccount;
      temporary_password: string;
      message: string;
    }>("/api/platform/accounts", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateAccount: (
    id: string,
    body: Partial<{
      email: string;
      name: string | null;
      role: string;
      is_active: boolean;
      is_platform_admin: boolean;
    }>,
  ) =>
    apiFetch<PlatformAccount>(`/api/platform/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  resetPassword: (id: string) =>
    apiFetch<{ message: string; temporary_password: string | null }>(
      `/api/platform/accounts/${id}/reset-password`,
      { method: "POST" },
    ),
  listBusinesses: () =>
    apiFetch<PlatformBusiness[]>("/api/platform/businesses"),
  listPlans: () => apiFetch<PlanCatalogItem[]>("/api/platform/plans"),
  businessUsage: (id: string) =>
    apiFetch<LicenseUsage>(`/api/platform/businesses/${id}/usage`),
  updateBusiness: (
    id: string,
    body: Partial<{
      name: string;
      timezone: string;
      plan: string;
      license_status: string;
      license_expires_at: string | null;
      max_appointments_month: number | null;
      max_messages_month: number | null;
      max_seats: number | null;
      enabled_channels: string[];
      apply_plan_defaults: boolean;
      clear_expiry: boolean;
    }>,
  ) =>
    apiFetch<PlatformBusiness>(`/api/platform/businesses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  grantLicense: (body: GrantLicensePayload) =>
    apiFetch<GrantLicenseResult>("/api/platform/grant-license", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listLicenseKeys: () =>
    apiFetch<LicenseKey[]>("/api/platform/license-keys"),
  createLicenseKey: (body: CreateLicenseKeyPayload) =>
    apiFetch<LicenseKey>("/api/platform/license-keys", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteLicenseKey: (id: string) =>
    apiFetch<void>(`/api/platform/license-keys/${id}`, {
      method: "DELETE",
    }),
  pageviewStats: () =>
    apiFetch<PlatformPageviewStats>("/api/platform/stats/pageviews"),
};

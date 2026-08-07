import { apiFetch } from "./client";
import type {
  Appointment,
  Business,
  Conversation,
  Customer,
  DashboardAnalytics,
  DashboardSummary,
  Feedback,
  InboxMessage,
  KnowledgeItem,
  NotificationLogEntry,
  NotificationSettings,
  NotificationTemplate,
  Owner,
  Service,
  TimeOff,
  WaitlistEntry,
  WorkingHours,
} from "./types";

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ access_token: string }>("/api/auth/login/json", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => apiFetch<Owner>("/api/auth/me"),
};

export const businessApi = {
  get: () => apiFetch<Business>("/api/business"),
  update: (body: Partial<Business>) =>
    apiFetch<Business>("/api/business", {
      method: "PATCH",
      body: JSON.stringify(body),
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
  create: (body: { name?: string; phone?: string }) =>
    apiFetch<Customer>("/api/customers", {
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
};

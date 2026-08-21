export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type Channel =
  | "telegram"
  | "messenger"
  | "instagram"
  | "whatsapp"
  | "widget"
  | "admin";

export type FeedbackRoute = "google" | "alert" | "none";
export type WaitlistStatus =
  | "active"
  | "offered"
  | "booked"
  | "expired"
  | "cancelled";

export type UserRole = "owner" | "admin" | "pracownik";

export type Owner = {
  id: string;
  email: string;
  business_id: string;
  name?: string | null;
  role: UserRole;
  email_verified: boolean;
  is_active: boolean;
  is_platform_admin?: boolean;
  created_at?: string | null;
};

export type PlatformAccount = Owner & {
  business_name?: string | null;
};

export type PlatformPageviewStats = {
  visits_today: number;
  visits_7d: number;
  visits_30d: number;
  unique_sessions_7d: number;
  by_day: Array<{ day: string; count: number }>;
  top_paths: Array<{ path: string; count: number }>;
  recent: Array<{
    id: string;
    path: string;
    referrer: string | null;
    user_agent: string | null;
    session_id: string | null;
    created_at: string;
  }>;
};

export type Business = {
  id: string;
  name: string;
  timezone: string;
  google_calendar_id: string | null;
  settings: Record<string, unknown>;
  public_slug?: string | null;
  deposit_percent?: number | null;
  stripe_account_id?: string | null;
  plan?: string;
  license_status?: string;
  license_expires_at?: string | null;
  max_appointments_month?: number | null;
  max_messages_month?: number | null;
  max_seats?: number | null;
  enabled_channels?: string[] | null;
  created_at?: string;
  updated_at?: string;
};

export type LicenseUsage = {
  plan: string;
  license_status: string;
  license_expires_at: string | null;
  is_active: boolean;
  appointments_month: number;
  max_appointments_month: number | null;
  messages_month: number;
  max_messages_month: number | null;
  seats: number;
  max_seats: number | null;
  enabled_channels: string[];
  period_start: string;
  period_end: string;
};

export type PlanCatalogItem = {
  id: string;
  max_appointments_month: number | null;
  max_messages_month: number | null;
  max_seats: number | null;
  enabled_channels: string[];
  trial_days: number;
};

export type PlatformBusiness = Business & {
  usage?: LicenseUsage | null;
};

export type Service = {
  id: string;
  business_id: string;
  name: string;
  duration_min: number;
  price: string | number;
  description: string | null;
};

export type CustomerTag = {
  id: string;
  name: string;
  color: string | null;
};

export type Customer = {
  id: string;
  business_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  external_ids?: Record<string, string>;
  tags?: CustomerTag[];
  created_at?: string;
  updated_at?: string;
};

export type Appointment = {
  id: string;
  business_id: string;
  customer_id: string;
  service_id: string;
  staff_id?: string | null;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  channel: Channel;
  notes: string | null;
  deposit_amount?: string | number | null;
  deposit_status?: string | null;
  gcal_event_id?: string | null;
  customer_name?: string | null;
  service_name?: string | null;
  staff_name?: string | null;
};

export type StaffMember = {
  id: string;
  business_id: string;
  name: string;
  avatar_url?: string | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
};

export type WorkingHours = {
  id: string;
  business_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

export type TimeOff = {
  id: string;
  business_id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
};

export type KnowledgeItem = {
  id: string;
  business_id: string;
  category: string | null;
  question: string;
  answer: string;
};

export type Feedback = {
  id: string;
  appointment_id: string;
  score: number;
  comment: string | null;
  routed_to: FeedbackRoute;
  customer_name?: string | null;
  service_name?: string | null;
  start_at?: string | null;
  created_at: string;
};

export type WaitlistEntry = {
  id: string;
  business_id: string;
  customer_id: string;
  service_id: string;
  status: WaitlistStatus;
  customer_name?: string | null;
  service_name?: string | null;
  created_at: string;
};

export type DashboardSummary = {
  business_id: string;
  appointments_today: number;
  customers_total: number;
  pending_count: number;
  cancelled_7d?: number;
  no_show_7d?: number;
  alerts_open?: number;
  avg_score?: number | null;
};

export type DayBucket = {
  day: string;
  confirmed: number;
  cancelled: number;
  no_show: number;
  completed: number;
};

export type ChannelBucket = {
  channel: string;
  count: number;
};

export type DashboardAnalytics = {
  days: DayBucket[];
  by_channel: ChannelBucket[];
  gaps_today: number;
  feedback_avg: number | null;
  visits?: number;
  no_show_rate?: number | null;
  cancel_rate?: number | null;
};

export type NotificationChannel =
  | "sms"
  | "email"
  | "telegram"
  | "messenger"
  | "instagram"
  | "whatsapp"
  | "widget";
export type NotificationKind = "reminder" | "custom" | "waitlist" | "feedback";
export type NotificationStatus = "sent" | "failed";

export type NotificationTemplate = {
  id: string;
  business_id: string;
  kind: NotificationKind;
  name: string;
  body: string;
  is_default: boolean;
  updated_at: string;
};

export type NotificationSettings = {
  id: string;
  business_id: string;
  reminders_enabled: boolean;
  lead_times_min: number[];
  max_per_appointment: number;
  default_channel: NotificationChannel;
};

export type NotificationLogEntry = {
  id: string;
  business_id: string;
  appointment_id: string | null;
  customer_id: string | null;
  channel: NotificationChannel;
  kind: NotificationKind;
  status: NotificationStatus;
  body: string;
  error: string | null;
  provider: string;
  lead_time_min: number | null;
  sent_at: string | null;
  created_at: string;
  customer_name?: string | null;
  service_name?: string | null;
};

export type Conversation = {
  id: string;
  customer_id: string;
  customer_name: string | null;
  channel: Channel;
  state: string;
  external_thread_id: string;
  updated_at: string;
  last_message: string | null;
  last_role: string | null;
};

export type InboxMessage = {
  id: string;
  conversation_id: string;
  role: "customer" | "bot" | "owner" | "system";
  content: string;
  created_at: string;
};

export type LicenseKey = {
  id: string;
  key: string;
  plan: string;
  duration_days: number | null;
  max_uses: number;
  times_used: number;
  is_active: boolean;
  expires_at?: string | null;
  notes?: string | null;
  created_at: string;
};

export type GrantLicensePayload = {
  email?: string;
  business_id?: string;
  plan: string;
  duration_days?: number | null;
  custom_max_appointments?: number | null;
  custom_max_messages?: number | null;
  custom_max_seats?: number | null;
  custom_channels?: string[];
  notes?: string;
};

export type GrantLicenseResult = {
  success: boolean;
  message: string;
  business_id: string;
  business_name: string;
  owner_email: string;
  plan: string;
  license_status: string;
  license_expires_at?: string | null;
  usage: LicenseUsage;
};

export type CreateLicenseKeyPayload = {
  plan: string;
  duration_days?: number | null;
  max_uses?: number;
  custom_key?: string;
  notes?: string;
};

export type RedeemLicenseResult = {
  success: boolean;
  message: string;
  plan: string;
  license_status: string;
  license_expires_at?: string | null;
  usage: LicenseUsage;
};


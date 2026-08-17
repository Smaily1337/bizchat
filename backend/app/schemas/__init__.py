from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    AppointmentStatus,
    Channel,
    FeedbackRoute,
    NotificationChannel,
    NotificationKind,
    NotificationStatus,
    UserRole,
    WaitlistStatus,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OwnerOut(ORMModel):
    id: UUID
    email: str
    business_id: UUID
    name: Optional[str] = None
    role: UserRole = UserRole.owner
    email_verified: bool = False
    is_active: bool = True
    is_platform_admin: bool = False
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Business
# ---------------------------------------------------------------------------


class BusinessOut(ORMModel):
    id: UUID
    name: str
    timezone: str
    google_calendar_id: Optional[str] = None
    settings: dict[str, Any] = Field(default_factory=dict)
    plan: str = "free"
    license_status: str = "trial"
    license_expires_at: Optional[datetime] = None
    max_appointments_month: Optional[int] = None
    max_messages_month: Optional[int] = None
    max_seats: Optional[int] = None
    enabled_channels: Optional[list[str]] = None
    created_at: datetime
    updated_at: datetime


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    timezone: Optional[str] = None
    google_calendar_id: Optional[str] = None
    settings: Optional[dict[str, Any]] = None


class LicenseUsageOut(BaseModel):
    plan: str
    license_status: str
    license_expires_at: Optional[datetime] = None
    is_active: bool
    appointments_month: int
    max_appointments_month: Optional[int] = None
    messages_month: int
    max_messages_month: Optional[int] = None
    seats: int
    max_seats: Optional[int] = None
    enabled_channels: list[str] = Field(default_factory=list)
    period_start: datetime
    period_end: datetime


class PlanCatalogItem(BaseModel):
    id: str
    max_appointments_month: Optional[int] = None
    max_messages_month: Optional[int] = None
    max_seats: Optional[int] = None
    enabled_channels: list[str] = Field(default_factory=list)
    trial_days: int = 0


# ---------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------


class ServiceOut(ORMModel):
    id: UUID
    business_id: UUID
    name: str
    duration_min: int
    price: Decimal
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ServiceCreate(BaseModel):
    name: str
    duration_min: int = Field(ge=5, le=24 * 60)
    price: Decimal = Decimal("0")
    description: Optional[str] = None


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    duration_min: Optional[int] = Field(default=None, ge=5, le=24 * 60)
    price: Optional[Decimal] = None
    description: Optional[str] = None


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------


class CustomerOut(ORMModel):
    id: UUID
    business_id: UUID
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    external_ids: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class CustomerCreate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    messenger_psid: Optional[str] = Field(
        default=None,
        description="Page-Scoped ID Messengera (z webhooka / narzędzi Meta)",
    )
    instagram_id: Optional[str] = None
    telegram_id: Optional[str] = None
    external_ids: Optional[dict[str, Any]] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    messenger_psid: Optional[str] = None
    instagram_id: Optional[str] = None
    telegram_id: Optional[str] = None
    external_ids: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Working hours / time off
# ---------------------------------------------------------------------------


class WorkingHoursOut(ORMModel):
    id: UUID
    business_id: UUID
    weekday: int
    start_time: time
    end_time: time


class WorkingHoursDay(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    closed: bool = False


class WorkingHoursBulkUpdate(BaseModel):
    days: list[WorkingHoursDay]


class TimeOffOut(ORMModel):
    id: UUID
    business_id: UUID
    start_at: datetime
    end_at: datetime
    reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TimeOffCreate(BaseModel):
    start_at: datetime
    end_at: datetime
    reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------


class AppointmentCreate(BaseModel):
    customer_id: UUID
    service_id: UUID
    start_at: datetime
    end_at: Optional[datetime] = None
    status: AppointmentStatus = AppointmentStatus.pending
    channel: Channel = Channel.admin
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = None
    service_id: Optional[UUID] = None


class AppointmentOut(ORMModel):
    id: UUID
    business_id: UUID
    customer_id: UUID
    service_id: UUID
    start_at: datetime
    end_at: datetime
    status: AppointmentStatus
    channel: Channel
    gcal_event_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    customer_name: Optional[str] = None
    service_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Availability
# ---------------------------------------------------------------------------


class SlotOut(BaseModel):
    start_at: datetime
    end_at: datetime
    available: bool = True


class AvailabilityResponse(BaseModel):
    business_id: UUID
    service_id: UUID
    date: str
    slots: list[SlotOut]


# ---------------------------------------------------------------------------
# Knowledge
# ---------------------------------------------------------------------------


class KnowledgeOut(ORMModel):
    id: UUID
    business_id: UUID
    category: Optional[str] = None
    question: str
    answer: str
    created_at: datetime
    updated_at: datetime


class KnowledgeCreate(BaseModel):
    category: Optional[str] = None
    question: str
    answer: str


class KnowledgeUpdate(BaseModel):
    category: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------


class FeedbackCreate(BaseModel):
    appointment_id: UUID
    score: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class FeedbackOut(ORMModel):
    id: UUID
    appointment_id: UUID
    score: int
    comment: Optional[str] = None
    routed_to: FeedbackRoute
    created_at: datetime
    updated_at: datetime
    customer_name: Optional[str] = None
    service_name: Optional[str] = None
    start_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Waitlist
# ---------------------------------------------------------------------------


class WaitlistCreate(BaseModel):
    customer_id: UUID
    service_id: UUID
    preferred_windows: list[Any] = Field(default_factory=list)


class WaitlistOut(ORMModel):
    id: UUID
    business_id: UUID
    customer_id: UUID
    service_id: UUID
    preferred_windows: list[Any] = Field(default_factory=list)
    status: WaitlistStatus
    created_at: datetime
    updated_at: datetime
    customer_name: Optional[str] = None
    service_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Bot / adapters
# ---------------------------------------------------------------------------


class InboundMessage(BaseModel):
    channel: Channel
    business_id: Optional[UUID] = None
    external_user_id: str
    external_thread_id: str
    text: str
    raw_payload: dict[str, Any] = Field(default_factory=dict)
    display_name: Optional[str] = None


class OutboundMessage(BaseModel):
    channel: Channel
    external_thread_id: str
    text: str
    metadata: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Widget
# ---------------------------------------------------------------------------


class WidgetMessageRequest(BaseModel):
    session_token: str
    text: str
    business_id: UUID


class WidgetMessageResponse(BaseModel):
    reply: str
    session_token: str


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------


class NotificationTemplateOut(ORMModel):
    id: UUID
    business_id: UUID
    kind: NotificationKind
    name: str
    body: str
    is_default: bool
    updated_at: datetime


class NotificationTemplateCreate(BaseModel):
    kind: NotificationKind = NotificationKind.custom
    name: str
    body: str
    is_default: bool = False


class NotificationTemplateUpdate(BaseModel):
    kind: Optional[NotificationKind] = None
    name: Optional[str] = None
    body: Optional[str] = None
    is_default: Optional[bool] = None


class NotificationSettingsOut(ORMModel):
    id: UUID
    business_id: UUID
    reminders_enabled: bool
    lead_times_min: list[int]
    max_per_appointment: int
    default_channel: NotificationChannel


class NotificationSettingsUpdate(BaseModel):
    reminders_enabled: Optional[bool] = None
    lead_times_min: Optional[list[int]] = Field(
        default=None, description="Minuty przed wizytą, np. [1440, 120, 30]"
    )
    max_per_appointment: Optional[int] = Field(default=None, ge=0, le=10)
    default_channel: Optional[NotificationChannel] = None


class NotificationSendRequest(BaseModel):
    appointment_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    channel: Optional[NotificationChannel] = None
    template_id: Optional[UUID] = None
    body: Optional[str] = None


class NotificationPreviewRequest(BaseModel):
    body: str
    appointment_id: Optional[UUID] = None


class NotificationPreviewResponse(BaseModel):
    rendered: str


class NotificationLogOut(ORMModel):
    id: UUID
    business_id: UUID
    appointment_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    channel: NotificationChannel
    kind: NotificationKind
    status: NotificationStatus
    body: str
    error: Optional[str] = None
    provider: str
    lead_time_min: Optional[int] = None
    sent_at: Optional[datetime] = None
    created_at: datetime
    customer_name: Optional[str] = None
    service_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: str
    app: str
    environment: str

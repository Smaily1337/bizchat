import enum


class Channel(str, enum.Enum):
    telegram = "telegram"
    messenger = "messenger"
    instagram = "instagram"
    widget = "widget"
    admin = "admin"


class AppointmentStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"
    no_show = "no_show"


class MessageRole(str, enum.Enum):
    customer = "customer"
    bot = "bot"
    owner = "owner"
    system = "system"


class ConversationState(str, enum.Enum):
    idle = "idle"
    faq = "faq"
    booking = "booking"
    feedback = "feedback"
    waitlist = "waitlist"


class WaitlistStatus(str, enum.Enum):
    active = "active"
    offered = "offered"
    booked = "booked"
    expired = "expired"
    cancelled = "cancelled"


class FeedbackRoute(str, enum.Enum):
    google = "google"
    alert = "alert"
    none = "none"


class NotificationChannel(str, enum.Enum):
    sms = "sms"
    email = "email"
    telegram = "telegram"
    widget = "widget"


class NotificationKind(str, enum.Enum):
    reminder = "reminder"
    custom = "custom"
    waitlist = "waitlist"
    feedback = "feedback"


class NotificationStatus(str, enum.Enum):
    sent = "sent"
    failed = "failed"


class UserRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    pracownik = "pracownik"

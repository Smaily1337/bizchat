"""SQLAlchemy models — import side-effects register metadata for Alembic."""

from app.models.analytics import PageView
from app.models.appointment import Appointment, WaitlistEntry
from app.models.business import Business, Owner, Service, TimeOff, WorkingHours
from app.models.conversation import Conversation, Message
from app.models.customer import Customer
from app.models.enums import (
    AppointmentStatus,
    Channel,
    ConversationState,
    DepositStatus,
    FeedbackRoute,
    MessageRole,
    NotificationChannel,
    NotificationKind,
    NotificationStatus,
    UserRole,
    WaitlistStatus,
)
from app.models.feedback import CancellationEvent, Feedback
from app.models.knowledge import KnowledgeItem
from app.models.license_key import LicenseKey
from app.models.notification import (
    NotificationLog,
    NotificationSettings,
    NotificationTemplate,
)
from app.models.staff import Staff
from app.models.tag import Tag, customer_tags

__all__ = [
    "Appointment",
    "AppointmentStatus",
    "Business",
    "CancellationEvent",
    "Channel",
    "Conversation",
    "ConversationState",
    "Customer",
    "DepositStatus",
    "Feedback",
    "FeedbackRoute",
    "KnowledgeItem",
    "LicenseKey",
    "Message",
    "MessageRole",
    "NotificationChannel",
    "NotificationKind",
    "NotificationLog",
    "NotificationSettings",
    "NotificationStatus",
    "NotificationTemplate",
    "Owner",
    "PageView",
    "Service",
    "Staff",
    "Tag",
    "TimeOff",
    "UserRole",
    "WaitlistEntry",
    "WaitlistStatus",
    "WorkingHours",
    "customer_tags",
]

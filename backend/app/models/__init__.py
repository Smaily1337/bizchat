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
    FeedbackRoute,
    MessageRole,
    NotificationChannel,
    NotificationKind,
    NotificationStatus,
    TaskMailStatus,
    TaskPriority,
    TaskStatus,
    UserRole,
    WaitlistStatus,
)
from app.models.feedback import CancellationEvent, Feedback
from app.models.knowledge import KnowledgeItem
from app.models.notification import (
    NotificationLog,
    NotificationSettings,
    NotificationTemplate,
)
from app.models.task import Task, TaskAssignee, TaskAttachment

__all__ = [
    "Appointment",
    "AppointmentStatus",
    "Business",
    "CancellationEvent",
    "Channel",
    "Conversation",
    "ConversationState",
    "Customer",
    "Feedback",
    "FeedbackRoute",
    "KnowledgeItem",
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
    "Task",
    "TaskAssignee",
    "TaskAttachment",
    "TaskMailStatus",
    "TaskPriority",
    "TaskStatus",
    "TimeOff",
    "UserRole",
    "WaitlistEntry",
    "WaitlistStatus",
    "WorkingHours",
]

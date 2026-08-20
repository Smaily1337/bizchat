"""Feedback service — store scores; routing is stubbed."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, Feedback
from app.models.enums import FeedbackRoute
from app.services.events import hub


async def submit_feedback(
    db: AsyncSession,
    *,
    appointment_id: UUID,
    score: int,
    comment: str | None = None,
) -> Feedback:
    if score < 1 or score > 5:
        raise ValueError("score must be 1–5")

    # Stub routing: high scores → google, low → alert
    if score >= 4:
        routed = FeedbackRoute.google
    elif score <= 2:
        routed = FeedbackRoute.alert
    else:
        routed = FeedbackRoute.none

    feedback = Feedback(
        appointment_id=appointment_id,
        score=score,
        comment=comment,
        routed_to=routed,
    )
    db.add(feedback)
    await db.flush()

    appt = await db.get(Appointment, appointment_id)
    if appt is not None:
        if routed == FeedbackRoute.alert:
            title, msg = "Zła opinia", f"Ocena {score}/5 — sprawdź alerty"
        elif routed == FeedbackRoute.google:
            title, msg = "Dobra opinia", f"Ocena {score}/5 — kandydat do Google"
        else:
            title, msg = "Nowa opinia", f"Ocena {score}/5"
        await hub.publish(
            appt.business_id,
            "feedback.created",
            {
                "id": str(feedback.id),
                "score": score,
                "routed_to": routed.value,
                "appointment_id": str(appointment_id),
            },
            title=title,
            message=msg,
        )
    return feedback

"""Executive reports API: daily morning briefing and weekly/monthly PDF summaries."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentOwner, DbSession, RequireOwnerOrAdmin
from app.models import Business, Owner
from app.services.reports import (
    generate_executive_pdf_report,
    generate_morning_summary,
    send_morning_summary_notification,
    send_pdf_report_email,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])


class MorningSummaryPreviewOut(BaseModel):
    ok: bool = True
    summary_text: str
    appointments_count: int
    total_revenue: float
    date_label: str
    time_offs_count: int


class MorningSummarySendOut(BaseModel):
    ok: bool = True
    recipient: str | None
    message: str
    summary: dict


class PdfReportSendIn(BaseModel):
    period: Literal["week", "month"] = Field(default="week")
    target_email: str | None = None


class PdfReportSendOut(BaseModel):
    ok: bool = True
    recipient: str | None
    filename: str
    message: str


@router.get("/morning-summary/preview", response_model=MorningSummaryPreviewOut)
async def preview_morning_summary(
    db: DbSession,
    owner: CurrentOwner,
) -> MorningSummaryPreviewOut:
    """Generates today's morning briefing text for live preview."""
    res = await generate_morning_summary(db, owner.business_id)
    return MorningSummaryPreviewOut(
        ok=True,
        summary_text=res["summary_text"],
        appointments_count=res["appointments_count"],
        total_revenue=res["total_revenue"],
        date_label=res["date_label"],
        time_offs_count=res["time_offs_count"],
    )


@router.post("/morning-summary/send", response_model=MorningSummarySendOut)
async def send_morning_summary_test(
    db: DbSession,
    owner: RequireOwnerOrAdmin,
) -> MorningSummarySendOut:
    """Sends today's morning summary briefing to the business owner via Email."""
    biz = await db.get(Business, owner.business_id)
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")

    res = await send_morning_summary_notification(db, biz, owner)
    return MorningSummarySendOut(
        ok=True,
        recipient=res["recipient"],
        message=res["message"],
        summary=res["summary"],
    )


@router.get("/pdf")
async def download_executive_pdf(
    db: DbSession,
    owner: CurrentOwner,
    period: Literal["week", "month"] = Query(default="week"),
) -> Response:
    """Generates and streams the graphical executive PDF report for download."""
    biz = await db.get(Business, owner.business_id)
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")

    pdf_bytes = await generate_executive_pdf_report(db, owner.business_id, period=period)

    period_pl = "Tygodniowy" if period == "week" else "Miesieczny"
    safe_name = biz.name.replace(" ", "_").replace("/", "_")
    filename = f"Raport_{period_pl}_{safe_name}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.post("/pdf/send", response_model=PdfReportSendOut)
async def send_pdf_report_test(
    db: DbSession,
    owner: RequireOwnerOrAdmin,
    body: PdfReportSendIn,
) -> PdfReportSendOut:
    """Generates the executive PDF report and emails it to the owner."""
    biz = await db.get(Business, owner.business_id)
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")

    target_user = owner
    if body.target_email and body.target_email.strip():
        # Create a mock/override user container or pass override
        target_user = Owner(
            id=owner.id,
            business_id=owner.business_id,
            email=body.target_email.strip(),
            role=owner.role,
        )

    res = await send_pdf_report_email(db, biz, target_user, period=body.period)
    return PdfReportSendOut(
        ok=True,
        recipient=res["recipient"],
        filename=res["filename"],
        message=res["message"],
    )

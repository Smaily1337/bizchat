"""Email delivery — SMTP when configured, otherwise console (Cloud Logging)."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger("bizchat.mailer")


def send_email(
    *,
    to: str,
    subject: str,
    body: str,
    reply_to: str | None = None,
    attachments: list[tuple[str, bytes, str]] | None = None,
) -> None:
    """Send a plain-text email. attachments: (filename, data, content_type)."""
    if not settings.smtp_host:
        extra = ""
        if attachments:
            names = ", ".join(name for name, _, _ in attachments)
            extra = f"\nAttachments: {names}"
        logger.info(
            "\n========== BIZCHAT MAIL (console) ==========\n"
            "To: %s\nReply-To: %s\nSubject: %s\n\n%s%s\n"
            "============================================",
            to,
            reply_to or "",
            subject,
            body,
            extra,
        )
        print(
            f"\n========== BIZCHAT MAIL (console) ==========\n"
            f"To: {to}\nReply-To: {reply_to or ''}\nSubject: {subject}\n\n"
            f"{body}{extra}\n"
            f"============================================\n",
            flush=True,
        )
        return

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)

    for filename, data, content_type in attachments or []:
        maintype, _, subtype = (content_type or "application/octet-stream").partition(
            "/"
        )
        msg.add_attachment(
            data,
            maintype=maintype or "application",
            subtype=subtype or "octet-stream",
            filename=filename,
        )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        if settings.smtp_tls:
            smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)


def send_verification_email(*, to: str, token: str) -> None:
    link = f"{settings.public_frontend_url.rstrip('/')}/verify-email?token={token}"
    send_email(
        to=to,
        subject="BizChat — potwierdź adres e-mail",
        body=(
            "Cześć!\n\n"
            "Potwierdź adres e-mail w BizChat, klikając link:\n"
            f"{link}\n\n"
            "Jeśli nie zakładałeś konta, zignoruj tę wiadomość.\n"
        ),
    )

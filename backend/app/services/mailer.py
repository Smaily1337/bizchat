"""Email delivery — SMTP when configured, otherwise console (Cloud Logging)."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger("bizchat.mailer")


def send_email(*, to: str, subject: str, body: str) -> None:
    if not settings.smtp_host:
        logger.info(
            "\n========== BIZCHAT MAIL (console) ==========\n"
            "To: %s\nSubject: %s\n\n%s\n"
            "============================================",
            to,
            subject,
            body,
        )
        print(
            f"\n========== BIZCHAT MAIL (console) ==========\n"
            f"To: {to}\nSubject: {subject}\n\n{body}\n"
            f"============================================\n",
            flush=True,
        )
        return

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

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
        subject="Automovia — potwierdź adres e-mail",
        body=(
            "Cześć!\n\n"
            "Potwierdź adres e-mail w Automovia, klikając link:\n"
            f"{link}\n\n"
            "Jeśli nie zakładałeś konta, zignoruj tę wiadomość.\n"
        ),
    )

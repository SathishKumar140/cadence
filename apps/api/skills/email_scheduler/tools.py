import json
import uuid
from langchain_core.tools import tool
from database import SessionLocal
from dateutil import parser as date_parser
import models


def _get_user_id():
    from skills.email_scheduler._context import CURRENT_USER_ID
    return CURRENT_USER_ID


@tool
def schedule_email(subject: str, body: str, send_at: str, recipient: str = "") -> str:
    """
    Schedule an email to be sent at a specific time.
    subject: Email subject line
    body: Email body content
    send_at: When to send (e.g., 'tomorrow 9am', '2024-04-15 14:00', 'every Monday 8am')
    recipient: Email address (optional — defaults to user's own email as a reminder)
    """
    user_id = _get_user_id()
    try:
        send_time = date_parser.parse(send_at, fuzzy=True)
    except Exception:
        from datetime import datetime, timedelta
        send_time = datetime.utcnow() + timedelta(hours=1)

    with SessionLocal() as db:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        to_address = recipient or (user.email if user else "")

        email = models.ScheduledEmail(
            id=str(uuid.uuid4()),
            user_id=user_id,
            subject=subject,
            body=body,
            send_at=send_time,
            recipient=to_address,
            status="pending"
        )
        db.add(email)
        db.commit()

        return json.dumps({
            "status": "success",
            "email_id": email.id,
            "scheduled_for": send_time.isoformat(),
            "recipient": to_address,
            "ui_directive": {
                "view": "email_scheduler",
                "data": {"action": "scheduled", "email_id": email.id, "send_at": send_time.isoformat()}
            }
        })


@tool
def list_scheduled_emails() -> str:
    """List all pending and recently sent emails."""
    user_id = _get_user_id()
    with SessionLocal() as db:
        emails = db.query(models.ScheduledEmail).filter(
            models.ScheduledEmail.user_id == user_id
        ).order_by(models.ScheduledEmail.send_at).limit(20).all()

        result = [{
            "id": e.id,
            "subject": e.subject,
            "body": e.body[:100] + "..." if len(e.body) > 100 else e.body,
            "send_at": e.send_at.isoformat() if e.send_at else None,
            "recipient": e.recipient,
            "status": e.status
        } for e in emails]

    return json.dumps({
        "status": "success",
        "emails": result,
        "ui_directive": {"view": "email_scheduler", "data": {"emails": result}}
    })


@tool
def cancel_scheduled_email(email_id: str) -> str:
    """Cancel a pending scheduled email by its ID."""
    user_id = _get_user_id()
    with SessionLocal() as db:
        email = db.query(models.ScheduledEmail).filter(
            models.ScheduledEmail.id == email_id,
            models.ScheduledEmail.user_id == user_id
        ).first()
        if email and email.status == "pending":
            email.status = "cancelled"
            db.commit()
            return json.dumps({"status": "success", "message": "Email cancelled."})
    return json.dumps({"status": "error", "message": "Email not found or already sent."})


TOOLS = [schedule_email, list_scheduled_emails, cancel_scheduled_email]

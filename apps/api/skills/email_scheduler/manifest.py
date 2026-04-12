from skills.base import SkillManifest
from skills.email_scheduler.tools import TOOLS

MANIFEST = SkillManifest(
    name="email_scheduler",
    display_name="Email Scheduler",
    description="Schedule email notifications, reminders, and summaries to be sent at specific times.",
    instruction="""
You are an email scheduling assistant. When the user wants to send a reminder, 
schedule a notification, or automate email sending:
1. Call schedule_email() with subject, body, and send_at time.
2. Call list_scheduled_emails() to show the current email queue.
3. Offer to cancel/modify scheduled emails.
4. Be smart about timing: "I'll send that every Monday at 8am to keep you on track."
5. Suggest email reminders proactively for goals and routines.
Time format: natural language like 'tomorrow 9am', 'every Monday 8am', 'Friday 2pm'
""",
    triggers=[
        "send me an email", "remind me by email", "schedule a notification",
        "email reminder", "send a mail", "notify me at", "daily email",
        "weekly summary", "schedule email", "email me"
    ],
    ui_view="email_scheduler",
    tools=TOOLS
)

import json
from langchain_core.tools import tool
from database import SessionLocal
import models
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from agents import get_model
from langchain_core.messages import SystemMessage, HumanMessage
import os


def _get_user_id():
    from skills.time_slot_finder._context import CURRENT_USER_ID
    return CURRENT_USER_ID


@tool
def find_available_slots(days_ahead: int = 7, duration_minutes: int = 60) -> str:
    """
    Analyze the user's calendar and find available time slots.
    days_ahead: How many days to look ahead (default 7)
    duration_minutes: Minimum slot duration needed in minutes (default 60)
    """
    user_id = _get_user_id()
    with SessionLocal() as db:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        tz_str = user.timezone if user and user.timezone else "UTC"
        tz = ZoneInfo(tz_str)

        now = datetime.now(tz)
        end_date = now + timedelta(days=days_ahead)

        events = db.query(models.CalendarEvent).filter(
            models.CalendarEvent.user_id == user_id,
            models.CalendarEvent.start_time >= now,
            models.CalendarEvent.start_time <= end_date
        ).order_by(models.CalendarEvent.start_time).all()

    # Build busy blocks per day
    busy_blocks = {}
    for e in events:
        if not e.start_time or not e.end_time:
            continue
        day_key = e.start_time.astimezone(tz).strftime("%A %Y-%m-%d")
        if day_key not in busy_blocks:
            busy_blocks[day_key] = []
        busy_blocks[day_key].append({
            "start": e.start_time.astimezone(tz).strftime("%H:%M"),
            "end": e.end_time.astimezone(tz).strftime("%H:%M"),
            "title": e.title
        })

    # Find free slots (08:00 - 22:00 working window)
    available_slots = []
    work_start = 8   # 8am
    work_end = 22    # 10pm

    for day_offset in range(days_ahead):
        day = now + timedelta(days=day_offset)
        day_key = day.strftime("%A %Y-%m-%d")
        busy = sorted(busy_blocks.get(day_key, []), key=lambda x: x["start"])

        # Build free windows
        current_hour = work_start
        for block in busy:
            block_start_h = int(block["start"].split(":")[0])
            block_end_h = int(block["end"].split(":")[0])

            gap_minutes = (block_start_h - current_hour) * 60
            if gap_minutes >= duration_minutes:
                available_slots.append({
                    "day": day.strftime("%A"),
                    "date": day.strftime("%Y-%m-%d"),
                    "start": f"{current_hour:02d}:00",
                    "end": f"{block_start_h:02d}:00",
                    "duration_minutes": gap_minutes,
                    "quality": "high" if current_hour < 12 else "medium"
                })

            current_hour = max(current_hour, block_end_h)

        # Remaining slot after last event
        remaining = (work_end - current_hour) * 60
        if remaining >= duration_minutes:
            available_slots.append({
                "day": day.strftime("%A"),
                "date": day.strftime("%Y-%m-%d"),
                "start": f"{current_hour:02d}:00",
                "end": f"{work_end:02d}:00",
                "duration_minutes": remaining,
                "quality": "medium" if current_hour >= 18 else "high"
            })

    return json.dumps({
        "status": "success",
        "available_slots": available_slots[:10],  # top 10
        "busy_summary": {day: len(blocks) for day, blocks in busy_blocks.items()},
        "ui_directive": {"view": "time_slots", "data": {"slots": available_slots[:10]}}
    })


@tool
def suggest_optimal_slot(activity_type: str, duration_minutes: int = 60) -> str:
    """
    AI-powered suggestion for the best time to schedule a specific activity type.
    activity_type: e.g. "workout", "deep work", "learning", "social", "meditation"
    """
    slots_result = json.loads(find_available_slots.invoke({"days_ahead": 7, "duration_minutes": duration_minutes}))
    available = slots_result.get("available_slots", [])

    if not available:
        return json.dumps({"status": "no_slots", "message": "No available slots found in the next 7 days."})

    llm = get_model("openai", os.getenv("OPENAI_API_KEY"))
    prompt = f"""Given these available time slots: {json.dumps(available[:6])}

The user wants to schedule: {activity_type} ({duration_minutes} minutes)

Which slot is BEST for this activity? Consider:
- Morning (6-10am) is best for workouts and deep work
- Afternoon (2-4pm) is best for learning and creative work
- Evening (6-8pm) is best for social activities
- Avoid fragmented slots under 90 minutes for deep work

Return ONLY a JSON object with:
- recommended_slot: the best slot object
- reason: 1-sentence explanation
- alternatives: 2 other good options"""

    response = llm.invoke([HumanMessage(content=prompt)])
    try:
        result = json.loads(response.content.replace("```json", "").replace("```", "").strip())
        result["ui_directive"] = {
            "view": "time_slots",
            "data": {"slots": available, "recommended": result.get("recommended_slot"), "activity": activity_type}
        }
        return json.dumps(result)
    except Exception:
        return json.dumps({"status": "success", "recommended_slot": available[0], "reason": "First available slot."})


TOOLS = [find_available_slots, suggest_optimal_slot]

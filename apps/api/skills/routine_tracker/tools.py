import json
import uuid
from langchain_core.tools import tool
from database import SessionLocal
import models


def _get_user_id():
    from skills.routine_tracker._context import CURRENT_USER_ID
    return CURRENT_USER_ID


@tool
def create_routine(name: str, schedule: str, alert_time: str = None, description: str = "") -> str:
    """
    Create a new recurring routine for the user.
    name: Routine name e.g. 'Morning Workout'
    schedule: e.g. 'daily', 'weekdays', 'Monday,Wednesday,Friday', 'weekends'
    alert_time: Time to send alert e.g. '07:00' (optional)
    description: Brief description of the routine
    """
    user_id = _get_user_id()
    with SessionLocal() as db:
        routine = models.Routine(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=name,
            schedule=schedule,
            alert_time=alert_time,
            description=description,
            streak_count=0,
            is_active=True
        )
        db.add(routine)
        db.commit()

        return json.dumps({
            "status": "success",
            "routine": {"id": routine.id, "name": name, "schedule": schedule, "alert_time": alert_time},
            "ui_directive": {"view": "routine_dashboard", "data": {"action": "created", "routine_id": routine.id}}
        })


@tool
def get_routines() -> str:
    """Fetch all active routines with their streak counts and today's completion status."""
    from datetime import datetime, date
    user_id = _get_user_id()
    with SessionLocal() as db:
        routines = db.query(models.Routine).filter(
            models.Routine.user_id == user_id,
            models.Routine.is_active == True
        ).all()

        today = date.today()
        result = []
        for r in routines:
            last_done = r.last_completed.date() if r.last_completed else None
            done_today = last_done == today if last_done else False
            result.append({
                "id": r.id,
                "name": r.name,
                "schedule": r.schedule,
                "alert_time": r.alert_time,
                "description": r.description,
                "streak_count": r.streak_count,
                "done_today": done_today,
                "last_completed": r.last_completed.isoformat() if r.last_completed else None
            })

    return json.dumps({
        "status": "success",
        "routines": result,
        "ui_directive": {"view": "routine_dashboard", "data": {"routines": result}}
    })


@tool
def mark_routine_done(routine_id: str) -> str:
    """Mark a routine as completed for today and update the streak counter."""
    from datetime import datetime
    user_id = _get_user_id()
    with SessionLocal() as db:
        routine = db.query(models.Routine).filter(
            models.Routine.id == routine_id,
            models.Routine.user_id == user_id
        ).first()

        if not routine:
            return json.dumps({"status": "error", "message": "Routine not found"})

        now = datetime.utcnow()
        from datetime import timedelta
        yesterday = (now - timedelta(days=1)).date()
        last = routine.last_completed.date() if routine.last_completed else None

        if last == yesterday or last is None:
            routine.streak_count = (routine.streak_count or 0) + 1
        elif last != now.date():
            routine.streak_count = 1  # Reset streak

        routine.last_completed = now
        db.commit()

        return json.dumps({
            "status": "success",
            "streak": routine.streak_count,
            "message": f"🔥 Streak: {routine.streak_count} days!",
            "mutation": {"target": "routine", "action": "completed", "data": {"id": routine_id, "streak": routine.streak_count}}
        })


@tool
def delete_routine(routine_id: str) -> str:
    """Delete a routine by its ID."""
    user_id = _get_user_id()
    with SessionLocal() as db:
        routine = db.query(models.Routine).filter(
            models.Routine.id == routine_id,
            models.Routine.user_id == user_id
        ).first()
        if routine:
            routine.is_active = False
            db.commit()
    return json.dumps({"status": "success", "message": "Routine removed."})


TOOLS = [create_routine, get_routines, mark_routine_done, delete_routine]

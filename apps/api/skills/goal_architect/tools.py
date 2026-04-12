import json
import uuid
from langchain_core.tools import tool
from database import SessionLocal
import models
from agents import get_model
from langchain_core.messages import SystemMessage, HumanMessage
import os


def _get_user_id():
    from skills.goal_architect._context import CURRENT_USER_ID
    return CURRENT_USER_ID


@tool
def create_goal(title: str, target_value: float, unit: str, category: str, deadline: str = None) -> str:
    """
    Create a new personal goal with a measurable target.
    title: e.g. 'Read 2 books this month', 'Run 100km'
    target_value: numeric target e.g. 2, 100
    unit: e.g. 'books', 'km', 'hours', 'days', 'sessions'
    category: e.g. 'fitness', 'learning', 'productivity', 'social', 'health'
    deadline: optional e.g. '2024-04-30', 'end of month'
    """
    user_id = _get_user_id()
    from dateutil import parser as date_parser
    from datetime import datetime

    deadline_dt = None
    if deadline:
        try:
            deadline_dt = date_parser.parse(deadline, fuzzy=True)
        except Exception:
            pass

    with SessionLocal() as db:
        goal = models.Goal(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=title,
            target_value=target_value,
            current_value=0.0,
            unit=unit,
            category=category,
            deadline=deadline_dt,
            is_active=True
        )
        db.add(goal)
        db.commit()

        return json.dumps({
            "status": "success",
            "goal": {"id": goal.id, "title": title, "target": target_value, "unit": unit},
            "ui_directive": {"view": "goal_editor", "data": {"action": "created", "goal_id": goal.id}}
        })


@tool
def list_goals() -> str:
    """List all active goals with their current progress."""
    user_id = _get_user_id()
    with SessionLocal() as db:
        goals = db.query(models.Goal).filter(
            models.Goal.user_id == user_id,
            models.Goal.is_active == True
        ).all()

        result = [{
            "id": g.id,
            "title": g.title,
            "target_value": g.target_value,
            "current_value": g.current_value or 0,
            "unit": g.unit,
            "category": g.category,
            "progress_pct": round((g.current_value or 0) / g.target_value * 100, 1) if g.target_value else 0,
            "deadline": g.deadline.isoformat() if g.deadline else None
        } for g in goals]

    return json.dumps({
        "status": "success",
        "goals": result,
        "ui_directive": {"view": "goal_editor", "data": {"goals": result}}
    })


@tool
def update_goal_progress(goal_id: str, progress_delta: float) -> str:
    """
    Update the progress of a goal by adding to its current value.
    progress_delta: Amount to add (e.g., 1 for 'completed 1 book', 5 for 'ran 5km')
    """
    user_id = _get_user_id()
    with SessionLocal() as db:
        goal = db.query(models.Goal).filter(
            models.Goal.id == goal_id,
            models.Goal.user_id == user_id
        ).first()
        if not goal:
            return json.dumps({"status": "error", "message": "Goal not found"})

        goal.current_value = (goal.current_value or 0) + progress_delta
        pct = round(goal.current_value / goal.target_value * 100, 1) if goal.target_value else 0
        db.commit()

        msg = f"Progress updated! {goal.current_value}/{goal.target_value} {goal.unit} ({pct}%)"
        if pct >= 100:
            msg = f"🎉 Goal COMPLETED: {goal.title}!"

        return json.dumps({
            "status": "success",
            "message": msg,
            "progress_pct": pct,
            "mutation": {"target": "goals", "action": "update", "data": {"id": goal_id, "progress_pct": pct}}
        })


@tool
def suggest_ai_goals() -> str:
    """Ask the AI to suggest personalized goals based on the user's interests and calendar patterns."""
    user_id = _get_user_id()
    with SessionLocal() as db:
        pref = db.query(models.UserPreference).filter(
            models.UserPreference.user_id == user_id
        ).first()
        events = db.query(models.CalendarEvent).filter(
            models.CalendarEvent.user_id == user_id
        ).order_by(models.CalendarEvent.start_time.desc()).limit(10).all()

    interests = pref.interests if pref and pref.interests else ["productivity", "fitness"]
    event_titles = [e.title for e in events]

    llm = get_model("openai", os.getenv("OPENAI_API_KEY"))
    prompt = f"""Based on interests: {interests} and recent activities: {event_titles}

Suggest 4 specific, measurable goals. Return JSON array:
[{{
    "title": "specific goal",
    "target_value": 10,
    "unit": "sessions",
    "category": "fitness",
    "deadline": "end of month",
    "why": "1-sentence reason this goal matters"
}}]
Return ONLY JSON."""

    response = llm.invoke([
        SystemMessage(content="You suggest SMART goals — Specific, Measurable, Achievable, Relevant, Time-bound."),
        HumanMessage(content=prompt)
    ])

    try:
        suggestions = json.loads(response.content.replace("```json", "").replace("```", "").strip())
    except Exception:
        suggestions = []

    return json.dumps({
        "status": "success",
        "suggestions": suggestions,
        "ui_directive": {"view": "goal_editor", "data": {"suggestions": suggestions}}
    })


@tool
def suggest_better_time_slot_for_goal(goal_id: str) -> str:
    """
    Analyze a specific goal and suggest a better time slot to work on it based on calendar availability.
    """
    user_id = _get_user_id()
    with SessionLocal() as db:
        goal = db.query(models.Goal).filter(
            models.Goal.id == goal_id,
            models.Goal.user_id == user_id
        ).first()

    if not goal:
        return json.dumps({"status": "error", "message": "Goal not found"})

    # Delegate to time_slot_finder
    import importlib
    tsf_tools = importlib.import_module("skills.time_slot_finder.tools")
    import skills.time_slot_finder._context as ctx
    ctx.CURRENT_USER_ID = user_id

    result = tsf_tools.suggest_optimal_slot.invoke({"activity_type": goal.category or "general", "duration_minutes": 60})
    parsed = json.loads(result)
    parsed["goal_title"] = goal.title
    parsed["ui_directive"] = {"view": "time_slots", "data": {**parsed.get("ui_directive", {}).get("data", {}), "goal": goal.title}}
    return json.dumps(parsed)


TOOLS = [create_goal, list_goals, update_goal_progress, suggest_ai_goals, suggest_better_time_slot_for_goal]

import json
import uuid
from langchain_core.tools import tool
from database import SessionLocal
import models
from sqlalchemy.orm.attributes import flag_modified


@tool
def get_weekly_plan() -> str:
    """Fetch the user's current weekly schedule/plan including all item IDs, titles, days, and times."""
    from skills.schedule_manager._context import CURRENT_USER_ID
    with SessionLocal() as db:
        cached = db.query(models.DashboardCache).filter(
            models.DashboardCache.user_id == CURRENT_USER_ID
        ).first()
        if not cached or not cached.weekly_plan:
            return "Your weekly plan is currently empty."
        return json.dumps(cached.weekly_plan)


@tool
def add_plan_item(title: str, day: str, time: str, reason: str) -> str:
    """Add a new activity to the user's weekly plan. Day must be a weekday name (Monday-Sunday). Time format: HH:MM-HH:MM."""
    from skills.schedule_manager._context import CURRENT_USER_ID
    with SessionLocal() as db:
        cached = db.query(models.DashboardCache).filter(
            models.DashboardCache.user_id == CURRENT_USER_ID
        ).first()
        new_id = str(uuid.uuid4())
        new_item = {"id": new_id, "title": title, "day": day, "time": time, "reason": reason}

        if not cached:
            cached = models.DashboardCache(
                id=str(uuid.uuid4()),
                user_id=CURRENT_USER_ID,
                insights={"optimization_score": 0, "insight_cards": []},
                weekly_plan=[]
            )
            db.add(cached)

        if not isinstance(cached.weekly_plan, list):
            cached.weekly_plan = []

        cached.weekly_plan.append(new_item)
        flag_modified(cached, "weekly_plan")
        db.commit()

        return json.dumps({"status": "success", "mutation": {"target": "weekly_plan", "action": "add", "data": new_item}})


@tool
def update_plan_item(item_id: str, title: str = None, day: str = None, time: str = None, reason: str = None) -> str:
    """Update an existing plan item's details (title, day, time, or reason). Use for moving or swapping items."""
    from skills.schedule_manager._context import CURRENT_USER_ID
    with SessionLocal() as db:
        cached = db.query(models.DashboardCache).filter(
            models.DashboardCache.user_id == CURRENT_USER_ID
        ).first()
        if not cached or not isinstance(cached.weekly_plan, list):
            return "Item not found (no plan exists)."

        updated_item = None
        plan = list(cached.weekly_plan)
        for item in plan:
            if str(item.get("id")) == str(item_id):
                if title: item["title"] = title
                if day: item["day"] = day
                if time: item["time"] = time
                if reason: item["reason"] = reason
                updated_item = item
                break

        if updated_item:
            cached.weekly_plan = plan
            flag_modified(cached, "weekly_plan")
            db.commit()
            return json.dumps({"status": "success", "mutation": {"target": "weekly_plan", "action": "update", "data": updated_item}})

        return f"Item with ID {item_id} not found."


@tool
def remove_plan_item(item_id: str) -> str:
    """Remove an item from the weekly plan by its ID."""
    from skills.schedule_manager._context import CURRENT_USER_ID
    with SessionLocal() as db:
        cached = db.query(models.DashboardCache).filter(
            models.DashboardCache.user_id == CURRENT_USER_ID
        ).first()
        if cached and isinstance(cached.weekly_plan, list):
            cached.weekly_plan = [i for i in cached.weekly_plan if str(i.get("id")) != str(item_id)]
            flag_modified(cached, "weekly_plan")
            db.commit()

        return json.dumps({"status": "success", "mutation": {"target": "weekly_plan", "action": "remove", "data": {"id": item_id}}})


@tool
def modify_goals(workout_per_week: int = None, learning_hours_per_week: int = None, social_events: int = None) -> str:
    """Update the user's weekly goals. Only provide the fields that need to change."""
    from skills.schedule_manager._context import CURRENT_USER_ID
    with SessionLocal() as db:
        pref = db.query(models.UserPreference).filter(
            models.UserPreference.user_id == CURRENT_USER_ID
        ).first()
        if not pref:
            return "User preferences not found."

        updates = {}
        if workout_per_week is not None:
            pref.goals["workout_per_week"] = workout_per_week
            updates["workout_per_week"] = workout_per_week
        if learning_hours_per_week is not None:
            pref.goals["learning_hours_per_week"] = learning_hours_per_week
            updates["learning_hours_per_week"] = learning_hours_per_week
        if social_events is not None:
            pref.goals["social_events"] = social_events
            updates["social_events"] = social_events

        flag_modified(pref, "goals")
        db.commit()
        return json.dumps({"status": "success", "mutation": {"target": "goals", "action": "update", "data": updates}})


TOOLS = [get_weekly_plan, add_plan_item, update_plan_item, remove_plan_item, modify_goals]

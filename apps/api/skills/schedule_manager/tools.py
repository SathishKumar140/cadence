from datetime import datetime, timedelta

def get_next_weekday_date(day_name: str) -> str:
    """Converts a weekday name to the next occurrence of that date from today."""
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    target_idx = days.index(day_name.lower())
    now = datetime.now()
    current_idx = now.weekday()
    
    # Calculate days ahead. If target is today but time is passed, or just target is in future
    days_ahead = target_idx - current_idx
    if days_ahead < 0:
        days_ahead += 7
        
    target_date = now + timedelta(days=days_ahead)
    return target_date.strftime("%Y-%m-%d")

@tool
def get_weekly_plan() -> str:
    """Fetch the user's current schedule/plan for the next 4 weeks including item IDs, titles, dates, and times."""
    from skills.schedule_manager._context import CURRENT_USER_ID
    with SessionLocal() as db:
        cached = db.query(models.DashboardCache).filter(
            models.DashboardCache.user_id == CURRENT_USER_ID
        ).first()
        if not cached or not cached.weekly_plan:
            return "Your plan is currently empty."
        
        return json.dumps({
            "status": "success",
            "items": cached.weekly_plan,
            "ui_directive": {
                "view": "all_events",
                "data": {"items": cached.weekly_plan}
            }
        })


@tool
def add_plan_item(title: str, day: str, time: str, reason: str, date: str = None) -> str:
    """
    CRITICAL: Add a new activity to the user's plan.
    Day must be a weekday name (Monday-Sunday). Time format: HH:MM-HH:MM.
    Date: MANDATORY for multi-week planning. If unknown, the system will calculate it from the day name for the current week.
    
    UTILIZE CONTEXT: Check previous tool outputs (like 'scout_local_events') for these details.
    Always prioritize absolute dates (e.g. 'Apr 14') over relative day names.
    """
    from skills.schedule_manager._context import CURRENT_USER_ID
    with SessionLocal() as db:
        # Auto-calculate date if missing
        final_date = date
        if not final_date:
            try:
                final_date = get_next_weekday_date(day)
            except Exception:
                pass

        cached = db.query(models.DashboardCache).filter(
            models.DashboardCache.user_id == CURRENT_USER_ID
        ).first()
        new_id = str(uuid.uuid4())
        new_item = {
            "id": new_id, 
            "title": title, 
            "day": day, 
            "time": time, 
            "reason": reason,
            "date": final_date
        }

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

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import json
import uuid
import importlib
from langchain_core.tools import tool
from database import SessionLocal
import models
from sqlalchemy.orm.attributes import flag_modified

def get_next_weekday_date(day_name: str, start_from: datetime = None) -> str:
    """Converts a weekday name to the next occurrence of that date from a reference point."""
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    target_idx = days.index(day_name.lower())
    now = start_from if start_from else datetime.now()
    current_idx = now.weekday()
    
    # Calculate days ahead.
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
def add_plan_item(title: str, day: str, time: str, reason: str, date: str = None, source: str = None, url: str = None) -> str:
    """
    CRITICAL: Add a new activity to the user's plan.
    Day must be a weekday name (Monday-Sunday). Time format: HH:MM-HH:MM.
    Date: MANDATORY for multi-week planning. If unknown, the system will calculate it from the day name for the current week.
    Source: (Optional) The host or platform (e.g. 'Meetup', 'Internal').
    Url: (Optional) The link to the event or source info.
    
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
            "date": final_date,
            "source": source,
            "url": url,
            "is_discovery": True if source else False
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
def clear_entire_plan() -> str:
    """CRITICAL: Permanently remove ALL items from the weekly plan schedule. Use for full cleanup/reset."""
    from skills.schedule_manager._context import CURRENT_USER_ID
    with SessionLocal() as db:
        cached = db.query(models.DashboardCache).filter(
            models.DashboardCache.user_id == CURRENT_USER_ID
        ).first()
        if cached:
            cached.weekly_plan = []
            flag_modified(cached, "weekly_plan")
            db.commit()
            return json.dumps({"status": "success", "message": "All items removed from plan.", "mutation": {"target": "weekly_plan", "action": "clear"}})
        return "Plan was already empty."

@tool
def purge_dashboard_insights() -> str:
    """CRITICAL: Reset the Strategic Hub optimization score and clear all insight cards. Use for full cleanup/reset."""
    from skills.schedule_manager._context import CURRENT_USER_ID
    with SessionLocal() as db:
        cached = db.query(models.DashboardCache).filter(
            models.DashboardCache.user_id == CURRENT_USER_ID
        ).first()
        if cached:
            cached.insights = {"optimization_score": 0, "insight_cards": []}
            flag_modified(cached, "insights")
            db.commit()
            return json.dumps({"status": "success", "message": "Dashboard insights purged.", "mutation": {"target": "insights", "action": "clear"}})
        return "Dashboard was already clean."

@tool
def cleanup_strategic_dashboard() -> str:
    """CRITICAL: Full system reset. Wipes ALL weekly plan items AND resets all Strategic Hub insights/scores in one step. Use when the user asks for a 'full cleanup' or 'reset everything'."""
    from skills.schedule_manager._context import CURRENT_USER_ID
    with SessionLocal() as db:
        cached = db.query(models.DashboardCache).filter(
            models.DashboardCache.user_id == CURRENT_USER_ID
        ).first()
        if cached:
            cached.weekly_plan = []
            cached.insights = {"optimization_score": 0, "insight_cards": []}
            flag_modified(cached, "weekly_plan")
            flag_modified(cached, "insights")
            
            # TOTAL GROUND-ZERO DATABASE PURGE
            db.query(models.PendingAction).filter(models.PendingAction.user_id == CURRENT_USER_ID).delete()
            db.query(models.CalendarEvent).filter(models.CalendarEvent.user_id == CURRENT_USER_ID).delete()
            db.query(models.TopicListener).filter(models.TopicListener.user_id == CURRENT_USER_ID).delete()
            db.query(models.Routine).filter(models.Routine.user_id == CURRENT_USER_ID).delete()
            db.query(models.KnowledgeItem).filter(models.KnowledgeItem.user_id == CURRENT_USER_ID).delete()
            db.query(models.ScheduledEmail).filter(models.ScheduledEmail.user_id == CURRENT_USER_ID).delete()
            
            db.commit()
            return json.dumps({
                "status": "success", 
                "message": "Strategic dashboard fully cleaned: items and insights purged.",
                "mutation": {"target": "dashboard", "action": "clear"}
            })
        return "Dashboard was already clean."


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


@tool
async def generate_priority_weekly_plan(target_week: str = "current", force_scout: bool = True) -> str:
    """
    Generate a high-priority tactical sequence for the next 7 days based on the user's core interests.
    Use this specifically when the user asks for a 'plan for next week' or 'plan for this week'.
    
    target_week: 'current' (days starting today) or 'next' (7 days starting next Monday).
    It fetches all preferences, scouts for matching events across sources, and identifies free slots.
    """
    from skills.schedule_manager._context import CURRENT_USER_ID
    user_id = CURRENT_USER_ID
    
    with SessionLocal() as db:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        tz_str = user.timezone if user and user.timezone else "UTC"
        tz = ZoneInfo(tz_str)
        
        pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == user_id).first()
        interests = pref.interests if pref and pref.interests else []
        location = "San Francisco" 
        if pref and pref.location:
             location = pref.location.get("city") or pref.location.get("name") or location

    if not interests:
        return "I don't have any interests set for you. Please tell me what you're into first!"

    # Calculate start date based on target_week
    now = datetime.now(tz)
    if target_week == "next":
        # Calculate next Monday
        days_until_monday = (0 - now.weekday() + 7) % 7
        if days_until_monday == 0: days_until_monday = 7
        start_date_dt = now + timedelta(days=days_until_monday)
        selected_week_index = 1
    else:
        start_date_dt = now
        selected_week_index = 0
        
    start_date_str = start_date_dt.strftime("%Y-%m-%d")

    # 1. Scout for events matching ALL interests
    all_discoveries = []
    if force_scout:
        es_tools = importlib.import_module("skills.event_scout.tools")
        import skills.event_scout._context as es_ctx
        es_ctx.CURRENT_USER_ID = user_id
        
        # To avoid massive wait time, we fetch sequentially but keep it focused
        for interest in interests[:5]: 
            try:
                # Event scout might need start_date support too, but for now we look wide
                res = await es_tools.scout_local_events.ainvoke({"query": interest, "location": location})
                data = json.loads(res)
                if data.get("discoveries"):
                    all_discoveries.extend(data["discoveries"])
            except Exception:
                pass

    # 2. Find available slots for the TARGET week
    tsf_tools = importlib.import_module("skills.time_slot_finder.tools")
    import skills.time_slot_finder._context as tsf_ctx
    tsf_ctx.CURRENT_USER_ID = user_id
    
    slots_res = tsf_tools.find_available_slots.invoke({
        "days_ahead": 7, 
        "start_date": start_date_str
    })
    slots = json.loads(slots_res).get("available_slots", [])

    # 3. ATOMIC PERSISTENCE: Save the new strategic pulse to the DashboardCache
    with SessionLocal() as db:
        cached = db.query(models.DashboardCache).filter(models.DashboardCache.user_id == user_id).first()
        if not cached:
            cached = models.DashboardCache(
                id=str(uuid.uuid4()),
                user_id=user_id,
                weekly_plan=[],
                insights={"optimization_score": 0, "insight_cards": []}
            )
            db.add(cached)
        
        # We store discoveries as the base for the plan if it was just cleared
        # In a real app, this would be a more complex merging logic
        proposed_plan = []
        for i, discovery in enumerate(all_discoveries[:10]):
            slot = slots[i % len(slots)] if slots else {}
            proposed_plan.append({
                "id": str(uuid.uuid4()),
                "title": discovery.get("title", "Insight Review"),
                "day": slot.get("day", "Today"),
                "time": slot.get("time", "14:00"),
                "reason": discovery.get("description", "")[:200],
                "source": discovery.get("url")
            })
            
        cached.weekly_plan = proposed_plan
        # Update insights score based on find density
        score = min(100, len(all_discoveries) * 10)
        cached.insights = {
            "optimization_score": score,
            "insight_cards": [
                {"title": "Schedule Density", "value": f"+{len(slots)} Gaps Identified"},
                {"title": "Opportunity Scout", "value": f"{len(all_discoveries)} Matches Found"}
            ]
        }
        
        flag_modified(cached, "weekly_plan")
        flag_modified(cached, "insights")
        db.commit()

    return json.dumps({
        "status": "success",
        "message": f"Strategy synchronized for {target_week} week. I've populated your Tactical Timeline with {len(proposed_plan)} fresh maneuvers.",
        "mutation": {
            "target": "dashboard", 
            "action": "sync", 
            "data": {
                "plan": proposed_plan,
                "insights": cached.insights,
                "selected_week_index": selected_week_index
            }
        }
    })


TOOLS = [get_weekly_plan, add_plan_item, update_plan_item, remove_plan_item, clear_entire_plan, purge_dashboard_insights, cleanup_strategic_dashboard, modify_goals, generate_priority_weekly_plan]

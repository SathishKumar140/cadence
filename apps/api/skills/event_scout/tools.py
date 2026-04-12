import json
import os
from langchain_core.tools import tool
from integrations import EventDiscoveryService
from database import SessionLocal
import models


def _get_user_id():
    from skills.event_scout._context import CURRENT_USER_ID
    return CURRENT_USER_ID


@tool
async def scout_events(query: str, location: str = None) -> str:
    """
    Search for real-world events (Eventbrite, Luma, Meetup, etc.) based on a topic and location.
    If location is not provided, uses the user's profile location or calendar-inferred city.
    """
    user_id = _get_user_id()
    target_location = location
    source_info = ""

    with SessionLocal() as db:
        eb_key = None
        integration = db.query(models.Integration).filter(
            models.Integration.user_id == user_id,
            models.Integration.provider == "eventbrite",
            models.Integration.enabled == True
        ).first()
        if integration:
            eb_key = integration.access_token

        if not target_location:
            pref = db.query(models.UserPreference).filter(
                models.UserPreference.user_id == user_id
            ).first()
            if pref and pref.location:
                loc_data = pref.location
                if isinstance(loc_data, dict):
                    target_location = loc_data.get("city") or loc_data.get("name")
                else:
                    target_location = str(loc_data)
                if target_location:
                    source_info = f" (using your profile location: {target_location})"

        if not target_location:
            recent_events = db.query(models.CalendarEvent).filter(
                models.CalendarEvent.user_id == user_id,
                models.CalendarEvent.location.isnot(None)
            ).order_by(models.CalendarEvent.start_time.desc()).limit(10).all()

            for ev in recent_events:
                if ev.location and "," in ev.location:
                    target_location = ev.location.split(",")[-1].strip()
                    source_info = f" (inferred from your calendar)"
                    break
                elif ev.location and len(ev.location) > 2:
                    target_location = ev.location
                    break

    if not target_location:
        return "I don't have a location for you. Which city should I search in?"

    tavily_key = os.getenv("TAVILY_API_KEY")
    service = EventDiscoveryService(eventbrite_key=eb_key, tavily_key=tavily_key)
    interests = [i.strip() for i in query.split(",")]
    events = await service.discover(interests, target_location)

    if events:
        return json.dumps({
            "status": "success",
            "location_used": target_location,
            "message": f"Found {len(events)} events in {target_location}{source_info}.",
            "discoveries": events[:4],
            "ui_directive": {
                "view": "discoveries",
                "data": {"events": events[:4], "location": target_location, "query": query}
            }
        })

    return f"No events found in {target_location} for those interests. Try a different city or topic."


TOOLS = [scout_events]

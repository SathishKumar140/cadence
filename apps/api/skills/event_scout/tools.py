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
async def scout_local_events(query: str, location: str = None) -> str:
    """
    Search for PHYSICAL real-world meetings and events (Meetup, Eventbrite, Luma) in a SPECIFIC CITY.
    Requires a location (city). Use this only for physical attendence intents like 'find meetups in London'.
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
            from location_utils import resolve_user_location
            target_location = resolve_user_location(user_id, db)
            if target_location:
                source_info = f" (dynamically detected location: {target_location})"

    if not target_location:
        return "I don't have a location for you. Which city should I search in?"

    tavily_key = os.getenv("TAVILY_API_KEY")
    service = EventDiscoveryService(eventbrite_key=eb_key, tavily_key=tavily_key)
    interests = [i.strip() for i in query.split(",")]
    events = await service.discover(interests, target_location)

    if events:
        # Check against existing schedule to filter out already added items
        with SessionLocal() as db:
            cache = db.query(models.DashboardCache).filter(
                models.DashboardCache.user_id == user_id
            ).first()
            
            scheduled_titles = []
            if cache and cache.weekly_plan:
                scheduled_titles = [item.get("title", "").lower() for item in cache.weekly_plan]
            
            for ev in events:
                ev["is_scheduled"] = ev.get("title", "").lower() in scheduled_titles

        return json.dumps({
            "status": "success",
            "location_used": target_location,
            "message": f"Found {len(events)} events in {target_location}{source_info}.",
            "discoveries": events[:10],
            "ui_directive": {
                "view": "discoveries",
                "data": {"events": events[:10], "location": target_location, "query": query}
            }
        })

    return f"No events found in {target_location} for those interests. Try a different city or topic."


TOOLS = [scout_local_events]

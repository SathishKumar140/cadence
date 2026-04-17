import models
from sqlalchemy.orm import Session
from typing import Optional

def resolve_user_location(user_id: str, db: Session) -> Optional[str]:
    """
    Dynamically resolves a user's current city/location without hardcoded defaults.
    Strategy:
    1. Check UserPreference.location (User-defined Profile)
    2. Check recent CalendarEvent locations (Action-based Inference)
    3. Infer from User.timezone (e.g., 'Asia/Singapore' -> 'Singapore')
    """
    
    # Tier 1: User Profile Preference
    pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == user_id).first()
    if pref and pref.location:
        loc_data = pref.location
        if isinstance(loc_data, dict):
            city = loc_data.get("city") or loc_data.get("name")
            if city: return city
        elif isinstance(loc_data, str) and len(loc_data) > 1:
            return loc_data

    # Tier 2: Recent Calendar Events (Action Inference)
    recent_events = db.query(models.CalendarEvent).filter(
        models.CalendarEvent.user_id == user_id,
        models.CalendarEvent.location.isnot(None)
    ).order_by(models.CalendarEvent.start_time.desc()).limit(10).all()
    
    for ev in recent_events:
        if not ev.location: continue
        # Try to extract city from common 'Venue, City, Country' format
        if "," in ev.location:
            parts = [p.strip() for p in ev.location.split(",")]
            # If multiple parts, the 2nd to last is often the city/region
            if len(parts) >= 2:
                # If the last part is a country, return the one before it
                return parts[-2] if len(parts) > 2 else parts[0]
        elif len(ev.location) > 2:
            return ev.location

    # Tier 3: Timezone Triangulation
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user and user.timezone:
        # Timezones like 'Asia/Singapore' or 'America/Los_Angeles'
        if "/" in user.timezone:
            city_slug = user.timezone.split("/")[-1].replace("_", " ")
            if city_slug and len(city_slug) > 2:
                return city_slug

    return None

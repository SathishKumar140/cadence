import httpx
import os
from typing import List, Dict, Any

class EventbriteClient:
    """
    Client for Eventbrite API.
    Uses an OAuth token typically stored in environment variables or user settings.
    """
    BASE_URL = "https://www.eventbriteapi.com/v3"

    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("EVENTBRITE_API_KEY")

    async def search_events(self, keywords: List[str], location: Dict[str, Any] = None, radius_km: int = 50) -> List[Dict[str, Any]]:
        """
        Search for events on Eventbrite.
        Note: Eventbrite API v3 /events/search/ is legacy/deprecated in some versions, 
        often replaced by organization-specific or specialized endpoints.
        For a broad search, keyword-based search on certain endpoints might be needed.
        """
        if not self.api_key:
            return []

        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }
        
        # Simulating a search query. In a real scenario, you'd use specific endpoints or coordinates.
        params = {
            "q": " ".join(keywords),
            "sort_by": "date"
        }
        
        if location and location.get("latitude") and location.get("longitude"):
            params["location.latitude"] = location["latitude"]
            params["location.longitude"] = location["longitude"]
            params["location.within"] = f"{radius_km}km"

        async with httpx.AsyncClient() as client:
            try:
                # Eventbrite API v3 often requires specific permissions for broad search.
                # This is a representative implementation.
                response = await client.get(f"{self.BASE_URL}/events/search/", params=params, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    events = data.get("events", [])
                    return [
                        {
                            "title": e.get("name", {}).get("text", "Event"),
                            "description": e.get("description", {}).get("text", ""),
                            "start_time": e.get("start", {}).get("utc"),
                            "end_time": e.get("end", {}).get("utc"),
                            "url": e.get("url"),
                            "location": e.get("venue_id", "Multiple Locations"), # Real app would fetch venue
                            "source": "eventbrite"
                        }
                        for e in events
                    ]
                return []
            except Exception as e:
                print(f"Eventbrite API Error: {e}")
                return []

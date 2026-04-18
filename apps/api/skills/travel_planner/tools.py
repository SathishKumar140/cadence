import json
import os
import uuid
from typing import Dict, Any, List
from langchain_core.tools import tool
from langchain_core.messages import SystemMessage, HumanMessage
from database import SessionLocal
from tavily import TavilyClient

def _get_user_id() -> str:
    from skills.travel_planner._context import CURRENT_USER_ID
    return CURRENT_USER_ID

@tool
async def scout_travel_plans(
    destination: str, 
    origin: str = "", 
    dates: str = "Upcoming", 
    duration_days: int = 3, 
    trip_pace: str = "Balanced", 
    interests: List[str] = [],
    included_stops: List[str] = []
) -> str:
    """
    Plan a travel itinerary, fetch flights, hotels, and the best time to visit using real-time search.
    Args:
        destination (str): The place the user wants to go (e.g. "Tokyo, Japan").
        origin (str): Where the user is flying from. If empty, the system will dynamically detect it.
        dates (str): The desired travel dates.
        duration_days (int): Number of days for the trip.
        trip_pace (str): The desired pace (Relaxed, Balanced, Fast-paced).
        interests (List[str]): Specific interests (e.g. ["Hiking", "Art"]).
        included_stops (List[str]): Specific cities or regions to include in the trip (e.g. ["Shenzhen", "Chongqing"]).
    """
    user_id = _get_user_id()
    
    # 1. Resolve Location if empty
    if not origin or origin.strip() == "":
        try:
            with SessionLocal() as db:
                from location_utils import resolve_user_location
                origin = resolve_user_location(user_id, db) or "Singapore" # fallback
        except Exception as e:
            print(f"Error resolving origin location: {e}")
            origin = "Singapore"

    # 2. Setup Tavily Search for real-time intelligence
    tavily_key = os.getenv("TAVILY_API_KEY")
    insights_text = ""
    flights_text = ""
    hotels_text = ""
    
    interests_str = ", ".join(interests) if interests else "Sightseeing, Culture"
    stops_str = ", ".join(included_stops) if included_stops else ""
    
    if tavily_key and "placeholder" not in tavily_key:
        try:
            client = TavilyClient(api_key=tavily_key)
            
            # Context 1: Destination insights (seasons, festivals) calibrated to dates
            insight_query = f"festivals and events in {destination} during {dates} weather conditions"
            res_insights = client.search(insight_query, max_results=3)
            insights_text = json.dumps([r['content'] for r in res_insights.get('results', [])])
            
            # Context 2: Flights
            res_flights = client.search(f"cheap flight prices deals from {origin} to {destination} {dates}", max_results=3)
            flights_text = json.dumps([r['content'] for r in res_flights.get('results', [])])
            
            # Context 3: Hotels
            search_hotel_query = f"{trip_pace} hotels recommendations in {destination} {dates} for {interests_str}"
            res_hotels = client.search(search_hotel_query, max_results=3)
            hotels_text = json.dumps([r['content'] for r in res_hotels.get('results', [])])
            
        except Exception as e:
            print(f"Tavily Search Error in Travel Planner: {e}")
    
    # 3. Use internal LLM to parse raw text into clean JSON format
    try:
        from agents import get_model, flatten_content
        llm = get_model() # Uses default provider
        
        prompt = f"""
        You are a JSON formatter for a travel agent. Analyze the following web search data and extract structured travel options.
        PERSONALIZATION PROFILE:
        - Primary Destination: {destination}
        - Included Stops/Cities: {stops_str}
        - Duration: {duration_days} days
        - Travel window: {dates}
        - Pace: {trip_pace}
        - Interests: {interests_str}
        
        Web Insights Context: {insights_text}
        Flights Context: {flights_text}
        Hotels Context: {hotels_text}
        
        Return ONLY a JSON object with this exact structure:
        {{
            "best_season": "Short description of the best time to visit and weather",
            "upcoming_festivals": ["Festival 1 (Month)", "Festival 2 (Month)"],
            "hero_image_url": "A high-quality Unsplash image URL for the destination (e.g., https://images.unsplash.com/photo-XXX?auto=format&fit=crop&w=1200&q=80)",
            "strategic_route_recommendation": "A brief explanation of why this city sequence was chosen for maximum efficiency (e.g., 'Entering via Shenzhen and exiting via Beijing saves 4 hours of domestic travel from Singapore')",
            "flights": [
                {{"airline": "Airline Name", "price": "$X", "layovers": "Direct / 1 Stop", "duration": "XH YM", "booking_url": "Official portal URL"}}
            ],
            "hotels": [
                {{"name": "Hotel Name", "price_per_night": "$Y", "rating": "4.5 Stars", "area": "Neighborhood", "image_url": "Unsplash hotel image URL", "booking_url": "Official portal URL"}}
            ],
            "suggested_itinerary": [
                {{"day": 1, "title": "Day Title", "image_url": "Unsplash image URL", "activities": [
                    "Breakfast: Local specialty at... (08:30 AM)",
                    "Morning: Visiting X Landmark (10:00 AM) - [Tactical Tip: Arrive early to avoid crowds]",
                    "Lunch: Hidden gem recommendation... (12:30 PM)",
                    "Afternoon: Exploring Y District (02:30 PM)",
                    "Evening: Dinner & Z View (07:00 PM)"
                ]}},
                ... (provide {duration_days} days total)
            ]
        }}
        
        GEOGRAPHICAL STRATEGY (CRITICAL):
        1. Analyze the distance from {origin} to each stop ({destination}, {stops_str}).
        2. Sequence the itinerary to minimize total travel distance and "zigzagging".
        3. Optimize for Open-Jaw paths: If entering via one city and exiting via another is more efficient given {origin}, suggest that path in `strategic_route_recommendation` and the itinerary structure.
        
        TEMPORAL RELEVANCE (CRITICAL):
        - If `{dates}` is not "Upcoming", you MUST prioritize festivals and events occurring during that specific window. 
        - Tailor the `best_season` description to evaluate the suitability of the `{dates}` window specifically for this trip.
        
        ITINERARY DENSITY (CRITICAL):
        - Each day MUST have at least 4-5 distinct activities covering Morning, Lunch, Afternoon, and Evening/Dinner. 
        - DO NOT provide sparse 1-2 item lists. 
        - Include specific names of neighborhoods, food spots, or landmarks with short tactical advice in brackets e.g. [Buy tickets online].

        Provide exactly 3 flights, 3 hotels, and a {duration_days}-day itinerary. 
        5. For ALL image_urls and booking_urls:
            - Use high-quality Unsplash source URLs for imagery.
            - Ensure `booking_url` points to the most logical official portal.
        """
        
        response = await llm.ainvoke([
            SystemMessage(content="You are a strict JSON data extractor and travel architect."),
            HumanMessage(content=prompt)
        ])
        
        content = flatten_content(response.content)
        content = content.replace("```json", "").replace("```", "").strip()
        data = json.loads(content)
        
    except Exception as e:
        print(f"LLM Parsing Error: {e}")
        # Fallback Mock Data with URLs
        data = {
            "origin": origin,
            "destination": destination,
            "dates": dates,
            "insights": {
                "season": f"The period in {dates.split()[0]} is ideal for {destination}.",
                "festivals": ["Local Art Festival", "Food Week"],
                "route_logic": f"Optimized multi-stop routing entering via {destination}."
            },
            "hero_image": "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1200",
            "flights": [
                {"airline": "Singapore Airlines", "price": "$316", "layovers": "Direct", "duration": "5H 30M", "booking_url": "https://www.singaporeair.com"},
                {"airline": "Air China", "price": "$309", "layovers": "Direct", "duration": "6H 15M", "booking_url": "https://www.airchina.com"}
            ],
            "hotels": [
                {"name": "The Upper House", "price_per_night": "$450", "rating": "5 Stars", "area": "Central", "image_url": "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800", "booking_url": "https://www.booking.com"},
                {"name": "Mandarin Oriental", "price_per_night": "$520", "rating": "5 Stars", "area": "Waterfront", "image_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800", "booking_url": "https://www.mandarinoriental.com"}
            ],
            "itinerary": [
                {
                    "day": 1, 
                    "title": "Shanghai Modernism & Tradition", 
                    "image_url": "https://images.unsplash.com/photo-1517089535811-66af7d8001e7?auto=format&fit=crop&w=800", 
                    "activities": [
                        "Sunrise: Bund Riverside Walk (07:30 AM) - Best for empty photos.",
                        "Morning: Yu Garden & Old City Exploration (09:30 AM).",
                        "Lunch: Xiaolongbao Tasting at Nanxiang (12:30 PM).",
                        "Afternoon: Shanghai Museum & People's Square (02:30 PM).",
                        "Night: Oriental Pearl Tower Observatory & Dinner (07:00 PM)."
                    ]
                }
            ]
        }

    # 4. Return UI Directive
    payload = {
        "status": "success",
        "message": f"I've compiled a travel dossier for {destination} departing from {origin}.",
        "ui_directive": {
            "view": "travel_planner",
            "data": {
                "destination": destination,
                "included_stops": included_stops,
                "hero_image": data.get("hero_image_url", "/travel_hero.png"),
                "origin": origin,
                "dates": dates,
                "duration_days": duration_days,
                "trip_pace": trip_pace,
                "interests": interests,
                "insights": {
                    "season": data.get("best_season", ""),
                    "festivals": data.get("upcoming_festivals", []),
                    "route_logic": data.get("strategic_route_recommendation", "")
                },
                "flights": data.get("flights", []),
                "hotels": data.get("hotels", []),
                "itinerary": data.get("suggested_itinerary", [])
            }
        }
    }
    
    return json.dumps(payload)

@tool
async def open_travel_planner_configurator(destination: str, duration_days: int = 3, trip_pace: str = "Balanced", interests: List[str] = [], included_stops: List[str] = []) -> str:
    """
    Open the interactive travel planner to gather trip details (Days, Pace, Interests). 
    Use this when you need more details from the user before scouting.
    """
    payload = {
        "status": "success",
        "ui_directive": {
            "view": "travel_setup",
            "data": {
                "destination": destination,
                "prefill": {
                    "duration_days": duration_days,
                    "trip_pace": trip_pace,
                    "interests": interests,
                    "included_stops": included_stops
                }
            }
        }
    }
    return json.dumps(payload)

TOOLS = [scout_travel_plans, open_travel_planner_configurator]

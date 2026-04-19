import json
import os
import uuid
import asyncio
from datetime import datetime
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
            import asyncio
            client = TavilyClient(api_key=tavily_key)
            
            # Parallelize searches to minimize socket termination risk
            async def get_insights():
                q = f"festivals and events in {destination} during {dates} weather conditions"
                return client.search(q, max_results=3, search_depth="basic")
            
            async def get_flights():
                # Dynamic Port Strategy: Search specifically for "Cheapest" and "Best" deals.
                # If destination is "China", the search will naturally pick up Guangzhou (CAN) or Shanghai (PVG) based on price.
                q = f"Skyscanner cheapest economy flight direct from {origin} to {destination} or major China hub on {dates} 2026"
                return client.search(q, max_results=10, search_depth="advanced")
                
            async def get_hotels():
                q = f"Skyscanner best hotels in {destination} for {dates} with prices and ratings"
                return client.search(q, max_results=6, search_depth="advanced")

            results = await asyncio.gather(get_insights(), get_flights(), get_hotels())
            
            res_insights, res_flights, res_hotels = results
            
            insights_text = json.dumps([{"c": r['content'][:400], "u": r['url']} for r in res_insights.get('results', [])])
            flights_text = json.dumps([{"c": r['content'][:400], "u": r['url']} for r in res_flights.get('results', [])])
            hotels_text = json.dumps([{"c": r['content'][:400], "u": r['url']} for r in res_hotels.get('results', [])])
            
        except Exception as e:
            print(f"Tavily Search Error in Travel Planner: {e}")
    
    # 3. Use internal LLM to parse raw text into clean JSON format
    try:
        from agents import get_model, flatten_content
        llm = get_model() # Uses default provider
        
        prompt = f"""
        You are a travel architect and IATA specialist. Analyze the search data and extract structured travel options.
        PERSONALIZATION PROFILE:
        - Current Date: {datetime.now().strftime('%Y-%m-%d')}
        - Primary Destination: {destination}
        - Included Stops: {stops_str}
        - Duration: {duration_days} days
        - Window: {dates}
        
        Context (Content & Source URLs):
        Flights: {flights_text}
        Hotels: {hotels_text}
        
        IATA & ENTITY DISCOVERY:
        - Identify IATA codes (e.g., CCU, PVG, SIN).
        - SKYSCANNER ENTITY IDs (CRITICAL):
            - Beijing: 45695035
            - Shanghai: 27536640
            - Guangzhou: 27546680
            - Hong Kong: 27536665
            - For others: Extract the numeric 'entity_id' from Skyscanner URLs found in the 'Hotels' context.
        - DATE RESOLUTION: Resolve the user's travel window ({dates}) into precise formats.
          Check-in (YYMMDD): {dates} 2026.
          Check-out (YYMMDD): Check-in + {duration_days} days.
          Also provide YYYY-MM-DD format for hotel links.
        
        Return ONLY a JSON object:
        {{
            "best_season": "...",
            "upcoming_festivals": ["Festival (Month)"],
            "hero_image_url": "...",
            "strategic_route_recommendation": "...",
            "flights": [
                {{
                    "airline": "Airline Name", 
                    "price": "£X", 
                    "date": "Friday, May 15, 2026",
                    "layovers": "1 Stop", 
                    "route": "CCU ➔ CAN",
                    "stop_details": "via DAC",
                    "duration": "XH YM",
                    "booking_url": "https://www.skyscanner.net/transport/flights/[ORIG_IATA]/[DEST_IATA]/260515/?adults=1&cabinclass=economy",
                    "is_live_quote": true
                }}
            ],
            "hotels": [
                {{
                    "name": "Hotel Name", 
                    "price_per_night": "$Y", 
                    "rating": "4.5 Stars", 
                    "area": "Neighborhood", 
                    "image_url": "...",
                    "booking_url": "DEEP_LINK",
                    "is_live_quote": true
                }}
            ],
            "suggested_itinerary": [
                {{
                    "day": 1, 
                    "title": "Welcome to [City]", 
                    "image_url": "...", 
                    "activities": ["Morning: ...", "Lunch: ...", "Afternoon: ...", "Evening: ..."]
                }}
            ]
        }}
        
        LIVE PRICE EXTRACTION (CRITICAL):
        - You MUST extract the actual, real-time prices found in the context.
        - CHEAPEST FIRST: Prioritize results labeled "Best", "Cheapest", or "Lowest". DO NOT use higher prices if a lower one (e.g., £113) is present in the snippets for the same route.
        - DATE MATCHING: Ensure the pricing corresponds to the exact date: {dates}, 2026.
        - CURRENCY INTEGRITY: Use the currency from the snippet (e.g., £, €, ₹). DO NOT convert to $ unless clearly instructed by the context.
        - Set `is_live_quote` to true only if you found a specific price in the context.
        
        BOOKING_URL LOGIC (CRITICAL):
        1. FOR FLIGHTS: Construct a Skyscanner Deep Link using the precise path format.
           Pattern: `https://www.skyscanner.net/transport/flights/[ORIGIN_IATA]/[DEST_IATA]/[YYMMDD]/?adults=1&cabinclass=economy`
        2. FOR HOTELS: Construct the Verified Skyscanner Hotel Search Link.
           Pattern: `https://www.skyscanner.com.sg/hotels/search?entity_id=[ENTITY_ID]&checkin=[YYYY-MM-DD]&checkout=[YYYY-MM-DD]&adults=1&rooms=1`
           (Example Beijing -> `https://www.skyscanner.com.sg/hotels/search?entity_id=45695035&checkin=2026-05-15&checkout=2026-05-25&adults=1&rooms=1`)
        
        GEOGRAPHICAL & TEMPORAL STRATEGY:
        - Sequence the itinerary to minimize travel distance.
        - Tailor activities to the specific `{dates}` window.
        - Each day MUST have Morning, Lunch, Afternoon, and Evening activities.

        Provide exactly 3 flights, 3 hotels, and a {duration_days}-day itinerary.
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

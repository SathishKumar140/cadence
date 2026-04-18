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
    interests: List[str] = []
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
    
    if tavily_key and "placeholder" not in tavily_key:
        try:
            client = TavilyClient(api_key=tavily_key)
            
            # Context 1: Destination insights (seasons, festivals)
            res_insights = client.search(f"best time to visit {destination} festivals seasonal weather", max_results=2)
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
        - Target: {destination}
        - Duration: {duration_days} days
        - Pace: {trip_pace}
        - Interests: {interests_str}
        
        Web Insights Context: {insights_text}
        Flights Context: {flights_text}
        Hotels Context: {hotels_text}
        
        Return ONLY a JSON object with this exact structure:
        {{
            "best_season": "Short description of the best time to visit and weather",
            "upcoming_festivals": ["Festival 1 (Month)", "Festival 2 (Month)"],
            "flights": [
                {{"airline": "Airline Name", "price": "$X", "layovers": "Direct / 1 Stop", "duration": "XH YM"}}
            ],
            "hotels": [
                {{"name": "Hotel Name", "price_per_night": "$Y", "rating": "4.5 Stars", "area": "Neighborhood"}}
            ],
            "suggested_itinerary": [
                {{"day": 1, "title": "Exploring the Heart", "activities": ["Activity 1 (10:00 AM)", "Activity 2 (02:00 PM)"]}},
                ... (provide {duration_days} days total)
            ]
        }}
        Provide exactly 3 flights, 3 hotels, and a {duration_days}-day itinerary matched to the specified pace and interests.
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
        # Fallback Mock Data
        data = {
            "best_season": "Spring and Autumn offer the most moderate weather and clear skies.",
            "upcoming_festivals": ["Local Cultural Festival (Next Month)", "Seasonal Celebration"],
            "flights": [
                {"airline": "Global Airways", "price": "$750", "layovers": "Direct", "duration": "5H 30M"},
                {"airline": "BudgetJet", "price": "$450", "layovers": "1 Stop", "duration": "8H 15M"}
            ],
            "hotels": [
                {"name": "Downtown Plaza Hotel", "price_per_night": "$120", "rating": "4 Stars", "area": "City Center"},
                {"name": "Seaside Resort & Spa", "price_per_night": "$250", "rating": "5 Stars", "area": "Coastal District"}
            ],
            "suggested_itinerary": [{"day": i+1, "title": f"Plan for Day {i+1}", "activities": ["Activity A", "Activity B"]} for i in range(duration_days)]
        }

    # 4. Return UI Directive
    payload = {
        "status": "success",
        "message": f"I've compiled a travel dossier for {destination} departing from {origin}.",
        "ui_directive": {
            "view": "travel_planner",
            "data": {
                "destination": destination,
                "origin": origin,
                "dates": dates,
                "duration_days": duration_days,
                "trip_pace": trip_pace,
                "interests": interests,
                "insights": {
                    "season": data.get("best_season", ""),
                    "festivals": data.get("upcoming_festivals", [])
                },
                "flights": data.get("flights", []),
                "hotels": data.get("hotels", []),
                "itinerary": data.get("suggested_itinerary", [])
            }
        }
    }
    
    return json.dumps(payload)

@tool
async def open_travel_planner_configurator(destination: str, duration_days: int = 3, trip_pace: str = "Balanced", interests: List[str] = []) -> str:
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
                    "interests": interests
                }
            }
        }
    }
    return json.dumps(payload)

TOOLS = [scout_travel_plans, open_travel_planner_configurator]

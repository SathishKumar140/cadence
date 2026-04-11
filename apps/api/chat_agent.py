import os
import json
import uuid
import asyncio
from typing import List, Dict, Any, TypedDict, Annotated, Union
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage, ToolMessage
from langchain_core.tools import tool
import models
from integrations import EventDiscoveryService
from agents import get_model, run_deep_think

from langgraph.graph.message import add_messages
from langchain.agents import create_agent

# Define State
class ChatAgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    user_id: str
    db: Session
    api_key: str
    provider: str
    mutations: List[Dict[str, Any]] # Events for the frontend

from database import SessionLocal

def create_chat_agent(user_id: str, provider: str = "openai", api_key: str = None):
    # Define Tools
    @tool
    def get_weekly_plan() -> str:
        """Fetch the user's current weekly schedule/plan including all item IDs, titles, days, and times."""
        with SessionLocal() as db:
            cached = db.query(models.DashboardCache).filter(models.DashboardCache.user_id == user_id).first()
            if not cached or not cached.weekly_plan:
                return "Your weekly plan is currently empty."
            return json.dumps(cached.weekly_plan)

    @tool
    def add_plan_item(title: str, day: str, time: str, reason: str) -> str:
        """Add a new activity to the user's weekly plan."""
        # Persistence Logic with Upsert
        with SessionLocal() as db:
            cached = db.query(models.DashboardCache).filter(models.DashboardCache.user_id == user_id).first()
            new_id = str(uuid.uuid4())
            new_item = {"id": new_id, "title": title, "day": day, "time": time, "reason": reason}
            
            if not cached:
                cached = models.DashboardCache(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
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
        """Update an existing plan item's details (title, day, time, or reason). Use this for moving or swapping items."""
        with SessionLocal() as db:
            cached = db.query(models.DashboardCache).filter(models.DashboardCache.user_id == user_id).first()
            if not cached or not isinstance(cached.weekly_plan, list):
                return "Item not found (no plan exists)."
            
            updated_item = None
            plan = list(cached.weekly_plan) # Work on a copy
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
        # Persistence Logic
        with SessionLocal() as db:
            cached = db.query(models.DashboardCache).filter(models.DashboardCache.user_id == user_id).first()
            if cached and isinstance(cached.weekly_plan, list):
                cached.weekly_plan = [i for i in cached.weekly_plan if str(i.get("id")) != str(item_id)]
                flag_modified(cached, "weekly_plan")
                db.commit()
                
            return json.dumps({"status": "success", "mutation": {"target": "weekly_plan", "action": "remove", "data": {"id": item_id}}})

    @tool
    def modify_goals(workout_per_week: int = None, learning_hours_per_week: int = None, social_events: int = None) -> str:
        """Update the user's weekly goals. Only provide the fields that need to change."""
        with SessionLocal() as db:
            pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == user_id).first()
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
    async def scout_events(query: str, location: str = None) -> str:
        """Search for real-world events (Eventbrite, Luma, etc.) based on a query or interest and a location. 
        If location is not provided, I will use your profile location. If neither is available, I will ask you for a city."""
        try:
            target_location = location
            source_info = ""

            with SessionLocal() as db:
                # 1. Fetch user's integrated Eventbrite key
                eb_key = None
                integration = db.query(models.Integration).filter(
                    models.Integration.user_id == user_id,
                    models.Integration.provider == "eventbrite",
                    models.Integration.enabled == True
                ).first()
                if integration:
                    eb_key = integration.access_token

                # 2. Fetch user's profile location if none provided in chat
                if not target_location:
                    pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == user_id).first()
                    if pref and pref.location:
                        loc_data = pref.location
                        if isinstance(loc_data, dict):
                            target_location = loc_data.get("city") or loc_data.get("name")
                        else:
                            target_location = str(loc_data)
                        
                        if target_location:
                            source_info = f" (using your profile location: {target_location})"

                # 3. Smart Inference: Check Calendar if still no location
                if not target_location:
                    # Look at recent events with location data
                    recent_events = db.query(models.CalendarEvent).filter(
                        models.CalendarEvent.user_id == user_id,
                        models.CalendarEvent.location.isnot(None)
                    ).order_by(models.CalendarEvent.start_time.desc()).limit(10).all()
                    
                    if recent_events:
                        # Extract potential cities from location strings
                        # This is a basic heuristic: look for common patterns or just use the first non-empty location
                        for ev in recent_events:
                            loc_str = ev.location.lower()
                            # Simple city extraction (real app would use a Geocoding API or NER)
                            if "," in ev.location:
                                target_location = ev.location.split(",")[-1].strip()
                                source_info = f" (inferred from your calendar: {ev.location})"
                                break
                            elif ev.location and len(ev.location) > 2:
                                target_location = ev.location
                                source_info = f" (detected from your recent events: {ev.location})"
                                break

            if not target_location:
                return "I don't have a location for you yet. Which city should I scout events in?"

            # Initialize search with both provider keys for maximum coverage
            tavily_key = os.getenv("TAVILY_API_KEY")
            service = EventDiscoveryService(eventbrite_key=eb_key, tavily_key=tavily_key)
            # Normalize interests for discovery
            interests = [i.strip() for i in query.split(",")]
            events = await service.discover(interests, target_location)
            
            if events:
                return json.dumps({
                    "status": "success", 
                    "location_used": target_location,
                    "message": f"Found {len(events)} events in {target_location}{source_info}. Is this the right area?",
                    "discoveries": events[:3]
                })
            return f"I couldn't find any specific events in {target_location} (inferred from your calendar) for those interests right now. Would you like to try a different city?"
        except Exception as e:
            return f"Event discovery encountered an issue: {str(e)}"

    @tool
    def deep_think(query: str) -> str:
        """Process a complex query through a multi-stage reasoning graph (analyze, draft, critique, refine). Use this for planning, architecture, or deep analysis."""
        return f"DEEP_THINK_REQUESTED:{query}"

    tools = [get_weekly_plan, add_plan_item, update_plan_item, remove_plan_item, modify_goals, scout_events, deep_think]
    llm = get_model(provider, api_key)
    
    return create_agent(llm, tools=tools, state_schema=ChatAgentState)

async def run_chat_agent_stream(user_id: str, message: str, db: Session, history: List[Dict] = [], provider: str = "openai", api_key: str = None):
    agent = create_chat_agent(user_id, provider, api_key)
    
    # Initialize state
    messages = [
        SystemMessage(content="""You are the Cadence AI Assistant.
        
        ### AGENTIC PROTOCOL:
        1. ACTION FIRST: If a location is in the profile, CALL 'scout_events' immediately. Do not ask for confirmation.
        2. NO TITLES/LISTS: NEVER repeat event titles, names, dates, or URLs. NEVER use numbered lists in your text response.
        3. BREVITY: Your text response MUST be shorter than 15 words. Simply say: 'I found these events for you in [City]:'
        
        ### Guidelines:
        - Use profile location as the default.
        - Only ask for a city if profile and history are empty.
        
        ### Capabilities:
        - Management of schedules, reasoning, and real-world scouting.
        """)
    ]
    from langchain_core.messages import AIMessage
    for h in history:
        if h['role'] == 'user': 
            messages.append(HumanMessage(content=h['content']))
        elif h['role'] == 'assistant': 
            messages.append(AIMessage(content=h['content']))
        
    messages.append(HumanMessage(content=message))
    
    state = {"messages": messages, "user_id": user_id, "db": db, "mutations": [], "provider": provider, "api_key": api_key}
    
    # Stream the interaction
    async for event in agent.astream(state, stream_mode="updates"):
        for node, data in event.items():
            # Internal Debug (visible in server logs only)
            print(f"DEBUG: Processing node '{node}'")
            
            # 1. Catching tool execution results (Mutations/Discoveries)
            if node == "tools":
                tmsgs = data.get("messages", [])
                for tmsg in tmsgs:
                    if isinstance(tmsg, ToolMessage):
                        content = tmsg.content
                        
                        # Handle specific tool response side-effects
                        if content.startswith("DEEP_THINK_REQUESTED:"):
                            query = content.replace("DEEP_THINK_REQUESTED:", "")
                            async for stage in run_deep_think(query, user_id, db, provider, api_key):
                                if stage["type"] == "stage":
                                    yield {"type": "thinking", "content": stage["content"]}
                                elif stage["type"] == "final":
                                    yield {"type": "response", "content": f"\n\n**Deep Thinking Analysis:**\n{stage['content']}"}
                            continue

                        try:
                            res_obj = json.loads(content)
                            if isinstance(res_obj, dict):
                                if "mutation" in res_obj:
                                    yield {"type": "mutation", "data": res_obj["mutation"]}
                                    yield {"type": "thinking", "content": f"Refining {res_obj['mutation']['target']} settings..."}
                                if "discoveries" in res_obj:
                                    print(f"DEBUG: Yielding {len(res_obj['discoveries'])} discoveries")
                                    yield {"type": "discoveries", "data": res_obj["discoveries"]}
                        except Exception as e:
                            print(f"DEBUG: Tool content parse error: {e}")

            # 2. Catching initial tool calls or text responses from the primary node
            elif "messages" in data:
                msgs = data["messages"]
                if msgs:
                    last_msg = msgs[-1]
                    
                    # LOGIC: If it has tool calls, it's 'Thinking'
                    tcalls = getattr(last_msg, "tool_calls", [])
                    if not tcalls and hasattr(last_msg, "additional_kwargs"):
                        tcalls = last_msg.additional_kwargs.get("tool_calls", [])
                    
                    if tcalls:
                        for tc in tcalls:
                            tname = tc.get("name") if isinstance(tc, dict) else getattr(tc, "function", {}).get("name", "unknown")
                            if not tname and hasattr(tc, "name"): tname = tc.name

                            if tname == "scout_events":
                                yield {"type": "thinking", "content": "Analyzing interests & broadening search with Tavily and city scrapers..."}
                            elif tname == "deep_think":
                                yield {"type": "thinking", "content": "Engaging multi-stage reasoning graph..."}
                            elif "plan_item" in tname:
                                yield {"type": "thinking", "content": "Optimizing schedule in database..."}
                            else:
                                yield {"type": "thinking", "content": f"Considering tool: {tname}"}
                    
                    # If it's an AIMessage with content and NO tool calls, it's a 'Response'
                    elif isinstance(last_msg, AIMessage) and last_msg.content and not tcalls:
                        yield {"type": "response", "content": last_msg.content}

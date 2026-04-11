import os
from typing import List, Dict, Any, TypedDict
from datetime import datetime
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from sqlalchemy.orm import Session
import models

load_dotenv()
print(f"DEBUG: OPENAI_API_KEY detected: {'Yes' if os.getenv('OPENAI_API_KEY') else 'No'}")

# Define the state for our graph
class AgentState(TypedDict):
    user_id: str
    db: Session
    api_key: str # User-provided API key
    events: List[Dict[str, Any]]
    preferences: Dict[str, Any]
    interests: List[str]
    timezone: str
    analysis: str
    insights: Dict[str, Any]
    weekly_plan: List[Dict[str, Any]]
    discovered_events: List[Dict[str, Any]]

# Node 1: Fetch Data
def fetch_data_node(state: AgentState):
    user_id = state["user_id"]
    db = state["db"]
    print(f"DEBUG: Node 1: Fetching data for user {user_id}")
    
    # Fetch events
    db_events = db.query(models.CalendarEvent).filter(models.CalendarEvent.user_id == user_id).all()
    events = []
    for e in db_events:
        events.append({
            "title": e.title,
            "description": e.description,
            "start_time": e.start_time.isoformat() if e.start_time else None,
            "end_time": e.end_time.isoformat() if e.end_time else None,
            "location": e.location,
            "event_type": e.event_type
        })

    # Fetch user for timezone
    user = db.query(models.User).filter(models.User.id == user_id).first()
    timezone = user.timezone if user else "UTC"

    return {"events": events, "timezone": timezone}

# Node 2: Fetch Preferences
def fetch_preferences_node(state: AgentState):
    user_id = state["user_id"]
    db = state["db"]
    print(f"DEBUG: Node 2: Fetching preferences for user {user_id}")
    
    pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == user_id).first()
    
    default_prefs = {
        "workout_per_week": 3,
        "learning_hours_per_week": 2,
        "social_events": 1
    }
    
    interests = pref.interests if pref and pref.interests else ["AI", "Fitness", "Coding"]
    return {
        "preferences": pref.goals if pref else default_prefs,
        "interests": interests
    }

# Node 3: Analyze Patterns
def analyze_patterns_node(state: AgentState):
    events = state["events"]
    print(f"DEBUG: Node 3: Analyzing patterns for {len(events)} events")
    
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    
    event_summary = "\n".join([f"- {e['title']} ({e['start_time']} to {e['end_time']})" for e in events])
    
    prompt = f"""
    You are an expert personal assistant analyzer. Look at the following list of calendar events for a user and detect patterns in their life.
    
    User Events:
    {event_summary}
    
    Tasks:
    1. Identify recurring routines (e.g., gym, work, social).
    2. Detect gaps and free time windows for next week.
    3. Evaluate work-life balance.
    
    Analysis:
    """
    
    response = llm.invoke([SystemMessage(content="You are a helpful AI that analyzes user behavior patterns."), HumanMessage(content=prompt)])
    
    return {"analysis": response.content}

# Node 3.5: Discovery Agent
def discovery_agent_node(state: AgentState):
    interests = state["interests"]
    timezone = state["timezone"]
    print(f"DEBUG: Node 3.5: Discovering events for interests: {interests}")
    
    llm = ChatOpenAI(model="gpt-4o", temperature=0.7, api_key=state.get("api_key")) # Slightly higher temp for "discovery"
    
    prompt = f"""
    You are an AI Scout. Search for highly relevant, specific upcoming events for these interests: {interests}.
    Current user timezone: {timezone}.
    
    Tasks:
    1. Generate 2 unique, realistic events that would actually happen this upcoming week.
    2. Include specific details like physical location (e.g., 'National Library' or 'Virtual Meetup') and a plausible source link.
    3. Categorize them by how well they fit the user's weekly goals.
    
    Return a JSON list:
    [
      {{
        "title": "Specific Event Name",
        "description": "Engaging 1-2 sentence description.",
        "day": "Day of week",
        "time": "HH:MM-HH:MM",
        "source": "https://example.com/event",
        "category": "learning/fitness/social",
        "location": "Physical or Virtual address"
      }}
    ]
    Return ONLY JSON.
    """
    
    response = llm.invoke([SystemMessage(content="You are a professional event discovery specialist."), HumanMessage(content=prompt)])
    
    import json
    try:
        content = response.content.replace("```json", "").replace("```", "").strip()
        discovered = json.loads(content)
    except:
        discovered = []
        
    return {"discovered_events": discovered}

# Node 4: Planner Agent
def planner_agent_node(state: AgentState):
    analysis = state["analysis"]
    preferences = state["preferences"]
    timezone = state["timezone"]
    discovered = state.get("discovered_events", [])
    print(f"DEBUG: Node 4: Generating optimized weekly plan with {len(discovered)} discoveries")
    
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    
    prompt = f"""
    Suggest a high-performance weekly plan for the upcoming week.
    User Goals: {preferences}
    Analysis: {analysis}
    User Timezone: {timezone}
    Discovered Events: {discovered}
    
    Strategy:
    1. Be specific with times (HH:MM-HH:MM).
    2. Incorporate 'Discovered Events' if they strongly align with goals.
    3. Balance recovery with focus.
    
    Return a JSON list of 3-5 activities. Each MUST have:
    - id: A unique string (e.g., a UUID or slug)
    - title: Activity name
    - day: "Monday", "Tuesday", etc.
    - time: "HH:MM-HH:MM"
    - reason: Rationale for this choice.
    - is_discovery: true/false
    - discovery_source: (The source URL if is_discovery is true)
    - location: (The location if provided in Discovery)
    
    Return ONLY JSON.
    """
    
    response = llm.invoke([SystemMessage(content="You are a proactive planner."), HumanMessage(content=prompt)])
    
    import json
    import uuid
    try:
        content = response.content.replace("```json", "").replace("```", "").strip()
        weekly_plan = json.loads(content)
        # Ensure IDs exist if LLM missed them
        for item in weekly_plan:
            if "id" not in item:
                item["id"] = str(uuid.uuid4())
    except:
        weekly_plan = []
        
    return {"weekly_plan": weekly_plan}

def run_alternate_agent(current_plan: List[Dict], item_to_replace: Dict, goals: Dict, api_key: str = None):
    """Specialized function to rethink a single slot."""
    llm = ChatOpenAI(model="gpt-4o", temperature=0.7, api_key=api_key)
    
    prompt = f"""
    You are an AI Optimization Specialist. The user wants to REPLACE a specific item in their weekly plan.
    
    Current Plan: {current_plan}
    Item to Replace: {item_to_replace}
    User Goals: {goals}
    
    Task:
    Suggest ONE new activity for this time slot (or a similar one on the same day) that better serves the user's goals.
    Maintain the harmony of the REST of the week.
    
    Return the new item as a SINGLE JSON object:
    {{
      "id": "{item_to_replace.get('id')}",
      "title": "New Title",
      "day": "{item_to_replace.get('day')}",
      "time": "HH:MM-HH:MM",
      "reason": "Why this is a better fit",
      "is_discovery": false
    }}
    Return ONLY JSON.
    """
    
    response = llm.invoke([SystemMessage(content="You refine specific schedule slots."), HumanMessage(content=prompt)])
    
    import json
    try:
        content = response.content.replace("```json", "").replace("```", "").strip()
        new_item = json.loads(content)
        return new_item
    except:
        return item_to_replace

# Node 5: Generate Insights
def generate_insights_node(state: AgentState):
    analysis = state["analysis"]
    print("DEBUG: Node 5: Generating structured insights")
    
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    
    prompt = f"""
    Based on the analysis, generate a structured JSON object containing:
    1. optimization_score: A number from 0 to 100 representing overall weekly harmony.
    2. insight_cards: A list of 3-4 objects with:
       - title: Short punchy title.
       - description: One sentence explaining the pattern.
       - score_type: MUST be one of ['productivity', 'wellness', 'social', 'learning', 'focus'].
       - impact: A number 0-100 representing how much this pattern contributes/detracts from the optimization_score.
    
    Analysis: {analysis}
    Return ONLY JSON.
    """
    
    response = llm.invoke([SystemMessage(content="You generate structured JSON insights."), HumanMessage(content=prompt)])
    
    import json
    try:
        content = response.content.replace("```json", "").replace("```", "").strip()
        insights = json.loads(content)
    except:
        insights = {"optimization_score": 70, "insight_cards": []}
        
    return {"insights": insights}

# Build the Graph
def create_insight_agent():
    workflow = StateGraph(AgentState)
    
    workflow.add_node("fetch_data", fetch_data_node)
    workflow.add_node("fetch_preferences", fetch_preferences_node)
    workflow.add_node("analyze_patterns", analyze_patterns_node)
    workflow.add_node("discovery_agent", discovery_agent_node)
    workflow.add_node("planner_agent", planner_agent_node)
    workflow.add_node("generate_insights", generate_insights_node)
    
    workflow.set_entry_point("fetch_data")
    workflow.add_edge("fetch_data", "fetch_preferences")
    workflow.add_edge("fetch_preferences", "analyze_patterns")
    workflow.add_edge("analyze_patterns", "discovery_agent")
    workflow.add_edge("discovery_agent", "planner_agent")
    workflow.add_edge("analyze_patterns", "generate_insights")
    workflow.add_edge("planner_agent", END)
    workflow.add_edge("generate_insights", END)
    
    return workflow.compile()

# Entry point
def run_full_agent(user_id: str, db: Session, api_key: str = None):
    agent = create_insight_agent()
    # If no user key provided, ChatOpenAI will use OPENAI_API_KEY from environment
    result = agent.invoke({"user_id": user_id, "db": db, "api_key": api_key})
    return {
        "insights": result["insights"],
        "weekly_plan": result["weekly_plan"],
        "calendar_timezone": result.get("timezone", "UTC")
    }


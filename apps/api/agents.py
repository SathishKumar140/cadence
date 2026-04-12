import os
import json
import uuid
from typing import List, Dict, Any, TypedDict
from datetime import datetime
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage
from langgraph.graph import StateGraph, END, MessageGraph
from sqlalchemy.orm import Session
import models

load_dotenv()

def get_model(provider: str = "openai", api_key: str = None, model_name: str = None):
    """Factory to get the appropriate LLM."""
    if provider == "google":
        return ChatGoogleGenerativeAI(
            model=model_name or "gemini-1.5-pro",
            google_api_key=api_key or os.getenv("GOOGLE_API_KEY"),
            temperature=0
        )
    else:
        return ChatOpenAI(
            model=model_name or "gpt-4o",
            api_key=api_key or os.getenv("OPENAI_API_KEY"),
            temperature=0
        )

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
    
    llm = get_model(state.get("provider"), state.get("api_key"))
    
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

from integrations import EventDiscoveryService

# Node 3.5: Discovery Agent
async def discovery_agent_node(state: AgentState):
    interests = state["interests"]
    user_id = state["user_id"]
    db = state["db"]
    
    # Try fetching real events first
    try:
        service = EventDiscoveryService()
        discovered = await service.discover(interests, "San Francisco") # City should be dynamic from profile
        if discovered:
            return {"discovered_events": discovered[:10]}
    except Exception as e:
        print(f"Discovery Service Error: {e}")

    # Fallback to AI generation
    llm = ChatOpenAI(model="gpt-4o", temperature=0.7, api_key=state.get("api_key"))
    prompt = f"""
    You are an AI Scout. Search for highly relevant, specific upcoming events for these interests: {interests}.
    Current user timezone: {state['timezone']}.
    Return ONLY JSON list of 2 events.
    """
    response = await llm.ainvoke([SystemMessage(content="You are a professional event discovery specialist."), HumanMessage(content=prompt)])
    
    try:
        content = response.content.replace("```json", "").replace("```", "").strip()
        discovered = json.loads(content)
        for d in discovered: d["source"] = "ai_suggested"
    except:
        discovered = []
        
    return {"discovered_events": discovered}

# Node 4: Planner Agent
def planner_agent_node(state: AgentState):
    analysis = state["analysis"]
    preferences = state["preferences"]
    timezone = state["timezone"]
    discovered = state.get("discovered_events", [])
    
    llm = get_model(state.get("provider"), state.get("api_key"))
    
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

def run_alternate_agent(current_plan: List[Dict], item_to_replace: Dict, goals: Dict, provider: str = "openai", api_key: str = None):
    """Specialized function to rethink a single slot."""
    llm = get_model(provider, api_key)
    
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
    
    llm = get_model(state.get("provider"), state.get("api_key"))
    
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

# Deep Thinking Agent Workflow
class DeepThinkingState(TypedDict):
    query: str
    user_id: str
    db: Session
    provider: str
    api_key: str
    analysis: str
    draft: str
    critique: str
    final_output: str

async def analyze_problem_node(state: DeepThinkingState):
    llm = get_model(state.get("provider"), state.get("api_key"))
    prompt = f"Decompose this complex planning request into core constraints and goals: {state['query']}"
    res = await llm.ainvoke([SystemMessage(content="You are a strategic analyst."), HumanMessage(content=prompt)])
    return {"analysis": res.content}

async def draft_plan_node(state: DeepThinkingState):
    llm = get_model(state.get("provider"), state.get("api_key"))
    prompt = f"Based on this analysis: {state['analysis']}, create a detailed draft schedule plan."
    res = await llm.ainvoke([SystemMessage(content="You are a meticulous planner."), HumanMessage(content=prompt)])
    return {"draft": res.content}

async def evaluate_plan_node(state: DeepThinkingState):
    llm = get_model(state.get("provider"), state.get("api_key"))
    prompt = f"Critique this draft plan for potential conflicts or missed goals: {state['draft']}"
    res = await llm.ainvoke([SystemMessage(content="You are a critical reviewer."), HumanMessage(content=prompt)])
    return {"critique": res.content}

async def refine_plan_node(state: DeepThinkingState):
    llm = get_model(state.get("provider"), state.get("api_key"))
    prompt = f"Finalize the plan using the original query, draft, and critique: {state['critique']}"
    res = await llm.ainvoke([SystemMessage(content="You are an expert scheduler."), HumanMessage(content=prompt)])
    return {"final_output": res.content}

def create_deep_thinking_agent():
    workflow = StateGraph(DeepThinkingState)
    workflow.add_node("analyze", analyze_problem_node)
    workflow.add_node("draft", draft_plan_node)
    workflow.add_node("evaluate", evaluate_plan_node)
    workflow.add_node("refine", refine_plan_node)
    
    workflow.set_entry_point("analyze")
    workflow.add_edge("analyze", "draft")
    workflow.add_edge("draft", "evaluate")
    workflow.add_edge("evaluate", "refine")
    workflow.add_edge("refine", END)
    
    return workflow.compile()

async def run_deep_think(query: str, user_id: str, db: Session, provider: str = "openai", api_key: str = None):
    """Refactor to yield progress stages and final result."""
    agent = create_deep_thinking_agent()
    
    # These map internal node names to user-friendly progress strings
    stage_map = {
        "analyze": "Analyzing request & constraints...",
        "draft": "Generating initial reasoning draft...",
        "evaluate": "Critiquing plan for potential issues...",
        "refine": "Polishing final recommendation..."
    }
    
    final_output = ""
    async for event in agent.astream({
        "query": query, 
        "user_id": user_id, 
        "db": db, 
        "provider": provider, 
        "api_key": api_key
    }, stream_mode="updates"):
        for node, data in event.items():
            if node in stage_map:
                yield {"type": "stage", "content": stage_map[node]}
            if node == "refine" and "final_output" in data:
                final_output = data["final_output"]
    
    yield {"type": "final", "content": final_output}

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
async def run_full_agent(user_id: str, db: Session, provider: str = "openai", api_key: str = None):
    agent = create_insight_agent()
    # If no user key provided, ChatOpenAI will use OPENAI_API_KEY from environment
    result = await agent.ainvoke({"user_id": user_id, "db": db, "provider": provider, "api_key": api_key})
    return {
        "insights": result["insights"],
        "weekly_plan": result["weekly_plan"],
        "calendar_timezone": result.get("timezone", "UTC")
    }


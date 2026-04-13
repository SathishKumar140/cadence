import os
import json
import uuid
from typing import List, Dict, Any, Annotated, Union, TypedDict, Optional
from sqlalchemy.orm import Session
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage, ToolMessage, AIMessage
from langchain_core.tools import tool
import models
from agents import get_model, run_deep_think
from langgraph.graph.message import add_messages
from langchain.agents import create_agent
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt, Command
from skills import registry

# Global checkpointer for the chat agent
memory = MemorySaver()


# Load skills once
registry.load()

# Global Compiled Agent Cache to ensure stable function identities for HITL
_AGENT_CACHE = {}

def get_cached_agent(user_id: str, provider: str, api_key: str):
    cache_key = f"{user_id}:{provider}:{api_key}"
    if cache_key in _AGENT_CACHE:
        print(f"[CADENCE] Agent Cache HIT for {user_id}")
        return _AGENT_CACHE[cache_key]
    
    print(f"[CADENCE] Agent Cache MISS for {user_id}. Compiling new graph...")
    agent = create_chat_agent(user_id, provider, api_key)
    _AGENT_CACHE[cache_key] = agent
    return agent

# Define State
class ChatAgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    mutations: List[Dict[str, Any]] # Events for the frontend
    user_id: Optional[str] = None
    api_key: Optional[str] = None
    provider: Optional[str] = None

# Define System Prompt
SYSTEM_PROMPT = """You are Cadence AI, a strategic personal intelligence assistant.

MANDATORY PROTOCOL (HIGHEST PRIORITY):
1. NO GUESSED DATES: If source info for a date/time is 'TBA' or missing, you MUST NOT guess a value for any tool argument. Defaulting to 'Saturday' is a FAILURE.
2. PROACTIVE SCHEDULING: If a date is TBA or unknown, you MUST IMMEDIATELY use 'suggest_optimal_slot' to find gaps in the user's schedule. This must happen in the current turn.
3. SMART RESPONSE: Your textual response MUST present the options found by the tool. For example: "The event is TBA. I've checked your availability and I suggest [Option 1] or [Option 2]. Which should I pick?"
4. DATE SPECIFICITY: Every scheduled event MUST have an exact ISO date (YYYY-MM-DD). If the user uses a relative day name (e.g. "this Friday" or "next Tuesday"), you MUST calculate the absolute date before calling tools. Refer to the current local time in your context for this calculation.
5. CONTEXT UTILIZATION: If the user asks to "add" or "schedule" an item you just found (e.g. "add calligraphy art jam"), you MUST look at your previous tool outputs for that item's metadata (title, day, time, date). Do NOT ask the user for information that has already been provided in discovery results. Call 'add_plan_item' immediately using that pre-found data.
6. NO REDUNDANT NAVIGATION: If a tool output (like 'scout_local_events') already contains a 'ui_directive' to switch views, DO NOT call 'emit_ui_directive' again. Acknowledge the navigation in your response instead.
7. DYNAMIC UI ENGAGEMENT: Whenever the user asks to see their schedule, multi-week patterns, or "all events", you MUST trigger the 'all_events' view (Tactical Timeline). Avoid just listing them in text; let the UI do the heavy lifting.
8. COMPLETION CONFIRMATION: Always provide a brief conversational response after a tool executes (e.g., 'I've added the event to your schedule.').

GENERAL GOALS:
Your goal is to help the user manage their time, scout for relevant trends, and optimize their weekly layout.
Use emit_ui_directive to switch views if the context warrants it (e.g., viewing Goal Editor or Time Slots).
"""

@tool
def emit_ui_directive(view: str, data: Dict[str, Any] = None) -> str:
    """
    Switch the user's dashboard view and provide data for that view.
    view: The ui_view name define in the skill (e.g., 'linkedin_composer', 'time_slots', 'goal_editor')
    data: Optional payload for the view.
    """
    return json.dumps({"status": "success", "ui_directive": {"view": view, "data": data or {}}})

def create_chat_agent(user_id: str, provider: str = "openai", api_key: str = None):
    # Inject user_id into skill contexts before creating tools
    import importlib
    for skill in registry.all():
        try:
            ctx = importlib.import_module(f"skills.{skill.name}._context")
            ctx.CURRENT_USER_ID = user_id
        except Exception:
            pass

    # Dynamic Tools from Registry + Core Tools
    skill_tools = registry.get_all_tools()
    core_tools = [emit_ui_directive, run_deep_think] if False else [emit_ui_directive] # simplifying for now
    
    # We also have deep_think as a tool in the original chat_agent.py
    @tool
    def deep_think(query: str) -> str:
        """Process a complex query through a multi-stage reasoning graph (analyze, draft, critique, refine). Use this for planning, architecture, or deep analysis."""
        return f"DEEP_THINK_REQUESTED:{query}"
    
    tools = skill_tools + [emit_ui_directive, deep_think]
    
    # Wrap tools with interrupt
    import types
    wrapped_tools = []
    
    # Tools that are read-only or diagnostic and don't need human approval
    SAFE_TOOLS = [
        "emit_ui_directive", 
        "list_active_listeners", 
        "get_pending_actions_for_review",
        "scout_for_updates",
        "scout_local_events",
        "list_scheduled_emails",
        "list_goals",
        "suggest_ai_goals",
        "suggest_better_time_slot_for_goal",
        "get_post_suggestions",
        "get_routines",
        "get_weekly_plan",
        "find_available_slots",
        "suggest_optimal_slot"
    ]
    
    def wrap_tool(t):
        if t.name in SAFE_TOOLS:
            return t
            
        orig_run = getattr(t, "_run", None)
        orig_arun = getattr(t, "_arun", None)
        
        def new_run(self, *args, config=None, run_manager=None, **kwargs):
            # The interrupt ID must be stable! We use a composite of task and tool call info if possible,
            # but for now, the tool name is the primary anchor.
            ans = interrupt({"action": "approval_required", "tool_name": self.name, "tool_args": kwargs})
            if ans == "reject":
                return "The user rejected this action. Stop and apologize."
            if orig_run: 
                return orig_run(*args, config=config, run_manager=run_manager, **kwargs)
            return "Execution failed."
            
        async def new_arun(self, *args, config=None, run_manager=None, **kwargs):
            ans = interrupt({"action": "approval_required", "tool_name": self.name, "tool_args": kwargs})
            if ans == "reject":
                return "The user rejected this action. Stop and apologize."
            if orig_arun: 
                return await orig_arun(*args, config=config, run_manager=run_manager, **kwargs)
            if orig_run: 
                return orig_run(*args, config=config, run_manager=run_manager, **kwargs)
            return "Execution failed."
            
        t._run = types.MethodType(new_run, t)
        if hasattr(t, "_arun") and orig_arun:
            t._arun = types.MethodType(new_arun, t)
        return t

    for t in tools:
        wrapped_tools.append(wrap_tool(t))
    
    llm = get_model(provider, api_key)
    return create_agent(llm, tools=wrapped_tools, state_schema=ChatAgentState, checkpointer=memory, system_prompt=SYSTEM_PROMPT)

def get_premium_thinking_title(tool_name: str) -> str:
    """Map technical tool names to premium tactical headers."""
    TITLE_MAP = {
        "scout_for_updates": "SYNCHRONIZING TREND DATA",
        "add_plan_item": "CALIBRATING MASTER PLAN",
        "get_weekly_plan": "MAPPING Master SEQUENCE",
        "scout_local_events": "HARVESTING LOCAL OPPORTUNITIES",
        "find_available_slots": "ANALYZING TEMPORAL GAPS",
        "suggest_optimal_slot": "RESOLVING SCHEDULING CONSTRAINTS",
        "emit_ui_directive": "SYNCHRONIZING DOMAIN VIEWS",
        "get_pending_actions_for_review": "RECONSTRUCTING ACTION QUEUE",
        "list_goals": "RETRIEVING STRATEGIC OBJECTIVES",
        "suggest_ai_goals": "SYNTHESIZING NEW TRAJECTORIES"
    }
    return TITLE_MAP.get(tool_name, "COGNITIVE REASONING PROCESS")

async def run_chat_agent_stream(user_id: str, message: str, db: Session, history: List[Dict] = [], provider: str = "openai", api_key: str = None):
    agent = get_cached_agent(user_id, provider, api_key)
    
    # Check current state from the checkpointer
    config = {"configurable": {"thread_id": user_id}}
    curr_state = agent.get_state(config)
    
    # 1. Handle pending interrupts before starting a new turn
    if curr_state.tasks and any(t.interrupts for t in curr_state.tasks):
        # Implicitly reject the pending action to clear the history for the new prompt
        async for _ in agent.astream(Command(resume="reject"), config, stream_mode="updates"):
            pass
        # Refresh state after resolution
        curr_state = agent.get_state(config)

    # 2. Prepare the input message(s)
    # If the thread is empty, we must include the system prompt. 
    # Otherwise, we just append the new human message to the existing thread.
    has_history = curr_state.values.get("messages") is not None and len(curr_state.values["messages"]) > 0
    
    if not has_history:
        # Dynamic System Prompt
        skills_context = registry.build_system_prompt_section()
        system_prompt = f"""You are the Cadence AI Assistant, a high-performance strategic partner.
            
{skills_context}

### CORE PROTOCOL:
1. MATCH INTENT: Identify which skill the user needs.
2. USE TOOLS: Call the appropriate tools for that skill.
3. PROACTIVE SCOUTING: If the user adds a Topic Listener or asks for updates, always call `scout_for_updates` to fetch real-time data.
4. SMART NAVIGATION: Only call `emit_ui_directive` if the tool used did NOT already provide a view or if you need to switch context intentionally. If a discovery was just made or listed, ensure the view stays on `discovery_feed`.
5. BREVITY: Keep text responses short and helpful. Focus on the data shown in the dynamic panels. 
6. HANDOFF PROTOCOL: If you trigger a view switch (like discovery_feed or linkedin_composer), your text response MUST be limited to a single confirmation sentence. Do NOT list the data in markdown text if it will be visible in the destination view.
"""
        initial_messages = [SystemMessage(content=system_prompt), HumanMessage(content=message)]
        state = {
            "messages": initial_messages,
            "user_id": user_id,
            "provider": provider,
            "api_key": api_key,
            "mutations": []
        }
    else:
        # Just append the new message to existing state
        state = {"messages": [HumanMessage(content=message)]}
    
    # 3. Final Sequence Integrity Check (OpenAI 400 Fix)
    # Ensure that every AIMessage with tool_calls in the history is followed by ToolMessages.
    # We'll inject fallback responses into the incoming stream if any slots are missing.
    curr_state = agent.get_state(config)
    msgs = curr_state.values.get("messages", [])
    safety_responses = []
    
    # Find the most recent AIMessage with tool_calls
    for i in range(len(msgs) - 1, -1, -1):
        m = msgs[i]
        if isinstance(m, AIMessage) and m.tool_calls:
            # Check if all these calls have responses in the following messages
            confirmed_ids = set()
            for j in range(i + 1, len(msgs)):
                if isinstance(msgs[j], ToolMessage):
                    confirmed_ids.add(msgs[j].tool_call_id)
                elif isinstance(msgs[j], (HumanMessage, AIMessage)):
                    # A new turn started
                    break
            
            missing_ids = [tc['id'] for tc in m.tool_calls if tc['id'] not in confirmed_ids]
            if missing_ids:
                print(f"[CADENCE] Prepended missing ToolMessages for IDs: {missing_ids}")
                safety_responses = [
                    ToolMessage(tool_call_id=tid, content="Action cancelled by user for new prompt.") 
                    for tid in missing_ids
                ]
            break

    if safety_responses:
        state["messages"] = safety_responses + state["messages"]

    # We must properly handle interruption
    async for event in agent.astream(state, config, stream_mode="updates"):
        for node, data in event.items():
            if node == "tools":
                msgs = data.get("messages", [])
                tmsgs = msgs if isinstance(msgs, list) else [msgs]
                for tmsg in tmsgs:
                    if isinstance(tmsg, ToolMessage):
                        content = tmsg.content
                        
                        # Handle deep_think
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
                                if "ui_directive" in res_obj:
                                    yield {"type": "ui_directive", "view": res_obj["ui_directive"]["view"], "data": res_obj["ui_directive"]["data"]}
                                if "discoveries" in res_obj:
                                    yield {"type": "discoveries", "data": res_obj["discoveries"]}
                        except Exception:
                            pass

            elif "messages" in data or node == "model":
                msgs = data.get("messages", [])
                msgs_list = msgs if isinstance(msgs, list) else [msgs]
                if msgs_list:
                    last_msg = msgs_list[-1]
                    tcalls = getattr(last_msg, "tool_calls", [])
                    if tcalls:
                        for tc in tcalls:
                            tname = tc.get("name") if isinstance(tc, dict) else getattr(tc, "function", {}).get("name", "unknown")
                            yield {"type": "thinking_title", "content": get_premium_thinking_title(tname)}
                            yield {"type": "thinking", "content": f"Using {tname}..."}
                    elif isinstance(last_msg, AIMessage) and last_msg.content:
                        yield {"type": "response", "content": last_msg.content}
            elif node == "__interrupt__":
                # The agent hit our interrupt() wrapper
                for intr in data:
                    val = intr.value
                    if isinstance(val, dict) and val.get("action") == "approval_required":
                         # Yield approval to UI. Generate a mock ID for the UI if missing
                         yield {
                             "type": "approval_required",
                             "tool_calls": [{"id": intr.interrupt_id if hasattr(intr, "interrupt_id") else "unknown", "name": val["tool_name"], "args": val["tool_args"]}]
                         }


async def resume_chat_agent_stream(user_id: str, action: str, db: Session, provider: str = "openai", api_key: str = None):
    agent = get_cached_agent(user_id, provider, api_key)
    config = {"configurable": {"thread_id": user_id}}
    
    curr_state = agent.get_state(config)
    if not curr_state.tasks or not curr_state.tasks[0].interrupts:
        # Check if there's actually an interrupt to resume
        if not curr_state.next:
            yield {"type": "response", "content": "\n*No pending operations to resume.*"}
            return
            
    # Now continue the stream with the user choice injected into the interrupt
    async for event in agent.astream(Command(resume=action), config, stream_mode="updates"):
        for node, data in event.items():
            if node == "tools":
                msgs = data.get("messages", [])
                tmsgs = msgs if isinstance(msgs, list) else [msgs]
                for tmsg in tmsgs:
                    if isinstance(tmsg, ToolMessage):
                        content = tmsg.content
                        if content.startswith("DEEP_THINK_REQUESTED:"):
                            continue  # skipped for simplicity in resume
                        try:
                            res_obj = json.loads(content)
                            if isinstance(res_obj, dict):
                                if "mutation" in res_obj:
                                    yield {"type": "mutation", "data": res_obj["mutation"]}
                                if "ui_directive" in res_obj:
                                    yield {"type": "ui_directive", "view": res_obj["ui_directive"]["view"], "data": res_obj["ui_directive"]["data"]}
                                if "discoveries" in res_obj:
                                    yield {"type": "discoveries", "data": res_obj["discoveries"]}
                        except Exception:
                            pass
            elif "messages" in data or node == "model":
                msgs = data.get("messages", [])
                msgs_list = msgs if isinstance(msgs, list) else [msgs]
                if msgs_list:
                    last_msg = msgs_list[-1]
                    tcalls = getattr(last_msg, "tool_calls", [])
                    if tcalls:
                        for tc in tcalls:
                            tname = tc.get("name") if isinstance(tc, dict) else getattr(tc, "function", {}).get("name", "unknown")
                            yield {"type": "thinking_title", "content": get_premium_thinking_title(tname)}
                            yield {"type": "thinking", "content": f"Using {tname}..."}
                    elif isinstance(last_msg, AIMessage) and last_msg.content:
                        yield {"type": "response", "content": last_msg.content}
            elif node == "__interrupt__":
                # Check if paused again
                for intr in data:
                    val = intr.value
                    if isinstance(val, dict) and val.get("action") == "approval_required":
                        yield {
                             "type": "approval_required",
                             "tool_calls": [{"id": intr.interrupt_id if hasattr(intr, "interrupt_id") else "unknown", "name": val["tool_name"], "args": val["tool_args"]}]
                        }

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

def flatten_content(content: Any) -> str:
    """Normalizes AI content blocks (strings or lists of dicts) into a single string."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                # LangChain content block format: {'type': 'text', 'text': '...'}
                if part.get("type") == "text":
                    parts.append(part.get("text", ""))
                elif "text" in part:
                    parts.append(part["text"])
        return "".join(parts)
    return str(content) if content is not None else ""

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
1. CORE INTERESTS: Always prioritize the user's primary interests (found in UserPreference or Knowledge). If the user asks for planning or suggestions, prioritize Travel, AI Updates, Hiking, and Tech events.
2. NEXT WEEK- **PLANNING TRIGGER**: When a user says "plan for next week", you **MUST** call the `generate_priority_weekly_plan` tool.
- **WEEK SELECTION**: 
    - Use `target_week='next'` for requests about "next week".
    - Use `target_week='current'` for requests about "this week" or "upcoming".
- **REASONING**: Always explain that you are scouting for their specific interests (AI, Travel, Hiking, etc.) and looking for optimal gaps in their schedule.
3. NO GUESSED DATES: If source info for a date/time is 'TBA' or missing, you MUST NOT guess a value for any tool argument. Defaulting to 'Saturday' is a FAILURE.
4. PROACTIVE SCHEDULING: If a date is TBA or unknown, you MUST IMMEDIATELY use 'suggest_optimal_slot' to find gaps in the user's schedule. This must happen in the current turn.
5. METADATA PERSISTENCE: When adding a discovery to the plan using `add_plan_item`, you **MUST** pass the `source` and EXACT `url` from the discovery data. DO NOT use generic homepage URLs. The specific event link is critical for the user.
6. DATE SPECIFICITY: Every scheduled event MUST have an exact ISO date (YYYY-MM-DD). If the user uses a relative day name (e.g. "this Friday" or "next Tuesday"), you MUST calculate the absolute date before calling tools.
6. CONTEXT UTILIZATION: If the user asks to "add" or "schedule" an item you just found, call 'add_plan_item' immediately using that pre-found data. Do NOT ask for it again.
7. DYNAMIC UI ENGAGEMENT: Whenever the user asks to see their schedule, patterns, or "all events", trigger the 'all_events' view (Tactical Timeline).
8. DOMAIN ISOLATION (CRITICAL):
- Travel Planning: If Duration, Pace, or Interests are missing: Use `open_travel_planner_configurator`. 
- **View Priority**: Once a specialized view (like `travel_setup` or `travel_planner`) is triggered, you MUST NOT call `emit_ui_directive` for 'all_events' or 'schedule' in the same or subsequent turns unless the user explicitly says "Go back to my schedule" or "Show the hub".
- **Specialized Context**: High-fidelity travel scouting is an intensive focal state. Maintain this view until the user either syncs the plan or intentionally navigates away.
- **Warm Expert Response**: Always provide a warm, expert conversational response in the chat box with 1-2 initial suggestions for the destination when opening the planner.
    - **Multi-Stop Memory**: If the user discussed multiple cities (e.g. Shenzhen, Chongqing), treat the country (China) as the `destination` and include the cities in `included_stops`.
    - **Strategic Intelligence**: ALWAYS evaluate geographical efficiency (Open-Jaw paths).
    - **Temporal Precision**: Calibrate all insights to the provided travel window (festivals, seasons).
    - **Tactical Density**: provide high-resolution itineraries (4-5 items/day).

9. SMART NAVIGATION: Only call `emit_ui_directive` if the tool used did NOT already provide a view or if you need to switch context intentionally. Do NOT override specialized planners with the general hub view.

10. COMPLETION CONFIRMATION: Always provide a brief conversational response after a tool executes.
11. TRAVEL PLANNER SYNC: When the user confirms their settings in the setup panel (sending a 'Params' block), call `scout_travel_plans` immediately.
"""

@tool
def emit_ui_directive(view: str, data: Dict[str, Any] = None) -> str:
    """
    Switch the user's dashboard view and provide data for that view.
    view: The ui_view name define in the skill (e.g., 'linkedin_composer', 'time_slots', 'goal_editor')
    data: Optional payload for the view.
    """
    return json.dumps({"status": "success", "ui_directive": {"view": view, "data": data or {}}})

def create_chat_agent(user_id: str, provider: str = None, api_key: str = None):
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
        "scout_travel_plans",
        "list_scheduled_emails",
        "list_goals",
        "suggest_ai_goals",
        "suggest_better_time_slot_for_goal",
        "get_post_suggestions",
        "get_routines",
        "get_weekly_plan",
        "find_available_slots",
        "suggest_optimal_slot",
        "get_tactical_summary",
        "open_travel_planner_configurator"
    ]
    
    def wrap_tool(t):
        if t.name in SAFE_TOOLS:
            return t
            
        orig_run = getattr(t, "_run", None)
        orig_arun = getattr(t, "_arun", None)
        
        def new_run(self, *args, config=None, run_manager=None, **kwargs):
            meta = get_action_metadata(self.name, kwargs)
            ans = interrupt({
                "action": "approval_required", 
                "tool_name": self.name, 
                "tool_args": kwargs,
                "display_name": meta["title"],
                "description": meta["description"]
            })
            if ans == "reject":
                return "The user rejected this action. Stop and apologize."
            if orig_run: 
                return orig_run(*args, config=config, run_manager=run_manager, **kwargs)
            return "Execution failed."
            
        async def new_arun(self, *args, config=None, run_manager=None, **kwargs):
            meta = get_action_metadata(self.name, kwargs)
            ans = interrupt({
                "action": "approval_required", 
                "tool_name": self.name, 
                "tool_args": kwargs,
                "display_name": meta["title"],
                "description": meta["description"]
            })
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

def get_action_metadata(tool_name: str, args: dict = {}) -> dict:
    """Map technical tool names and args to premium tactical labels and descriptions."""
    # Contextual lookups for IDs (Safe copy to avoid polluting tool execution)
    display_topic_name = "ACTIVE MONITOR"
    if tool_name == "remove_topic_listener" and "listener_id" in args:
        try:
            from database import SessionLocal
            import models
            with SessionLocal() as db:
                listener = db.query(models.TopicListener).filter(models.TopicListener.id == args["listener_id"]).first()
                if listener:
                    display_topic_name = listener.topic
        except: pass
        
    MAP = {
        "add_plan_item": {
            "title": "CALIBRATING MASTER PLAN",
            "description": f"Adding '{args.get('title', 'new event')}' to your strategic sequence."
        },
        "update_plan_item": {
            "title": "RE-CALIBRATING SEQUENCE",
            "description": f"Modifying particulars for '{args.get('updates', {}).get('title', 'this event')}'."
        },
        "remove_plan_item": {
            "title": "DE-COUPLE TACTICAL ITEM",
            "description": "Permanently removing this item from your current cycle."
        },
        "clear_entire_plan": {
            "title": "SEQUENCE PURGE",
            "description": "Wiping all scheduled tactical items for a clean slate."
        },
        "purge_dashboard_insights": {
            "title": "STRATEGIC HUB RESET",
            "description": "Resetting high-level optimization metrics and insight cards."
        },
        "cleanup_strategic_dashboard": {
            "title": "FULL SYSTEM RESET: GROUND-ZERO CLEANUP",
            "description": "This will permanently purge:\n• Weekly Plan & Insights\n• Discovery Feed & Pending Actions\n• Topic Listeners & Background Scouting\n• Tactical Calendar Events\n• Stored Knowledge & Routines\n• Queued Scheduled Emails"
        },
        "modify_goals": {
            "title": "GOAL ARCHITECTURE UPDATE",
            "description": "Adjusting baseline targets for workout, social, and learning cycles."
        },
        "generate_priority_weekly_plan": {
            "title": "SYNCHRONIZING Master SEQUENCE",
            "description": f"Generating a fresh 7-day tactical plan for the '{args.get('target_week', 'current')}' week."
        },
        "clear_all_pending_actions": {
            "title": "DISCOVERY QUEUE PURGE",
            "description": "Clearing all pending action items from the discovery feed."
        },
        "remove_topic_listener": {
            "title": f"DE-COUPLING TOPIC: {display_topic_name}",
            "description": "Permanently disabling background scouting for this strategic interest."
        },
        "clear_all_active_listeners": {
            "title": "SYSTEM RESET: FULL LISTENER DE-COUPLING",
            "description": "Permanently removing ALL active monitoring topics and halting background scouting."
        },
        "emit_ui_directive": {
             "title": "SYNCHRONIZING DOMAIN VIEWS",
             "description": f"Switching navigation focus to '{args.get('view', 'dashboard')}'."
        }
    }
    return MAP.get(tool_name, {
        "title": tool_name.upper().replace("_", " "),
        "description": f"Executing tactical operation {tool_name}."
    })

def set_agent_context(user_id: str):
    """Safely inject user context into all sub-skill modules."""
    try:
        import skills.schedule_manager._context as sm_ctx
        sm_ctx.CURRENT_USER_ID = user_id
    except: pass
    
    try:
        import skills.cognitive_listener._context as cl_ctx
        cl_ctx.CURRENT_USER_ID = user_id
    except: pass
    
    try:
        import skills.time_slot_finder._context as tsf_ctx
        tsf_ctx.CURRENT_USER_ID = user_id
    except: pass
    
    try:
        import skills.event_scout._context as es_ctx
        es_ctx.CURRENT_USER_ID = user_id
    except: pass
    
    try:
        import skills.travel_planner._context as tp_ctx
        tp_ctx.CURRENT_USER_ID = user_id
    except: pass

def get_premium_thinking_title(tool_name: str) -> str:
    """Map technical tool names to premium tactical headers."""
    return get_action_metadata(tool_name)["title"]

async def run_chat_agent_stream(user_id: str, message: str, db: Session, history: List[Dict] = [], provider: str = None, api_key: str = None):
    set_agent_context(user_id)
    agent = get_cached_agent(user_id, provider, api_key)
    
    # Check current state from the checkpointer
    config = {"configurable": {"thread_id": user_id}}
    curr_state = agent.get_state(config)
    
    # 1. Handle pending interrupts before starting a new turn by resolving them with a rejection
    # to clear the graph path for the new user prompt.
    while curr_state.tasks and any(t.interrupts for t in curr_state.tasks):
        # We must resolve by ID if there are multiple
        # NOTE: We only resolve the top task's interrupts for now as that's typical
        task = curr_state.tasks[0]
        if task.interrupts:
            intr = task.interrupts[0]
            print(f"[CADENCE] Clearing stale interrupt: {intr.interrupt_id}")
            async for _ in agent.astream(Command(resume={intr.interrupt_id: "reject"}), config, stream_mode="updates"):
                pass
            curr_state = agent.get_state(config)
        else:
            break

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
6. ATOMIC CLEANUP: If the user asks for a 'cleanup', 'reset', or 'clear all', ALWAYS use `cleanup_strategic_dashboard` to wipe both events and insights in one action. This avoids multiple approval prompts.
7. TARGETED REMOVAL: If the user wants to remove a specific listener or topic, ALWAYS call `list_active_listeners` first to show them the full context. Then, once they confirm, use `remove_topic_listener` with the exact `listener_id`.
8. BULK LISTENER REMOVAL: If the user specifically asks to 'delete all listeners', 'reset monitoring', or remove several topics at once, use `clear_all_active_listeners`.
9. REJECTION FINALITY: If the user REJECTS a tool call, this is a TERMINAL signal. DO NOT attempt to call the same tool with the same arguments again in the same turn. Apologize and ask for further instructions instead.
10. PRIORITIZE PERSONAL CONTEXT: When the user asks for 'hot topics', 'news', 'updates', or 'what is happening', you MUST first call `get_tactical_summary`. Prioritize the findings in your active listeners and discovery feed over generic web searches. Only reach for a broad web search if your internal tactical context is empty or specifically requested.
11. HANDOFF PROTOCOL: When triggering a view switch (like discovery_feed or linkedin_composer), lead with a rich, strategic recap of the data in the chat first. Do NOT limit your text to a single sentence; provide full value in the chat and offer the view switch as an 'Advanced Scoping' option.
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
            if node == "__interrupt__":
                # The agent hit our interrupt() wrapper
                for intr in data:
                    val = intr.value
                    if isinstance(val, dict) and val.get("action") == "approval_required":
                         # Yield approval to UI. Generate a mock ID for the UI if missing
                         yield {
                             "type": "approval_required",
                             "tool_calls": [{
                                 "id": intr.interrupt_id if hasattr(intr, "interrupt_id") else "unknown", 
                                 "name": val.get("display_name", val["tool_name"]), 
                                 "args": val["tool_args"],
                                 "description": val.get("description", "")
                             }]
                         }
            else:
                yield {"type": "thinking", "content": f"Graph Node Update: {node}"}
            
                # Extract messages from any node (tools, agent, model, etc.)
                msgs = data.get("messages", [])
                msgs_list = msgs if isinstance(msgs, list) else [msgs]
                
                for msg in msgs_list:
                    mtype = getattr(msg, "type", type(msg).__name__)
                    # 1. Process ToolMessages for UI Directives and Mutations
                    if isinstance(msg, ToolMessage) or mtype == "tool":
                        content = flatten_content(msg.content)
                        
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
                            # Robust JSON extraction: handle markdown blocks if they exist
                            clean_content = content.strip()
                            if "```json" in clean_content:
                                clean_content = clean_content.split("```json")[-1].split("```")[0].strip()
                            elif "```" in clean_content:
                                clean_content = clean_content.split("```")[-1].split("```")[0].strip()
                                
                            res_obj = json.loads(clean_content)
                            if isinstance(res_obj, dict):
                                if "mutation" in res_obj:
                                    yield {"type": "mutation", "data": res_obj["mutation"]}
                                if "ui_directive" in res_obj:
                                    yield {"type": "ui_directive", "view": res_obj["ui_directive"]["view"], "data": res_obj["ui_directive"]["data"]}
                                if "discoveries" in res_obj:
                                    yield {"type": "discoveries", "data": res_obj["discoveries"]}
                                if "status" in res_obj and "summary" in res_obj:
                                    summary = res_obj["summary"]
                                    if "momentum_metrics" in summary:
                                        yield {
                                            "type": "metrics",
                                            "data": {
                                                "type": "line",
                                                "title": "Discovery Momentum",
                                                "data": summary["momentum_metrics"]
                                            }
                                        }
                        except Exception:
                            pass
                    
                    # 2. Process AIMessages for Streaming Text and Thinking Titles
                    elif isinstance(msg, AIMessage):
                        tcalls = getattr(msg, "tool_calls", [])
                        if tcalls:
                            for tc in tcalls:
                                tname = tc.get("name") if isinstance(tc, dict) else getattr(tc, "function", {}).get("name", "unknown")
                                yield {"type": "thinking_title", "content": get_premium_thinking_title(tname)}
                                yield {"type": "thinking", "content": f"Using {tname}..."}
                        elif msg.content:
                            flattened = flatten_content(msg.content)
                            if flattened:
                                yield {"type": "response", "content": flattened}

    
async def clear_session(user_id: str):
    """Wipe the agent's memory and cache for a focused restart."""
    # 1. Clear Long-Term Memory (Checkpoints)
    memory.delete_thread(user_id)
    
    # 2. Clear Active Cache
    keys_to_remove = [k for k in _AGENT_CACHE if k.startswith(f"{user_id}:")]
    for k in keys_to_remove:
        del _AGENT_CACHE[k]
    
    print(f"[CADENCE] Session cleared for user: {user_id}")


async def resume_chat_agent_stream(user_id: str, action: str, db: Session, provider: str = None, api_key: str = None):
    set_agent_context(user_id)
    agent = get_cached_agent(user_id, provider, api_key)
    config = {"configurable": {"thread_id": user_id}}
    
    curr_state = agent.get_state(config)
    if not curr_state.tasks or not curr_state.tasks[0].interrupts:
        # Check if there's actually an interrupt to resume
        if not curr_state.next:
            yield {"type": "response", "content": "\n*No pending operations to resume.*"}
            return
            
    # Resolve all pending interrupts for the current task before proceeding
    while curr_state.tasks and curr_state.tasks[0].interrupts:
        task = curr_state.tasks[0]
        intr = task.interrupts[0]
        interrupt_id = intr.interrupt_id
        
        # 1. Gather ALL identical interrupts to resolve them atomically
        # This prevents the 'Duplicate Request' loop where the AI calls the same tool twice.
        resumption_map = {interrupt_id: action}
        
        current_val = None
        # Find the value of the interrupt we are resolving to match others
        for t in curr_state.tasks:
            for i in t.interrupts:
                if i.interrupt_id == interrupt_id:
                    current_val = i.value
                    break
                
        if current_val:
            for t in curr_state.tasks:
                for i in t.interrupts:
                    if i.interrupt_id != interrupt_id and i.value == current_val:
                        # Same tool, same args! Resolve it too.
                        resumption_map[i.interrupt_id] = action

        # 2. Resume with the atomic map
        async for event in agent.astream(Command(resume=resumption_map), config, stream_mode="updates"):
            # We must yield the events during resolution too!
            for node, data in event.items():
                if node == "tools":
                    msgs = data.get("messages", [])
                    tmsgs = msgs if isinstance(msgs, list) else [msgs]
                    for tmsg in tmsgs:
                        if isinstance(tmsg, ToolMessage):
                            content = tmsg.content
                            if content.startswith("DEEP_THINK_REQUESTED:"):
                                continue
                            try:
                                res_obj = json.loads(content)
                                if isinstance(res_obj, dict):
                                    if "mutation" in res_obj: yield {"type": "mutation", "data": res_obj["mutation"]}
                                    if "ui_directive" in res_obj: yield {"type": "ui_directive", "view": res_obj["ui_directive"]["view"], "data": res_obj["ui_directive"]["data"]}
                                    if "discoveries" in res_obj: yield {"type": "discoveries", "data": res_obj["discoveries"]}
                            except Exception: pass
                elif "messages" in data or node == "model":
                    msgs = data.get("messages", [])
                    msgs_list = msgs if isinstance(msgs, list) else [msgs]
                    if msgs_list:
                        last_msg = msgs_list[-1]
                        if isinstance(last_msg, AIMessage) and last_msg.content:
                            flattened = flatten_content(last_msg.content)
                            if flattened: yield {"type": "response", "content": flattened}
                elif node == "__interrupt__":
                    # If new interrupts appear, we yield them and stop manual resolution
                    for ni in data:
                        val = ni.value
                        if isinstance(val, dict) and val.get("action") == "approval_required":
                             yield {
                                 "type": "approval_required",
                                 "tool_calls": [{
                                     "id": ni.interrupt_id, 
                                     "name": val.get("display_name", val["tool_name"]), 
                                     "args": val["tool_args"],
                                     "description": val.get("description", "")
                                 }]
                             }
                    return # Stop loop, wait for user again
        
        # Refresh state to see if more interrupts remain
        curr_state = agent.get_state(config)

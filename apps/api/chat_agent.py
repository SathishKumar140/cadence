import os
import json
import uuid
from typing import List, Dict, Any, Annotated, Union, TypedDict
from sqlalchemy.orm import Session
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage, ToolMessage, AIMessage
from langchain_core.tools import tool
import models
from agents import get_model, run_deep_think
from langgraph.graph.message import add_messages
from langchain.agents import create_agent
from skills import registry

# Load skills once
registry.load()

# Define State
class ChatAgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    user_id: str
    db: Session
    api_key: str
    provider: str
    mutations: List[Dict[str, Any]] # Events for the frontend

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
    
    llm = get_model(provider, api_key)
    
    return create_agent(llm, tools=tools, state_schema=ChatAgentState)

async def run_chat_agent_stream(user_id: str, message: str, db: Session, history: List[Dict] = [], provider: str = "openai", api_key: str = None):
    agent = create_chat_agent(user_id, provider, api_key)
    
    # Dynamic System Prompt
    skills_context = registry.build_system_prompt_section()
    
    system_prompt = f"""You are the Cadence AI Assistant, a high-performance strategic partner.
        
{skills_context}

### CORE PROTOCOL:
1. MATCH INTENT: Identify which skill the user needs.
2. USE TOOLS: Call the appropriate tools for that skill.
3. EMIT UI: Always call `emit_ui_directive` after tool usage to switch the user's focus to the relevant panel.
4. BREVITY: Keep text responses short and helpful. Focus on the data shown in the dynamic panels.
"""

    messages = [SystemMessage(content=system_prompt)]
    
    for h in history:
        if h['role'] == 'user': 
            messages.append(HumanMessage(content=h['content']))
        elif h['role'] == 'assistant': 
            messages.append(AIMessage(content=h['content']))
        
    messages.append(HumanMessage(content=message))
    
    state = {"messages": messages, "user_id": user_id, "db": db, "mutations": [], "provider": provider, "api_key": api_key}
    
    async for event in agent.astream(state, stream_mode="updates"):
        for node, data in event.items():
            if node == "tools":
                tmsgs = data.get("messages", [])
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
                                if "discoveries" in res_obj: # for event scout backward compatibility or direct access
                                    yield {"type": "discoveries", "data": res_obj["discoveries"]}
                        except Exception:
                            pass

            elif "messages" in data:
                msgs = data["messages"]
                if msgs:
                    last_msg = msgs[-1]
                    tcalls = getattr(last_msg, "tool_calls", [])
                    if tcalls:
                        for tc in tcalls:
                            tname = tc.get("name") if isinstance(tc, dict) else getattr(tc, "function", {}).get("name", "unknown")
                            yield {"type": "thinking", "content": f"Using {tname}..."}
                    elif isinstance(last_msg, AIMessage) and last_msg.content:
                        yield {"type": "response", "content": last_msg.content}

from typing import TypedDict

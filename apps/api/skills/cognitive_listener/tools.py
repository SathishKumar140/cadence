import json
import uuid
from langchain_core.tools import tool
from database import SessionLocal
import models
from datetime import datetime

def _get_user_id():
    from skills.cognitive_listener._context import CURRENT_USER_ID
    return CURRENT_USER_ID

@tool
def add_topic_listener(topic: str, context_instruction: str = None) -> str:
    """
    Subscribe to a specific topic or trend (e.g., 'New AI Features', 'Open Source JS Frameworks').
    The assistant will monitor for these items and flag them for review.
    topic: The specific subject to monitor.
    context_instruction: Optional specific details (e.g., 'Only look for releases with local-first features').
    """
    user_id = _get_user_id()
    with SessionLocal() as db:
        listener = models.TopicListener(
            id=str(uuid.uuid4()),
            user_id=user_id,
            topic=topic,
            context_instruction=context_instruction or f"Identify any new developments related to {topic}.",
            is_active=True
        )
        db.add(listener)
        db.commit()

        return json.dumps({
            "status": "success",
            "message": f"Successfully subscribed to: {topic}",
            "ui_directive": {"view": "review_center", "data": {"action": "listener_added", "topic": topic}}
        })

@tool
def list_active_listeners() -> str:
    """List all topics you are currently monitoring."""
    user_id = _get_user_id()
    with SessionLocal() as db:
        listeners = db.query(models.TopicListener).filter(
            models.TopicListener.user_id == user_id,
            models.TopicListener.is_active == True
        ).all()
        
        result = [{"id": l.id, "topic": l.topic, "instruction": l.context_instruction} for l in listeners]
        
        return json.dumps({
            "status": "success",
            "listeners": result
        })

@tool
def get_pending_actions_for_review() -> str:
    """Fetch all identified items that require your manual review."""
    user_id = _get_user_id()
    with SessionLocal() as db:
        actions = db.query(models.PendingAction).filter(
            models.PendingAction.user_id == user_id,
            models.PendingAction.status == "pending"
        ).all()
        
        result = [{
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "source": a.source_url,
            "reasoning": a.reasoning,
            "created_at": a.created_at.isoformat()
        } for a in actions]
        
        return json.dumps({
            "status": "success",
            "actions": result,
            "ui_directive": {"view": "review_center", "data": {"actions": result}}
        })

@tool
def resolve_pending_action(action_id: str, resolution: str) -> str:
    """
    Take action on a pending item.
    action_id: The ID of the item to resolve.
    resolution: 'dismissed' (ignore), 'promoted' (convert to goal/event), or 'completed'.
    """
    user_id = _get_user_id()
    with SessionLocal() as db:
        action = db.query(models.PendingAction).filter(
            models.PendingAction.id == action_id,
            models.PendingAction.user_id == user_id
        ).first()
        
        if not action:
            return json.dumps({"status": "error", "message": "Action item not found"})
        
        action.status = resolution
        db.commit()
        
        return json.dumps({
            "status": "success",
            "message": f"Action {action_id} resolved as {resolution}",
            "mutation": {"target": "pending_actions", "action": "remove", "data": {"id": action_id}}
        })

@tool
def simulate_found_trend(topic: str, title: str, description: str, reasoning: str, url: str = None) -> str:
    """
    Simulate finding a new item for a given topic. Use this to demonstrate the 'proactive' discovery.
    """
    user_id = _get_user_id()
    with SessionLocal() as db:
        listener = db.query(models.TopicListener).filter(
            models.TopicListener.user_id == user_id,
            models.TopicListener.topic == topic
        ).first()
        
        new_action = models.PendingAction(
            id=str(uuid.uuid4()),
            user_id=user_id,
            listener_id=listener.id if listener else None,
            title=title,
            description=description,
            reasoning=reasoning,
            source_url=url,
            status="pending"
        )
        db.add(new_action)
        db.commit()
        
        return json.dumps({
            "status": "success",
            "message": f"Found new item for {topic}: {title}",
            "ui_directive": {"view": "review_center", "data": {"new_item": title}}
        })

TOOLS = [add_topic_listener, list_active_listeners, get_pending_actions_for_review, resolve_pending_action, simulate_found_trend]

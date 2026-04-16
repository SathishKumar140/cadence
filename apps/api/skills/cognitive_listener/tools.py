import json
import uuid
from langchain_core.tools import tool
from database import SessionLocal
import models
from datetime import datetime

def _get_user_id():
    from skills.cognitive_listener._context import CURRENT_USER_ID
    return CURRENT_USER_ID

import asyncio
from integrations.tavily_search import TavilyDiscovery

async def _scout_for_updates_internal(topic: str = None, user_id: str = None) -> str:
    if not user_id:
        user_id = _get_user_id()
    tavily = TavilyDiscovery()
    
    async def _run_scout():
        with SessionLocal() as db:
            if topic:
                listeners = db.query(models.TopicListener).filter(
                    models.TopicListener.user_id == user_id,
                    models.TopicListener.topic == topic,
                    models.TopicListener.is_active == True
                ).all()
            else:
                listeners = db.query(models.TopicListener).filter(
                    models.TopicListener.user_id == user_id,
                    models.TopicListener.is_active == True
                ).all()

            if not listeners:
                if topic:
                    # SMART DISCOVERY: Perform a one-off search even if no listener exists
                    print(f"[CADENCE] Perform one-off discovery for: {topic}")
                    trends = await tavily.search_trends(topic)
                    found_count = 0
                    for trend in trends:
                        # Check duplicates
                        exists = db.query(models.PendingAction).filter(
                            models.PendingAction.user_id == user_id,
                            models.PendingAction.source_url == trend["url"]
                        ).first()
                        if not exists:
                            new_action = models.PendingAction(
                                id=str(uuid.uuid4()),
                                user_id=user_id,
                                listener_id=None, # One-off discovery
                                title=trend["title"],
                                description=f"[Discovery] {trend['description'][:400]}",
                                reasoning=f"Found via discovery scan for '{topic}'.",
                                source_url=trend["url"],
                                status="pending"
                            )
                            db.add(new_action)
                            found_count += 1
                    db.commit()
                    return found_count
                return 0 # No listeners and no specific topic provided

            found_count = 0
            for listener in listeners:
                trends = await tavily.search_trends(listener.topic)
                for trend in trends:
                    # Check if this URL already exists for this user to avoid duplicates
                    exists = db.query(models.PendingAction).filter(
                        models.PendingAction.user_id == user_id,
                        models.PendingAction.source_url == trend["url"]
                    ).first()
                    
                    if not exists:
                        new_action = models.PendingAction(
                            id=str(uuid.uuid4()),
                            user_id=user_id,
                            listener_id=listener.id,
                            title=trend["title"],
                            description=trend["description"][:500], # title + description
                            reasoning=f"Identified as a relevant update for your interest in '{listener.topic}'.",
                            source_url=trend["url"],
                            status="pending"
                        )
                        db.add(new_action)
                        found_count += 1
                
                listener.last_processed = datetime.now()
            
            db.commit()
            return found_count

    try:
        count = await _run_scout()

        # Fetch the full set of pending actions to sync the UI
        with SessionLocal() as db:
            actions = db.query(models.PendingAction).filter(
                models.PendingAction.user_id == user_id,
                models.PendingAction.status == "pending"
            ).order_by(models.PendingAction.created_at.desc()).all()
            
            actions_data = [{
                "id": a.id,
                "title": a.title,
                "description": a.description,
                "source_url": a.source_url,
                "reasoning": a.reasoning,
                "created_at": a.created_at.isoformat()
            } for a in actions]

        return json.dumps({
            "status": "success",
            "message": f"Scout complete. Identified {count} new items for review.",
            "mutation": {"target": "discovery", "action": "sync", "data": {"actions": actions_data}},
            "ui_directive": {"view": "discovery_feed", "data": {"action": "scout_complete", "new_items": count}}
        })
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@tool
async def scout_for_updates(topic: str = None) -> str:
    """
    Perform a DISCOVERY scouting report for the latest real-time updates and news.
    USE THIS for one-off information requests. It is 'Safe' and does not need human approval.
    If 'topic' is provided, it performs a targeted discovery search.
    Found items are flagged for review in the Discovery Feed.
    """
    return await _scout_for_updates_internal(topic=topic)

@tool
async def add_topic_listener(topic: str, context_instruction: str = None, scouting_frequency: str = "6h") -> str:
    """
    MUTATING ACTION: Permanently subscribe to a topic for ongoing background monitoring.
    REQUIRES HUMAN APPROVAL. Use this only when the user wants to 'FOLLOW' or 'TRACK' a topic long-term.
    Found items are flagged for review in the Discovery Feed.
    scouting_frequency: (e.g., '1h', '6h', '12h'). Default is '6h'.
    An initial scout is performed immediately.
    """
    user_id = _get_user_id()
    with SessionLocal() as db:
        # Check if a listener for this topic already exists for the user
        existing = db.query(models.TopicListener).filter(
            models.TopicListener.user_id == user_id,
            models.TopicListener.topic == topic
        ).first()
        
        if existing:
            if existing.is_active:
                existing.scouting_frequency = scouting_frequency
                db.commit()
                return json.dumps({
                    "status": "success",
                    "message": f"Updated existing listener for '{topic}' with frequency {scouting_frequency}.",
                    "ui_directive": {"view": "discovery_feed", "data": {"action": "already_monitored", "topic": topic}}
                })
            else:
                existing.is_active = True
                existing.scouting_frequency = scouting_frequency
                db.commit()
                return json.dumps({
                    "status": "success",
                    "message": f"Re-activated listener for '{topic}' at frequency {scouting_frequency}.",
                    "mutation": {"target": "listeners", "action": "add", "data": {"id": existing.id, "topic": existing.topic, "instruction": existing.context_instruction, "scouting_frequency": existing.scouting_frequency}},
                    "ui_directive": {"view": "discovery_feed", "data": {"action": "listener_activated", "topic": topic}}
                })

        listener = models.TopicListener(
            id=str(uuid.uuid4()),
            user_id=user_id,
            topic=topic,
            context_instruction=context_instruction or f"Identify any new developments related to {topic}.",
            scouting_frequency=scouting_frequency,
            is_active=True
        )
        db.add(listener)
        db.commit()

        # 2. Get all listeners to sync UI
        listeners = db.query(models.TopicListener).filter(
            models.TopicListener.user_id == user_id,
            models.TopicListener.is_active == True
        ).all()
        listeners_data = [{"id": l.id, "topic": l.topic, "instruction": l.context_instruction, "scouting_frequency": l.scouting_frequency} for l in listeners]

        # 3. Trigger an immediate scout for the new topic via the internal helper
        scout_result = json.loads(await _scout_for_updates_internal(topic=topic))
        actions_data = scout_result.get("mutation", {}).get("data", {}).get("actions", [])
        
        return json.dumps({
            "status": "success",
            "message": f"Successfully subscribed to: {topic} (scouting every {scouting_frequency}). Initial scout performed.",
            "scout_detail": scout_result,
            "mutation": {
                "target": "discovery", 
                "action": "sync", 
                "data": {
                    "listeners": listeners_data,
                    "actions": actions_data
                }
            },
            "ui_directive": {"view": "discovery_feed", "data": {"action": "listener_added", "topic": topic}}
        })

@tool
def list_active_listeners() -> str:
    """List all topics you are currently monitoring and their scouting frequencies."""
    user_id = _get_user_id()
    with SessionLocal() as db:
        listeners = db.query(models.TopicListener).filter(
            models.TopicListener.user_id == user_id,
            models.TopicListener.is_active == True
        ).all()
        
        result = [{"id": l.id, "topic": l.topic, "instruction": l.context_instruction, "scouting_frequency": l.scouting_frequency, "last_processed": l.last_processed.isoformat() if l.last_processed else None} for l in listeners]
        
        return json.dumps({
            "status": "success",
            "listeners": result,
            "ui_directive": {"view": "discovery_feed", "data": {"action": "list_listeners", "count": len(result)}}
        })

@tool
def get_pending_actions_for_review() -> str:
    """Fetch all identified items that require your manual review in the Discovery Feed."""
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
            "ui_directive": {"view": "discovery_feed", "data": {"actions": result}}
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
def get_tactical_summary() -> str:
    """
    Fetch a snapshot of your current monitoring landscape.
    USE THIS instead of generic searches when asked 'any hot topics?', 'what's new?', or 'summary of my topics'.
    Returns:
    - active_scouting_topics: Sectors you are currently tracking.
    - latest_discovery_signals: Most recent items identified for review (Top 10).
    """
    user_id = _get_user_id()
    with SessionLocal() as db:
        # 1. Listeners
        listeners = db.query(models.TopicListener).filter(
            models.TopicListener.user_id == user_id,
            models.TopicListener.is_active == True
        ).all()
        
        # 2. Latest Signals
        signals = db.query(models.PendingAction).filter(
            models.PendingAction.user_id == user_id,
            models.PendingAction.status == "pending"
        ).order_by(models.PendingAction.created_at.desc()).limit(10).all()
        
        # 3. Momentum Calculation (Signals per day for last 7 days)
        from datetime import timedelta
        momentum = []
        for i in range(7):
            day = datetime.now().date() - timedelta(days=6-i)
            count = db.query(models.PendingAction).filter(
                models.PendingAction.user_id == user_id,
                models.PendingAction.created_at >= datetime.combine(day, datetime.min.time()),
                models.PendingAction.created_at <= datetime.combine(day, datetime.max.time())
            ).count()
            momentum.append({"day": day.strftime("%a"), "count": count})

        summary = {
            "active_monitoring_topics": [l.topic for l in listeners],
            "latest_identified_signals": [
                {
                    "title": s.title,
                    "reasoning": s.reasoning,
                    "created_at": s.created_at.isoformat()
                } for s in signals
            ],
            "momentum_metrics": momentum
        }
        
        if not summary["active_monitoring_topics"] and not summary["latest_identified_signals"]:
            return "Tactical context is currently empty. No active listeners or identified signals found."
            
        return json.dumps({
            "status": "success",
            "summary": summary
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
            "ui_directive": {"view": "discovery_feed", "data": {"new_item": title}}
        })

@tool
def remove_topic_listener(listener_id: str) -> str:
    """Permanently remove a monitoring topic by its unique ID."""
    user_id = _get_user_id()
    with SessionLocal() as db:
        listener = db.query(models.TopicListener).filter(
            models.TopicListener.user_id == user_id,
            models.TopicListener.id == listener_id
        ).first()
        
        if not listener:
            return json.dumps({"status": "error", "message": f"Listener with ID '{listener_id}' not found."})
        
        topic_name = listener.topic
        db.delete(listener)
        db.commit()
        
        # Verify deletion
        exists = db.query(models.TopicListener).filter(models.TopicListener.id == listener_id).first()
        if exists:
            return json.dumps({"status": "error", "message": f"Critical Failure: Topic '{topic_name}' could not be purged from the database."})
            
        return json.dumps({
            "status": "success",
            "message": f"Successfully removed topic listener: {topic_name}",
            "mutation": {"target": "listeners", "action": "remove", "data": {"id": listener_id}}
        })

@tool
def clear_all_pending_actions() -> str:
    """CRITICAL: Permanently clear all identified items from the Discovery Feed/Pending Actions queue. Use for full cleanup/reset."""
    user_id = _get_user_id()
    with SessionLocal() as db:
        count = db.query(models.PendingAction).filter(
            models.PendingAction.user_id == user_id,
            models.PendingAction.status == "pending"
        ).delete()
        db.commit()
        return json.dumps({"status": "success", "message": f"Cleared {count} pending actions.", "mutation": {"target": "pending_actions", "action": "clear"}})

@tool
def update_user_interests(interests: list[str]) -> str:
    """
    Update the user's core interests/preferences in the Digital Brain.
    Use this when the user explicitly asks to 'add to preferences' or 'change interests'.
    """
    user_id = _get_user_id()
    from sqlalchemy.orm.attributes import flag_modified
    with SessionLocal() as db:
        # 1. Update UserPreference
        pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == user_id).first()
        if not pref:
            pref = models.UserPreference(
                id=str(uuid.uuid4()), 
                user_id=user_id, 
                interests=interests,
                goals={"workout_per_week": 3, "learning_hours_per_week": 2, "social_events": 1}
            )
            db.add(pref)
        else:
            pref.interests = interests
            flag_modified(pref, "interests")
        
        # 2. Add as a durable Knowledge Item
        knowledge = models.KnowledgeItem(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title="Priority Interests Profile",
            content=f"User has prioritized the following interests for strategic planning: {', '.join(interests)}",
            tags=interests
        )
        db.add(knowledge)
        db.commit()
        
        return json.dumps({
            "status": "success",
            "message": f"Interests updated to: {', '.join(interests)}",
            "mutation": {"target": "preferences", "action": "update", "data": {"interests": interests}},
            "ui_directive": {"view": "discovery_feed", "data": {"action": "interests_updated", "interests": interests}}
        })

@tool
def clear_all_active_listeners() -> str:
    """CRITICAL: Permanently remove ALL monitoring topics and stop all background scouting. Use when the user asks to 'delete all listeners' or 'reset monitoring'."""
    user_id = _get_user_id()
    with SessionLocal() as db:
        count = db.query(models.TopicListener).filter(
            models.TopicListener.user_id == user_id
        ).delete()
        db.commit()
        return json.dumps({
            "status": "success", 
            "message": f"Successfully de-coupled {count} active monitoring topics.",
            "mutation": {"target": "listeners", "action": "replace", "data": []}
        })

TOOLS = [add_topic_listener, list_active_listeners, get_pending_actions_for_review, resolve_pending_action, simulate_found_trend, scout_for_updates, remove_topic_listener, update_user_interests, clear_all_pending_actions, clear_all_active_listeners]

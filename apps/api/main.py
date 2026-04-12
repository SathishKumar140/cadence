import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import func
from typing import Dict, Any, List, Optional
import uuid
import json
import asyncio
import httpx
from pydantic import BaseModel
from datetime import datetime, timedelta
from dateutil import parser as date_parser
from dateutil.relativedelta import relativedelta, MO, TU, WE, TH, FR, SA, SU
from zoneinfo import ZoneInfo

# Create database tables
import models
from database import engine, get_db
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Cadence API", description="AI Operations System Backend", version="1.0.0")

# Setup CORS
raw_origins = os.getenv("ALLOW_ORIGINS", "*")
if raw_origins == "*":
    allow_origins = ["*"]
    allow_credentials = False
else:
    allow_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Request logger for debugging CORS
@app.middleware("http")
async def log_requests(request, call_next):
    print(f"DEBUG RECV: {request.method} {request.url.path}")
    response = await call_next(request)
    return response

print(f"DEBUG: CORS initialized with origins: {allow_origins}, credentials: {allow_credentials}")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "cadence-api"}


from agents import run_full_agent
from chat_agent import run_chat_agent_stream
from integrations import EventDiscoveryService
from integrations.linkedin import LinkedInClient

# Pydantic Models
class ChatRequest(BaseModel):
    message: str
    user_id: str
    access_token: str = ""
class SyncRequest(BaseModel):
    access_token: str
    user_id: str
    timezone: str = "UTC"

class PreferenceUpdate(BaseModel):
    goals: Dict[str, Any]
    interests: List[str] = []
    location: Optional[Dict[str, Any]] = None

class RoutineActionRequest(BaseModel):
    user_id: str
    routine_id: str

class SocialPostRequest(BaseModel):
    user_id: str
    content: str
    title: str
    action_id: str

class AddEventRequest(BaseModel):
    user_id: str
    item_id: str
    access_token: str
    title: str
    day: str
    time: str
    description: str

class UserSettingsUpdate(BaseModel):
    theme: str = "dark"
    ai_provider: str = "openai"
    ai_api_key: str = ""
    scouting_frequency: str = "6h"

class AlternateRequest(BaseModel):
    user_id: str
    item_id: str
    access_token: str
    title: str = ""
    day: str = ""
    time: str = ""

class RoutineCreate(BaseModel):
    user_id: str
    name: str
    description: str = ""
    schedule: str = "daily"
    alert_time: Optional[str] = None

class GoalCreate(BaseModel):
    user_id: str
    title: str
    target_value: float
    unit: str = "times"
    category: str = "general"
    deadline: Optional[str] = None

class GoalUpdate(BaseModel):
    progress_delta: float

class EmailCreate(BaseModel):
    user_id: str
    subject: str
    body: str
    recipient: str
    send_at: str

class ListenerCreate(BaseModel):
    user_id: str
    topic: str
    context_instruction: Optional[str] = None
    scouting_frequency: Optional[str] = "6h"

class ListenerFrequencyUpdate(BaseModel):
    user_id: str
    frequency: str

class ActionResolve(BaseModel):
    user_id: str
    resolution: str  # 'dismissed', 'promoted', 'completed'

class KnowledgeSave(BaseModel):
    user_id: str
    title: str
    content: str
    source_url: Optional[str] = None
    tags: Optional[List[str]] = None

# Helper Functions
def get_next_weekday(day_str: str, time_str: str, user_tz: str = "UTC"):
    days = {"Monday": MO, "Tuesday": TU, "Wednesday": WE, "Thursday": TH, "Friday": FR, "Saturday": SA, "Sunday": SU}
    target_day = days.get(day_str.capitalize(), MO)
    
    try:
        # Expected format "HH:MM-HH:MM"
        time_range = time_str.split('-')
        start_t_str = time_range[0]
        end_t_str = time_range[1] if len(time_range) > 1 else time_range[0]
        
        now = datetime.now(ZoneInfo(user_tz))
        # Find next occurrence of that weekday
        start_date = now + relativedelta(weekday=target_day)
        
        # Combine date with time
        start_dt = datetime.combine(start_date.date(), datetime.strptime(start_t_str.strip(), "%H:%M").time())
        start_dt = start_dt.replace(tzinfo=ZoneInfo(user_tz))
        
        end_dt = datetime.combine(start_date.date(), datetime.strptime(end_t_str.strip(), "%H:%M").time())
        end_dt = end_dt.replace(tzinfo=ZoneInfo(user_tz))
        
        return start_dt.isoformat(), end_dt.isoformat()
    except Exception as e:
        print(f"Error parsing date/time: {e}")
        # Fallback to current time + 1 hour
        now = datetime.now(ZoneInfo(user_tz))
        return now.isoformat(), (now + timedelta(hours=1)).isoformat()

# Endpoints
@app.get("/api/skills")
def list_skills():
    from skills import registry
    return [{"name": s.name, "display_name": s.display_name, "description": s.description, "ui_view": s.ui_view} for s in registry.all()]

@app.get("/api/routines")
def get_routines(user_id: str, db: Session = Depends(get_db)):
    routines = db.query(models.Routine).filter(models.Routine.user_id == user_id, models.Routine.is_active == True).all()
    return routines

@app.post("/api/routines")
def create_routine(req: RoutineCreate, db: Session = Depends(get_db)):
    routine = models.Routine(
        id=str(uuid.uuid4()),
        user_id=req.user_id,
        name=req.name,
        description=req.description,
        schedule=req.schedule,
        alert_time=req.alert_time
    )
    db.add(routine)
    db.commit()
    db.refresh(routine)
    return routine

@app.delete("/api/routines/{routine_id}")
def delete_routine(routine_id: str, user_id: str, db: Session = Depends(get_db)):
    routine = db.query(models.Routine).filter(models.Routine.id == routine_id, models.Routine.user_id == user_id).first()
    if routine:
        routine.is_active = False
        db.commit()
    return {"status": "success"}

@app.get("/api/goals")
def get_goals(user_id: str, db: Session = Depends(get_db)):
    goals = db.query(models.Goal).filter(models.Goal.user_id == user_id, models.Goal.is_active == True).all()
    return goals

@app.post("/api/goals")
def create_goal(req: GoalCreate, db: Session = Depends(get_db)):
    deadline_dt = None
    if req.deadline:
        try:
            deadline_dt = date_parser.parse(req.deadline, fuzzy=True)
        except:
            pass
            
    goal = models.Goal(
        id=str(uuid.uuid4()),
        user_id=req.user_id,
        title=req.title,
        target_value=req.target_value,
        unit=req.unit,
        category=req.category,
        deadline=deadline_dt
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal

@app.put("/api/goals/{goal_id}/progress")
def update_goal_progress(goal_id: str, user_id: str, req: GoalUpdate, db: Session = Depends(get_db)):
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id, models.Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    goal.current_value += req.progress_delta
    db.commit()
    return {"status": "success", "current_value": goal.current_value}

@app.get("/api/emails")
def get_emails(user_id: str, db: Session = Depends(get_db)):
    emails = db.query(models.ScheduledEmail).filter(models.ScheduledEmail.user_id == user_id).all()
    return emails

@app.post("/api/emails")
def create_email(req: EmailCreate, db: Session = Depends(get_db)):
    try:
        send_time = date_parser.parse(req.send_at, fuzzy=True)
    except:
        send_time = datetime.utcnow() + timedelta(hours=1)
        
    email = models.ScheduledEmail(
        id=str(uuid.uuid4()),
        user_id=req.user_id,
        subject=req.subject,
        body=req.body,
        recipient=req.recipient,
        send_at=send_time
    )
    db.add(email)
    db.commit()
    db.refresh(email)
    return email

@app.get("/api/dashboard/insights")
async def get_dashboard_data(user_id: str, db: Session = Depends(get_db)):
    try:
        # 1. Check Cache
        cached = db.query(models.DashboardCache).filter(models.DashboardCache.user_id == user_id).first()
        if cached:
            # TTL check (24 hours) - Normalize for naive/aware mismatch
            now = datetime.now(cached.created_at.tzinfo) if cached.created_at.tzinfo else datetime.now()
            age = now - cached.created_at
            if age < timedelta(hours=24):
                plan = cached.weekly_plan
                
                # Self-healing: Ensure all items have IDs for targeted management
                plan_updated = False
                for item in plan:
                    if not item.get("id"):
                        item["id"] = str(uuid.uuid4())
                        plan_updated = True
                
                if plan_updated:
                    cached.weekly_plan = plan
                    flag_modified(cached, "weekly_plan")
                    db.commit()
                
                # Enrich with sync status
                user = db.query(models.User).filter(models.User.id == user_id).first()
                user_tz = user.timezone if user and user.timezone else "UTC"
                synced_events = db.query(models.CalendarEvent).filter(models.CalendarEvent.user_id == user_id).all()
                
                for item in plan:
                    # Precision Matching: Check if this specific item ID exists in synced records
                    is_synced = any(
                        e.plan_item_id == item.get("id") 
                        for e in synced_events
                    )
                    item["is_synced"] = is_synced

                return {
                    "insights": cached.insights,
                    "weekly_plan": plan,
                    "calendar_timezone": cached.calendar_timezone,
                    "cached": True,
                    "last_updated": cached.created_at.isoformat()
                }

        # 2. Fetch user for API key
        user = db.query(models.User).filter(models.User.id == user_id).first()
        api_key = user.ai_api_key if user and user.ai_api_key else None
        
        # 3. Run Agent
        provider = user.ai_provider if user and user.ai_provider else "openai"
        data = await run_full_agent(user_id, db, provider=provider, api_key=api_key)
        
        # 4. Upsert Cache
        if not cached:
            cached = models.DashboardCache(
                id=str(uuid.uuid4()),
                user_id=user_id,
            )
            db.add(cached)
        
        cached.insights = data.get("insights")
        cached.weekly_plan = data.get("weekly_plan")
        cached.calendar_timezone = data.get("calendar_timezone", "UTC")
        cached.created_at = func.now() # Reset TTL
        db.commit()

        # 5. Enrich fresh data with sync status
        synced_events = db.query(models.CalendarEvent).filter(models.CalendarEvent.user_id == user_id).all()
        for item in data.get("weekly_plan", []):
            is_synced = any(
                e.plan_item_id == item.get("id")
                for e in synced_events
            )
            item["is_synced"] = is_synced

        return data
    except Exception as e:
        print(f"Error generating insights: {e}")
        return {
            "insights": {
                "optimization_score": 75,
                "insight_cards": [
                    {"title": "Welcome to Cadence", "description": "Analyzing your patterns... your dashboard will update soon.", "score_type": "schedule", "impact": 4}
                ]
            },
            "weekly_plan": [],
            "calendar_timezone": 'UTC'
        }

@app.post("/api/dashboard/items/alternate")
async def suggest_alternate(req: AlternateRequest, db: Session = Depends(get_db)):
    try:
        # 1. Fetch Cache & User
        cached = db.query(models.DashboardCache).filter(models.DashboardCache.user_id == req.user_id).first()
        if not cached:
            raise HTTPException(status_code=404, detail="No dashboard to refine")
        
        user = db.query(models.User).filter(models.User.id == req.user_id).first()
        pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == req.user_id).first()
        
        # 2. Identify item to replace with aggressive self-healing
        plan = cached.weekly_plan
        import uuid
        plan_updated = False
        
        # Ensure all items have IDs first (in case suggest_alternate is called before enrichment)
        for item in plan:
            if not item.get("id"):
                item["id"] = str(uuid.uuid4())
                plan_updated = True
        
        if plan_updated:
            cached.weekly_plan = plan
            flag_modified(cached, "weekly_plan")
            db.commit()
            db.refresh(cached)
            plan = cached.weekly_plan

        item_to_replace = next((i for i in plan if str(i.get("id")) == str(req.item_id)), None)
        
        if not item_to_replace:
            # Final fallback: matching by title/day/time if ID is still mismatched
            item_to_replace = next((i for i in plan if 
                i.get("title") == req.title and 
                i.get("day") == req.day and 
                i.get("time") == req.time
            ), None)
        
        if not item_to_replace:
            raise HTTPException(status_code=404, detail=f"No matching item found for alternate suggestion.")
        
        # 3. Run Alternate Agent
        from agents import run_alternate_agent
        new_item = run_alternate_agent(
            current_plan=plan,
            item_to_replace=item_to_replace,
            goals=pref.goals if pref else {},
            provider=user.ai_provider if user and user.ai_provider else "openai",
            api_key=user.ai_api_key if user and user.ai_api_key else None
        )
        
        # 4. Update Cache
        updated_plan = [new_item if i.get("id") == req.item_id else i for i in plan]
        cached.weekly_plan = updated_plan
        db.commit()
        
        return {"status": "success", "new_item": new_item}
    except Exception as e:
        print(f"Error suggesting alternate: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/dashboard/cache")
async def clear_dashboard_cache(user_id: str, db: Session = Depends(get_db)):
    db.query(models.DashboardCache).filter(models.DashboardCache.user_id == user_id).delete()
    db.commit()
    return {"status": "success", "message": "Cache invalidated"}

@app.delete("/api/calendar/event")
async def unsync_calendar_event(user_id: str, item_id: str, access_token: str, db: Session = Depends(get_db)):
    try:
        # 1. Find the synced event by exact plan_item_id
        target_event = db.query(models.CalendarEvent).filter(
            models.CalendarEvent.user_id == user_id,
            models.CalendarEvent.plan_item_id == item_id
        ).first()
        
        if not target_event:
            raise HTTPException(status_code=404, detail="Synced event record not found")

        # 2. Call Google API to delete
        headers = { "Authorization": f"Bearer {access_token}" }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(
                f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{target_event.external_id}",
                headers=headers
            )
            
            # 204 success, 404 acceptable if manually deleted in Google
            if resp.status_code not in [204, 404]:
                raise HTTPException(status_code=resp.status_code, detail=f"Google API Error: {resp.text}")

        # 3. Cleanup DB
        db.delete(target_event)
        db.commit()
        
        return {"status": "success"}
        
    except Exception as e:
        print(f"Error unsyncing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/settings")
def get_user_settings(user_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return {"theme": "dark", "ai_provider": "openai", "ai_api_key": "", "scouting_frequency": "6h"}
    return {
        "theme": user.theme or "dark",
        "ai_provider": user.ai_provider or "openai",
        "ai_api_key": user.ai_api_key or "",
        "scouting_frequency": user.scouting_frequency or "6h"
    }

@app.put("/api/user/settings")
def update_user_settings(user_id: str, req: UserSettingsUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        # Create user if doesn't exist (though normally handled in sync)
        user = models.User(
            id=user_id, 
            email=f"{user_id}@example.com", 
            theme=req.theme, 
            ai_provider=req.ai_provider, 
            ai_api_key=req.ai_api_key,
            scouting_frequency=req.scouting_frequency
        )
        db.add(user)
    else:
        user.theme = req.theme
        user.ai_provider = req.ai_provider
        user.ai_api_key = req.ai_api_key
        user.scouting_frequency = req.scouting_frequency
    db.commit()
    # Invalidate dashboard cache on settings update
    db.query(models.DashboardCache).filter(models.DashboardCache.user_id == user_id).delete()
    db.commit()
    return {"status": "success"}

@app.options("/api/user/preferences")
async def options_user_preferences():
    return {}

@app.get("/api/user/preferences")
def get_preferences(user_id: str, db: Session = Depends(get_db)):
    pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == user_id).first()
    if not pref:
        return {
            "goals": {"workout_per_week": 3, "learning_hours_per_week": 2, "social_events": 1},
            "interests": ["AI", "Fitness", "Coding"]
        }
    return {
        "goals": pref.goals,
        "interests": pref.interests if pref.interests else []
    }

@app.post("/api/user/preferences")
def update_preferences(user_id: str, req: PreferenceUpdate, db: Session = Depends(get_db)):
    try:
        # 1. Ensure user exists (Self-healing for onboarding)
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            print(f"DEBUG: Initializing new user account: {user_id}")
            user = models.User(id=user_id, email=f"{user_id}@cadence-user.com")
            db.add(user)
            db.flush() # Ensure ID is available for FKs

        # 2. Update or Create Preferences
        pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == user_id).first()
        if not pref:
            pref = models.UserPreference(
                id=str(uuid.uuid4()), 
                user_id=user_id, 
                goals=req.goals, 
                interests=req.interests,
                location=req.location
            )
            db.add(pref)
        else:
            pref.goals = req.goals
            pref.interests = req.interests
            pref.location = req.location
        
        # 3. Invalidate dependent caches
        db.query(models.DashboardCache).filter(models.DashboardCache.user_id == user_id).delete()
        
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        print(f"ERROR: Preference update failed for {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Persistence error")

@app.get("/api/interests/suggest")
async def suggest_interests(q: str = ""):
    ALL_TAGS = [
        "AI Development", "Generative AI", "Large Language Models", "Python Programming",
        "React.js", "Next.js", "TypeScript", "Web3", "Blockchain", "Solidity",
        "Digital Marketing", "Product Management", "UI/UX Design", "Figma",
        "Marathon Training", "Yoga", "Crossfit", "Weightlifting", "Swimming",
        "Jazz Music", "Cooking", "Photography", "Stock Trading", "Real Estate",
        "Basketball", "Football", "Tennis", "Chess", "Cybersecurity", "Cloud Computing"
    ]
    if not q:
        return []
    matches = [t for t in ALL_TAGS if q.lower() in t.lower()]
    return matches[:8]

@app.post("/api/calendar/add-event")
async def add_calendar_event(req: AddEventRequest, db: Session = Depends(get_db)):
    try:
        user = db.query(models.User).filter(models.User.id == req.user_id).first()
        user_tz = user.timezone if user and user.timezone else "UTC"
        
        start_iso, end_iso = get_next_weekday(req.day, req.time, user_tz)
        
        event_body = {
            "summary": req.title,
            "description": req.description,
            "start": {"dateTime": start_iso, "timeZone": user_tz},
            "end": {"dateTime": end_iso, "timeZone": user_tz},
            "reminders": {"useDefault": True}
        }
        
        headers = {
            "Authorization": f"Bearer {req.access_token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                json=event_body,
                headers=headers
            )
            
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=f"Google API Error: {resp.text}")
            
            google_data = resp.json()
            event_id = google_data.get("id")

            # 5. Save to local DB for tracking
            new_event = models.CalendarEvent(
                id=str(uuid.uuid4()),
                user_id=req.user_id,
                plan_item_id=req.item_id, # Exact link
                external_id=event_id,
                title=req.title,
                description=req.description,
                start_time=date_parser.isoparse(start_iso),
                end_time=date_parser.isoparse(end_iso),
                status="synced",
                source="cadence"
            )
            db.add(new_event)
            db.commit()
                
            return {"status": "success", "event_id": event_id}
    except Exception as e:
        print(f"Error adding event: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/calendar/sync")
async def sync_calendar(req: SyncRequest, db: Session = Depends(get_db)):
    # Calculate time limits dynamically for last 30 days
    time_min = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    
    headers = {
        "Authorization": f"Bearer {req.access_token}",
        "Accept": "application/json"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            cal_meta_resp = await client.get(
                "https://www.googleapis.com/calendar/v3/calendars/primary",
                headers=headers
            )
            google_tz = req.timezone
            if cal_meta_resp.status_code == 200:
                google_tz = cal_meta_resp.json().get("timeZone", req.timezone)

            user = db.query(models.User).filter(models.User.id == req.user_id).first()
            if not user:
                new_user = models.User(id=req.user_id, email=f"{req.user_id}@example.com", timezone=google_tz)
                db.add(new_user)
            else:
                user.timezone = google_tz
            db.commit()

            response = await client.get(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                params={"timeMin": time_min, "maxResults": 100, "singleEvents": True, "orderBy": "startTime"},
                headers=headers
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to fetch Google Calendar: {response.text}")
                
            data = response.json()
            events = data.get("items", [])

            synced_count = 0
            for item in events:
                ext_id = item.get("id")
                existing = db.query(models.CalendarEvent).filter(
                    models.CalendarEvent.external_id == ext_id,
                    models.CalendarEvent.user_id == req.user_id
                ).first()
                
                if not existing:
                    start_raw = item.get("start", {}).get("dateTime") or item.get("start", {}).get("date")
                    end_raw = item.get("end", {}).get("dateTime") or item.get("end", {}).get("date")
                    
                    try:
                        start_time = date_parser.isoparse(start_raw) if start_raw else None
                        end_time = date_parser.isoparse(end_raw) if end_raw else None
                    except Exception:
                        start_time, end_time = None, None

                    new_event = models.CalendarEvent(
                        id=str(uuid.uuid4()),
                        user_id=req.user_id,
                        external_id=ext_id,
                        title=item.get("summary", "Untitled"),
                        description=item.get("description", ""),
                        event_type="event",
                        start_time=start_time,
                        end_time=end_time,
                        location=item.get("location", ""),
                        status="scheduled",
                        source="google"
                    )
                    db.add(new_event)
                    synced_count += 1
            db.commit()
            return {"status": "success", "synced": synced_count}
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Error connecting to Google Calendar: {str(e)}")

@app.post("/api/agent/chat")
async def agent_chat_endpoint(req: ChatRequest, db: Session = Depends(get_db)):
    from fastapi.responses import StreamingResponse
    import json
    
    # Fetch history
    history_objs = db.query(models.AgentChatMessage).filter(models.AgentChatMessage.user_id == req.user_id).order_by(models.AgentChatMessage.created_at.desc()).limit(10).all()
    history = [{"role": m.role, "content": m.content} for m in reversed(history_objs)]
    
    # Save user message
    user_msg = models.AgentChatMessage(id=str(uuid.uuid4()), user_id=req.user_id, role="user", content=req.message)
    db.add(user_msg)
    db.commit()

    # Fetch user for settings
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    provider = user.ai_provider if user and user.ai_provider else "openai"
    api_key = user.ai_api_key if user and user.ai_api_key else None

    async def event_generator():
        combined_response = ""
        async for event in run_chat_agent_stream(req.user_id, req.message, db, history, provider, api_key):
            if event["type"] == "response":
                combined_response += event["content"]
            yield f"data: {json.dumps(event)}\n\n"
        
        # Save assistant response
        if combined_response:
            asst_msg = models.AgentChatMessage(id=str(uuid.uuid4()), user_id=req.user_id, role="assistant", content=combined_response)
            db.add(asst_msg)
            db.commit()

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/agent/history")
async def get_agent_history(user_id: str, db: Session = Depends(get_db)):
    msgs = db.query(models.AgentChatMessage).filter(models.AgentChatMessage.user_id == user_id).order_by(models.AgentChatMessage.created_at.asc()).limit(50).all()
    return msgs

# Topic Listeners & Pending Actions
@app.get("/api/listeners")
def get_listeners(user_id: str, db: Session = Depends(get_db)):
    return db.query(models.TopicListener).filter(models.TopicListener.user_id == user_id).all()

@app.post("/api/listeners")
def create_listener(req: ListenerCreate, db: Session = Depends(get_db)):
    listener = models.TopicListener(
        id=str(uuid.uuid4()),
        user_id=req.user_id,
        topic=req.topic,
        context_instruction=req.context_instruction
    )
    db.add(listener)
    db.commit()
    return listener

@app.patch("/api/listeners/{listener_id}/toggle")
def toggle_listener(listener_id: str, user_id: str, db: Session = Depends(get_db)):
    listener = db.query(models.TopicListener).filter(
        models.TopicListener.id == listener_id,
        models.TopicListener.user_id == user_id
    ).first()
    if not listener:
        raise HTTPException(status_code=404, detail="Listener not found")
    listener.is_active = not listener.is_active
    db.commit()
    return listener

@app.patch("/api/listeners/{listener_id}/frequency")
def update_listener_frequency(listener_id: str, req: ListenerFrequencyUpdate, db: Session = Depends(get_db)):
    listener = db.query(models.TopicListener).filter(
        models.TopicListener.id == listener_id,
        models.TopicListener.user_id == req.user_id
    ).first()
    if not listener:
        raise HTTPException(status_code=404, detail="Listener not found")
    listener.scouting_frequency = req.frequency
    db.commit()
    return listener

@app.post("/api/listeners/{listener_id}/scout")
async def manual_scout_listener(listener_id: str, user_id: str, db: Session = Depends(get_db)):
    listener = db.query(models.TopicListener).filter(
        models.TopicListener.id == listener_id,
        models.TopicListener.user_id == user_id
    ).first()
    if not listener:
        raise HTTPException(status_code=404, detail="Listener not found")
    
    from skills.cognitive_listener.tools import _scout_for_updates_internal
    import json
    
    # Internal helper runs synchronously but handles its own loops
    result_str = _scout_for_updates_internal(topic=listener.topic, user_id=user_id)
    result = json.loads(result_str)
    
    # Update last_processed
    listener.last_processed = datetime.now()
    db.commit()
    
    return result

@app.delete("/api/listeners/{listener_id}")
def delete_listener(listener_id: str, user_id: str, db: Session = Depends(get_db)):
    listener = db.query(models.TopicListener).filter(
        models.TopicListener.id == listener_id,
        models.TopicListener.user_id == user_id
    ).first()
    if not listener:
        raise HTTPException(status_code=404, detail="Listener not found")
    db.delete(listener)
    db.commit()
    return {"status": "success"}

# --- Social Integrations & Auth ---

@app.get("/api/auth/linkedin")
async def linkedin_auth_start(user_id: str):
    client = LinkedInClient()
    return {"url": client.get_authorization_url(state=user_id)}

@app.get("/api/auth/linkedin/callback")
async def linkedin_auth_callback(code: str, state: str, db: Session = Depends(get_db)):
    # state is user_id
    user_id = state
    client = LinkedInClient()
    try:
        token_data = await client.get_access_token(code)
        user_info = await client.get_user_info(token_data["access_token"])
        
        author_urn = f"urn:li:person:{user_info['sub']}"
        
        # Save or update integration
        integration = db.query(models.Integration).filter(
            models.Integration.user_id == user_id,
            models.Integration.provider == "linkedin"
        ).first()
        
        if not integration:
            integration = models.Integration(
                id=str(uuid.uuid4()),
                user_id=user_id,
                provider="linkedin"
            )
            db.add(integration)
            
        integration.access_token = token_data["access_token"]
        integration.refresh_token = token_data.get("refresh_token")
        integration.config = {
            "urn": author_urn,
            "name": f"{user_info.get('given_name', '')} {user_info.get('family_name', '')}".strip() or user_info.get('name'),
            "email": user_info.get("email")
        }
        db.commit()
        
        # Return a simple HTML page that closes the popup
        from fastapi.responses import HTMLResponse
        return HTMLResponse(content="""
            <html>
                <body>
                    <script>
                        window.opener.postMessage({ type: 'linkedin_auth_success' }, '*');
                        window.close();
                    </script>
                    <p>LinkedIn connected successfully. You can close this window.</p>
                </body>
            </html>
        """)
    except Exception as e:
        print(f"LinkedIn Auth Error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"LinkedIn authentication failed: {str(e)}")

@app.get("/api/integrations/status")
async def get_integrations_status(user_id: str, db: Session = Depends(get_db)):
    integrations = db.query(models.Integration).filter(models.Integration.user_id == user_id).all()
    return {i.provider: {"enabled": i.enabled, "name": i.config.get("name") if i.config else None} for i in integrations}

@app.post("/api/social/linkedin/post")
async def linkedin_direct_post(req: SocialPostRequest, db: Session = Depends(get_db)):
    integration = db.query(models.Integration).filter(
        models.Integration.user_id == req.user_id,
        models.Integration.provider == "linkedin"
    ).first()
    
    if not integration or not integration.access_token:
        raise HTTPException(status_code=401, detail="LinkedIn not connected")
    
    client = LinkedInClient()
    try:
        author_urn = integration.config.get("urn")
        if not author_urn:
            user_info = await client.get_user_info(integration.access_token)
            author_urn = f"urn:li:person:{user_info['sub']}"
            integration.config["urn"] = author_urn
            flag_modified(integration, "config")
            db.commit()
            
        result = await client.create_post(integration.access_token, author_urn, req.content)
        
        # Mark action as promoted if it exists
        action = db.query(models.PendingAction).filter(models.PendingAction.id == req.action_id).first()
        if action:
            action.status = "promoted"
            db.commit()
            
        return {"status": "success", "result": result}
    except Exception as e:
        print(f"LinkedIn Post Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to post to LinkedIn: {str(e)}")

@app.get("/api/actions/pending")
def get_pending_actions(user_id: str, db: Session = Depends(get_db)):
    return db.query(models.PendingAction).filter(
        models.PendingAction.user_id == user_id,
        models.PendingAction.status == "pending"
    ).all()

@app.post("/api/actions/{action_id}/resolve")
def resolve_action(action_id: str, req: ActionResolve, db: Session = Depends(get_db)):
    action = db.query(models.PendingAction).filter(
        models.PendingAction.id == action_id,
        models.PendingAction.user_id == req.user_id
    ).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    action.status = req.resolution
    db.commit()
    return {"status": "success"}

@app.get("/api/events/discover")
async def discover_events(user_id: str, db: Session = Depends(get_db)):
    # Fetch interests from preferences
    pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == user_id).first()
    interests = pref.interests if pref else ["AI", "Fitness", "Coding"]
    
    # Fetch location if available (placeholder city)
    location = "San Francisco" 
    
    service = EventDiscoveryService()
    events = await service.discover(interests, location)
    return events

# Digital Brain / Knowledge Hub
@app.get("/api/knowledge")
def get_knowledge(user_id: str, db: Session = Depends(get_db)):
    return db.query(models.KnowledgeItem).filter(models.KnowledgeItem.user_id == user_id).order_by(models.KnowledgeItem.created_at.desc()).all()

@app.post("/api/knowledge")
def save_knowledge(req: KnowledgeSave, db: Session = Depends(get_db)):
    item = models.KnowledgeItem(
        id=str(uuid.uuid4()),
        user_id=req.user_id,
        title=req.title,
        content=req.content,
        source_url=req.source_url,
        tags=req.tags
    )
    db.add(item)
    db.commit()
    return item

@app.get("/")
def read_root():
    return {"message": "Welcome to Cadence API!"}

# --- Autonomous Intelligence Pulse ---

async def autonomous_scouting_pulse():
    """Background task that runs periodically to pulse all listeners according to their specific frequencies."""
    print("Intelligence Pulse: Initialized background scheduler (Per-Listener mode).")
    while True:
        try:
            # Check every 5 minutes (300s) for better precision with fast pulses
            await asyncio.sleep(300)
            
            from skills.cognitive_listener.tools import _scout_for_updates_internal
            from database import SessionLocal
            
            with SessionLocal() as db:
                now = datetime.now()
                # Find active listeners that are not 'manual'
                listeners = db.query(models.TopicListener).filter(
                    models.TopicListener.is_active == True,
                    models.TopicListener.scouting_frequency != 'manual'
                ).all()
                
                for listener in listeners:
                    freq = listener.scouting_frequency or '6h'
                    
                    # Parse frequency (e.g., '10m', '6h', '1d')
                    is_due = False
                    try:
                        unit = freq[-1].lower()
                        value = int(freq[:-1])
                        
                        last_processed = listener.last_processed
                        if not last_processed:
                            is_due = True
                        else:
                            # Normalize offset-naive/aware if needed
                            if last_processed.tzinfo is None:
                                last_processed = last_processed.replace(tzinfo=None)
                                check_now = now.replace(tzinfo=None)
                            else:
                                check_now = now.astimezone(last_processed.tzinfo)
                            
                            if unit == 'm':
                                if check_now - last_processed >= timedelta(minutes=value):
                                    is_due = True
                            elif unit == 'h':
                                if check_now - last_processed >= timedelta(hours=value):
                                    is_due = True
                            elif unit == 'd':
                                if check_now - last_processed >= timedelta(days=value):
                                    is_due = True
                    except Exception as parse_err:
                        print(f"Intelligence Pulse: Failed to parse frequency '{freq}' for listener {listener.id}: {parse_err}")
                        is_due = False
                    
                    if is_due:
                        print(f"Intelligence Pulse: Scouting for topic '{listener.topic}' (ID: {listener.id}, Freq: {freq})")
                        try:
                            # Pass user_id and specific topic to the scouting tool
                            _scout_for_updates_internal(topic=listener.topic, user_id=listener.user_id) 
                            listener.last_processed = now
                            db.commit()
                        except Exception as scout_err:
                            print(f"Intelligence Pulse Error for listener {listener.topic}: {scout_err}")
                
        except Exception as e:
            print(f"Intelligence Pulse: Scheduler loop error: {e}")
            await asyncio.sleep(60) # Back off on error

@app.on_event("startup")
async def startup_event():
    # Start the background pulse
    asyncio.create_task(autonomous_scouting_pulse())

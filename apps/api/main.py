import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import func
from typing import Dict, Any, List
import uuid
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
allow_origins = os.getenv("ALLOW_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "cadence-api"}


from agents import run_full_agent

# Pydantic Models
class SyncRequest(BaseModel):
    access_token: str
    user_id: str
    timezone: str = "UTC"

class PreferenceUpdate(BaseModel):
    goals: Dict[str, Any]
    interests: List[str] = []

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

class AlternateRequest(BaseModel):
    user_id: str
    item_id: str
    access_token: str
    title: str = ""
    day: str = ""
    time: str = ""

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
                print(f"DEBUG: Returning cached insights for user {user_id}")
                plan = cached.weekly_plan
                
                # Self-healing: Ensure all items have IDs for targeted management
                import uuid
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
        data = run_full_agent(user_id, db, api_key=api_key)
        
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
            print(f"DEBUG: ID Match failed for {req.item_id}, trying title/time fallback")
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
            api_key=user.ai_api_key if user else None
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
        return {"theme": "dark", "ai_provider": "openai", "ai_api_key": ""}
    return {
        "theme": user.theme or "dark",
        "ai_provider": user.ai_provider or "openai",
        "ai_api_key": user.ai_api_key or ""
    }

@app.put("/api/user/settings")
def update_user_settings(user_id: str, req: UserSettingsUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        # Create user if doesn't exist (though normally handled in sync)
        user = models.User(id=user_id, email=f"{user_id}@example.com", theme=req.theme, ai_provider=req.ai_provider, ai_api_key=req.ai_api_key)
        db.add(user)
    else:
        user.theme = req.theme
        user.ai_provider = req.ai_provider
        user.ai_api_key = req.ai_api_key
    db.commit()
    # Invalidate dashboard cache on settings update
    db.query(models.DashboardCache).filter(models.DashboardCache.user_id == user_id).delete()
    db.commit()
    return {"status": "success"}

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
    pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == user_id).first()
    if not pref:
        pref = models.UserPreference(id=str(uuid.uuid4()), user_id=user_id, goals=req.goals, interests=req.interests)
        db.add(pref)
    else:
        pref.goals = req.goals
    pref.interests = req.interests
    db.commit()
    # Invalidate dashboard cache on preference update
    db.query(models.DashboardCache).filter(models.DashboardCache.user_id == user_id).delete()
    db.commit()
    return {"status": "success"}

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

@app.get("/")
def read_root():
    return {"message": "Welcome to Cadence API!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

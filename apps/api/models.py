from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Float, JSON
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String)
    timezone = Column(String)
    theme = Column(String, default="dark")
    ai_provider = Column(String) # e.g., "openai", "anthropic"
    ai_api_key = Column(String) # Stored plain for this version
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    interests = Column(JSON)
    work_schedule = Column(JSON)
    constraints = Column(JSON)
    goals = Column(JSON)
    location = Column(JSON)
    notification_preferences = Column(JSON)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    external_id = Column(String)
    title = Column(String)
    description = Column(String)
    event_type = Column(String)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    location = Column(String)
    status = Column(String)
    source = Column(String)
    plan_item_id = Column(String, index=True, nullable=True) # Link to exact AI suggestion
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class DashboardCache(Base):
    __tablename__ = "dashboard_cache"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True)
    insights = Column(JSON)
    weekly_plan = Column(JSON)
    calendar_timezone = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class AgentChatMessage(Base):
    __tablename__ = "agent_chat_messages"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    role = Column(String)  # "user" | "assistant" | "system" | "tool"
    content = Column(String)
    metadata_json = Column(JSON)  # tool calls, thinking steps, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Integration(Base):
    __tablename__ = "integrations"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    provider = Column(String)  # "eventbrite", "meetup", "luma"
    access_token = Column(String, nullable=True)
    refresh_token = Column(String, nullable=True)
    config = Column(JSON, nullable=True)  # provider-specific settings
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Routine(Base):
    """A recurring habit/routine with streak tracking."""
    __tablename__ = "routines"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    description = Column(String, default="")
    schedule = Column(String, default="daily")  # 'daily', 'weekdays', 'Monday,Wednesday,Friday'
    alert_time = Column(String, nullable=True)   # 'HH:MM' format
    streak_count = Column(Integer, default=0)
    last_completed = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Goal(Base):
    """A measurable personal goal with progress tracking."""
    __tablename__ = "goals"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    target_value = Column(Float, default=1.0)
    current_value = Column(Float, default=0.0)
    unit = Column(String, default="times")         # 'km', 'hours', 'books', 'sessions'
    category = Column(String, default="general")   # 'fitness', 'learning', 'productivity', etc.
    deadline = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ScheduledEmail(Base):
    """An email queued to be sent at a specific time."""
    __tablename__ = "scheduled_emails"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    subject = Column(String, nullable=False)
    body = Column(String, nullable=False)
    recipient = Column(String, nullable=False)
    send_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String, default="pending")     # 'pending', 'sent', 'failed', 'cancelled'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TopicListener(Base):
    """Subscription to a specific trend or topic for proactive monitoring."""
    __tablename__ = "topic_listeners"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    topic = Column(String, nullable=False)         # e.g., "AI Features", "Market Trends"
    context_instruction = Column(String)           # specific things to look for
    is_active = Column(Boolean, default=True)
    last_processed = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PendingAction(Base):
    """An item identified by a listener that requires user review."""
    __tablename__ = "pending_actions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    listener_id = Column(String, ForeignKey("topic_listeners.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(String)
    source_url = Column(String, nullable=True)
    reasoning = Column(String)                     # AI explanation of why this was flagged
    status = Column(String, default="pending")     # 'pending', 'dismissed', 'promoted', 'completed'
    metadata_json = Column(JSON, nullable=True)    # extra data (e.g., event details)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

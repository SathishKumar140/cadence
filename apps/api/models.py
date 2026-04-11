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

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

# Pull from env, default to local sqlite for dev
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cadence.db")

# Fix for common "postgres://" vs "postgresql://" schema issue in cloud providers
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Configuration for different environments
engine_kwargs = {}

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Postgres Security: Enforce SSL for production
    engine_kwargs["connect_args"] = {
        "sslmode": "require",
        "connect_timeout": 10
    }
    
    # Supabase Optimization: If using the Pooler (port 6543), disable client-side pooling
    # to avoid conflict with Supavisor.
    if ":6543" in SQLALCHEMY_DATABASE_URL:
        engine_kwargs["poolclass"] = NullPool
    else:
        # Standard direct connection (port 5432)
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_recycle"] = 3600

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, **engine_kwargs
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

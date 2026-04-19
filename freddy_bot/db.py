"""
MongoDB connection & collection handles.
Connects to the same Atlas cluster as the portal backend.
"""

from pymongo import MongoClient
from config import MONGODB_URI, MONGODB_DB

_client: MongoClient | None = None


def get_db():
    global _client
    if _client is None:
        _client = MongoClient(MONGODB_URI)
    return _client[MONGODB_DB]


# ── Collections ──

def leads_col():
    """Portal's existing `leads` collection — bot upserts leads here."""
    return get_db()["leads"]


def sessions_col():
    """Freddy bot conversation sessions — one doc per phone number."""
    db = get_db()
    col = db["freddy_sessions"]
    col.create_index("phone", unique=True)
    col.create_index("state")
    col.create_index("updated_at")
    return col


def messages_col():
    """Full chat log (inbound + outbound)."""
    db = get_db()
    col = db["freddy_messages"]
    col.create_index([("phone", 1), ("created_at", 1)])
    return col


def settings_col():
    """Portal's app_settings collection — read-only for availability settings."""
    return get_db()["app_settings"]


def calendar_integrations_col():
    """Portal's calendar_integrations collection."""
    return get_db()["calendar_integrations"]

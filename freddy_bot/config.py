import os
from dotenv import load_dotenv

load_dotenv()

# ── Meta / WhatsApp Cloud API ──
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "")
META_APP_SECRET = os.getenv("META_APP_SECRET", "")

# ── MongoDB (same Atlas cluster as the portal backend) ──
MONGODB_URI = os.getenv("MONGODB_URI", "")
MONGODB_DB = os.getenv("MONGODB_DB", "franchise-ready")

# ── Server ──
PORT = int(os.getenv("PORT", "3002"))

# ── Backend API (for calendar booking) ──
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3001")
INTERNAL_WEBHOOK_SECRET = os.getenv("INTERNAL_WEBHOOK_SECRET", "")

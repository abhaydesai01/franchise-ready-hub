"""
Low-level WhatsApp Cloud API client.
Sends text messages, interactive buttons, and lists via Meta Graph API v19.0.
"""

import logging
import requests
from config import WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN

logger = logging.getLogger(__name__)

API_URL = f"https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"
HEADERS = {
    "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
    "Content-Type": "application/json",
}


def _send(payload: dict) -> dict | None:
    """Send a payload to the WhatsApp Cloud API. Returns the API response or None on error."""
    try:
        resp = requests.post(API_URL, json=payload, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        logger.info("WA API response: %s", data)
        return data
    except Exception:
        logger.exception("WhatsApp send failed")
        return None


def send_text(to: str, body: str) -> dict | None:
    """Send a plain text message."""
    return _send({
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": body},
    })


def send_buttons(to: str, body: str, buttons: list[dict]) -> dict | None:
    """
    Send an interactive button message (max 3 buttons).
    Each button: {"id": "btn_id", "title": "Label"}  (title max 20 chars)
    """
    btn_list = [
        {"type": "reply", "reply": {"id": b["id"], "title": b["title"][:20]}}
        for b in buttons[:3]
    ]
    return _send({
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": body},
            "action": {"buttons": btn_list},
        },
    })


def send_list(to: str, body: str, button_text: str, rows: list[dict]) -> dict | None:
    """
    Send an interactive list message (single section, max 10 rows).
    Each row: {"id": "row_id", "title": "Label", "description": "optional"}
    """
    return _send({
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {"text": body},
            "action": {
                "button": button_text[:20],
                "sections": [
                    {
                        "title": "Options",
                        "rows": [
                            {
                                "id": r["id"],
                                "title": r["title"][:24],
                                "description": r.get("description", "")[:72],
                            }
                            for r in rows[:10]
                        ],
                    }
                ],
            },
        },
    })


def mark_read(message_id: str) -> None:
    """Mark an incoming message as read (blue ticks)."""
    try:
        requests.post(
            API_URL,
            json={
                "messaging_product": "whatsapp",
                "status": "read",
                "message_id": message_id,
            },
            headers=HEADERS,
            timeout=10,
        )
    except Exception:
        logger.exception("mark_read failed for %s", message_id)

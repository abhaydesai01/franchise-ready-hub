"""
Freddy Conversation Engine — state-machine driving the onboarding flow
followed by discovery-call slot booking.

States:
  WELCOME → Q_NAME → Q_BRAND → Q_OUTLETS → Q_CITY → Q_SERVICE → Q_SOPS → Q_GOAL
          → DATE_SELECT → SLOT_SELECT → DONE

Flow:
  1. Welcome + ask name
  2. 6 business questions
  3. Show next 3 working days as buttons (skip Sat/Sun)
  4. User picks a date → show available time slots for that day (numbered)
  5. User picks a slot number → booked
"""

import logging
import requests as http_requests
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from db import sessions_col, messages_col, leads_col, settings_col
from config import BACKEND_URL, INTERNAL_WEBHOOK_SECRET
import whatsapp_api as wa

logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")
WEEKDAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
DAY_DISPLAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# ── Freddy's script ──────────────────────────────────────────

SCRIPTS = {
    "welcome": (
        "Hi, this is *Freddy* from *Franchise Ready*. Thank you for reaching out.\n\n"
        "First, I'll understand your business in brief, and then help you book a "
        "discovery call with our Director, *Rahul*."
    ),
    "q_name": "May I know your *name*?",
    "q_brand": "May I know your *brand name* and what *business category* you are in?",
    "q_outlets": "How many *operational outlets or locations* do you currently have?",
    "q_city": "Which *city* are you currently operating from?",
    "q_service": "Are you looking for *full franchise consulting*, *franchise recruitment*, or *both*?",
    "q_sops": (
        "Have you already *documented your operations, costing, and SOPs*, "
        "or would you need support in building that?"
    ),
    "q_goal": (
        "What is your main goal right now — *expansion in one city*, "
        "*across India*, or *international growth*?"
    ),
    "date_transition": (
        "Thank you for sharing these details. Based on your inputs, the next step is to "
        "book a *discovery call* with our Director, *Rahul*.\n\n"
        "Please select a date:"
    ),
    "booked": (
        "✅ Your discovery call has been booked!\n\n"
        "📅 *{slot_label}*\n\n"
        "Our team will send you a calendar invite shortly. "
        "If you need to reschedule, just message here. Thank you! 🙌"
    ),
    "done_fallback": (
        "Thank you! Our team will reach out to you shortly. "
        "If you have any questions, just message here. 😊"
    ),
}

# State order
STATES = [
    "WELCOME",
    "Q_NAME",
    "Q_BRAND",
    "Q_OUTLETS",
    "Q_CITY",
    "Q_SERVICE",
    "Q_SOPS",
    "Q_GOAL",
    "DATE_SELECT",
    "SLOT_SELECT",
    "DONE",
]

# Map state → session field for storing the answer
STATE_FIELD_MAP = {
    "Q_NAME": "contact_name",
    "Q_BRAND": "brand_name",
    "Q_OUTLETS": "outlet_count",
    "Q_CITY": "city",
    "Q_SERVICE": "service_type",
    "Q_SOPS": "sops_ready",
    "Q_GOAL": "growth_goal",
}

# Interactive button options
SERVICE_BUTTONS = [
    {"id": "full_consulting", "title": "Full Consulting"},
    {"id": "franchise_recruitment", "title": "Recruitment"},
    {"id": "both", "title": "Both"},
]

SOPS_BUTTONS = [
    {"id": "yes_documented", "title": "Yes, documented"},
    {"id": "need_support", "title": "Need support"},
]

GOAL_BUTTONS = [
    {"id": "one_city", "title": "One city expansion"},
    {"id": "across_india", "title": "Across India"},
    {"id": "international", "title": "International"},
]

# Button IDs that should be prettified when stored
BUTTON_IDS = {
    "full_consulting", "franchise_recruitment", "both",
    "yes_documented", "need_support",
    "one_city", "across_india", "international",
}


# ── Helpers ───────────────────────────────────────────────────

def _log_message(phone: str, direction: str, body: str, state: str, wa_msg_id: str | None = None):
    messages_col().insert_one({
        "phone": phone,
        "direction": direction,
        "body": body,
        "wa_message_id": wa_msg_id,
        "bot_state": state,
        "created_at": datetime.now(timezone.utc),
    })


def _get_or_create_session(phone: str) -> dict:
    col = sessions_col()
    session = col.find_one({"phone": phone})
    if session:
        return session

    doc = {
        "phone": phone,
        "state": "WELCOME",
        "contact_name": None,
        "brand_name": None,
        "outlet_count": None,
        "city": None,
        "service_type": None,
        "sops_ready": None,
        "growth_goal": None,
        "selected_date": None,
        "booked_slot": None,
        "slot_map": None,
        "date_map": None,
        "lead_id": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    col.insert_one(doc)
    return col.find_one({"phone": phone})


def _advance_state(current: str) -> str:
    idx = STATES.index(current)
    return STATES[idx + 1] if idx + 1 < len(STATES) else "DONE"


def _extract_reply(message: dict) -> str:
    msg_type = message.get("type", "")

    if msg_type == "text":
        return message.get("text", {}).get("body", "").strip()

    if msg_type == "interactive":
        interactive = message.get("interactive", {})
        itype = interactive.get("type", "")
        if itype == "button_reply":
            return interactive.get("button_reply", {}).get("id", "")
        if itype == "list_reply":
            return interactive.get("list_reply", {}).get("id", "")

    if msg_type == "button":
        return message.get("button", {}).get("text", "").strip()

    return ""


# ── Get working days (skip Sat/Sun) ──────────────────────────

def _get_next_working_days(count: int = 3) -> list[dict]:
    """Get next `count` working days (Mon-Fri), starting from tomorrow."""
    settings_doc = settings_col().find_one()
    avail = (settings_doc or {}).get("availabilitySettings", {})
    tz_name = avail.get("timezone", "Asia/Kolkata")
    working_hours = avail.get("workingHours", {})

    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = IST

    now = datetime.now(tz)
    days: list[dict] = []
    cursor = now.date()

    while len(days) < count and cursor < now.date() + timedelta(days=30):
        cursor += timedelta(days=1)
        weekday_idx = cursor.weekday()  # 0=Mon, 5=Sat, 6=Sun

        # Skip Saturday and Sunday
        if weekday_idx in (5, 6):
            continue

        # Also check if this day is enabled in calendar settings
        weekday_key = WEEKDAY_NAMES[weekday_idx]
        day_config = working_hours.get(weekday_key, {})
        if not day_config.get("enabled", True):
            continue

        day_name = DAY_DISPLAY[weekday_idx]
        date_str = cursor.strftime("%d %B")  # e.g. "21 April"
        label = f"{day_name}, {date_str}"     # e.g. "Monday, 21 April"

        days.append({
            "date": cursor.isoformat(),
            "label": label,
            "weekday_key": weekday_key,
        })

    return days


# ── Get slots for a specific date ────────────────────────────

def _get_slots_for_date(date_iso: str) -> list[dict]:
    """Generate available time slots for a specific date."""
    from datetime import date as date_type

    settings_doc = settings_col().find_one()
    if not settings_doc:
        return []

    avail = settings_doc.get("availabilitySettings", {})
    slot_duration = avail.get("slotDurationMinutes", 30)
    buffer = avail.get("bufferBetweenSlots", 0)
    working_hours = avail.get("workingHours", {})
    tz_name = avail.get("timezone", "Asia/Kolkata")

    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = IST

    target_date = date_type.fromisoformat(date_iso)
    weekday_key = WEEKDAY_NAMES[target_date.weekday()]
    day_config = working_hours.get(weekday_key, {})

    if not day_config.get("enabled", False):
        return []

    start_h, start_m = map(int, day_config.get("start", "09:00").split(":"))
    end_h, end_m = map(int, day_config.get("end", "18:00").split(":"))

    day_start = datetime(target_date.year, target_date.month, target_date.day,
                         start_h, start_m, tzinfo=tz)
    day_end = datetime(target_date.year, target_date.month, target_date.day,
                       end_h, end_m, tzinfo=tz)

    now = datetime.now(tz)
    earliest = now + timedelta(hours=2)

    # Load booked calls for this date
    range_start = day_start.astimezone(timezone.utc)
    range_end = day_end.astimezone(timezone.utc)
    booked_calls = _get_booked_calls(range_start, range_end)

    slots: list[dict] = []
    cursor = day_start
    while cursor + timedelta(minutes=slot_duration) <= day_end:
        slot_start = cursor
        slot_end = cursor + timedelta(minutes=slot_duration)

        if slot_start >= earliest and not _overlaps_any(slot_start, slot_end, booked_calls):
            time_str = slot_start.strftime("%I:%M %p")
            day_label = slot_start.strftime("%A, %d %B")
            slots.append({
                "start": slot_start,
                "end": slot_end,
                "time_str": time_str,
                "label": f"{day_label}, {time_str}",
            })

        cursor += timedelta(minutes=slot_duration + buffer)

    return slots


def _get_booked_calls(start: datetime, end: datetime) -> list[tuple[datetime, datetime]]:
    booked = []
    for lead in leads_col().find(
        {
            "discoveryCall.status": "scheduled",
            "discoveryCall.scheduledAt": {"$gte": start, "$lte": end},
        },
        {"discoveryCall": 1},
    ):
        dc = lead.get("discoveryCall", {})
        sched = dc.get("scheduledAt")
        end_time = dc.get("endTime") or (sched + timedelta(minutes=30) if sched else None)
        if isinstance(sched, datetime) and isinstance(end_time, datetime):
            booked.append((sched, end_time))
    return booked


def _overlaps_any(start: datetime, end: datetime, busy: list[tuple[datetime, datetime]]) -> bool:
    s = start.astimezone(timezone.utc)
    e = end.astimezone(timezone.utc)
    for b_start, b_end in busy:
        bs = b_start.astimezone(timezone.utc) if b_start.tzinfo else b_start.replace(tzinfo=timezone.utc)
        be = b_end.astimezone(timezone.utc) if b_end.tzinfo else b_end.replace(tzinfo=timezone.utc)
        if s < be and e > bs:
            return True
    return False


# ── Sending questions / date offer / slot offer ──────────────

def _send_question(phone: str, state: str):
    key = state.lower()

    if state == "WELCOME":
        wa.send_text(phone, SCRIPTS["welcome"])
        _log_message(phone, "outbound", SCRIPTS["welcome"], state)
        # Immediately follow with the name question
        wa.send_text(phone, SCRIPTS["q_name"])
        _log_message(phone, "outbound", SCRIPTS["q_name"], "Q_NAME")

    elif state == "Q_SERVICE":
        wa.send_buttons(phone, SCRIPTS[key], SERVICE_BUTTONS)
        _log_message(phone, "outbound", SCRIPTS[key], state)

    elif state == "Q_SOPS":
        wa.send_buttons(phone, SCRIPTS[key], SOPS_BUTTONS)
        _log_message(phone, "outbound", SCRIPTS[key], state)

    elif state == "Q_GOAL":
        wa.send_buttons(phone, SCRIPTS[key], GOAL_BUTTONS)
        _log_message(phone, "outbound", SCRIPTS[key], state)

    elif state == "DATE_SELECT":
        _send_date_buttons(phone)

    elif key in SCRIPTS:
        wa.send_text(phone, SCRIPTS[key])
        _log_message(phone, "outbound", SCRIPTS[key], state)


def _send_date_buttons(phone: str):
    """Show next 3 working days as interactive buttons (skip Sat/Sun)."""
    days = _get_next_working_days(count=3)

    if not days:
        msg = (
            "Thank you for sharing these details.\n\n"
            "Unfortunately, no dates are available right now. "
            "Our team will reach out to schedule your call. Thank you! 🙌"
        )
        wa.send_text(phone, msg)
        _log_message(phone, "outbound", msg, "DATE_SELECT")
        sessions_col().update_one(
            {"phone": phone},
            {"$set": {"state": "DONE", "updated_at": datetime.now(timezone.utc)}},
        )
        return

    # Build date_map for lookup when user selects
    date_map = {}
    buttons = []
    for i, day in enumerate(days):
        btn_id = f"date_{i}"
        date_map[btn_id] = day["date"]
        # Button title max 20 chars — use short format
        short_label = day["label"][:20]
        buttons.append({"id": btn_id, "title": short_label})

    wa.send_buttons(phone, SCRIPTS["date_transition"], buttons)
    _log_message(phone, "outbound", SCRIPTS["date_transition"], "DATE_SELECT")

    sessions_col().update_one(
        {"phone": phone},
        {"$set": {"date_map": date_map, "updated_at": datetime.now(timezone.utc)}},
    )


def _send_slot_list(phone: str, date_iso: str, date_label: str):
    """Show available time slots for the selected date as a numbered list."""
    slots = _get_slots_for_date(date_iso)

    if not slots:
        msg = (
            f"Sorry, no slots are available on *{date_label}*. "
            "Please select another date."
        )
        wa.send_text(phone, msg)
        _log_message(phone, "outbound", msg, "SLOT_SELECT")
        # Go back to DATE_SELECT
        sessions_col().update_one(
            {"phone": phone},
            {"$set": {"state": "DATE_SELECT", "updated_at": datetime.now(timezone.utc)}},
        )
        _send_date_buttons(phone)
        return

    # Build numbered list + slot_map
    lines = [f"📅 Available slots for *{date_label}*:", ""]
    slot_map: dict[str, dict] = {}
    for i, s in enumerate(slots, 1):
        lines.append(f"  {i}. {s['time_str']}")
        slot_map[str(i)] = {
            "start": s["start"].isoformat(),
            "end": s["end"].isoformat(),
            "label": s["label"],
        }
    lines.append("")
    lines.append("Reply with the *number* of your preferred slot.")

    msg = "\n".join(lines)
    wa.send_text(phone, msg)
    _log_message(phone, "outbound", msg, "SLOT_SELECT")

    sessions_col().update_one(
        {"phone": phone},
        {"$set": {"slot_map": slot_map, "updated_at": datetime.now(timezone.utc)}},
    )


# ── Lead upsert ──────────────────────────────────────────────

def _format_activity_time() -> str:
    """Return a human-readable activity timestamp for the portal."""
    now = datetime.now(IST)
    return now.strftime("%d %b %Y, %I:%M %p")


def _upsert_lead(phone: str, session: dict):
    now = datetime.now(timezone.utc)
    activity_str = _format_activity_time()

    update_fields: dict = {
        "phone": phone,
        "source": "WhatsApp Inbound",
        "updatedAt": now,
        "lastActivity": activity_str,
        "lastActivityType": "whatsapp_bot",
    }

    # Name = contact_name (person's name), company = brand_name
    if session.get("contact_name"):
        update_fields["name"] = session["contact_name"]
    if session.get("brand_name"):
        update_fields["company"] = session["brand_name"]
    if session.get("city"):
        update_fields["notes"] = _build_notes(session)

    result = leads_col().find_one_and_update(
        {"phone": phone},
        {
            "$set": update_fields,
            "$setOnInsert": {
                "createdAt": now,
                "status": "New",
                "stage": "Gap Nurture",
                "track": "Not Ready",
                "score": 0,
                "tags": ["whatsapp-lead"],
                "value": 0,
            },
        },
        upsert=True,
        return_document=True,
    )

    if result and "_id" in result:
        sessions_col().update_one(
            {"phone": phone},
            {"$set": {"lead_id": result["_id"]}},
        )

    return result


def _build_notes(session: dict) -> str:
    parts = []
    if session.get("brand_name"):
        parts.append(f"Brand: {session['brand_name']}")
    if session.get("outlet_count"):
        parts.append(f"Outlets: {session['outlet_count']}")
    if session.get("city"):
        parts.append(f"City: {session['city']}")
    if session.get("service_type"):
        parts.append(f"Service: {session['service_type']}")
    if session.get("sops_ready"):
        parts.append(f"SOPs: {session['sops_ready']}")
    if session.get("growth_goal"):
        parts.append(f"Goal: {session['growth_goal']}")
    return " | ".join(parts)


def _book_slot(phone: str, session: dict, slot: dict):
    """Book the selected slot via the backend API so it appears on Google Calendar."""
    start = datetime.fromisoformat(slot["start"])
    end = datetime.fromisoformat(slot["end"])
    now = datetime.now(timezone.utc)

    lead_id = session.get("lead_id")
    meet_link = ""

    if lead_id:
        # Call backend API to create Google Calendar event + update lead
        try:
            resp = http_requests.post(
                f"{BACKEND_URL}/api/v1/calendar/bot-book",
                json={
                    "leadId": str(lead_id),
                    "startTime": start.isoformat(),
                    "endTime": end.isoformat(),
                },
                headers={"x-internal-secret": INTERNAL_WEBHOOK_SECRET},
                timeout=15,
            )
            if resp.ok:
                data = resp.json()
                meet_link = data.get("meetLink", "")
                logger.info("Bot-book API success: %s", data)
            else:
                logger.error("Bot-book API failed (%s): %s", resp.status_code, resp.text)
                # Fallback: write directly to MongoDB
                _book_slot_fallback(lead_id, start, end)
        except Exception:
            logger.exception("Bot-book API call failed — falling back to direct DB write")
            _book_slot_fallback(lead_id, start, end)

    sessions_col().update_one(
        {"phone": phone},
        {
            "$set": {
                "booked_slot": slot,
                "state": "DONE",
                "updated_at": now,
            }
        },
    )

    booked_msg = SCRIPTS["booked"].format(slot_label=slot["label"])
    if meet_link:
        booked_msg += f"\n\n🔗 Meet link: {meet_link}"
    wa.send_text(phone, booked_msg)
    _log_message(phone, "outbound", booked_msg, "DONE")


def _book_slot_fallback(lead_id, start: datetime, end: datetime):
    """Direct MongoDB write if backend API is unavailable."""
    now = datetime.now(timezone.utc)
    activity_str = _format_activity_time()
    leads_col().update_one(
        {"_id": lead_id},
        {
            "$set": {
                "discoveryCall.scheduledAt": start,
                "discoveryCall.endTime": end,
                "discoveryCall.status": "scheduled",
                "discoveryCall.bookedVia": "crm_bot",
                "stage": "Discovery",
                "updatedAt": now,
                "lastActivity": activity_str,
                "lastActivityType": "discovery_call_booked",
            }
        },
    )


# ── Main entry point ─────────────────────────────────────────

def handle_message(phone: str, message: dict):
    """
    Process an incoming WhatsApp message.
    Flow: WELCOME → Q_NAME → 6 questions → date select → slot select → DONE
    """
    wa_msg_id = message.get("id")
    reply = _extract_reply(message)

    if wa_msg_id:
        wa.mark_read(wa_msg_id)

    session = _get_or_create_session(phone)
    state = session["state"]

    _log_message(phone, "inbound", reply or "(media/unsupported)", state, wa_msg_id)

    # ── WELCOME: first contact → send welcome + ask name
    if state == "WELCOME":
        _send_question(phone, "WELCOME")
        sessions_col().update_one(
            {"phone": phone},
            {"$set": {"state": "Q_NAME", "updated_at": datetime.now(timezone.utc)}},
        )
        _upsert_lead(phone, session)
        return

    # ── DONE: already finished
    if state == "DONE":
        wa.send_text(phone, SCRIPTS["done_fallback"])
        _log_message(phone, "outbound", SCRIPTS["done_fallback"], state)
        return

    # ── DATE_SELECT: waiting for date button click
    if state == "DATE_SELECT":
        date_map = session.get("date_map") or {}
        chosen = reply.strip()

        if chosen in date_map:
            date_iso = date_map[chosen]
            # Find the label for this date
            days = _get_next_working_days(count=3)
            date_label = next((d["label"] for d in days if d["date"] == date_iso), date_iso)

            sessions_col().update_one(
                {"phone": phone},
                {
                    "$set": {
                        "selected_date": date_iso,
                        "state": "SLOT_SELECT",
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
            _send_slot_list(phone, date_iso, date_label)
        else:
            msg = "Please select one of the dates shown above."
            wa.send_text(phone, msg)
            _log_message(phone, "outbound", msg, state)
        return

    # ── SLOT_SELECT: waiting for slot number
    if state == "SLOT_SELECT":
        slot_map = session.get("slot_map") or {}
        chosen = reply.strip()

        if chosen in slot_map:
            _book_slot(phone, session, slot_map[chosen])
        else:
            msg = f"Please reply with a number between 1 and {len(slot_map)} to pick a slot."
            wa.send_text(phone, msg)
            _log_message(phone, "outbound", msg, state)
        return

    # ── Question states: save answer, advance, send next question
    if not reply:
        wa.send_text(phone, "Sorry, I didn't catch that. Could you please reply with text?")
        _log_message(phone, "outbound", "Sorry, I didn't catch that.", state)
        return

    # Save answer
    field = STATE_FIELD_MAP.get(state)
    if field:
        answer = reply.replace("_", " ").title() if reply in BUTTON_IDS else reply
        sessions_col().update_one(
            {"phone": phone},
            {"$set": {field: answer, "updated_at": datetime.now(timezone.utc)}},
        )
        session = sessions_col().find_one({"phone": phone})

    # Advance state
    next_state = _advance_state(state)
    sessions_col().update_one(
        {"phone": phone},
        {"$set": {"state": next_state, "updated_at": datetime.now(timezone.utc)}},
    )

    # Upsert lead with latest data
    _upsert_lead(phone, session)

    # Send next question (or date selection or slot selection)
    _send_question(phone, next_state)

    logger.info("Phone %s: %s → %s (answered: %s)", phone, state, next_state, reply[:50])

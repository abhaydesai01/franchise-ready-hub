"""
Freddy Bot — Flask webhook server for WhatsApp Cloud API.

This is the URL you paste into Meta Developers → WhatsApp → Configuration → Webhook URL.
Handles:
  GET  /webhook  → Meta verification handshake
  POST /webhook  → Incoming WhatsApp messages
  GET  /health   → Health check
"""

import hashlib
import hmac
import json
import logging
import os

from flask import Flask, request, jsonify

from config import PORT, META_VERIFY_TOKEN, META_APP_SECRET
from conversation import handle_message

# ── Logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("freddy_bot")

app = Flask(__name__)


# ── Webhook signature verification ──────────────────────────

def verify_signature(payload: bytes, signature_header: str | None) -> bool:
    """Verify the X-Hub-Signature-256 header from Meta."""
    app_secret = META_APP_SECRET
    if not app_secret:
        return True
    if not signature_header:
        return False

    expected = "sha256=" + hmac.new(
        app_secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


# ── Routes ──────────────────────────────────────────────────

@app.route("/")
def index():
    return jsonify({"status": "running", "bot": "Freddy Bot", "webhook": "/webhook"}), 200


@app.route("/webhook", methods=["GET", "POST"])
def webhook():

    if request.method == "GET":
        mode = request.args.get("hub.mode")
        token = request.args.get("hub.verify_token")
        challenge = request.args.get("hub.challenge")

        if mode == "subscribe" and token == META_VERIFY_TOKEN:
            print("Webhook verified successfully")
            return challenge, 200

        print(f"Webhook verification failed — mode={mode} token={token}")
        return "Forbidden", 403

    if request.method == "POST":
        data = request.json
        print("Incoming webhook:", data)

        # Extract messages and route to conversation engine
        if data:
            try:
                for entry in data.get("entry", []):
                    for change in entry.get("changes", []):
                        value = change.get("value", {})
                        messages = value.get("messages", [])

                        for msg in messages:
                            phone = msg.get("from", "")
                            if not phone:
                                continue

                            print(f"Message from {phone} — type: {msg.get('type')}")

                            try:
                                handle_message(phone, msg)
                            except Exception as e:
                                print(f"Error handling message from {phone}: {e}")

            except Exception as e:
                print(f"Error processing webhook: {e}")

        return "ok", 200


@app.route("/health", methods=["GET"])
def health():
    """Simple health check endpoint."""
    return jsonify({"status": "ok", "service": "freddy_bot"}), 200


# ── Main ──────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("Starting Freddy Bot on port %s", PORT)
    app.run(host="0.0.0.0", port=PORT, debug=True)

# Freddy Bot — WhatsApp Client Onboarding

Standalone Python service that onboards franchise leads via WhatsApp. When someone messages your WhatsApp Business number, Freddy asks 6 questions about their business, saves the answers to MongoDB, and creates a lead in the CRM portal automatically.

## Folder Structure

```
freddy_bot/
├── app.py              # Flask webhook server (paste this URL in Meta Developers)
├── conversation.py     # State-machine: 6-question flow + lead upsert
├── whatsapp_api.py     # WhatsApp Cloud API client (send text, buttons, lists)
├── db.py               # MongoDB connection (same Atlas as portal)
├── config.py           # Environment variable loader
├── requirements.txt    # Python dependencies
├── .env                # Your credentials (fill in before running)
└── README.md
```

## How It Works

```
User sends "Hi" on WhatsApp
        │
        ▼
Meta forwards to POST /webhook
        │
        ▼
Freddy Bot asks 6 questions (one at a time):
   1. Brand name
   2. Number of outlets
   3. City
   4. Service type (interactive buttons)
   5. SOPs documented? (interactive buttons)
   6. Growth goal (interactive buttons)
        │
        ▼
Answers saved to:
   • freddy_sessions (conversation state)
   • freddy_messages (full chat log)
   • leads (portal's lead collection — admin sees it in CRM)
        │
        ▼
Admin views lead in portal → assigns meeting → connects with them
```

## Setup

### 1. Install dependencies

```bash
cd freddy_bot
pip install -r requirements.txt
```

### 2. Fill in `.env`

Open `.env` and fill in your WhatsApp credentials:

| Variable | Where to find it |
|----------|-----------------|
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Developers → WhatsApp → API Setup → Phone Number ID |
| `WHATSAPP_ACCESS_TOKEN` | Meta Developers → WhatsApp → API Setup → Temporary Token (or create a System User permanent token) |
| `META_VERIFY_TOKEN` | Any string you choose — you'll paste the same string in Meta webhook config |
| `META_APP_SECRET` | Meta Developers → App Settings → Basic → App Secret |

### 3. Start the bot

```bash
python app.py
```

Runs on `http://localhost:3002` by default.

### 4. Make it publicly accessible

For Meta to send webhooks, the server needs a public URL. Use ngrok for testing:

```bash
ngrok http 3002
```

Copy the `https://xxxx.ngrok-free.app` URL.

### 5. Configure webhook in Meta Developers

1. Go to [developers.facebook.com](https://developers.facebook.com) → Your App → WhatsApp → Configuration
2. **Callback URL**: `https://your-url.ngrok-free.app/webhook`
3. **Verify token**: Same value as `META_VERIFY_TOKEN` in your `.env`
4. Click **Verify and Save**
5. Subscribe to: **messages**

### 6. Test it

Send a message to your WhatsApp Business number. Freddy will respond with the onboarding flow.

## Production Deployment

```bash
pip install gunicorn
gunicorn app:app --bind 0.0.0.0:3002 --workers 2
```

## What the Admin Sees

Every WhatsApp lead appears in the portal's Leads page automatically with:
- **Name** = Brand name they provided
- **Phone** = Their WhatsApp number
- **Source** = "WhatsApp Inbound"
- **Tags** = ["whatsapp-lead"]
- **Notes** = All 6 answers concatenated

The admin can then assign a meeting, schedule a discovery call, or reach out directly from the portal.

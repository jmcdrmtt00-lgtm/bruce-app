import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Headlights Supabase — used to load live prompts (optional; falls back to hardcoded)
HEADLIGHTS_SUPABASE_URL = os.getenv("HEADLIGHTS_SUPABASE_URL", "")
HEADLIGHTS_SUPABASE_KEY = os.getenv("HEADLIGHTS_SUPABASE_KEY", "")

# IT Buddy Supabase — used by the Gmail poller to create tickets
ITBUDDY_SUPABASE_URL             = os.getenv("ITBUDDY_SUPABASE_URL", "")
ITBUDDY_SUPABASE_SERVICE_ROLE_KEY = os.getenv("ITBUDDY_SUPABASE_SERVICE_ROLE_KEY", "")

# Gmail — used by the email poller
GMAIL_CLIENT_ID     = os.getenv("GMAIL_CLIENT_ID", "")
GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET", "")
GMAIL_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN", "")

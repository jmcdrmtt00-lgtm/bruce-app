import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Headlights Supabase — used to load live prompts (optional; falls back to hardcoded)
HEADLIGHTS_SUPABASE_URL = os.getenv("HEADLIGHTS_SUPABASE_URL", "")
HEADLIGHTS_SUPABASE_KEY = os.getenv("HEADLIGHTS_SUPABASE_KEY", "")

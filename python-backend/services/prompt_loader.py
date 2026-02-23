"""Load Bruce prompts from Headlights Supabase, falling back to hardcoded values."""
import os
import threading
from utils.prompts import SYSTEM_PROMPT as _DEFAULT_ASK

_DEFAULT_SQL = """You are a SQL generator for an IT management app.
Given a natural language question, generate a single PostgreSQL SELECT query.

Rules:
- Use ONLY SELECT. Never INSERT, UPDATE, DELETE, DROP, or any DDL.
- Always include WHERE user_id = '{user_id}' (literal placeholder text).
- Add LIMIT 50 unless the user asks for more.
- Return ONLY the SQL query — no explanation, no markdown, no code fences."""

_DEFAULT_SUGGESTIONS = """You are an IT assistant that reviews completed task notes for follow-up suggestions.
Look for notes that suggest a future action with a specific time frame (e.g. "consider doing X in 3 months",
"replace Y next year", "follow up in 6 weeks").

For each suggestion where that time has now passed or is within 2 weeks from today, return it.

Respond with a JSON array only — no other text:
[{"title": "Short task title", "reason": "Brief explanation referencing the original task"}]

If no suggestions are ready, return []."""

_lock = threading.Lock()
_prompts: dict[str, str] = {}
_loaded = False


def _fetch_from_supabase() -> dict[str, str]:
    """Fetch prompt texts from Headlights Supabase. Returns {} on any failure."""
    url = os.getenv("HEADLIGHTS_SUPABASE_URL", "").strip()
    key = os.getenv("HEADLIGHTS_SUPABASE_KEY", "").strip()
    if not url or not key:
        return {}

    try:
        import urllib.request
        import json

        req = urllib.request.Request(
            f"{url}/rest/v1/prompts?app_id=eq.bruce&select=id,text",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
            },
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            rows = json.loads(resp.read().decode())

        result = {}
        for row in rows:
            result[row["id"]] = row["text"]
        return result
    except Exception as e:
        print(f"[prompt_loader] Could not fetch prompts from Supabase: {e}")
        return {}


def _ensure_loaded():
    global _loaded, _prompts
    if _loaded:
        return
    with _lock:
        if _loaded:
            return
        _prompts = _fetch_from_supabase()
        _loaded = True


def get_sql_prompt() -> str:
    _ensure_loaded()
    return _prompts.get("p-bruce-sql") or _DEFAULT_SQL


def get_suggestions_prompt() -> str:
    _ensure_loaded()
    return _prompts.get("p-bruce-suggestions") or _DEFAULT_SUGGESTIONS


def get_ask_prompt() -> str:
    _ensure_loaded()
    return _prompts.get("p-bruce-ask") or _DEFAULT_ASK


def reload():
    """Force a fresh fetch from Supabase (useful after editing prompts in Headlights)."""
    global _loaded
    with _lock:
        _loaded = False
    _ensure_loaded()

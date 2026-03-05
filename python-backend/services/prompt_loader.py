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

_DEFAULT_SUMMARIZE = "Generate a very short title (5-8 words) for this IT problem. Return only the title, nothing else."

_DEFAULT_MATCH_TYPE = """You are an IT problem classifier. Match the user's description to one or more of these problem types:

{{problem_types}}

Each entry is formatted as "id: Label". Return a JSON object with key "matches" containing a list of matching type IDs (the part before the colon).
Return one ID if confident; up to 3 if genuinely ambiguous. Return an empty list if nothing matches.
Return only the JSON object, no markdown fences."""

_DEFAULT_ONBOARDING = """You extract new hire information from free-form text. Return ONLY a valid JSON object with exactly these fields:
- firstName: string
- lastName: string
- role: one of the following keys (pick the closest match):
    executive       = Executive / Administrator
    business_office = Business Office staff
    admissions      = Admissions
    hr              = Human Resources
    don_adon        = DON / ADON / Director of Nursing / RN supervisor
    social_services = Social Services / Case Manager / Social Worker
    activities      = Activities / Activity Director
    sdc             = SDC (Staff Development Coordinator)
    home_health     = Home Health staff
    maintenance     = Maintenance / Facilities
    kitchen         = Kitchen / Food Services / Dietary / Laundry / Housekeeping
    concierge       = Concierge / Front Desk
    it              = IT / Tech staff
    clinical_floor  = CNA / LPN / RN / Floor Clinical / Med Aide
- site: one of [holden, oakdale, business_office]
- startDate: YYYY-MM-DD string (or empty string if not mentioned)
- nextAssetNumber: string (or empty string if not mentioned)
- computerName: string (or empty string if not mentioned)
- notes: string (any other info not captured above, or empty string)
Return only the JSON object, no explanation, no markdown fences."""

_DEFAULT_DIAGNOSE = """You are IT Buddy, an expert IT advisor for Oriol Healthcare (nursing facility with three sites: Holden, Oakdale, Business Office).

You are diagnosing an IT issue of type: {{label}}

Return a JSON object with exactly these fields:
- "response": your analysis or next diagnostic step (plain text, no markdown symbols)
- "follow_up_questions": a list of specific questions you need answered to complete the diagnosis; use an empty list [] if you have enough information for a complete diagnosis

Return only the JSON object, no markdown fences."""

_DEFAULT_ADVISE_PLAN = """You are IT Buddy, an IT advisor for an IT professional at Oriol Healthcare — \
a nursing facility operator with three sites: Holden, Oakdale, and Business Office.

Current in-progress tasks:
{{in_progress_tasks}}

Review the user's question. Return a JSON object with exactly these fields:
- "rephrasing": one sentence starting with "You're asking..." confirming what you understood
- "sql": a single SELECT query if database data would help you give a better answer, \
otherwise null. Use {user_id} as a placeholder.
- "lookup_description": a short phrase describing what you are looking up (e.g. \
"warranty expiration dates for your computers"), or null if sql is null.

Only generate SQL if it would let you give a meaningfully better answer. \
For questions answerable from the in-progress tasks alone, set sql to null.

You may query:
{{schemas}}

Return only the JSON object with no markdown fences."""

_DEFAULT_ADVISE_ANSWER = """You are IT Buddy, an IT advisor for an IT professional at Oriol Healthcare — \
a nursing facility operator with three sites: Holden, Oakdale, and Business Office.

Current in-progress tasks:
{{in_progress_tasks}}
{{data_section}}
Answer the user's question directly and helpfully. Be specific — reference task names, \
equipment names, or data points from the lookup where relevant. \
Plain text only, no markdown symbols."""

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


def get_summarize_prompt() -> str:
    _ensure_loaded()
    return _prompts.get("p-bruce-summarize") or _DEFAULT_SUMMARIZE


def get_match_type_prompt() -> str:
    _ensure_loaded()
    return _prompts.get("p-bruce-match-type") or _DEFAULT_MATCH_TYPE


def get_onboarding_prompt() -> str:
    _ensure_loaded()
    return _prompts.get("p-bruce-onboarding") or _DEFAULT_ONBOARDING


def get_diagnose_prompt() -> str:
    _ensure_loaded()
    return _prompts.get("p-bruce-diagnose") or _DEFAULT_DIAGNOSE


def get_advise_plan_prompt() -> str:
    _ensure_loaded()
    return _prompts.get("p-bruce-advise-plan") or _DEFAULT_ADVISE_PLAN


def get_advise_answer_prompt() -> str:
    _ensure_loaded()
    return _prompts.get("p-bruce-advise-answer") or _DEFAULT_ADVISE_ANSWER


def reload():
    """Force a fresh fetch from Supabase (useful after editing prompts in Headlights)."""
    global _loaded
    with _lock:
        _loaded = False
    _ensure_loaded()

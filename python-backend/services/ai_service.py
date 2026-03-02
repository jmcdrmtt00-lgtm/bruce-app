import os
import anthropic
from services import prompt_loader
from services import headlights_tracker

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


async def ask(prompt: str, system: str = "", user_email: str = "") -> str:
    """Send a prompt to Claude and return the response text."""
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system or prompt_loader.get_ask_prompt(),
        messages=[{"role": "user", "content": prompt}],
    )
    headlights_tracker.track_tokens(user_email, message.usage.input_tokens, message.usage.output_tokens)
    headlights_tracker.track_activity(user_email, sessions=1)
    return message.content[0].text


async def summarize_incident(description: str, user_email: str = "") -> str:
    """Generate a short title for an IT incident from its description."""
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=30,
        system="Generate a very short title (5-8 words) for this IT problem. Return only the title, nothing else.",
        messages=[{"role": "user", "content": description}],
    )
    headlights_tracker.track_tokens(user_email, message.usage.input_tokens, message.usage.output_tokens)
    return message.content[0].text.strip()


TASKS_SCHEMA = """
Table: tasks (IT task database)
- id: UUID
- user_id: UUID  <-- always filter: WHERE user_id = '{user_id}'
- task_number: INTEGER
- task_name: TEXT (description of the task)
- priority: TEXT (e.g. 'High', 'Medium', 'Low', or NULL)
- date_due: DATE (nullable)
- status: TEXT (e.g. 'In Queue', 'In Process', 'Completed')
- information_needed: TEXT (what info is required to complete the task, nullable)
- results: TEXT (outcome or resolution notes, nullable)
- issues_comments: JSONB (array of {timestamp: "YYYY-MM-DD", text: "..."} objects, nullable)
- created_at: TIMESTAMPTZ

To search inside issues_comments use jsonb operators, e.g.:
  issues_comments @> '[{"text": "some keyword"}]'
  or: EXISTS (SELECT 1 FROM jsonb_array_elements(issues_comments) e WHERE e->>'text' ILIKE '%keyword%')
"""

ASSETS_SCHEMA = """
Table: assets (IT asset inventory — computers, printers, phones, tablets, cameras, etc.)
- id: UUID
- user_id: UUID  <-- always filter: WHERE user_id = '{user_id}'
- category: TEXT (e.g. 'Computer', 'Printer', 'Phone', 'iPad', 'Camera', 'Network')
- assigned_to: TEXT (primary identifier — person's name, department, or location label from the first column of the Excel sheet, nullable)
- name: TEXT (secondary description — role, desk label, or notes, nullable)
- site: TEXT ('Holden', 'Oakdale', 'Business Office', 'IT Office', 'Shared')
- status: TEXT ('active', 'retired')
- make: TEXT (brand, e.g. ThinkCentre, Lenovo, HP, Polycom, nullable)
- model: TEXT (model name or type, e.g. Mini, Tower, Laptop, nullable)
- os: TEXT (e.g. Win 11 Pro, Win 10 Pro, ChromeOS — mainly for computers/tablets, nullable)
- ram: TEXT (e.g. '8 GB', '16 GB' — mainly for computers, nullable)
- serial_number: TEXT (nullable)
- asset_number: TEXT (nullable)
- purchased: DATE (nullable)
- price: NUMERIC (nullable)
- install_date: DATE (nullable)
- warranty_expires: DATE (nullable)
- notes: TEXT (nullable)
- extra: JSONB (additional asset-type-specific fields, nullable)
"""


async def generate_sql(question: str, target: str, user_email: str = "") -> str:
    """Generate a safe SELECT SQL query from a natural language question."""
    schema = TASKS_SCHEMA if target == "tasks" else ASSETS_SCHEMA
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=f"{prompt_loader.get_sql_prompt()}\n\nSchema:\n{schema}",
        messages=[{"role": "user", "content": question}],
    )
    headlights_tracker.track_tokens(user_email, message.usage.input_tokens, message.usage.output_tokens)
    return message.content[0].text.strip()


INCIDENTS_SCHEMA = """
Table: incidents (IT tasks — current and historical)
- id: UUID
- user_id: UUID  <-- always filter: WHERE user_id = '{user_id}'
- task_number: INTEGER
- title: TEXT (task name)
- priority: TEXT ('high', 'low', or NULL)
- status: TEXT ('pending' = in queue, 'in_progress' = being worked on, 'resolved' = complete)
- date_due: DATE (nullable)
- date_completed: DATE (nullable)
- screen: TEXT (checklist type, e.g. 'Onboarding', nullable)
- auto_suggested: BOOLEAN
- created_at: TIMESTAMPTZ
"""


async def advise(question: str, in_progress_tasks: list[dict], user_email: str = "") -> dict:
    """Answer a free-form IT question with optional SQL for supporting context."""
    import json as _json

    if in_progress_tasks:
        tasks_text = "\n".join(
            f"  Task #{t.get('task_number', '?')}: {t.get('title', '')}"
            + (f" [Priority: {t['priority']}]" if t.get('priority') else "")
            + (f" [Due: {t['date_due']}]" if t.get('date_due') else "")
            for t in in_progress_tasks
        )
    else:
        tasks_text = "  (none)"

    system = f"""You are IT Buddy, an AI assistant for an IT professional at Oriol Healthcare — \
a nursing facility operator with three sites: Holden, Oakdale, and Business Office.

The user currently has these tasks in progress:
{tasks_text}

Answer the user's question. Return a JSON object with exactly these fields:
- "rephrasing": one sentence starting with "You're asking..." confirming what you understood
- "answer": practical, concise advice in plain text (no markdown symbols)
- "sql": a single SELECT query if additional database data would support your answer, \
otherwise null. Use {{user_id}} as a placeholder for the user's id.

You may query:
{INCIDENTS_SCHEMA}
{ASSETS_SCHEMA}

Return only the JSON object with no markdown fences."""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=system,
        messages=[{"role": "user", "content": question}],
    )
    headlights_tracker.track_tokens(user_email, message.usage.input_tokens, message.usage.output_tokens)
    headlights_tracker.track_activity(user_email, sessions=1)

    text = message.content[0].text.strip()
    try:
        return _json.loads(text)
    except Exception:
        return {"rephrasing": "I understood your question.", "answer": text, "sql": None}


async def check_suggestions(completed_tasks: list[dict], user_email: str = "") -> list[dict]:
    """Scan completed task notes for time-based suggestions and return new tasks to propose."""
    if not completed_tasks:
        return []

    task_list = "\n".join(
        f"Task #{t['task_number']} (completed {t['date_completed']}): {t['title']}"
        + (f"\n  Note: {t['note']}" if t.get('note') else "")
        for t in completed_tasks
    )

    import json as _json
    from datetime import date

    today = date.today().isoformat()

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=f"{prompt_loader.get_suggestions_prompt()}\nToday is {today}.",
        messages=[{"role": "user", "content": task_list}],
    )

    headlights_tracker.track_tokens(user_email, message.usage.input_tokens, message.usage.output_tokens)
    text = message.content[0].text.strip()
    try:
        return _json.loads(text)
    except Exception:
        return []

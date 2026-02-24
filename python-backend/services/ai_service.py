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
Table: incidents (IT tasks)
- id: UUID
- user_id: UUID  <-- always filter: WHERE user_id = '{user_id}'
- task_number: INTEGER
- title: TEXT (short task description)
- reported_by: TEXT (person who requested help, nullable)
- status: TEXT ('in_progress', 'pending', 'resolved')
- priority: TEXT ('high', 'low', or NULL)
- date_due: DATE (nullable)
- date_completed: DATE (nullable)
- auto_suggested: BOOLEAN
- created_at: TIMESTAMPTZ

Table: incident_updates (timestamped notes on a task)
- id: UUID
- incident_id: UUID (references incidents.id)
- user_id: UUID  <-- always filter: WHERE user_id = '{user_id}'
- type: TEXT ('approach', 'progress', 'resolved')
- note: TEXT
- created_at: TIMESTAMPTZ
"""

ASSETS_SCHEMA = """
Table: assets (IT asset inventory — computers, printers, phones, tablets, cameras, etc.)
- id: UUID
- user_id: UUID  <-- always filter: WHERE user_id = '{user_id}'
- category: TEXT (e.g. 'Computer', 'Printer', 'Phone', 'iPad', 'Camera', 'Network')
- name: TEXT (person's name, role, or desk/location label, nullable)
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

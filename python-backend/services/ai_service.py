import os
import anthropic

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


async def ask(prompt: str, system: str = "") -> str:
    """Send a prompt to Claude and return the response text."""
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system or "You are a helpful IT assistant for Oriol Healthcare.",
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


async def summarize_incident(description: str) -> str:
    """Generate a short title for an IT incident from its description."""
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=30,
        system="Generate a very short title (5-8 words) for this IT problem. Return only the title, nothing else.",
        messages=[{"role": "user", "content": description}],
    )
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

COMPUTERS_SCHEMA = """
Table: computers (IT asset inventory)
- id: UUID
- user_id: UUID  <-- always filter: WHERE user_id = '{user_id}'
- user_name: TEXT (person's name, role, or desk location)
- notes: TEXT (role or location description, nullable)
- machine_brand: TEXT (e.g. ThinkCentre, Lenovo, HP)
- machine_type: TEXT (e.g. Mini, Tower, Laptop, Chromebook)
- os: TEXT (e.g. Win 11 Pro, Win 10 Pro, ChromeOS)
- serial_number: TEXT (nullable)
- asset_number: TEXT (nullable)
- ram: TEXT (e.g. '8 GB', '16 GB', nullable)
- purchased: DATE (nullable)
- price: NUMERIC (nullable)
- install_date: DATE (nullable)
- site: TEXT ('Holden', 'Oakdale', 'Business Office', 'IT Office', 'Shared', 'Retired')
- status: TEXT ('active', 'retired')
"""


async def generate_sql(question: str, target: str) -> str:
    """Generate a safe SELECT SQL query from a natural language question."""
    schema = TASKS_SCHEMA if target == "tasks" else COMPUTERS_SCHEMA
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=f"""You are a SQL generator for an IT management app.
Given a natural language question, generate a single PostgreSQL SELECT query.

Rules:
- Use ONLY SELECT. Never INSERT, UPDATE, DELETE, DROP, or any DDL.
- Always include WHERE user_id = '{{user_id}}' (literal placeholder text).
- Add LIMIT 50 unless the user asks for more.
- Return ONLY the SQL query — no explanation, no markdown, no code fences.

Schema:
{schema}""",
        messages=[{"role": "user", "content": question}],
    )
    return message.content[0].text.strip()


async def check_suggestions(completed_tasks: list[dict]) -> list[dict]:
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
        system=f"""You are an IT assistant that reviews completed task notes for follow-up suggestions.
Today is {today}.

Look for notes that suggest a future action with a specific time frame (e.g. "consider doing X in 3 months",
"replace Y next year", "follow up in 6 weeks").

For each suggestion where that time has now passed or is within 2 weeks from today, return it.

Respond with a JSON array only — no other text:
[{{"title": "Short task title", "reason": "Brief explanation referencing the original task"}}]

If no suggestions are ready, return [].
""",
        messages=[{"role": "user", "content": task_list}],
    )

    text = message.content[0].text.strip()
    try:
        return _json.loads(text)
    except Exception:
        return []

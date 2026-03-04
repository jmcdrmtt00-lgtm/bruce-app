from __future__ import annotations

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


def _tasks_text(in_progress_tasks: list[dict]) -> str:
    if not in_progress_tasks:
        return "  (none)"
    return "\n".join(
        f"  Task #{t.get('task_number', '?')}: {t.get('title', '')}"
        + (f" [Priority: {t['priority']}]" if t.get('priority') else "")
        + (f" [Due: {t['date_due']}]" if t.get('date_due') else "")
        for t in in_progress_tasks
    )


async def advise_plan(question: str, in_progress_tasks: list[dict], user_email: str = "") -> dict:
    """Pass 1 — decide what data to look up, return rephrasing + optional SQL."""
    import json as _json

    system = f"""You are IT Buddy, an IT advisor for an IT professional at Oriol Healthcare — \
a nursing facility operator with three sites: Holden, Oakdale, and Business Office.

Current in-progress tasks:
{_tasks_text(in_progress_tasks)}

Review the user's question. Return a JSON object with exactly these fields:
- "rephrasing": one sentence starting with "You're asking..." confirming what you understood
- "sql": a single SELECT query if database data would help you give a better answer, \
otherwise null. Use {{user_id}} as a placeholder.
- "lookup_description": a short phrase describing what you are looking up (e.g. \
"warranty expiration dates for your computers"), or null if sql is null.

Only generate SQL if it would let you give a meaningfully better answer. \
For questions answerable from the in-progress tasks alone, set sql to null.

You may query:
{INCIDENTS_SCHEMA}
{ASSETS_SCHEMA}

Return only the JSON object with no markdown fences."""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=system,
        messages=[{"role": "user", "content": question}],
    )
    headlights_tracker.track_tokens(user_email, message.usage.input_tokens, message.usage.output_tokens)

    text = message.content[0].text.strip()
    try:
        return _json.loads(text)
    except Exception:
        return {"rephrasing": "I understood your question.", "sql": None, "lookup_description": None}


async def advise_answer(
    question: str,
    in_progress_tasks: list[dict],
    lookup_description: str | None,
    sql_results: list[dict],
    user_email: str = "",
) -> str:
    """Pass 2 — answer the question using in-progress tasks + any SQL results."""

    # Format SQL results as readable text (cap at 30 rows)
    data_section = ""
    if lookup_description and sql_results:
        rows = sql_results[:30]
        formatted = "\n".join(
            "  " + ", ".join(f"{k}: {v}" for k, v in row.items() if v is not None)
            for row in rows
        )
        suffix = f"\n  ... ({len(sql_results) - 30} more rows)" if len(sql_results) > 30 else ""
        data_section = f"\nAdditional data you looked up ({lookup_description}):\n{formatted}{suffix}\n"
    elif lookup_description:
        data_section = f"\nYou tried to look up {lookup_description} but the query returned no results.\n"

    system = f"""You are IT Buddy, an IT advisor for an IT professional at Oriol Healthcare — \
a nursing facility operator with three sites: Holden, Oakdale, and Business Office.

Current in-progress tasks:
{_tasks_text(in_progress_tasks)}
{data_section}
Answer the user's question directly and helpfully. Be specific — reference task names, \
equipment names, or data points from the lookup where relevant. \
Plain text only, no markdown symbols."""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=system,
        messages=[{"role": "user", "content": question}],
    )
    headlights_tracker.track_tokens(user_email, message.usage.input_tokens, message.usage.output_tokens)
    headlights_tracker.track_activity(user_email, sessions=1)

    return message.content[0].text.strip()


async def match_problem_type(description: str, problem_types: list[str], user_email: str = "") -> list[str]:
    """Classify a freeform description against a list of known problem types."""
    import json as _json

    types_text = "\n".join(f"- {pt}" for pt in problem_types)

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=f"""You are an IT problem classifier. Match the user's description to one or more of these problem types:

{types_text}

Each entry is formatted as "id: Label". Return a JSON object with key "matches" containing a list of matching type IDs (the part before the colon).
Return one ID if confident; up to 3 if genuinely ambiguous. Return an empty list if nothing matches.
Return only the JSON object, no markdown fences.""",
        messages=[{"role": "user", "content": description}],
    )
    headlights_tracker.track_tokens(user_email, message.usage.input_tokens, message.usage.output_tokens)

    text = message.content[0].text.strip()
    # Strip markdown fences if the model wrapped the JSON
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:]).strip()
    try:
        result = _json.loads(text)
        return result.get("matches", [])
    except Exception:
        return []


_PROBLEM_TYPE_LABELS = {
    "onboarding": "Onboarding",
    "intermittent_network_slowness": "Intermittent Network Slowness",
    "application_performance_degradation": "Application Performance Degradation",
    "access_drift_permission_sprawl": "Access Drift / Permission Sprawl",
    "recurring_endpoint_instability": "Recurring Endpoint Instability",
    "backup_reliability": "Backup Reliability / Restore Confidence Issues",
}


async def diagnose(
    problem_type: str,
    task_details: str | None = None,
    information: str | None = None,
    task_fields: dict | None = None,
    conversation: list[dict] | None = None,
    inventory_context: str | None = None,
    user_email: str = "",
) -> dict:
    """Diagnose an IT issue or extract onboarding structured data."""
    import json as _json

    label = _PROBLEM_TYPE_LABELS.get(problem_type, problem_type)

    if problem_type == "onboarding":
        context_parts = []
        if task_details:
            context_parts.append(f"Task details: {task_details}")
        if information:
            context_parts.append(f"Information gathered:\n{information}")
        context = "\n\n".join(context_parts) if context_parts else "No information provided."

        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            system="""You extract new hire information from free-form text. Return ONLY a valid JSON object with exactly these fields:
- firstName: string
- lastName: string
- role: one of [executive, business_office, admissions, hr, don_adon, social_services, activities, sdc, home_health, maintenance, kitchen, concierge, it, clinical_floor]
- site: one of [holden, oakdale, business_office]
- startDate: YYYY-MM-DD string (or empty string if not mentioned)
- nextAssetNumber: string (or empty string if not mentioned)
- computerName: string (or empty string if not mentioned)
- notes: string (any other info not captured above, or empty string)
Return only the JSON object, no explanation, no markdown fences.""",
            messages=[{"role": "user", "content": context}],
        )
        headlights_tracker.track_tokens(user_email, message.usage.input_tokens, message.usage.output_tokens)
        headlights_tracker.track_activity(user_email, sessions=1)

        text = message.content[0].text.strip()
        try:
            structured_data = _json.loads(text)
            return {"structured_data": structured_data}
        except Exception:
            return {"structured_data": {}}

    else:
        # Build context string
        context_parts = [f"Problem type: {label}"]
        if task_fields:
            tf_parts = [f"{k}: {v}" for k, v in task_fields.items() if v]
            if tf_parts:
                context_parts.append("Task: " + ", ".join(tf_parts))
        if task_details:
            context_parts.append(f"Questions/Details:\n{task_details}")
        if information:
            context_parts.append(f"Information gathered:\n{information}")
        context_text = "\n\n".join(context_parts)

        # Build message list: initial user request + conversation history
        is_first_pass = not conversation
        if is_first_pass:
            inventory_block = (
                f"\n\nInventory data from the asset database (use this to answer questions you would otherwise ask):\n{inventory_context}"
                if inventory_context else ""
            )
            user_msg = (
                f"I have gathered some initial context about this IT issue. "
                f"Use it to understand the situation and identify what key information is still missing. "
                f"Do NOT attempt a diagnosis yet — your job on this first pass is to ask the specific, targeted follow-up questions that will give you what you need to diagnose it properly."
                f"{inventory_block}\n\n{context_text}"
            )
        else:
            user_msg = f"Here is the full context for this IT issue:\n\n{context_text}"

        messages = [{"role": "user", "content": user_msg}]
        if conversation:
            for turn in conversation:
                role = turn.get("role", "user")
                content = turn.get("content", turn.get("text", ""))
                api_role = "assistant" if role == "ai" else "user"
                messages.append({"role": api_role, "content": content})
            # Last turn is the user's latest answer — Claude will respond

        inventory_instruction = (
            "\n\nYou have been given inventory data from the asset database. "
            "For any question whose answer is visible in that data, do NOT ask it — use the data directly. "
            "Only ask follow-up questions for information that is NOT in the inventory.\n"
            "IMPORTANT: On the first pass, begin your 'response' field by briefly summarising what relevant "
            "devices or records you found in the inventory (e.g. 'I found 2 Network devices at Holden: ...'), "
            "then ask the user to flag anything that looks wrong or out of date before you rely on it. "
            "After that, list only the follow-up questions for information the inventory does NOT contain."
            if inventory_context else ""
        )

        system = f"""You are IT Buddy, an expert IT advisor for Oriol Healthcare (nursing facility with three sites: Holden, Oakdale, Business Office).

You are working a {label} issue.{inventory_instruction}

On the FIRST pass (no prior conversation), your sole job is to ask the right follow-up questions — not to diagnose. Use the initial context to focus your questions. Set "response" to a brief acknowledgement of what you know so far (1–2 sentences), and put all your questions in "follow_up_questions".

On SUBSEQUENT passes (conversation history present), analyze the answers and either provide a diagnosis or ask any remaining critical questions. When you have enough information for a complete diagnosis, set "follow_up_questions" to [].

Return a JSON object with exactly these fields:
- "response": your brief acknowledgement (first pass) or full diagnosis/analysis (subsequent passes) — plain text, no markdown symbols
- "follow_up_questions": list of specific questions still needed, or [] if you have enough for a full diagnosis

Return only the JSON object, no markdown fences."""

        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=system,
            messages=messages,
        )
        headlights_tracker.track_tokens(user_email, message.usage.input_tokens, message.usage.output_tokens)
        headlights_tracker.track_activity(user_email, sessions=1)

        text = message.content[0].text.strip()
        try:
            result = _json.loads(text)
            return {
                "response": result.get("response", ""),
                "follow_up_questions": result.get("follow_up_questions", []),
            }
        except Exception:
            return {"response": text, "follow_up_questions": []}


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

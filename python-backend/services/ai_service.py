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
        system=prompt_loader.get_summarize_prompt(),
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

    system = (
        prompt_loader.get_advise_plan_prompt()
        .replace("{{in_progress_tasks}}", _tasks_text(in_progress_tasks))
        .replace("{{schemas}}", f"{INCIDENTS_SCHEMA}\n{ASSETS_SCHEMA}")
    )

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

    system = (
        prompt_loader.get_advise_answer_prompt()
        .replace("{{in_progress_tasks}}", _tasks_text(in_progress_tasks))
        .replace("{{data_section}}", data_section)
    )

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

    system = prompt_loader.get_match_type_prompt().replace("{{problem_types}}", types_text)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=system,
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


LOOKUP_ASSET_TOOL = {
    "name": "lookup_asset",
    "description": (
        "Look up a device or asset in the IT inventory database by name or assigned user. "
        "Returns purchase date, age, specs, and warranty info. Use this when knowing a device's "
        "age or specs would meaningfully change your diagnosis."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "search_term": {
                "type": "string",
                "description": "Device name, assigned user, or location label (e.g. 'Activities PC', 'Activities', 'Dining Room printer')",
            }
        },
        "required": ["search_term"],
    },
}


async def diagnose(
    problem_type: str,
    stage: str = "symptoms",
    task_details: str | None = None,
    information: str | None = None,
    task_fields: dict | None = None,
    conversation: list[dict] | None = None,
    user_email: str = "",
    tool_call: dict | None = None,
    tool_result: str | None = None,
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
            system=prompt_loader.get_onboarding_prompt(),
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

    elif stage == "fix":
        # Call 3: given agreed cause, return fix steps
        cause_text = information or task_details or "Unknown cause"
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=prompt_loader.get_diagnose_fix_prompt(),
            messages=[{"role": "user", "content": f"Cause: {cause_text}"}],
        )
        headlights_tracker.track_tokens(user_email, message.usage.input_tokens, message.usage.output_tokens)
        headlights_tracker.track_activity(user_email, sessions=1)

        text = message.content[0].text.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:]).strip()
        try:
            result = _json.loads(text)
            return {"steps": result.get("steps", [])}
        except Exception:
            return {"steps": [text]}

    else:
        # Calls 1 & 2: symptoms or follow-up loop — return {cause} or {questions}
        # Build multi-turn message history
        if conversation:
            messages = []
            for turn in conversation:
                role = turn.get("role", "user")
                content = turn.get("content", turn.get("text", ""))
                messages.append({"role": "assistant" if role == "ai" else "user", "content": content})
        else:
            # information = what the user typed; task_details = UI label template (not useful to AI)
            symptoms = (information or "").strip() or "No symptoms provided."
            messages = [{"role": "user", "content": f"Symptoms: {symptoms}"}]

        # Tool use: general tasks on first pass only
        use_tools = (problem_type == "general" and not conversation and tool_result is None)

        if tool_call and tool_result is not None:
            # Second pass: append tool use + result to message history, then get final diagnosis
            messages = messages + [
                {
                    "role": "assistant",
                    "content": [{"type": "tool_use", "id": tool_call["tool_use_id"],
                                 "name": tool_call["name"], "input": tool_call["input"]}],
                },
                {
                    "role": "user",
                    "content": [{"type": "tool_result", "tool_use_id": tool_call["tool_use_id"],
                                 "content": tool_result}],
                },
            ]
            message = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=512,
                system=prompt_loader.get_diagnose_prompt(),
                messages=messages,
            )
        elif use_tools:
            message = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=512,
                system=prompt_loader.get_diagnose_prompt(),
                messages=messages,
                tools=[LOOKUP_ASSET_TOOL],
            )
            headlights_tracker.track_tokens(user_email, message.usage.input_tokens, message.usage.output_tokens)
            # If Claude wants to call a tool, return the tool call for Next.js to execute
            if message.stop_reason == "tool_use":
                tool_use_block = next(b for b in message.content if b.type == "tool_use")
                return {
                    "tool_call": {
                        "name": tool_use_block.name,
                        "input": tool_use_block.input,
                        "tool_use_id": tool_use_block.id,
                    }
                }
        else:
            message = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=512,
                system=prompt_loader.get_diagnose_prompt(),
                messages=messages,
            )

        headlights_tracker.track_tokens(user_email, message.usage.input_tokens, message.usage.output_tokens)
        headlights_tracker.track_activity(user_email, sessions=1)

        text = message.content[0].text.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:]).strip()
        try:
            result = _json.loads(text)
            return {
                "cause":     result.get("cause") or None,
                "detail":    result.get("detail") or None,
                "questions": result.get("questions") or None,
            }
        except Exception:
            return {"cause": None, "detail": None, "questions": [text]}


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

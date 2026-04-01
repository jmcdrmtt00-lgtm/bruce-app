"""
gmail_poller.py — polls admin@lm-intel.ai for inbound IT tickets.

Email format:  admin+{org_slug}@lm-intel.ai
Example:       admin+oriol@lm-intel.ai

The sender's name and reply address come from the From: header.
For each valid unread email the poller:
  1. Looks up the org in Supabase by slug
  2. Creates an incident (ticket) in that org
  3. Runs AI triage and stores the result
  4. Marks the email as read so it isn't processed again
"""

from __future__ import annotations

import base64
import email as email_lib
import logging
import os
import re
from email.mime.text import MIMEText

import httpx

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

GMAIL_ADDRESS   = "admin@lm-intel.ai"
ADDR_PATTERN    = re.compile(
    r"admin\+([a-z0-9-]+)(?:-[^@\s]*)?@lm-intel\.ai", re.IGNORECASE
)

# ── Supabase REST helpers ─────────────────────────────────────────────────────

def _sb_headers() -> dict:
    key = os.getenv("ITBUDDY_SUPABASE_SERVICE_ROLE_KEY", "")
    return {
        "apikey":        key,
        "Authorization": f"Bearer {key}",
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
    }

def _sb_url(path: str) -> str:
    base = os.getenv("ITBUDDY_SUPABASE_URL", "").rstrip("/")
    if not base:
        raise RuntimeError("ITBUDDY_SUPABASE_URL / ITBUDDY_SUPABASE_SERVICE_ROLE_KEY not set")
    return f"{base}/rest/v1/{path}"

def _sb_get(path: str, params: dict) -> list:
    r = httpx.get(_sb_url(path), headers=_sb_headers(), params=params, timeout=10)
    r.raise_for_status()
    return r.json()

def _sb_post(path: str, body: dict) -> dict:
    r = httpx.post(_sb_url(path), headers=_sb_headers(), json=body, timeout=10)
    r.raise_for_status()
    data = r.json()
    return data[0] if isinstance(data, list) else data

def _sb_patch(path: str, body: dict) -> None:
    r = httpx.patch(_sb_url(path), headers=_sb_headers(), json=body, timeout=10)
    r.raise_for_status()


# ── Gmail service ─────────────────────────────────────────────────────────────

def _gmail_service():
    creds = Credentials(
        token=None,
        refresh_token=os.getenv("GMAIL_REFRESH_TOKEN", ""),
        client_id=os.getenv("GMAIL_CLIENT_ID", ""),
        client_secret=os.getenv("GMAIL_CLIENT_SECRET", ""),
        token_uri="https://oauth2.googleapis.com/token",
        scopes=[
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.send",
        ],
    )
    creds.refresh(Request())
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


# ── Email helpers ─────────────────────────────────────────────────────────────

def _get_header(headers: list[dict], name: str) -> str:
    for h in headers:
        if h["name"].lower() == name.lower():
            return h["value"]
    return ""


def _get_body(payload: dict) -> str:
    """Extract plain-text body from a Gmail message payload."""
    if payload.get("mimeType") == "text/plain":
        data = payload.get("body", {}).get("data", "")
        return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")

    for part in payload.get("parts", []):
        text = _get_body(part)
        if text:
            return text
    return ""


def _send_email(service, to: str, subject: str, body: str, reply_to: str | None = None) -> None:
    msg = MIMEText(body)
    msg["To"]      = to
    msg["From"]    = GMAIL_ADDRESS
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    service.users().messages().send(userId="me", body={"raw": raw}).execute()


def _reply_subject(original_subject: str) -> str:
    return original_subject if original_subject.startswith("Re:") else f"Re: {original_subject}"


def _send_adequate_ack(service, to: str, original_subject: str,
                       task_number: int, sender_name: str, org_slug: str) -> None:
    body = (
        f"Hi {sender_name},\n\n"
        f"Thank you for submitting ticket #T{task_number}; we will look at the problem "
        f"as soon as possible and get back to you if we have any more questions.\n\n"
        f"— IT Buddy"
    )
    _send_email(service, to, _reply_subject(original_subject), body,
                reply_to=f"admin+{org_slug}@lm-intel.ai")


def _send_needs_info_ack(service, to: str, original_subject: str,
                         task_number: int, sender_name: str, org_slug: str) -> None:
    body = (
        f"Hi {sender_name},\n\n"
        f"Thank you for submitting ticket #T{task_number}; we will look at the problem "
        f"as soon as possible; we are likely to get back to you with a few questions.\n\n"
        f"— IT Buddy"
    )
    _send_email(service, to, _reply_subject(original_subject), body,
                reply_to=f"admin+{org_slug}@lm-intel.ai")


def send_more_info_reply(service, to: str, original_subject: str,
                         sender_name: str, missing: str, org_slug: str) -> None:
    """Called by the Tickets page when Bruce clicks Send on a needs-info ticket."""
    body = (
        f"Hi {sender_name},\n\n"
        f"Thanks for reaching out to IT. To help you as quickly as possible, "
        f"could you provide a bit more information?\n\n"
        f"  {missing}\n\n"
        f"Just reply to this email with the details and we'll get right on it.\n\n"
        f"— IT Buddy"
    )
    _send_email(service, to, _reply_subject(original_subject), body,
                reply_to=f"admin+{org_slug}@lm-intel.ai")


# ── Core processing ───────────────────────────────────────────────────────────

def _process_message(service, msg_id: str) -> None:
    """Process a single Gmail message: create ticket + triage + mark read."""
    full = service.users().messages().get(
        userId="me", id=msg_id, format="full"
    ).execute()

    thread_id = full.get("threadId", "")
    headers   = full.get("payload", {}).get("headers", [])
    to_hdr    = _get_header(headers, "To")
    from_hdr  = _get_header(headers, "From")
    subject   = _get_header(headers, "Subject") or "(no subject)"
    body      = _get_body(full.get("payload", {})).strip()

    # Always mark as read first so we never reprocess
    try:
        service.users().messages().modify(
            userId="me", id=msg_id, body={"removeLabelIds": ["UNREAD"]}
        ).execute()
        print(f"Email poll: marked msg {msg_id} as read", flush=True)
    except Exception as exc:
        print(f"Email poll: WARNING — could not mark msg {msg_id} as read: {exc}", flush=True)

    # Extract sender info
    from_email_match = re.search(r"<([^>]+)>", from_hdr)
    reply_to = from_email_match.group(1) if from_email_match else from_hdr.strip()
    display_name = from_hdr[:from_hdr.index('<')].strip().strip('"') if '<' in from_hdr else ''
    sender_name = display_name or reply_to.split('@')[0]

    # ── Check if this is a reply to an existing ticket (same Gmail thread) ──
    if thread_id:
        existing = _sb_get("incidents", {
            "gmail_thread_id": f"eq.{thread_id}",
            "select": "id,task_number,org_id,user_id",
            "limit": "1",
        })
        if existing:
            incident_id  = existing[0]["id"]
            task_number  = existing[0]["task_number"]
            inc_user_id  = existing[0]["user_id"]
            print(f"Email poll: reply to existing ticket #{task_number} (thread {thread_id})", flush=True)
            # Add the reply body as an incident update
            update_note = f"Reply from {sender_name} <{reply_to}>:\n\n{body}" if body else f"Reply from {sender_name} <{reply_to}> (no body)"
            try:
                _sb_post("incident_updates", {
                    "incident_id": incident_id,
                    "user_id":     inc_user_id,
                    "type": "reply",
                    "note": update_note,
                })
            except Exception as exc:
                print(f"Email poll: WARNING — could not save reply update: {exc}", flush=True)
            # Move to Dashboard: mark as adequate so it appears there
            _sb_patch(f"incidents?id=eq.{incident_id}",
                      {"triage_result": "adequate", "awaiting_reply": False})
            print(f"Email poll: ticket #{task_number} moved to Dashboard (reply received)", flush=True)
            return

    # ── New ticket — parse org slug ──
    delivered_to = _get_header(headers, "Delivered-To")
    match = ADDR_PATTERN.search(to_hdr) or ADDR_PATTERN.search(delivered_to)
    if not match:
        print(f"Email poll: skipping msg {msg_id} — To: {to_hdr} / Delivered-To: {delivered_to}", flush=True)
        return

    org_slug = match.group(1).lower()

    # Look up org
    print(f"Email poll: looking up org slug '{org_slug}'", flush=True)
    orgs = _sb_get("orgs", {"slug": f"eq.{org_slug}", "select": "id,name", "limit": "1"})
    if not orgs:
        print(f"Email poll: unknown org slug '{org_slug}' — skipping", flush=True)
        return
    org_id   = orgs[0]["id"]
    org_name = orgs[0]["name"]
    print(f"Email poll: org found: {org_name}", flush=True)

    # Find a user_id to attach the incident to (prefer admin, fall back to any member)
    members = _sb_get("user_orgs", {"org_id": f"eq.{org_id}", "role": "eq.admin",
                                     "select": "user_id", "limit": "1"})
    if not members:
        members = _sb_get("user_orgs", {"org_id": f"eq.{org_id}",
                                         "select": "user_id", "limit": "1"})
    if not members:
        print(f"Email poll: no users for org '{org_slug}' — skipping", flush=True)
        return
    user_id = members[0]["user_id"]

    # Insert incident
    print(f"Email poll: inserting incident for org '{org_slug}'", flush=True)
    try:
        incident = _sb_post("incidents", {
            "org_id":            org_id,
            "user_id":           user_id,
            "title":             subject[:200],
            "description":       body or f"(Email from {reply_to} — no body text)",
            "reported_by":       f"{sender_name} <{reply_to}>",
            "status":            "open",
            "source":            "email",
            "gmail_message_id":  msg_id,
            "gmail_thread_id":   thread_id or None,
        })
    except Exception as exc:
        print(f"Email poll: incident insert failed (already processed?): {exc}", flush=True)
        return
    incident_id  = incident.get("id")
    task_number  = incident.get("task_number")
    print(f"Email poll: created ticket #{task_number} for org '{org_slug}' from {reply_to}", flush=True)

    # Triage: does this email have enough info to act on?
    from services.ai_service import triage_email_ticket
    try:
        triage = triage_email_ticket(subject, body)
    except Exception as exc:
        print(f"Email poll: triage failed: {exc}", flush=True)
        return
    adequate = triage.get("adequate", True)
    missing  = triage.get("missing", "Please describe the problem in more detail.")
    print(f"Email poll: triage result — adequate={adequate}", flush=True)

    if adequate:
        _sb_patch(f"incidents?id=eq.{incident_id}", {"triage_result": "adequate"})
        try:
            _send_adequate_ack(service, reply_to, subject, task_number, sender_name, org_slug)
            print(f"Email poll: ticket #{task_number} adequate — ack sent to {reply_to}", flush=True)
        except Exception as exc:
            print(f"Email poll: WARNING — could not send adequate ack: {exc}", flush=True)
    else:
        draft = (
            f"Hi {sender_name},\n\n"
            f"Thanks for reaching out to IT. To help you as quickly as possible, "
            f"could you provide a bit more information?\n\n"
            f"  {missing}\n\n"
            f"Just reply to this email with the details and we'll get right on it.\n\n"
            f"— IT Buddy"
        )
        _sb_patch(f"incidents?id=eq.{incident_id}",
                  {"triage_result": "needs_info", "draft_reply": draft})
        try:
            _send_needs_info_ack(service, reply_to, subject, task_number, sender_name, org_slug)
            print(f"Email poll: ticket #{task_number} needs-info — ack sent to {reply_to}", flush=True)
        except Exception as exc:
            print(f"Email poll: WARNING — could not send needs-info ack: {exc}", flush=True)


# ── Public entry point ────────────────────────────────────────────────────────

def poll_once() -> None:
    """
    Check Gmail for new IT ticket emails and process them.
    Called every 2 minutes by the background task in main.py.
    """
    client_id     = os.getenv("GMAIL_CLIENT_ID", "")
    refresh_token = os.getenv("GMAIL_REFRESH_TOKEN", "")
    if not client_id or not refresh_token:
        logger.debug("Gmail env vars not configured — skipping poll")
        return

    print("Email poll: starting", flush=True)
    try:
        service = _gmail_service()
        print("Email poll: Gmail auth OK", flush=True)
    except Exception as exc:
        print(f"Email poll: Gmail init failed: {exc}", flush=True)
        return

    # Verify Supabase env vars are present before processing
    if not os.getenv("ITBUDDY_SUPABASE_URL") or not os.getenv("ITBUDDY_SUPABASE_SERVICE_ROLE_KEY"):
        print("Email poll: ITBUDDY_SUPABASE_URL / ITBUDDY_SUPABASE_SERVICE_ROLE_KEY not set", flush=True)
        return

    # Fetch unread messages in inbox
    result = service.users().messages().list(
        userId="me",
        q="is:unread in:inbox",
        maxResults=20,
    ).execute()

    messages = result.get("messages", [])
    print(f"Email poll: found {len(messages)} unread message(s)", flush=True)
    if not messages:
        return

    for msg in messages:
        try:
            _process_message(service, msg["id"])
        except Exception as exc:
            print(f"Email poll: ERROR processing message {msg['id']}: {exc}", flush=True)

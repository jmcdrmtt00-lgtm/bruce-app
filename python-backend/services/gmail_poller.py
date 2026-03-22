"""
gmail_poller.py — polls admin@lm-intel.ai for inbound IT tickets.

Email format:  admin+{org_slug}-{sender_name}@lm-intel.ai
Example:       admin+oriol-nurseAlice@lm-intel.ai

For each valid unread email the poller:
  1. Looks up the org in Supabase by slug
  2. Creates an incident (ticket) in that org
  3. Sends a confirmation reply to the sender
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
    r"admin\+([a-z0-9-]+)-([^@\s]+)@lm-intel\.ai", re.IGNORECASE
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


def _send_reply(service, to: str, original_subject: str, ticket_number: int,
                sender_name: str, org_name: str) -> None:
    subject = (
        original_subject
        if original_subject.startswith("Re:")
        else f"Re: {original_subject}"
    )
    body = (
        f"Hi {sender_name},\n\n"
        f"Your IT request has been received. A ticket has been created:\n\n"
        f"  Ticket #: {ticket_number}\n"
        f"  Summary:  {original_subject}\n"
        f"  Org:      {org_name}\n\n"
        f"IT Buddy will follow up with you shortly. "
        f"You can reply to this email with any additional details.\n\n"
        f"— IT Buddy"
    )
    msg = MIMEText(body)
    msg["To"]      = to
    msg["From"]    = GMAIL_ADDRESS
    msg["Subject"] = subject

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    service.users().messages().send(
        userId="me", body={"raw": raw}
    ).execute()


# ── Core processing ───────────────────────────────────────────────────────────

def _process_message(service, msg_id: str) -> None:
    """Process a single Gmail message: create ticket + reply + mark read."""
    full = service.users().messages().get(
        userId="me", id=msg_id, format="full"
    ).execute()

    headers  = full.get("payload", {}).get("headers", [])
    to_hdr   = _get_header(headers, "To")
    from_hdr = _get_header(headers, "From")
    subject  = _get_header(headers, "Subject") or "(no subject)"
    body     = _get_body(full.get("payload", {})).strip()

    # Parse org slug and sender name from the To: address
    match = ADDR_PATTERN.search(to_hdr)
    if not match:
        logger.info("Skipping message %s — no valid IT Buddy address in To: %s", msg_id, to_hdr)
        return

    org_slug    = match.group(1).lower()
    sender_name = match.group(2)

    # Extract reply-to address from From: header
    from_email_match = re.search(r"<([^>]+)>", from_hdr)
    reply_to = from_email_match.group(1) if from_email_match else from_hdr.strip()

    # Look up org
    orgs = _sb_get("orgs", {"slug": f"eq.{org_slug}", "select": "id,name", "limit": "1"})
    if not orgs:
        logger.warning("Unknown org slug '%s' in email %s — skipping", org_slug, msg_id)
        return
    org_id   = orgs[0]["id"]
    org_name = orgs[0]["name"]

    # Find a user_id to attach the incident to (first admin of this org)
    members = _sb_get("user_orgs", {"org_id": f"eq.{org_id}", "role": "eq.admin",
                                     "select": "user_id", "limit": "1"})
    if not members:
        members = _sb_get("user_orgs", {"org_id": f"eq.{org_id}",
                                         "select": "user_id", "limit": "1"})
    if not members:
        logger.warning("No users found for org '%s' — skipping email %s", org_slug, msg_id)
        return
    user_id = members[0]["user_id"]

    # Insert incident
    incident = _sb_post("incidents", {
        "org_id":      org_id,
        "user_id":     user_id,
        "title":       subject[:200],
        "description": body or f"(Email from {reply_to} — no body text)",
        "reported_by": f"{sender_name} <{reply_to}>",
        "status":      "open",
        "source":      "email",
    })
    ticket_number = incident.get("task_number", 0)
    logger.info("Created ticket #%s for org '%s' from %s", ticket_number, org_slug, reply_to)

    # Send confirmation reply
    try:
        _send_reply(service, reply_to, subject, ticket_number, sender_name, org_name)
    except Exception as exc:
        logger.error("Failed to send reply to %s: %s", reply_to, exc)

    # Mark as read
    service.users().messages().modify(
        userId="me",
        id=msg_id,
        body={"removeLabelIds": ["UNREAD"]},
    ).execute()


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

    logger.info("Email poll: starting")
    try:
        service = _gmail_service()
        logger.info("Email poll: Gmail auth OK")
    except Exception as exc:
        logger.error("Gmail init failed: %s", exc)
        return

    # Verify Supabase env vars are present before processing
    if not os.getenv("ITBUDDY_SUPABASE_URL") or not os.getenv("ITBUDDY_SUPABASE_SERVICE_ROLE_KEY"):
        logger.error("ITBUDDY_SUPABASE_URL / ITBUDDY_SUPABASE_SERVICE_ROLE_KEY not set")
        return

    # Fetch unread messages in inbox
    result = service.users().messages().list(
        userId="me",
        q="is:unread in:inbox",
        maxResults=20,
    ).execute()

    messages = result.get("messages", [])
    logger.info("Email poll: found %d unread message(s)", len(messages))
    if not messages:
        return

    for msg in messages:
        try:
            _process_message(service, msg["id"])
        except Exception as exc:
            logger.error("Error processing message %s: %s", msg["id"], exc)

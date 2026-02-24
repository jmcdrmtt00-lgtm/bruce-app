"""Fire-and-forget: write AI usage metrics to Headlights Supabase."""
import os
import json
import threading
import urllib.request
import urllib.parse


def _get_url() -> str:
    return os.getenv("HEADLIGHTS_SUPABASE_URL", "").strip()


def _get_key() -> str:
    return os.getenv("HEADLIGHTS_SUPABASE_KEY", "").strip()


def _headers(key: str) -> dict:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _update(
    user_email: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    sessions: int = 0,
    uploads: int = 0,
    clicks: int = 0,
) -> None:
    url = _get_url()
    key = _get_key()
    if not url or not key or not user_email:
        return

    try:
        encoded_email = urllib.parse.quote(user_email, safe="")
        get_url = (
            f"{url}/rest/v1/user_accounts"
            f"?app_id=eq.bruce&email=eq.{encoded_email}"
            f"&select=id,input_tokens,output_tokens,sessions,uploads,clicks"
        )
        req = urllib.request.Request(
            get_url,
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            rows = json.loads(resp.read().decode())

        if rows:
            row = rows[0]
            patch: dict = {}
            if input_tokens or output_tokens:
                patch["input_tokens"]  = (row.get("input_tokens")  or 0) + input_tokens
                patch["output_tokens"] = (row.get("output_tokens") or 0) + output_tokens
            if sessions:
                patch["sessions"] = (row.get("sessions") or 0) + sessions
            if uploads:
                patch["uploads"]  = (row.get("uploads")  or 0) + uploads
            if clicks:
                patch["clicks"]   = (row.get("clicks")   or 0) + clicks
            if patch:
                patch_url = f"{url}/rest/v1/user_accounts?id=eq.{row['id']}"
                req = urllib.request.Request(
                    patch_url, data=json.dumps(patch).encode(),
                    headers=_headers(key), method="PATCH",
                )
                with urllib.request.urlopen(req, timeout=5) as _:
                    pass
        else:
            import time
            row_id = f"br-{int(time.time())}"
            data = json.dumps({
                "id":            row_id,
                "app_id":        "bruce",
                "email":         user_email,
                "sessions":      sessions,
                "uploads":       uploads,
                "clicks":        clicks,
                "credits":       0,
                "revenue":       0,
                "cost":          0,
                "input_tokens":  input_tokens,
                "output_tokens": output_tokens,
            }).encode()
            req = urllib.request.Request(
                f"{url}/rest/v1/user_accounts",
                data=data, headers=_headers(key), method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as _:
                pass

    except Exception as e:
        print(f"[headlights_tracker] Failed to update: {e}")


def track_tokens(user_email: str, input_tokens: int, output_tokens: int) -> None:
    """Increment token counts for this user in Headlights. Non-blocking."""
    if not input_tokens and not output_tokens:
        return
    threading.Thread(
        target=_update, daemon=True,
        kwargs={"user_email": user_email, "input_tokens": input_tokens, "output_tokens": output_tokens},
    ).start()


def track_activity(user_email: str, sessions: int = 0, uploads: int = 0, clicks: int = 0) -> None:
    """Increment activity counters for this user in Headlights. Non-blocking."""
    if not sessions and not uploads and not clicks:
        return
    threading.Thread(
        target=_update, daemon=True,
        kwargs={"user_email": user_email, "sessions": sessions, "uploads": uploads, "clicks": clicks},
    ).start()

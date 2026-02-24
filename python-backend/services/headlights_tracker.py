"""Fire-and-forget: write AI token usage to Headlights Supabase."""
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


def _track(user_email: str, input_tokens: int, output_tokens: int) -> None:
    url = _get_url()
    key = _get_key()
    if not url or not key or not user_email:
        return

    try:
        # Fetch existing row for this user
        encoded_email = urllib.parse.quote(user_email, safe="")
        get_url = (
            f"{url}/rest/v1/user_accounts"
            f"?app_id=eq.bruce&email=eq.{encoded_email}"
            f"&select=id,input_tokens,output_tokens"
        )
        req = urllib.request.Request(
            get_url,
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            rows = json.loads(resp.read().decode())

        if rows:
            row = rows[0]
            new_input  = (row.get("input_tokens")  or 0) + input_tokens
            new_output = (row.get("output_tokens") or 0) + output_tokens
            patch_url = f"{url}/rest/v1/user_accounts?id=eq.{row['id']}"
            data = json.dumps({"input_tokens": new_input, "output_tokens": new_output}).encode()
            req = urllib.request.Request(
                patch_url, data=data, headers=_headers(key), method="PATCH"
            )
            with urllib.request.urlopen(req, timeout=5) as _:
                pass
        else:
            # No row yet — create one
            import time
            row_id = f"br-{int(time.time())}"
            data = json.dumps({
                "id":            row_id,
                "app_id":        "bruce",
                "email":         user_email,
                "sessions":      0,
                "uploads":       0,
                "clicks":        0,
                "credits":       0,
                "revenue":       0,
                "cost":          0,
                "input_tokens":  input_tokens,
                "output_tokens": output_tokens,
            }).encode()
            req = urllib.request.Request(
                f"{url}/rest/v1/user_accounts",
                data=data,
                headers=_headers(key),
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as _:
                pass

    except Exception as e:
        print(f"[headlights_tracker] Failed to write tokens: {e}")


def track_tokens(user_email: str, input_tokens: int, output_tokens: int) -> None:
    """Increment token counts for this user in Headlights. Non-blocking."""
    if not input_tokens and not output_tokens:
        return
    t = threading.Thread(
        target=_track,
        args=(user_email, input_tokens, output_tokens),
        daemon=True,
    )
    t.start()

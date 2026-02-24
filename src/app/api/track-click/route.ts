import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export async function POST() {
  let userEmail = "";
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    userEmail = user?.email ?? "";
  } catch { /* proceed */ }

  if (userEmail) {
    fetch(`${BACKEND_URL}/api/track-click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_email: userEmail }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

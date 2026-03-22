import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

async function getClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

export async function GET(request: NextRequest) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId  = request.headers.get('x-org-id');
  const source = request.nextUrl.searchParams.get('source');

  let query = supabase
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false });

  // Filter by org if provided, otherwise fall back to user_id (legacy)
  if (orgId) {
    // Include org-tagged incidents AND legacy incidents (no org_id) owned by this user
    query = query.or(`org_id.eq.${orgId},and(org_id.is.null,user_id.eq.${user.id})`);
  } else {
    query = query.eq('user_id', user.id);
  }

  if (source === 'dashboard') {
    // IT's work queue: tasks created by IT, email tickets, or nurse-submitted with adequate info
    // Include legacy sources (null, 'issue') for backward compatibility
    query = query.or(
      "source.eq.submitted by IT,source.eq.submitted by nurse adequate info,source.eq.issue,source.eq.email,source.is.null"
    );
  } else if (source === 'tickets') {
    // Nurse-submitted tickets: needs more info (email route) or fixed by nurse
    // Include legacy sources ('ticket', 'nurse_self_fix') for backward compatibility
    query = query.or(
      "source.eq.submitted by nurse needs more info,source.eq.submitted by nurse fixed by nurse,source.eq.ticket,source.eq.nurse_self_fix"
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ incidents: data });
}

export async function POST(request: NextRequest) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.headers.get('x-org-id');
  const { title: providedTitle, description, reported_by, priority, screen, status, date_due, source } = await request.json();

  let title: string | null = providedTitle ?? null;
  const desc: string = description || providedTitle || '';

  // Only call AI for title if no user-provided title and there's a description
  if (!title && desc) {
    try {
      const backendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc }),
      });
      if (res.ok) {
        const json = await res.json();
        title = json.title ?? null;
      }
    } catch {
      // Backend not running — title stays null
    }
  }

  const { data, error } = await supabase
    .from('incidents')
    .insert({
      user_id: user.id,
      org_id: orgId || null,
      title,
      description: desc,
      reported_by: reported_by || null,
      priority: priority || null,
      screen: screen || null,
      status: status || 'pending',
      date_due: date_due || null,
      source: source || 'submitted by IT',
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ incident: data });
}

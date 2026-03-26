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

  // Filter by org_id — the correct multi-tenant scoping
  // Fall back to user_id for backward compatibility if no org header
  if (orgId) {
    query = query.eq('org_id', orgId);
  } else {
    query = query.eq('user_id', user.id);
  }

  if (source === 'dashboard') {
    // IT tasks + direct_ticket where IT is fixing + email with adequate info
    query = query.or(
      'source.eq.it,' +
      'and(source.eq.direct_ticket,self_fixed.eq.false),' +
      'and(source.eq.email,triage_result.eq.adequate,awaiting_reply.eq.false)'
    );
  } else if (source === 'tickets') {
    // Nurse self-fixed + email needing more info (not awaiting reply)
    query = query.or(
      'and(source.eq.direct_ticket,self_fixed.eq.true),' +
      'and(source.eq.email,awaiting_reply.eq.false,triage_result.eq.needs_info)'
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich reported_by: look up employee names in one bulk query
  const emails = [...new Set(
    (data ?? []).map(i => i.reported_by).filter((e): e is string => !!e && e.includes('@'))
  )];

  let nameMap: Record<string, string> = {};
  if (emails.length > 0) {
    const { data: emps } = await supabase
      .from('employees')
      .select('email, first_name, last_name')
      .in('email', emails);
    for (const emp of emps ?? []) {
      nameMap[emp.email.toLowerCase()] = `${emp.first_name} ${emp.last_name}`.trim();
    }
  }

  const enriched = (data ?? []).map(i => ({
    ...i,
    reporter_name: i.reported_by
      ? (nameMap[i.reported_by.toLowerCase()] ?? (i.reported_by.includes('@') ? i.reported_by : null))
      : null,
  }));

  return NextResponse.json({ incidents: enriched });
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
      status: status || 'open',
      date_due: date_due || null,
      source: source || 'it',
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ incident: data });
}

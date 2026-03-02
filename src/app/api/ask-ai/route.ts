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

export async function POST(request: NextRequest) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { question } = await request.json();
  if (!question?.trim()) return NextResponse.json({ error: 'Question required' }, { status: 400 });

  // Fetch the user's in-progress tasks to send as context
  const { data: inProgressTasks } = await supabase
    .from('incidents')
    .select('task_number, title, priority, date_due')
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .order('task_number');

  const backendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
  const taskContext = inProgressTasks ?? [];

  // ── Pass 1: plan — get rephrasing + optional SQL ──────────────────────────
  let plan: { rephrasing: string; sql: string | null; lookup_description: string | null };
  try {
    const res = await fetch(`${backendUrl}/api/advise/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question.trim(),
        in_progress_tasks: taskContext,
        user_email: user.email ?? '',
      }),
    });
    if (!res.ok) throw new Error('Backend unavailable');
    plan = await res.json();
  } catch {
    return NextResponse.json(
      { error: 'AI advisor requires the Python backend to be running.' },
      { status: 503 }
    );
  }

  // ── Run SQL if the AI requested additional data ───────────────────────────
  let sqlResults: Record<string, unknown>[] = [];
  const rawSql = plan.sql ?? null;
  if (rawSql) {
    const safeSql = rawSql.replace(/\{user_id\}/g, user.id).replace(/;+$/, '');
    const { data } = await supabase.rpc('execute_select_query', { query_sql: safeSql });
    sqlResults = Array.isArray(data) ? data : (data ? [data] : []);
  }

  // ── Pass 2: answer — using in-progress tasks + SQL results ────────────────
  let answer: string;
  try {
    const res = await fetch(`${backendUrl}/api/advise/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question.trim(),
        in_progress_tasks: taskContext,
        lookup_description: plan.lookup_description ?? null,
        sql_results: sqlResults,
        user_email: user.email ?? '',
      }),
    });
    if (!res.ok) throw new Error('Backend unavailable');
    const data = await res.json();
    answer = data.answer;
  } catch {
    return NextResponse.json(
      { error: 'AI advisor requires the Python backend to be running.' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    rephrasing:        plan.rephrasing,
    lookupDescription: plan.lookup_description ?? null,
    sql:               rawSql,
    supportingData:    sqlResults,
    answer,
  });
}

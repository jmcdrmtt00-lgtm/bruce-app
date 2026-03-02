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

  // Call Python backend
  const backendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
  let aiResult: { rephrasing: string; answer: string; sql: string | null };
  try {
    const res = await fetch(`${backendUrl}/api/advise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question.trim(),
        in_progress_tasks: inProgressTasks ?? [],
        user_email: user.email ?? '',
      }),
    });
    if (!res.ok) throw new Error('Backend unavailable');
    aiResult = await res.json();
  } catch {
    return NextResponse.json(
      { error: 'AI advisor requires the Python backend to be running.' },
      { status: 503 }
    );
  }

  // If the AI generated a SQL query, run it for supporting data
  let supportingData: Record<string, unknown>[] = [];
  const rawSql = aiResult.sql ?? null;
  if (rawSql) {
    const safeSql = rawSql.replace(/\{user_id\}/g, user.id).replace(/;+$/, '');
    const { data } = await supabase.rpc('execute_select_query', { query_sql: safeSql });
    supportingData = Array.isArray(data) ? data : (data ? [data] : []);
  }

  return NextResponse.json({
    rephrasing:     aiResult.rephrasing,
    answer:         aiResult.answer,
    sql:            rawSql,
    supportingData,
  });
}

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

  // Ask Python backend to generate SQL
  const backendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
  let generatedSql: string;
  try {
    const res = await fetch(`${backendUrl}/api/generate-sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.trim(), target: 'tasks' }),
    });
    if (!res.ok) throw new Error('Backend unavailable');
    const json = await res.json();
    generatedSql = json.sql;
  } catch {
    return NextResponse.json(
      { error: 'AI query requires the Python backend to be running.' },
      { status: 503 }
    );
  }

  // Substitute the real user_id into the generated SQL
  const safeSql = generatedSql.replace(/\{user_id\}/g, user.id).replace(/;+$/, '');

  // Execute via Postgres function (SELECT only, restricted schemas blocked)
  const { data, error } = await supabase.rpc('execute_select_query', {
    query_sql: safeSql,
  });

  if (error) return NextResponse.json({ error: error.message, sql: generatedSql }, { status: 500 });

  const rows = Array.isArray(data) ? data : (data ? [data] : []);
  return NextResponse.json({ results: rows, sql: generatedSql });
}

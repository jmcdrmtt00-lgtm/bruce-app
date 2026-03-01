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

interface IssuesComment {
  timestamp: string;
  text: string;
}

function parseIssuesComments(raw: string | null | undefined): IssuesComment[] {
  if (!raw) return [];
  return raw
    .split('|')
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      const colonIdx = entry.indexOf(':');
      if (colonIdx < 0) return { timestamp: '', text: entry.trim() };
      return {
        timestamp: entry.slice(0, colonIdx).trim(),
        text: entry.slice(colonIdx + 1).trim(),
      };
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

interface TaskRow {
  task_number?: number | string;
  task_name?: string;
  priority?: string;
  date_due?: string;
  status?: string;
  information_needed?: string;
  results?: string;
  issues_comments?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL;
  if (demoEmail && user.email !== demoEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tasks } = await request.json() as { tasks: TaskRow[] };
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: 'No tasks provided' }, { status: 400 });
  }

  const rows = tasks.map(t => ({
    user_id:            user.id,
    task_number:        t.task_number ? Number(t.task_number) : null,
    task_name:          t.task_name ?? null,
    priority:           t.priority ?? null,
    date_due:           t.date_due || null,
    status:             t.status ?? null,
    information_needed: t.information_needed ?? null,
    results:            t.results ?? null,
    issues_comments:    parseIssuesComments(t.issues_comments),
  }));

  // Delete all existing tasks for this user, then insert fresh (simplest reset strategy)
  const { error: delErr } = await supabase
    .from('demo_tasks')
    .delete()
    .eq('user_id', user.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const { error: insErr } = await supabase.from('demo_tasks').insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ inserted: rows.length, updated: 0 });
}

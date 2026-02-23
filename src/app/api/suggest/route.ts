import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function getClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

export async function POST() {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch resolved tasks with their notes from the past year
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data: resolved } = await supabase
    .from('incidents')
    .select('id, task_number, title, date_completed')
    .eq('user_id', user.id)
    .eq('status', 'resolved')
    .gte('date_completed', oneYearAgo.toISOString().split('T')[0]);

  if (!resolved || resolved.length === 0) {
    return NextResponse.json({ created: 0 });
  }

  // Fetch notes for those tasks
  const ids = resolved.map(t => t.id);
  const { data: notes } = await supabase
    .from('incident_updates')
    .select('incident_id, note')
    .in('incident_id', ids);

  // Build list for Python backend
  const taskData = resolved.map(t => ({
    task_number:    t.task_number,
    title:          t.title,
    date_completed: t.date_completed,
    note: notes?.find(n => n.incident_id === t.id)?.note ?? null,
  })).filter(t => t.note); // only tasks that have notes

  if (taskData.length === 0) return NextResponse.json({ created: 0 });

  // Ask Python backend to check for actionable suggestions
  const backendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
  let suggestions: { title: string; reason: string }[];
  try {
    const res = await fetch(`${backendUrl}/api/check-suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed_tasks: taskData }),
    });
    if (!res.ok) throw new Error();
    const json = await res.json();
    suggestions = json.suggestions ?? [];
  } catch {
    return NextResponse.json({ created: 0 }); // Silently skip if backend unavailable
  }

  if (suggestions.length === 0) return NextResponse.json({ created: 0 });

  // Fetch existing auto_suggested queue tasks to avoid duplicates
  const { data: existing } = await supabase
    .from('incidents')
    .select('title')
    .eq('user_id', user.id)
    .eq('auto_suggested', true)
    .eq('status', 'pending');

  const existingTitles = new Set((existing ?? []).map(t => t.title?.toLowerCase()));

  // Create new suggested tasks that don't already exist
  const newTasks = suggestions
    .filter(s => !existingTitles.has(s.title.toLowerCase()))
    .map(s => ({
      user_id:        user.id,
      title:          s.title,
      description:    s.reason,
      status:         'pending',
      source:         'issue',
      auto_suggested: true,
    }));

  if (newTasks.length === 0) return NextResponse.json({ created: 0 });

  await supabase.from('incidents').insert(newTasks);

  return NextResponse.json({ created: newTasks.length, titles: newTasks.map(t => t.title) });
}

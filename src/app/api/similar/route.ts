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

  const { taskName, elaboration } = await request.json();
  if (!taskName?.trim()) return NextResponse.json({ error: 'Task name required' }, { status: 400 });

  // Get all resolved tasks
  const { data: resolved } = await supabase
    .from('incidents')
    .select('id, title, description, task_number, reported_by, priority')
    .eq('user_id', user.id)
    .eq('status', 'resolved')
    .order('created_at', { ascending: false });

  if (!resolved || resolved.length === 0) {
    return NextResponse.json({ results: [], message: 'No resolved tasks to compare against yet.' });
  }

  const taskList = resolved
    .map(t => `#${t.task_number}: "${t.title || t.description}"${t.reported_by ? ` (customer: ${t.reported_by})` : ''}`)
    .join('\n');

  const prompt = `An IT technician wants to find past tasks similar to this one:
Task: "${taskName}"${elaboration ? `\nAdditional context: "${elaboration}"` : ''}

Past resolved tasks:
${taskList}

For each past task with a meaningful similarity or an interesting contrast worth noting, return a JSON array:
[{"task_number": 3, "similarity": "One or two sentences describing how it is similar and/or dissimilar."}]

Only include tasks with genuine relevance. If none qualify, return [].
Respond with only the JSON array, no other text.`;

  try {
    const backendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
    const res = await fetch(`${backendUrl}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        system: 'You are a helpful IT assistant. Respond only with the requested JSON array.',
      }),
    });

    if (!res.ok) throw new Error('Backend unavailable');
    const { text } = await res.json();

    const parsed = JSON.parse(text.trim());
    const results = parsed
      .map((item: { task_number: number; similarity: string }) => {
        const task = resolved.find(t => t.task_number === item.task_number);
        return task ? {
          id:          task.id,
          task_number: task.task_number,
          title:       task.title || task.description,
          similarity:  item.similarity,
        } : null;
      })
      .filter(Boolean);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: 'AI search requires the Python backend to be running.' },
      { status: 503 }
    );
  }
}

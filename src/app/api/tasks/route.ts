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

export async function GET() {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: incidents, error: incErr } = await supabase
    .from('incidents')
    .select('id, task_number, title, description, priority, date_due, status')
    .eq('user_id', user.id)
    .order('task_number');

  if (incErr) return NextResponse.json({ error: incErr.message }, { status: 500 });
  if (!incidents || incidents.length === 0) return NextResponse.json({ tasks: [] });

  // Fetch all incident_updates for these incidents in one query
  const ids = incidents.map(i => i.id);
  const { data: allUpdates, error: updErr } = await supabase
    .from('incident_updates')
    .select('incident_id, type, note, created_at')
    .in('incident_id', ids)
    .order('created_at', { ascending: false });

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Group updates by incident_id
  const updatesByIncident = new Map<string, { type: string; note: string; created_at: string }[]>();
  for (const upd of (allUpdates ?? [])) {
    if (!updatesByIncident.has(upd.incident_id)) updatesByIncident.set(upd.incident_id, []);
    updatesByIncident.get(upd.incident_id)!.push(upd);
  }

  const tasks = incidents.map(inc => {
    const updates = updatesByIncident.get(inc.id) ?? [];
    // Already sorted desc by created_at — get latest results and issues entries
    const resultsUpdate = updates.find(u => u.type === 'progress' && !u.note.startsWith('Issues/Comments:'));
    const issueUpdates  = updates.filter(u => u.type === 'progress' && u.note.startsWith('Issues/Comments:'));

    const issues_comments = issueUpdates
      .map(u => ({
        timestamp: u.created_at,
        text: u.note.replace(/^Issues\/Comments:\s*/, '').trim(),
      }))
      .filter(u => u.text);

    return {
      task_number:        inc.task_number,
      task_name:          inc.title || inc.description,
      priority:           inc.priority,
      date_due:           inc.date_due,
      status:             inc.status,
      information_needed: null,
      results:            resultsUpdate?.note ?? null,
      issues_comments,
    };
  });

  return NextResponse.json({ tasks });
}

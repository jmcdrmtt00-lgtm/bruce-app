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
    });
}

function normalizePriority(p: string | undefined | null): 'high' | 'low' | null {
  if (!p) return null;
  const lower = p.toLowerCase().trim();
  if (lower === 'high' || lower === 'h') return 'high';
  if (lower === 'low'  || lower === 'l') return 'low';
  return null;
}

function normalizeTaskType(t: string | undefined | null): string | null {
  if (!t) return null;
  const lower = t.toLowerCase().trim().replace(/[\s/]+/g, '_');
  if (lower.includes('problem'))      return 'problem_to_fix';
  if (lower.includes('ticket'))       return 'ticket_to_fix';
  if (lower.includes('onboarding') || lower.includes('offboarding')) return 'onboarding_offboarding';
  if (lower.includes('decision'))     return 'decision_to_make';
  if (lower.includes('project'))      return 'project_to_manage';
  return null;
}

function normalizeStatus(s: string | undefined | null): string {
  if (!s) return 'pending';
  const lower = s.toLowerCase().trim();
  if (lower === 'in_progress' || lower === 'in process' || lower === 'in progress') return 'in_progress';
  if (lower === 'resolved' || lower === 'complete' || lower === 'completed' || lower === 'done') return 'resolved';
  return 'pending';
}

interface TaskRow {
  task_number?: number | string;
  task_name?: string;
  requester?: string;
  priority?: string;
  date_due?: string;
  status?: string;
  task_type?: string;
  information_needed?: string;
  problem_to_fix?: string;
  decision_to_make?: string;
  project_to_manage?: string;
  results?: string;
  issues_comments?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tasks } = await request.json() as { tasks: TaskRow[] };
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: 'No tasks provided' }, { status: 400 });
  }

  // Get all existing incident IDs for this user so we can delete their updates first
  const { data: existing, error: fetchErr } = await supabase
    .from('incidents')
    .select('id')
    .eq('user_id', user.id);
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const existingIds = (existing ?? []).map(i => i.id);

  // Delete incident_updates first (no cascade on FK)
  if (existingIds.length > 0) {
    const { error: delUpdErr } = await supabase
      .from('incident_updates')
      .delete()
      .in('incident_id', existingIds);
    if (delUpdErr) return NextResponse.json({ error: delUpdErr.message }, { status: 500 });
  }

  // Delete all existing incidents for this user
  const { error: delErr } = await supabase
    .from('incidents')
    .delete()
    .eq('user_id', user.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // Insert new incidents — rows with a Task # go to the Dashboard (source='issue'),
  // rows without a Task # are nurse-submitted tickets (source='ticket')
  let issueCounter = 0;
  const incidentRows = tasks.map(t => {
    const hasTaskNumber = t.task_number !== null && t.task_number !== undefined && String(t.task_number).trim() !== '';
    if (hasTaskNumber) issueCounter++;
    return {
      user_id:        user.id,
      task_number:    hasTaskNumber ? Number(t.task_number) : null,
      title:          t.task_name ?? null,
      description:    t.task_name ?? '',
      reported_by:    t.requester?.trim() || null,
      priority:       normalizePriority(t.priority),
      date_due:       t.date_due || null,
      status:         normalizeStatus(t.status),
      screen:         normalizeTaskType(t.task_type),
      source:         hasTaskNumber ? 'issue' : 'ticket',
      auto_suggested: false,
      date_completed: normalizeStatus(t.status) === 'resolved'
        ? (t.date_due || new Date().toISOString().split('T')[0])
        : null,
    };
  });

  const { data: inserted, error: insErr } = await supabase
    .from('incidents')
    .insert(incidentRows)
    .select('id, task_number');
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Build a map from task_number → incident id for attaching updates
  const idByTaskNumber = new Map<number, string>();
  for (const inc of (inserted ?? [])) {
    if (inc.task_number !== null && inc.task_number !== undefined) {
      idByTaskNumber.set(inc.task_number, inc.id);
    }
  }

  // Insert incident_updates for content fields, results, and issues_comments
  const updates: { incident_id: string; user_id: string; type: string; note: string }[] = [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const hasTaskNumber = t.task_number !== null && t.task_number !== undefined && String(t.task_number).trim() !== '';
    const taskNum = hasTaskNumber ? Number(t.task_number) : null;
    const incidentId = (taskNum !== null ? idByTaskNumber.get(taskNum) : null) ?? inserted?.[i]?.id;
    if (!incidentId) continue;

    // Information needed (onboarding) → 'details' update
    if (t.information_needed?.trim()) {
      updates.push({ incident_id: incidentId, user_id: user.id, type: 'details', note: t.information_needed.trim() });
    }
    // Main content field → 'progress' update (what gets sent to the AI)
    const mainContent = t.problem_to_fix?.trim() || t.decision_to_make?.trim() || t.project_to_manage?.trim() || '';
    if (mainContent) {
      updates.push({ incident_id: incidentId, user_id: user.id, type: 'progress', note: mainContent });
    }
    if (t.results?.trim()) {
      updates.push({ incident_id: incidentId, user_id: user.id, type: 'progress', note: t.results.trim() });
    }
    for (const ic of parseIssuesComments(t.issues_comments)) {
      if (ic.text.trim()) {
        updates.push({ incident_id: incidentId, user_id: user.id, type: 'progress', note: `Issues/Comments: ${ic.text.trim()}` });
      }
    }
  }

  if (updates.length > 0) {
    const { error: updInsErr } = await supabase.from('incident_updates').insert(updates);
    if (updInsErr) return NextResponse.json({ error: updInsErr.message }, { status: 500 });
  }

  const ticketCount = incidentRows.filter(r => r.source === 'ticket').length;
  return NextResponse.json({ inserted: incidentRows.length, issues: issueCounter, tickets: ticketCount });
}

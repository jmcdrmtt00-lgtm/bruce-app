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

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function GET(request: NextRequest) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ tasks: [] });

  // Verify org membership
  const { data: membership } = await supabase
    .from('user_orgs')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .single();
  if (!membership) return NextResponse.json({ tasks: [] });

  const admin = getServiceClient();
  const { data: incidents, error: incErr } = await admin
    .from('incidents')
    .select('id, task_number, title, description, priority, date_due, status, reported_by, screen, source')
    .eq('org_id', orgId)
    .order('source')
    .order('task_number', { nullsFirst: false });

  if (incErr) return NextResponse.json({ error: incErr.message }, { status: 500 });
  if (!incidents || incidents.length === 0) return NextResponse.json({ tasks: [] });

  // Fetch all incident_updates for these incidents in one query
  const ids = incidents.map(i => i.id);
  const { data: allUpdates, error: updErr } = await admin
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

  const SCREEN_LABEL: Record<string, string> = {
    problem_to_fix:         'Problem to fix',
    decision_to_make:       'Decision to make',
    onboarding:             'Onboarding',
    offboarding:            'Offboarding',
    // legacy
    ticket_to_fix:          'Problem to fix',
    onboarding_offboarding: 'Onboarding',
    project_to_manage:      'Project to manage',
  };

  const tasks = incidents.map(inc => {
    const updates = updatesByIncident.get(inc.id) ?? [];
    const detailsUpdate  = updates.find(u => u.type === 'details');
    const progressUpdate = updates.find(u => u.type === 'progress' && !u.note.startsWith('Issues/Comments:'));

    const screen = inc.screen ?? '';
    const isOnboarding = screen === 'onboarding_offboarding' || screen === 'onboarding';

    return {
      task_number:      inc.task_number,
      task_name:        inc.title || inc.description,
      requester:        inc.reported_by ?? null,
      priority:         inc.priority,
      date_due:         inc.date_due,
      status:           inc.status,
      source:           inc.source ?? null,
      task_type:        SCREEN_LABEL[screen] ?? null,
      information_needed: isOnboarding ? (detailsUpdate?.note ?? null) : null,
      problem_to_fix:   (screen === 'problem_to_fix' || screen === 'ticket_to_fix') ? (progressUpdate?.note ?? null) : null,
      decision_to_make: screen === 'decision_to_make'  ? (progressUpdate?.note ?? null) : null,
      project_to_manage: screen === 'project_to_manage' ? (progressUpdate?.note ?? null) : null,
    };
  });

  return NextResponse.json({ tasks });
}

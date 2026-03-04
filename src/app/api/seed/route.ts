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

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}


export async function POST() {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Clear all existing tasks for this user (allows re-seeding at any time)
  await supabase.from('incidents').delete().eq('user_id', user.id);

  // ── 6 tasks — one per problem type ───────────────────────────────────────
  const tasks = [
    {
      title:    'Onboard new LPN — Holden Wing',
      screen:   'onboarding',
      status:   'in_progress',
      priority: 'high',
      date_due: daysFromNow(2),
      details:  'Information needed: First name, Last name, Role, Site, Start date, Next asset #?, Computer name, Notes',
    },
    {
      title:    'Wi-Fi dropping in morning hours — Oakdale dining room',
      screen:   'intermittent_network_slowness',
      status:   'in_progress',
      priority: 'high',
      date_due: daysFromNow(1),
      details:  'Information needed: Affected location, Wired vs Wi-Fi, Time of day issue occurs, Number of affected users, Network device(s) serving that area, Recent network changes (if any)',
    },
    {
      title:    'PCC running slow for nursing staff',
      screen:   'application_performance_degradation',
      status:   'in_progress',
      priority: null,
      date_due: null,
      details:  'Information needed: Application name + version, Server hosting the app, Number of affected users, Is issue location-specific?, Server CPU/RAM utilization snapshot, Last patch/update date, Any related error messages',
    },
    {
      title:    "Nurse can't access shared drive folder after role change",
      screen:   'access_drift_permission_sprawl',
      status:   'pending',
      priority: null,
      date_due: null,
      details:  'Information needed: User name + role, Resource name (e.g. folder, system, SharePoint site), Current group memberships, Group required for access, Remote vs onsite context, Date issue started',
    },
    {
      title:    'Activities laptop crashing multiple times per week',
      screen:   'recurring_endpoint_instability',
      status:   'pending',
      priority: 'low',
      date_due: null,
      details:  'Information needed: Device asset ID, Age and warranty status, OS version + last update, Crash frequency, Event Viewer error excerpt, Installed security tools',
    },
    {
      title:    'Backup job failing on main file server',
      screen:   'backup_reliability',
      status:   'pending',
      priority: 'high',
      date_due: daysFromNow(3),
      details:  'Information needed: Server name, Backup job name, Last successful restore test date, Current storage capacity %, Error code (if any), Retention policy settings',
    },
  ];

  const rows = tasks.map(t => ({
    user_id:        user.id,
    title:          t.title,
    description:    t.title,
    reported_by:    null,
    priority:       t.priority,
    screen:         t.screen,
    status:         t.status,
    source:         'issue',
    date_due:       t.date_due ?? null,
    auto_suggested: false,
  }));

  const { data: inserted, error } = await supabase
    .from('incidents')
    .insert(rows)
    .select('id, title');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Seed the Task details update for each task so they load pre-populated
  const updateRows = (inserted ?? []).map(inc => {
    const t = tasks.find(t => t.title === inc.title)!;
    return { incident_id: inc.id, user_id: user.id, type: 'details', note: t.details };
  });
  if (updateRows.length > 0) {
    await supabase.from('incident_updates').insert(updateRows);
  }

  return NextResponse.json({ success: true, count: rows.length });
}

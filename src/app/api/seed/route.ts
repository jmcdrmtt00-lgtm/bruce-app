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

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split('T')[0];
}

const today = daysFromNow(0);

export async function POST() {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { count } = await supabase
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: 'Tasks already exist — clear them first if you want to re-seed.' },
      { status: 400 }
    );
  }

  // ── In Progress: 3H, 2L, 5 blank ─────────────────────────────────────────
  const inProgressTasks = [
    // H (3) — with date_due; one is an onboarding task due today
    { title: 'Onboard new Activities coordinator',               priority: 'high', date_due: today,               screen: 'Onboarding', reported_by: null },
    { title: 'Replace Oak Wing Nurses Station Win 7 machines',   priority: 'high', date_due: daysFromNow(3),      screen: null,         reported_by: null },
    { title: 'Printer not printing for Catherine Pichardo',      priority: 'high', date_due: daysFromNow(1),      screen: null,         reported_by: 'Catherine Pichardo' },
    // L (2)
    { title: 'Update asset tags after recent equipment moves',   priority: 'low',  date_due: null,                screen: null,         reported_by: null },
    { title: 'Upgrade Oakdale Kitchen PC from Win 7',            priority: 'low',  date_due: null,                screen: null,         reported_by: null },
    // Blank (5)
    { title: "Set up Splashtop remote access for Tara D'Andrea", priority: null,   date_due: null,                screen: null,         reported_by: "Tara D'Andrea" },
    { title: "Replace Bob Oriol's Intel NUC (warranty expired)", priority: null,   date_due: null,                screen: null,         reported_by: 'Bob Oriol' },
    { title: "Replace Jay Kublbeck's Oakdale Maintenance PC",    priority: null,   date_due: null,                screen: null,         reported_by: 'Jay Kublbeck' },
    { title: 'Set up second ThinkCentre for Danielle Mattei',    priority: null,   date_due: null,                screen: null,         reported_by: 'Danielle Mattei' },
    { title: 'Fix broken HP LaserJet in Business Office',        priority: null,   date_due: null,                screen: null,         reported_by: null },
  ];

  // ── Queue: 3 tasks, one auto_suggested ───────────────────────────────────
  const queueTasks = [
    { title: "Replace Becky Gardner's Social Services PC",   priority: null, screen: null,         auto_suggested: false, reported_by: 'Becky Gardner' },
    { title: 'Onboard new nurse in Wachusett wing',          priority: null, screen: 'Onboarding', auto_suggested: false, reported_by: null },
    { title: 'Review and replace Oakdale network switch',    priority: null, screen: null,         auto_suggested: true,  reported_by: null },
  ];

  // ── Resolved: 10 tasks (no medium priority) ───────────────────────────────
  const resolvedTasks = [
    { title: "Replaced Beth Matson's ThinkCentre hard drive",      priority: 'high', reported_by: 'Beth Matson',       date_completed: monthsAgo(1),  withNote: null },
    { title: 'Set up workstation for Alexys Gonelli',               priority: null,   reported_by: 'Alexys Gonelli',    date_completed: monthsAgo(1),  withNote: null },
    { title: 'Fixed VPN connectivity for remote billing staff',     priority: 'high', reported_by: null,                date_completed: monthsAgo(2),  withNote: null },
    { title: 'Onboarded new Oak Wing charge nurse',                  priority: null,   reported_by: null,                date_completed: monthsAgo(2),  withNote: null },
    { title: "Replaced Catherine Pichardo's keyboard and mouse",    priority: 'low',  reported_by: 'Catherine Pichardo', date_completed: monthsAgo(1), withNote: null },
    { title: 'Installed HP LaserJet driver on Nursing Station PC',  priority: null,   reported_by: null,                date_completed: monthsAgo(4),  withNote: null },
    { title: 'Recovered deleted files for Lori Piracci HR',         priority: 'high', reported_by: 'Lori Piracci',      date_completed: monthsAgo(4),  withNote: null },
    { title: 'Set up Splashtop for Danielle Mattei home access',    priority: null,   reported_by: 'Danielle Mattei',   date_completed: monthsAgo(5),  withNote: null },
    { title: 'Cleared virus/malware from Activities laptop',        priority: 'high', reported_by: null,                date_completed: monthsAgo(6),  withNote: null },
    // 3 months ago — note triggers the auto_suggested queue task above
    { title: 'Replaced Oakdale network switch (east wing)',         priority: null,   reported_by: null,                date_completed: monthsAgo(3),
      withNote: 'Switch is running fine now. The west wing switch is getting old too — consider replacing it in about 3 months.' },
  ];

  // Insert in_progress tasks
  const inProgressRows = inProgressTasks.map(t => ({
    user_id:    user.id,
    title:      t.title,
    description: t.title,
    reported_by: t.reported_by,
    priority:   t.priority,
    screen:     t.screen,
    status:     'in_progress',
    source:     'issue',
    date_due:   t.date_due,
  }));

  // Insert queue tasks
  const queueRows = queueTasks.map(t => ({
    user_id:       user.id,
    title:         t.title,
    description:   t.title,
    reported_by:   t.reported_by,
    priority:      t.priority,
    screen:        t.screen,
    status:        'pending',
    source:        'issue',
    auto_suggested: t.auto_suggested,
  }));

  // Insert resolved tasks
  const resolvedRows = resolvedTasks.map(t => ({
    user_id:        user.id,
    title:          t.title,
    description:    t.title,
    reported_by:    t.reported_by,
    priority:       t.priority,
    screen:         null,
    status:         'resolved',
    source:         'issue',
    date_completed: t.date_completed,
  }));

  const allRows = [...inProgressRows, ...queueRows, ...resolvedRows];
  const { data: inserted, error } = await supabase
    .from('incidents')
    .insert(allRows)
    .select('id, title');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add the suggestion note to the 3-month-old resolved task
  const switchTask = inserted?.find(t => t.title === 'Replaced Oakdale network switch (east wing)');
  if (switchTask) {
    await supabase.from('incident_updates').insert({
      incident_id: switchTask.id,
      user_id:     user.id,
      type:        'resolved',
      note:        resolvedTasks.find(t => t.withNote)!.withNote,
    });
  }

  return NextResponse.json({ success: true, count: allRows.length });
}

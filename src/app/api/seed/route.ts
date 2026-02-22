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

const DEMO_TASKS = [
  // In Progress (10) — 3 with priority, 7 without
  { title: 'Replace Oak Wing Nurses Station Win 7 machines',    priority: 'high',   status: 'in_progress', reported_by: null,                 screen: null         },
  { title: 'Printer not printing for Catherine Pichardo',       priority: 'high',   status: 'in_progress', reported_by: 'Catherine Pichardo', screen: null         },
  { title: 'Fix broken HP LaserJet in Business Office',         priority: 'medium', status: 'in_progress', reported_by: null,                 screen: null         },
  { title: 'Upgrade Oakdale Kitchen PC from Win 7',             priority: null,     status: 'in_progress', reported_by: null,                 screen: null         },
  { title: "Set up Splashtop remote access for Tara D'Andrea",  priority: null,     status: 'in_progress', reported_by: "Tara D'Andrea",      screen: null         },
  { title: "Replace Bob Oriol's Intel NUC (warranty expired)",  priority: null,     status: 'in_progress', reported_by: 'Bob Oriol',          screen: null         },
  { title: 'Onboard new Activities coordinator',                priority: null,     status: 'in_progress', reported_by: null,                 screen: 'Onboarding' },
  { title: "Replace Jay Kublbeck's Oakdale Maintenance PC",     priority: null,     status: 'in_progress', reported_by: 'Jay Kublbeck',       screen: null         },
  { title: 'Set up second ThinkCentre for Danielle Mattei',     priority: null,     status: 'in_progress', reported_by: 'Danielle Mattei',    screen: null         },
  { title: 'Update asset tags after recent equipment moves',    priority: null,     status: 'in_progress', reported_by: null,                 screen: null         },
  // Queue (10) — 3 with priority, 7 without
  { title: "Replace Becky Gardner's Social Services PC",        priority: 'high',   status: 'pending', reported_by: 'Becky Gardner',    screen: null         },
  { title: 'Review network switch in Oakdale',                  priority: 'high',   status: 'pending', reported_by: null,               screen: null         },
  { title: 'Audit all Chromebooks for expired warranties',      priority: 'medium', status: 'pending', reported_by: null,               screen: null         },
  { title: "Upgrade Ildi's Activities Tower (Win 7, warranty expired 2015)", priority: null, status: 'pending', reported_by: null,       screen: null         },
  { title: "Set up new laptop for Tara D'Andrea (home use)",    priority: null,     status: 'pending', reported_by: "Tara D'Andrea",    screen: null         },
  { title: 'Onboard new nurse in Wachusett wing',               priority: null,     status: 'pending', reported_by: null,               screen: 'Onboarding' },
  { title: "Replace Nathan Oriol's ThinkCentre (no warranty on file)", priority: null, status: 'pending', reported_by: 'Nathan Oriol', screen: null         },
  { title: 'Set up iPhone for new staff member',                priority: null,     status: 'pending', reported_by: null,               screen: null         },
  { title: 'Lori Piracci HR laptop — confirm setup complete',   priority: null,     status: 'pending', reported_by: 'Lori Piracci',     screen: null         },
  { title: "Upgrade Emily Matson's ThinkCentre to Win 11",      priority: null,     status: 'pending', reported_by: 'Emily Matson',     screen: null         },
  // Resolved (10)
  { title: 'Replaced Beth Matson\'s ThinkCentre hard drive',    priority: 'high',   status: 'resolved', reported_by: 'Beth Matson',       screen: null         },
  { title: 'Set up workstation for Alexys Gonelli',             priority: 'medium', status: 'resolved', reported_by: 'Alexys Gonelli',    screen: null         },
  { title: 'Fixed VPN connectivity for remote billing staff',   priority: 'high',   status: 'resolved', reported_by: null,                screen: null         },
  { title: 'Onboarded new Oak Wing charge nurse',               priority: null,     status: 'resolved', reported_by: null,                screen: 'Onboarding' },
  { title: "Replaced Catherine Pichardo's keyboard and mouse",  priority: 'low',    status: 'resolved', reported_by: 'Catherine Pichardo', screen: null        },
  { title: 'Installed HP LaserJet driver on Nursing Station PC', priority: 'medium', status: 'resolved', reported_by: null,               screen: null         },
  { title: 'Recovered deleted files for Lori Piracci HR',       priority: 'high',   status: 'resolved', reported_by: 'Lori Piracci',      screen: null         },
  { title: 'Set up Splashtop for Danielle Mattei home access',  priority: 'medium', status: 'resolved', reported_by: 'Danielle Mattei',  screen: null         },
  { title: 'Cleared virus/malware from Activities laptop',      priority: 'high',   status: 'resolved', reported_by: null,                screen: null         },
  { title: 'Upgraded Wachusett Wing switch firmware',           priority: 'medium', status: 'resolved', reported_by: null,                screen: null         },
];

export async function POST() {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only seed if no tasks exist yet
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

  const rows = DEMO_TASKS.map(t => ({
    user_id:     user.id,
    title:       t.title,
    description: t.title,
    reported_by: t.reported_by,
    priority:    t.priority,
    screen:      t.screen,
    status:      t.status,
    source:      'issue',
  }));

  const { error } = await supabase.from('incidents').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, count: rows.length });
}

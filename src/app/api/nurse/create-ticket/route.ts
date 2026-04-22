import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Verify caller is a logged-in user
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('[nurse/create-ticket] Missing SUPABASE_SERVICE_ROLE_KEY');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const { subject, description, conversation_summary, org_id } = await request.json();
  if (!subject?.trim()) return NextResponse.json({ error: 'subject is required' }, { status: 400 });
  if (!org_id) return NextResponse.json({ error: 'org_id is required' }, { status: 400 });

  // Use service role client to bypass RLS
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );

  // Look up the IT admin's user_id for this org — prefer admin role, fall back to any member
  let orgAdmin: { user_id: string } | null = null;
  const { data: adminRow } = await adminClient
    .from('user_orgs').select('user_id').eq('org_id', org_id).eq('role', 'admin').limit(1).single();
  if (adminRow) {
    orgAdmin = adminRow;
  } else {
    const { data: memberRow } = await adminClient
      .from('user_orgs').select('user_id').eq('org_id', org_id).limit(1).single();
    orgAdmin = memberRow ?? null;
  }

  if (!orgAdmin) {
    console.error('[nurse/create-ticket] No members found for org:', org_id);
    return NextResponse.json({ error: 'Could not find IT admin for this org' }, { status: 500 });
  }

  const fullDescription = [
    description?.trim(),
    conversation_summary?.trim() ? `\n--- Q&A with staff ---\n${conversation_summary.trim()}` : null,
  ].filter(Boolean).join('\n');

  const { data: incident, error } = await adminClient
    .from('incidents')
    .insert({
      user_id:     orgAdmin.user_id,
      org_id,
      title:       subject.trim(),
      description: fullDescription,
      reported_by: user.email ?? null,
      status:      'open',
      screen:      'problem_to_fix',
      source:      'direct_ticket',
      self_fixed:  false,
    })
    .select('id, task_number')
    .single();

  if (error) {
    console.error('[nurse/create-ticket] Insert error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }


  return NextResponse.json({ task_number: incident.task_number, id: incident.id });
}

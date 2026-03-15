import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// Required env vars (add to Vercel + Railway):
//   SUPABASE_SERVICE_ROLE_KEY  — Supabase service role key (bypasses RLS)
//   IT_ADMIN_USER_ID           — UUID of the IT admin's Supabase user (Bruce)

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

  const adminUserId   = process.env.IT_ADMIN_USER_ID;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminUserId || !serviceRoleKey) {
    console.error('[nurse/create-ticket] Missing IT_ADMIN_USER_ID or SUPABASE_SERVICE_ROLE_KEY');
    return NextResponse.json({ error: 'Server not configured for ticket creation' }, { status: 500 });
  }

  const { subject, description, conversation_summary } = await request.json();
  if (!subject?.trim()) return NextResponse.json({ error: 'subject is required' }, { status: 400 });

  // Build description — include conversation Q&A context for IT
  const fullDescription = [
    description?.trim(),
    conversation_summary?.trim() ? `\n--- Q&A with staff ---\n${conversation_summary.trim()}` : null,
  ].filter(Boolean).join('\n');

  // Use service role client so we can write under the IT admin's user_id
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );

  const { data: incident, error } = await adminClient
    .from('incidents')
    .insert({
      user_id:     adminUserId,
      title:       subject.trim(),
      description: fullDescription,
      reported_by: user.email ?? null,
      status:      'pending',
      screen:      'problem_to_fix',
      source:      'nurse',
    })
    .select('id, task_number')
    .single();

  if (error) {
    console.error('[nurse/create-ticket] Insert error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task_number: incident.task_number, id: incident.id });
}

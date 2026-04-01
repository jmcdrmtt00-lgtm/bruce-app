import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getServiceClient();
  const { data: incident, error } = await admin
    .from('incidents')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !incident) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Verify user is authorized: org membership or direct ownership
  if (incident.org_id) {
    const { data: membership } = await supabase
      .from('user_orgs')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('org_id', incident.org_id)
      .single();
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } else if (incident.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: updates } = await admin
    .from('incident_updates')
    .select('*')
    .eq('incident_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ incident, updates: updates ?? [] });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify the user is authorized to delete this incident (org membership check)
  const admin = getServiceClient();
  const { data: incident } = await admin
    .from('incidents')
    .select('id, org_id, user_id')
    .eq('id', id)
    .single();

  if (!incident) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (incident.org_id) {
    const { data: membership } = await supabase
      .from('user_orgs')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('org_id', incident.org_id)
      .single();
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } else if (incident.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete child updates first to satisfy foreign key constraints
  await admin.from('incident_updates').delete().eq('incident_id', id);

  const { error } = await admin
    .from('incidents')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify the user is authorized to edit this incident (org membership check)
  const admin = getServiceClient();
  const { data: incident } = await admin
    .from('incidents')
    .select('id, org_id, user_id')
    .eq('id', id)
    .single();

  if (!incident) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (incident.org_id) {
    const { data: membership } = await supabase
      .from('user_orgs')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('org_id', incident.org_id)
      .single();
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } else if (incident.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status !== undefined)      updates.status      = body.status;
  if (body.priority !== undefined)    updates.priority    = body.priority    || null;
  if (body.screen !== undefined)      updates.screen      = body.screen      || null;
  if (body.title !== undefined)       updates.title       = body.title       || null;
  if (body.reported_by !== undefined) updates.reported_by = body.reported_by || null;
  if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to || null;
  if (body.date_due !== undefined)    updates.date_due    = body.date_due    || null;
  if (body.status === 'resolved')     updates.date_completed = new Date().toISOString().split('T')[0];

  const { error } = await admin
    .from('incidents')
    .update(updates)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

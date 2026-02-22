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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: incident, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: updates } = await supabase
    .from('incident_updates')
    .select('*')
    .eq('incident_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ incident, updates: updates ?? [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status !== undefined)      updates.status      = body.status;
  if (body.priority !== undefined)    updates.priority    = body.priority    || null;
  if (body.screen !== undefined)      updates.screen      = body.screen      || null;
  if (body.title !== undefined)       updates.title       = body.title       || null;
  if (body.reported_by !== undefined) updates.reported_by = body.reported_by || null;

  const { error } = await supabase
    .from('incidents')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

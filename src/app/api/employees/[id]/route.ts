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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'org required' }, { status: 400 });

  const { id } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = {};
  if (body.email !== undefined) update.email = body.email.trim().toLowerCase();
  if (body.first_name !== undefined) update.first_name = body.first_name.trim();
  if (body.last_name !== undefined) update.last_name = body.last_name.trim();
  if (body.ee_number !== undefined) update.ee_number = body.ee_number?.trim() || null;
  if (body.site !== undefined) update.site = body.site.trim();
  if (body.position !== undefined) update.position = body.position?.trim() || null;
  if (body.hours_per_week !== undefined) {
    update.hours_per_week = body.hours_per_week !== '' && body.hours_per_week != null ? Number(body.hours_per_week) : null;
  }
  if (body.shift !== undefined) update.shift = body.shift?.trim() || null;
  if (body.is_approved_submitter !== undefined) {
    update.is_approved_submitter = body.is_approved_submitter === true || body.is_approved_submitter === 'true';
  }

  const { data, error } = await supabase
    .from('employees')
    .update(update)
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id, email, first_name, last_name, ee_number, site, position, hours_per_week, shift, is_approved_submitter')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employee: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'org required' }, { status: 400 });

  const { id } = await params;
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

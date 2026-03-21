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

export async function GET() {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('employees')
    .select('id, email, first_name, last_name, ee_number, site, position, hours_per_week, shift, is_approved_submitter')
    .order('last_name')
    .order('first_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employees: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { email, first_name, last_name, site } = body;
  if (!email?.trim() || !first_name?.trim() || !last_name?.trim() || !site?.trim()) {
    return NextResponse.json({ error: 'email, first_name, last_name, and site are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('employees')
    .insert({
      email: email.trim().toLowerCase(),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      ee_number: body.ee_number?.trim() || null,
      site: site.trim(),
      position: body.position?.trim() || null,
      hours_per_week: body.hours_per_week !== '' && body.hours_per_week != null ? Number(body.hours_per_week) : null,
      shift: body.shift?.trim() || null,
      is_approved_submitter: body.is_approved_submitter === true || body.is_approved_submitter === 'true',
    })
    .select('id, email, first_name, last_name, ee_number, site, position, hours_per_week, shift, is_approved_submitter')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employee: data });
}

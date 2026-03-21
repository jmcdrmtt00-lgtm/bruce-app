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
    .from('nurse_profiles')
    .select('id, email, full_name, site, default_priority')
    .order('email');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profiles: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, full_name, site, default_priority } = await request.json();
  if (!email?.trim() || !full_name?.trim() || !site?.trim()) {
    return NextResponse.json({ error: 'email, full_name, and site are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('nurse_profiles')
    .insert({
      email: email.trim().toLowerCase(),
      full_name: full_name.trim(),
      site: site.trim(),
      default_priority: default_priority ?? '',
    })
    .select('id, email, full_name, site, default_priority')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

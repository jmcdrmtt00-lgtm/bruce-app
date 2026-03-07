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

export async function GET(request: NextRequest) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const site     = request.nextUrl.searchParams.get('site');
  const category = request.nextUrl.searchParams.get('category') ?? 'Computer';

  let query = supabase
    .from('assets')
    .select('id, asset_number, name, make, model, os, ram, site')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('category', category)
    .is('assigned_to', null);

  if (site) query = query.eq('site', site);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ assets: data ?? [] });
}

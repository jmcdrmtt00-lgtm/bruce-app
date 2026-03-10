import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const site     = searchParams.get('site')     || '';
  const category = searchParams.get('category') || '';
  if (!site || !category) return NextResponse.json({ assets: [] });

  const { data, error } = await supabase
    .from('assets')
    .select('id, asset_number, name, make, model, os, ram, site, assigned_to')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('site', site)
    .eq('category', category);

  if (error || !data) return NextResponse.json({ assets: [] });
  return NextResponse.json({ assets: data });
}

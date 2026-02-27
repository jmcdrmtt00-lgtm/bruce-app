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

  const assetNumber = request.nextUrl.searchParams.get('asset_number');
  if (!assetNumber) return NextResponse.json({ error: 'asset_number required' }, { status: 400 });

  const { data: asset } = await supabase
    .from('assets')
    .select('asset_number, assigned_to, name, site, notes, make, model, category')
    .eq('asset_number', assetNumber)
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({ asset: asset ?? null });
}

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

export async function POST(request: NextRequest) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { assets } = await request.json();
  if (!Array.isArray(assets) || assets.length === 0) {
    return NextResponse.json({ error: 'No assets provided' }, { status: 400 });
  }

  // Fetch existing serial numbers for this user to avoid duplicates
  const { data: existing } = await supabase
    .from('assets')
    .select('serial_number')
    .eq('user_id', user.id)
    .not('serial_number', 'is', null);

  const existingSerials = new Set((existing ?? []).map((r: { serial_number: string }) => r.serial_number));

  // Split into new (insert) vs duplicate (skip)
  const toInsert = [];
  let skipped = 0;

  for (const asset of assets) {
    if (asset.serial_number && existingSerials.has(asset.serial_number)) {
      skipped++;
    } else {
      toInsert.push({ ...asset, user_id: user.id });
    }
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0, skipped });
  }

  const { error } = await supabase.from('assets').insert(toInsert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: toInsert.length, skipped });
}

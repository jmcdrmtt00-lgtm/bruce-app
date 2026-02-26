import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

async function getClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

const DATE_FIELDS = ['purchased', 'install_date', 'warranty_expires'];

function cleanDates(asset: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...asset };
  for (const field of DATE_FIELDS) {
    const v = cleaned[field];
    if (typeof v === 'string' && (v.startsWith('+') || v.startsWith('-'))) {
      cleaned[field] = null;
    }
  }
  return cleaned;
}

export async function POST(request: NextRequest) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { assets } = await request.json();
  if (!Array.isArray(assets) || assets.length === 0) {
    return NextResponse.json({ error: 'No assets provided' }, { status: 400 });
  }

  // Fetch existing assets that have serial numbers so we can match them for updates
  const { data: existing } = await supabase
    .from('assets')
    .select('id, serial_number')
    .eq('user_id', user.id)
    .not('serial_number', 'is', null);

  const serialToId = new Map<string, string>(
    (existing ?? []).map((r: { id: string; serial_number: string }) => [r.serial_number, r.id])
  );

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: Record<string, unknown>[] = [];

  for (const asset of assets) {
    const cleaned = cleanDates({ ...asset, user_id: user.id });
    if (asset.serial_number && serialToId.has(asset.serial_number)) {
      // Existing record — carry its id so upsert knows which row to overwrite
      toUpdate.push({ ...cleaned, id: serialToId.get(asset.serial_number) });
    } else {
      toInsert.push(cleaned);
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('assets').insert(toInsert);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (toUpdate.length > 0) {
    const { error } = await supabase.from('assets').upsert(toUpdate, { onConflict: 'id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Track the upload in Headlights (fire-and-forget)
  if (user.email) {
    fetch(`${BACKEND_URL}/api/track-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: user.email }),
    }).catch(() => {});
  }

  return NextResponse.json({ inserted: toInsert.length, updated: toUpdate.length });
}

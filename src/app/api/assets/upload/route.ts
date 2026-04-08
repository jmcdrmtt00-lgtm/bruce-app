import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

async function getUserClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

// Service role client — bypasses RLS for reads, so we see all org assets
// regardless of which user originally uploaded them.
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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
  const supabase = await getUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'org required' }, { status: 400 });

  const { assets, replace } = await request.json();
  if (!Array.isArray(assets) || assets.length === 0) {
    return NextResponse.json({ error: 'No assets provided' }, { status: 400 });
  }

  const admin = getAdminClient();

  // Replace mode: delete all existing assets for this org in the categories
  // being uploaded before inserting fresh data.
  if (replace) {
    const categories = [...new Set(assets.map((a: Record<string, unknown>) => a.category).filter(Boolean))] as string[];
    if (categories.length > 0) {
      const { error: delError } = await admin
        .from('assets')
        .delete()
        .eq('org_id', orgId)
        .in('category', categories);
      if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    // After deletion, just insert everything fresh
    const toInsert = assets.map((asset: Record<string, unknown>) =>
      cleanDates({ ...asset, user_id: user.id, org_id: orgId })
    );
    const { error } = await admin.from('assets').insert(toInsert);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    trackUpload(user.email ?? '', toInsert.length);
    return NextResponse.json({ inserted: toInsert.length, updated: 0, replaced: true });
  }

  // Normal mode: use admin client to fetch ALL existing serials for this org,
  // bypassing RLS so we see every row regardless of who uploaded it.
  const { data: existing } = await admin
    .from('assets')
    .select('id, serial_number')
    .eq('org_id', orgId)
    .not('serial_number', 'is', null);

  const serialToId = new Map<string, string>(
    (existing ?? []).map((r: { id: string; serial_number: string }) => [r.serial_number, r.id])
  );

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: Record<string, unknown>[] = [];

  for (const asset of assets) {
    const cleaned = cleanDates({ ...asset, user_id: user.id, org_id: orgId });
    if (asset.serial_number && serialToId.has(asset.serial_number)) {
      toUpdate.push({ ...cleaned, id: serialToId.get(asset.serial_number) });
    } else {
      toInsert.push(cleaned);
    }
  }

  if (toInsert.length > 0) {
    const { error } = await admin.from('assets').insert(toInsert);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (toUpdate.length > 0) {
    const dedupedUpdate = Array.from(
      new Map(toUpdate.map(r => [r.id as string, r])).values()
    );
    const { error } = await admin.from('assets').upsert(dedupedUpdate, { onConflict: 'id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  trackUpload(user.email ?? '', toInsert.length);
  return NextResponse.json({ inserted: toInsert.length, updated: toUpdate.length });
}

function trackUpload(email: string, count: number) {
  if (!email) return;
  fetch(`${BACKEND_URL}/api/track-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_email: email, count }),
  }).catch(() => {});
}

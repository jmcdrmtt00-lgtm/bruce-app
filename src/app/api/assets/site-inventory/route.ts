import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

async function getAnonClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  const supabase = await getAnonClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ assets: [] });

  // Verify user belongs to this org
  const { data: membership } = await supabase
    .from('user_orgs')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .single();
  if (!membership) return NextResponse.json({ assets: [] });

  const { searchParams } = new URL(request.url);
  const site     = searchParams.get('site')     || '';
  const category = searchParams.get('category') || '';
  if (!site || !category) return NextResponse.json({ assets: [] });

  const admin = getServiceClient();
  // Use ilike for site (handles 'Oakdale' and 'Oakdale (ORSNC)' etc.)
  // No status filter — unassigned retired computers are still available to assign
  // Allow null category — older records may not have it set
  const { data, error } = await admin
    .from('assets')
    .select('id, asset_number, name, make, model, os, ram, site, assigned_to')
    .eq('org_id', orgId)
    .ilike('site', `%${site}%`)
    .or(`category.eq.${category},category.is.null`);

  if (error || !data) return NextResponse.json({ assets: [] });
  return NextResponse.json({ assets: data });
}

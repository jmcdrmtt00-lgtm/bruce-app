import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ROLES } from '@/data/roles';
import { SITES } from '@/data/sites';

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

  const { hire } = await request.json();
  const { firstName, lastName, role, site, startDate, nextAssetNumber, computerName } = hire;

  if (!nextAssetNumber) {
    return NextResponse.json({ error: 'No asset number provided' }, { status: 400 });
  }

  const roleLabel  = ROLES[role as keyof typeof ROLES]?.label  ?? role;
  const siteLabel  = SITES[site as keyof typeof SITES]?.label  ?? site;
  const assignNote = `Assigned to ${firstName} ${lastName} (${roleLabel}) — Start date: ${startDate || 'TBD'}`;

  // Fetch existing asset to preserve any existing notes
  const { data: existing } = await supabase
    .from('assets')
    .select('id, notes')
    .eq('asset_number', nextAssetNumber)
    .eq('user_id', user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: `Asset #${nextAssetNumber} not found` }, { status: 404 });
  }

  const updatedNotes = existing.notes
    ? `${existing.notes}\n${assignNote}`
    : assignNote;

  const { error } = await supabase
    .from('assets')
    .update({ assigned_to: `${firstName} ${lastName}`, name: computerName, site: siteLabel, notes: updatedNotes })
    .eq('id', existing.id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

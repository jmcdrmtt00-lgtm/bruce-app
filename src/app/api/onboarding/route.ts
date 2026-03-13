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

  const { hire, loginId, systems, computerType } = await request.json();

  // Save onboarding session
  const { data: session, error } = await supabase
    .from('onboarding_sessions')
    .insert({
      user_id: user.id,
      first_name: hire.firstName,
      last_name: hire.lastName,
      role: hire.role,
      site: hire.site,
      start_date: hire.startDate || null,
      next_asset_number: hire.nextAssetNumber,
      computer_name: hire.computerName,
      notes: hire.notes,
      login_id: loginId,
      systems,
      computer_type: computerType,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: session.id });
}

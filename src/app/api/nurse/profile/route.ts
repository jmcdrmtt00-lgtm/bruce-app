import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email  = request.nextUrl.searchParams.get('email');
  const orgId  = request.nextUrl.searchParams.get('org_id');
  if (!email?.trim()) return NextResponse.json({ error: 'email required' }, { status: 400 });

  let query = supabase
    .from('employees')
    .select('first_name, last_name, site')
    .eq('email', email.trim().toLowerCase());

  if (orgId) query = query.eq('org_id', orgId);

  const { data, error } = await query.single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    full_name: `${data.first_name} ${data.last_name}`.trim(),
    site: data.site,
    default_priority: '',
  });
}

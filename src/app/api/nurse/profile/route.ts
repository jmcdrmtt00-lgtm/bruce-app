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

  const email = request.nextUrl.searchParams.get('email');
  if (!email?.trim()) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const { data, error } = await supabase
    .from('employees')
    .select('first_name, last_name, site')
    .eq('email', email.trim().toLowerCase())
    .eq('is_approved_submitter', true)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    full_name: `${data.first_name} ${data.last_name}`.trim(),
    site: data.site,
    default_priority: '',
  });
}

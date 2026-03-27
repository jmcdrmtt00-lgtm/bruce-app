import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ orgs: [] });

  const { data, error } = await supabase
    .from('user_orgs')
    .select('is_default, orgs(id, name, slug)')
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ orgs: [] });
  const orgs = (data ?? [])
    .map((row: { is_default: boolean; orgs: { id: string; name: string; slug: string } | null }) => ({
      ...(row.orgs ?? {}),
      is_default: row.is_default ?? false,
    }))
    .filter((o: { id?: string }) => o.id)
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
  return NextResponse.json({ orgs });
}

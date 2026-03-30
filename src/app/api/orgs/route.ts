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
    .map((row: { is_default: boolean; orgs: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null }) => {
      const org = Array.isArray(row.orgs) ? row.orgs[0] : row.orgs;
      if (!org) return null;
      return { id: org.id, name: org.name, slug: org.slug, is_default: row.is_default ?? false };
    })
    .filter((o): o is { id: string; name: string; slug: string; is_default: boolean } => o !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ orgs });
}

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

export async function GET() {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ incidents: data });
}

export async function POST(request: NextRequest) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { description, reported_by } = await request.json();

  // Ask Python backend to generate a short title — non-blocking, falls back to null
  let title: string | null = null;
  try {
    const backendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
    const res = await fetch(`${backendUrl}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });
    if (res.ok) {
      const json = await res.json();
      title = json.title ?? null;
    }
  } catch {
    // Backend not running locally — title stays null, no problem
  }

  const { data, error } = await supabase
    .from('incidents')
    .insert({
      user_id: user.id,
      title,
      description,
      reported_by: reported_by || null,
      status: 'open',
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

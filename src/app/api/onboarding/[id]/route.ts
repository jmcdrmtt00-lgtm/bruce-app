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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { status } = await request.json();

  const { error } = await supabase
    .from('onboarding_sessions')
    .update({
      status,
      completed_at: status === 'complete' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // When checklist is complete, resolve the linked incident
  if (status === 'complete') {
    await supabase
      .from('incidents')
      .update({ status: 'resolved', updated_at: new Date().toISOString() })
      .eq('onboarding_session_id', id)
      .eq('user_id', user.id);
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { trackEvents } from '@/libs/trackEvent';

export async function POST(request: NextRequest) {
  try {
    const { event_type } = await request.json();
    if (event_type !== 'session' && event_type !== 'click') {
      return NextResponse.json({ ok: true });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ ok: true });

    await trackEvents([{
      app_id: 'bruce',
      email: user.email,
      event_type,
      count: 1,
      input_tokens: 0,
      output_tokens: 0,
    }]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

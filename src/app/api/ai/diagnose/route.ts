import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

// Which asset categories are relevant for each problem type
const PROBLEM_TYPE_ASSET_CATEGORIES: Record<string, string[] | null> = {
  intermittent_network_slowness:      ['Network'],
  recurring_endpoint_instability:     ['Computer'],
  application_performance_degradation: ['Computer', 'Network'],
  access_drift_permission_sprawl:     null, // null = all categories
  backup_reliability:                 ['Computer', 'Network'],
  onboarding:                         ['Computer'],
};

type SupabaseClient = ReturnType<typeof createServerClient>;

async function fetchInventoryContext(
  supabase: SupabaseClient,
  userId: string,
  problemType: string,
): Promise<string> {
  const categories = PROBLEM_TYPE_ASSET_CATEGORIES[problemType];
  if (categories === undefined) return ''; // unknown problem type

  let query = supabase
    .from('assets')
    .select('asset_number, category, assigned_to, name, site, make, model, os, serial_number, status, warranty_expires, notes')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('category')
    .order('assigned_to')
    .limit(60);

  if (categories !== null && categories.length > 0) {
    query = query.in('category', categories);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) return '';

  const lines = (data as Record<string, string | null>[]).map(a => {
    const parts = [
      a.asset_number  ? `#${a.asset_number}`                        : null,
      a.category,
      a.make && a.model ? `${a.make} ${a.model}` : (a.make ?? a.model ?? null),
      a.name          ?? null,
      a.assigned_to   ? `assigned_to:${a.assigned_to}`              : 'unassigned',
      a.site          ? `site:${a.site}`                            : null,
      a.os            ? `os:${a.os}`                                : null,
      a.serial_number ? `sn:${a.serial_number}`                     : null,
      a.warranty_expires ? `warranty_exp:${a.warranty_expires}`     : null,
      a.notes         ?? null,
    ].filter(Boolean);
    return parts.join(' | ');
  });

  return `Relevant inventory (${data.length} active records):\n${lines.join('\n')}`;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  // Fetch inventory relevant to the problem type — only on first pass (no conversation yet)
  const isFirstPass = !body.conversation || body.conversation.length === 0;
  const inventoryContext = (isFirstPass && body.problem_type)
    ? await fetchInventoryContext(supabase, user.id, body.problem_type)
    : '';

  const response = await fetch(`${PYTHON_BACKEND_URL}/api/diagnose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      user_email: user.email ?? '',
      inventory_context: inventoryContext || null,
    }),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

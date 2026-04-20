import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SCHEMA = `
Table: assets
Columns:
  id               UUID
  user_id          UUID        -- automatically filtered by RLS; never include in WHERE
  category         TEXT        -- 'Computer', 'iPad', 'Phone', 'Network', 'Camera', 'Printer', 'Other'
  assigned_to      TEXT        -- person name or desk label the asset is assigned to
  site             TEXT        -- 'Holden', 'Oakdale', 'Business Office', 'IT Office', 'Shared'
  status           TEXT        -- 'active' or 'retired'
  make             TEXT        -- brand name (e.g. HP, Lenovo, Apple, Polycom)
  model            TEXT        -- model name or machine type
  serial_number    TEXT
  asset_number     TEXT
  os               TEXT        -- operating system (computers/tablets)
  ram              TEXT        -- RAM size (computers)
  purchased        DATE
  price            NUMERIC
  install_date     DATE
  warranty_expires DATE
  notes            TEXT
  extra            JSONB       -- flexible extra fields; query with extra->>'field_name'
  created_at       TIMESTAMPTZ

Notes:
- Row-level security is already applied — only the current user's rows are visible; do NOT add a user_id filter
- Use ILIKE for text searches so they are case-insensitive
- Always SELECT only the columns needed to answer the question
- Default to status = 'active' unless the user asks about retired assets
`.trim();

async function generateSql(question: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `You are a SQL generator for a PostgreSQL database. Given the schema below and a natural-language question, return ONLY a valid SELECT statement — no explanation, no markdown, no semicolon at the end.

${SCHEMA}

Question: ${question}`,
    }],
  });
  const raw = (msg.content[0] as { type: string; text: string }).text.trim();
  // Strip any accidental markdown fences
  return raw.replace(/^```(?:sql)?\s*/i, '').replace(/\s*```$/, '').replace(/;+$/, '').trim();
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

  const { question } = await request.json();
  if (!question?.trim()) return NextResponse.json({ error: 'Question required' }, { status: 400 });

  let generatedSql: string;
  try {
    generatedSql = await generateSql(question.trim());
  } catch (e) {
    console.error('[query/assets] SQL generation error:', e);
    return NextResponse.json({ error: 'AI query failed — please try again.' }, { status: 500 });
  }

  const safeSql = generatedSql.replace(/\{user_id\}/g, user.id).replace(/;+$/, '');

  const { data, error } = await supabase.rpc('execute_select_query', {
    query_sql: safeSql,
  });

  if (error) return NextResponse.json({ error: error.message, sql: generatedSql }, { status: 500 });

  const rows = Array.isArray(data) ? data : (data ? [data] : []);
  return NextResponse.json({ results: rows, sql: generatedSql });
}

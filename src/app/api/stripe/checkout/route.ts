// Stripe checkout — placeholder for future billing features
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Stripe not yet configured' }, { status: 501 });
}

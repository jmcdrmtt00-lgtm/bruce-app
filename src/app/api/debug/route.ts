import { NextResponse } from 'next/server';

export async function GET() {
  const backendUrl = process.env.PYTHON_BACKEND_URL || 'NOT SET';
  let railwayReachable = false;
  let railwayResponse = '';

  if (backendUrl !== 'NOT SET') {
    try {
      const res = await fetch(`${backendUrl}/health`);
      railwayReachable = res.ok;
      railwayResponse = await res.text();
    } catch (e) {
      railwayResponse = String(e);
    }
  }

  return NextResponse.json({
    PYTHON_BACKEND_URL: backendUrl,
    railwayReachable,
    railwayResponse,
  });
}

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const SESSION_KEY = 'itbuddy_session_date';

async function fire(type: 'session' | 'click') {
  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: type }),
    });
  } catch {}
}

export default function TrackingProvider() {
  const pathname = usePathname();
  const mounted = useRef(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(SESSION_KEY) !== today) {
      localStorage.setItem(SESSION_KEY, today);
      fire('session');
    }
  }, []);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    fire('click');
  }, [pathname]);

  return null;
}

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const SESSION_KEY = 'itbuddy_session_date';

async function fire(type: 'session' | 'click', count = 1) {
  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: type, count }),
    });
  } catch {}
}

export default function TrackingProvider() {
  const pathname = usePathname();
  const mounted = useRef(false);
  const clickBuffer = useRef(0);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session: once per calendar day
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(SESSION_KEY) !== today) {
      localStorage.setItem(SESSION_KEY, today);
      fire('session');
    }
  }, []);

  // Click counter: batch clicks and flush after 1s of inactivity
  useEffect(() => {
    function handleClick() {
      clickBuffer.current += 1;
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        if (clickBuffer.current > 0) {
          fire('click', clickBuffer.current);
          clickBuffer.current = 0;
        }
      }, 1000);
    }

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, []);

  // Route change: also counts as a click
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    clickBuffer.current += 1;
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      if (clickBuffer.current > 0) {
        fire('click', clickBuffer.current);
        clickBuffer.current = 0;
      }
    }, 1000);
  }, [pathname]);

  return null;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User | null;
}

export default function UserMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  if (!user) {
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Link href="/auth/login" style={{
          padding: '5px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
          background: 'transparent', color: '#4a5568', border: '1px solid #d1d5db',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
        }}>Sign In</Link>
        <Link href="/auth/signup" style={{
          padding: '5px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
          background: '#4f8ef7', color: '#ffffff', border: 'none',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
        }}>Sign Up</Link>
      </div>
    );
  }

  const initial = user.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: '#4f8ef7', color: '#ffffff', border: 'none',
          cursor: 'pointer', fontSize: '14px', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'DM Sans', sans-serif",
        }}
        aria-label="User menu"
      >
        {initial}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          background: '#ffffff', border: '1px solid #e5e7eb',
          borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          minWidth: '200px', zIndex: 50, overflow: 'hidden',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          <div style={{
            padding: '10px 14px', fontSize: '12px', color: '#6b7280',
            borderBottom: '1px solid #f3f4f6', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {user.email}
          </div>
          <Link
            href="/auth/logout"
            onClick={() => setOpen(false)}
            style={{
              display: 'block', padding: '10px 14px', fontSize: '13px',
              color: '#1a1a2e', textDecoration: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Sign Out
          </Link>
        </div>
      )}
    </div>
  );
}

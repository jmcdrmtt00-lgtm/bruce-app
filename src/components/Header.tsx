'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MonitorCheck } from 'lucide-react';
import UserMenu from '@/components/UserMenu';
import { supabase } from '@/libs/supabase';
import { useDemoUser } from '@/libs/useDemoUser';
import { useAdminUser } from '@/libs/useAdminUser';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

const NAV = [
  { href: '/',                   label: 'Dashboard'        },
  { href: '/tickets',            label: 'Tickets'          },
  { href: '/inventory',          label: 'Inventory'        },
  { href: '/task-intelligence',  label: 'Task Intelligence'},
  { href: '/submit-ticket',      label: 'Submit Ticket'    },
];

// DemoITbuddy1 only
const DEMO_NAV = [
  { href: '/demo', label: 'Demo' },
];

// jmcdrmtt00 only
const ADMIN_NAV: { href: string; label: string }[] = [];

// Auth pages are public — hide the nav on these routes
const AUTH_PATHS = ['/auth/'];

const navBtn: React.CSSProperties = {
  padding: '5px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
  fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', border: 'none',
  transition: 'background 0.12s',
  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
};

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const isDemoUser = useDemoUser();
  const isAdminUser = useAdminUser();
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  const showNav = !AUTH_PATHS.some(p => pathname.startsWith(p));

  return (
    <header style={{
      background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)',
      padding: '0 16px', display: 'flex', alignItems: 'center',
      height: '52px', fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <MonitorCheck style={{ width: '20px', height: '20px', color: '#4f8ef7', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '15px', color: '#1a1a2e' }}>IT Buddy</span>
      </div>

      {/* Nav links */}
      {showNav && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '12px' }}>
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={isActive(href)
                ? { ...navBtn, background: '#4f8ef7', color: '#ffffff' }
                : { ...navBtn, background: 'transparent', color: '#4a5568' }}
            >
              {label}
            </Link>
          ))}

          {isDemoUser && DEMO_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={isActive(href)
                ? { ...navBtn, background: '#7c3aed', color: '#ffffff' }
                : { ...navBtn, background: 'transparent', color: '#7c3aed' }}
            >
              {label}
            </Link>
          ))}

          {isAdminUser && ADMIN_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={isActive(href)
                ? { ...navBtn, background: '#7c3aed', color: '#ffffff' }
                : { ...navBtn, background: 'transparent', color: '#7c3aed' }}
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      <UserMenu user={user} />
    </header>
  );
}

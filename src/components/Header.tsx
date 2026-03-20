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
  { href: '/ask-ai',             label: 'Inventory'        },
  { href: '/task-intelligence',  label: 'Task Intelligence'},
  { href: '/maybe-by-myself',    label: 'Submit Ticket'    },
];

// DemoITbuddy1 only
const DEMO_NAV = [
  { href: '/demo', label: 'Demo' },
];

// jmcdrmtt00 only
const ADMIN_NAV: { href: string; label: string }[] = [];

// Auth pages are public — hide the nav on these routes
const AUTH_PATHS = ['/auth/'];

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

  // Show nav on all protected pages immediately — middleware already blocks
  // unauthenticated access, so we don't need to wait for the async user check.
  const showNav = !AUTH_PATHS.some(p => pathname.startsWith(p));

  return (
    <header className="navbar bg-base-100 shadow-sm px-4">
      <div className="flex-1 flex items-center gap-2">
        <MonitorCheck className="w-6 h-6 text-primary" />
        <span className="font-bold text-lg">IT Buddy</span>
      </div>
      {showNav && (
        <div className="flex-none flex items-center gap-1 mr-2">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`btn btn-sm ${isActive(href) ? '' : 'btn-ghost'}`}
              style={isActive(href) ? { background: '#4f8ef7', color: '#ffffff', border: 'none' } : {}}
            >
              {label}
            </Link>
          ))}
          {isDemoUser && DEMO_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`btn btn-sm ${isActive(href) ? 'btn-secondary' : 'btn-ghost text-secondary'}`}
            >
              {label}
            </Link>
          ))}
          {isAdminUser && ADMIN_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`btn btn-sm ${isActive(href) ? 'btn-secondary' : 'btn-ghost text-secondary'}`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
      <div className="flex-none">
        <UserMenu user={user} />
      </div>
    </header>
  );
}

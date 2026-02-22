'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MonitorCheck } from 'lucide-react';
import UserMenu from '@/components/UserMenu';
import { supabase } from '@/libs/supabase';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

const NAV = [
  { href: '/',            label: 'Dashboard'   },
  { href: '/onboarding',  label: 'Onboarding'  },
  { href: '/issues',      label: 'Tasks'       },
  { href: '/history',     label: 'History'     },
];

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
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

  return (
    <header className="navbar bg-base-100 shadow-sm px-4">
      <div className="flex-1 flex items-center gap-2">
        <MonitorCheck className="w-6 h-6 text-primary" />
        <span className="font-bold text-lg">IT Buddy</span>
      </div>
      {user && (
        <div className="flex-none flex items-center gap-1 mr-2">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`btn btn-sm ${isActive(href) ? 'btn-primary' : 'btn-ghost'}`}
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

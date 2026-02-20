'use client';

import { useEffect, useState } from 'react';
import { MonitorCheck } from 'lucide-react';
import UserMenu from '@/components/UserMenu';
import { createClient } from '@/libs/supabase';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

export default function Header() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="navbar bg-base-100 shadow-sm px-4">
      <div className="flex-1 flex items-center gap-2">
        <MonitorCheck className="w-6 h-6 text-primary" />
        <span className="font-bold text-lg">Bruce IT</span>
      </div>
      <div className="flex-none">
        <UserMenu user={user} />
      </div>
    </header>
  );
}

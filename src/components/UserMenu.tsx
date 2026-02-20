'use client';

import Link from 'next/link';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User | null;
}

export default function UserMenu({ user }: Props) {
  if (!user) {
    return (
      <div className="flex gap-2">
        <Link href="/auth/login" className="btn btn-ghost btn-sm">Sign In</Link>
        <Link href="/auth/signup" className="btn btn-primary btn-sm">Sign Up</Link>
      </div>
    );
  }

  const initial = user.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar placeholder">
        <div className="bg-primary text-primary-content rounded-full w-9">
          <span className="text-sm font-bold">{initial}</span>
        </div>
      </div>
      <ul tabIndex={0} className="menu menu-sm dropdown-content bg-base-100 rounded-box z-50 mt-3 w-52 p-2 shadow">
        <li className="menu-title px-2 py-1 text-xs text-base-content/60 truncate">{user.email}</li>
        <li><Link href="/auth/logout">Sign Out</Link></li>
      </ul>
    </div>
  );
}

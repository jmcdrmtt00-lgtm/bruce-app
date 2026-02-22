'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/libs/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const redirectTo = searchParams.get('redirect') || '/';

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(() => {
        router.push(redirectTo);
      });
    } else {
      supabase.auth.getSession().then(({ data: { session } }: { data: { session: import('@supabase/supabase-js').Session | null } }) => {
        router.push(session ? redirectTo : '/auth/login');
      });
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center">
      <span className="loading loading-spinner loading-lg" />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/libs/supabase';

/**
 * Returns true when the logged-in user has is_demo: true in their Supabase user_metadata.
 * Set this flag via SQL:
 *   update auth.users
 *   set raw_user_meta_data = raw_user_meta_data || '{"is_demo": true}'::jsonb
 *   where email = 'your-demo-email';
 */
export function useDemoUser(): boolean {
  const [isDemoUser, setIsDemoUser] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsDemoUser(data.user?.user_metadata?.is_demo === true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsDemoUser(session?.user?.user_metadata?.is_demo === true);
    });
    return () => subscription.unsubscribe();
  }, []);

  return isDemoUser;
}

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/libs/supabase';

/**
 * Returns true when the logged-in user has is_admin: true in their Supabase user_metadata.
 * Set this flag via SQL:
 *   update auth.users
 *   set raw_user_meta_data = raw_user_meta_data || '{"is_admin": true}'::jsonb
 *   where email = 'jmcdrmtt00@gmail.com';
 */
export function useAdminUser(): boolean {
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAdminUser(data.user?.user_metadata?.is_admin === true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAdminUser(session?.user?.user_metadata?.is_admin === true);
    });
    return () => subscription.unsubscribe();
  }, []);

  return isAdminUser;
}

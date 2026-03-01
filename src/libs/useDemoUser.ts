'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/libs/supabase';

/**
 * Returns true only when the logged-in user's email matches NEXT_PUBLIC_DEMO_EMAIL.
 * All demo-only features (DemoController, /demo, /tasks, /task-management) check this.
 */
export function useDemoUser(): boolean {
  const [isDemoUser, setIsDemoUser] = useState(false);
  const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL;

  useEffect(() => {
    if (!demoEmail) return;
    supabase.auth.getUser().then(({ data }) => {
      setIsDemoUser(data.user?.email === demoEmail);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsDemoUser(session?.user?.email === demoEmail);
    });
    return () => subscription.unsubscribe();
  }, [demoEmail]);

  return isDemoUser;
}

'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/libs/supabase';

export interface Org {
  id: string;
  name: string;
  slug: string;
}

interface OrgContextValue {
  orgs: Org[];
  activeOrg: Org | null;
  activeOrgId: string | null;
  switchOrg: (orgId: string) => void;
  /** Wrapper around fetch() that injects the X-Org-Id header automatically */
  orgFetch: (url: string, opts?: RequestInit) => Promise<Response>;
}

const OrgContext = createContext<OrgContextValue>({
  orgs: [],
  activeOrg: null,
  activeOrgId: null,
  switchOrg: () => {},
  orgFetch: (url, opts) => fetch(url, opts),
});

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch orgs when there's a logged-in user
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        loadOrgs();
      } else {
        setOrgs([]);
        setActiveOrgId(null);
      }
    });
    // Also try immediately on mount
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) loadOrgs();
    });
    return () => subscription.unsubscribe();
  }, []);

  function loadOrgs() {
    fetch('/api/orgs')
      .then(r => r.json())
      .then(data => {
        const fetched: Org[] = data.orgs ?? [];
        setOrgs(fetched);
        if (fetched.length === 0) return;
        const stored = sessionStorage.getItem('activeOrgId');
        const valid = stored && fetched.find(o => o.id === stored);
        setActiveOrgId(valid ? stored : fetched[0].id);
      })
      .catch(() => {});
  }

  function switchOrg(orgId: string) {
    setActiveOrgId(orgId);
    sessionStorage.setItem('activeOrgId', orgId);
  }

  const orgFetch = useCallback((url: string, opts?: RequestInit): Promise<Response> => {
    const headers = new Headers(opts?.headers);
    if (activeOrgId) headers.set('x-org-id', activeOrgId);
    return fetch(url, { ...opts, headers });
  }, [activeOrgId]);

  const activeOrg = orgs.find(o => o.id === activeOrgId) ?? null;

  return (
    <OrgContext.Provider value={{ orgs, activeOrg, activeOrgId, switchOrg, orgFetch }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}

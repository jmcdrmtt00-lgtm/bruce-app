import { createBrowserClient } from '@supabase/ssr'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Browser client — lazy proxy with graceful no-op stubs when env vars are missing
let _supabase: SupabaseClient | null = null

export const supabase: SupabaseClient = (() => {
  return new Proxy({} as SupabaseClient, {
    get(_target, prop: string) {
      if (!_supabase) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!url || !key) {
          console.warn('Supabase not configured — auth features disabled')
          const noopResult = { data: null, error: new Error('Supabase not configured') }
          if (prop === 'auth') {
            return {
              getUser: () => Promise.resolve({ data: { user: null }, error: null }),
              getSession: () => Promise.resolve({ data: { session: null }, error: null }),
              signInWithPassword: () => Promise.resolve(noopResult),
              signInWithOAuth: () => Promise.resolve(noopResult),
              signUp: () => Promise.resolve(noopResult),
              signOut: () => Promise.resolve(noopResult),
              exchangeCodeForSession: () => Promise.resolve(noopResult),
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            }
          }
          return typeof prop === 'string' ? () => Promise.resolve(noopResult) : undefined
        }

        _supabase = createBrowserClient(url, key)
      }

      const value = (_supabase as unknown as Record<string, unknown>)[prop]
      return typeof value === 'function' ? (value as Function).bind(_supabase) : value
    }
  })
})()

// Server/Admin client — uses service_role key, server-side only
let _supabaseAdmin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      throw new Error('Missing Supabase environment variables')
    }

    _supabaseAdmin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return _supabaseAdmin
}

import { createBrowserClient } from '@supabase/ssr';

let client = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Return a mock client if env vars are missing (build time / demo mode)
  if (!url || !key || url === 'your_supabase_url_here') {
    return {
      auth: {
        getUser: async () => ({ data: { user: null } }),
        signInWithPassword: async () => ({ error: { message: 'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local' } }),
        signUp: async () => ({ error: { message: 'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local' } }),
        signOut: async () => ({}),
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null }) }), order: () => ({ limit: async () => ({ data: [] }), data: [] }), data: [] }),
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }), data: null, error: null }),
        update: () => ({ eq: async () => ({ data: null, error: null }) }),
        delete: () => ({ eq: async () => ({ data: null, error: null }) }),
      }),
    };
  }

  if (!client) {
    client = createBrowserClient(url, key);
  }
  return client;
}

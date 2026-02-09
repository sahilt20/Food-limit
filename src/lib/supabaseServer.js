import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Return a mock client if env vars are missing
    if (!url || !key || url === 'your_supabase_url_here') {
        return {
            auth: {
                getUser: async () => ({ data: { user: null } }),
            },
            from: () => ({
                select: () => ({ eq: () => ({ single: async () => ({ data: null }) }), order: () => ({ limit: async () => ({ data: [] }) }) }),
            }),
        };
    }

    const cookieStore = await cookies();

    return createServerClient(url, key, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch {
                    // The `setAll` method was called from a Server Component.
                }
            },
        },
    });
}

import { NextResponse } from 'next/server';

const START_TIME = Date.now();

/**
 * GET /api/health
 * Used by uptime monitors, load-balancers, and deployment pipelines.
 */
export async function GET() {
    const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);

    const providers = {
        openrouter: !!process.env.OPENROUTER_API_KEY,
        gemini:  !!process.env.GEMINI_API_KEY,
        openai:  !!process.env.OPENAI_API_KEY,
        nvidia:  !!(
            process.env.NVIDIA_API_KEY ||
            process.env.NVIDIA_GLM47_API_KEY ||
            process.env.NVIDIA_QWEN_API_KEY ||
            process.env.NVIDIA_DEEPSEEK_V32_API_KEY ||
            process.env.NVIDIA_DEEPSEEK_V31_API_KEY ||
            process.env.NVIDIA_VISION_API_KEY
        ),
    };

    const supabaseConfigured = !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your_supabase_url_here'
    );

    const aiProviderAvailable = Object.values(providers).some(Boolean);
    const status = supabaseConfigured && aiProviderAvailable ? 'ok' : 'degraded';

    return NextResponse.json(
        {
            status,
            uptime_seconds: uptimeSeconds,
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version ?? 'unknown',
            environment: process.env.NODE_ENV ?? 'unknown',
            services: {
                database: supabaseConfigured ? 'configured' : 'not_configured',
                ai: {
                    status: aiProviderAvailable ? 'available' : 'not_configured',
                    providers,
                },
            },
        },
        {
            status: status === 'ok' ? 200 : 503,
            headers: {
                'Cache-Control': 'no-store',
                'Content-Type': 'application/json',
            },
        }
    );
}

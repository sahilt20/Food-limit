/**
 * Simple in-memory rate limiter for API routes.
 * Limits requests per IP address.
 */

const rateLimitMap = new Map();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10; // 10 requests per minute per IP

/**
 * Check rate limit for a request.
 * Returns { allowed: boolean, remaining: number, resetMs: number }
 */
export function checkRateLimit(request) {
    const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';

    const now = Date.now();
    const key = ip;

    // Clean old entries
    if (rateLimitMap.size > 10000) {
        for (const [k, v] of rateLimitMap) {
            if (now - v.windowStart > WINDOW_MS) {
                rateLimitMap.delete(k);
            }
        }
    }

    let entry = rateLimitMap.get(key);

    if (!entry || now - entry.windowStart > WINDOW_MS) {
        entry = { windowStart: now, count: 0 };
        rateLimitMap.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, MAX_REQUESTS - entry.count);
    const resetMs = entry.windowStart + WINDOW_MS - now;

    return {
        allowed: entry.count <= MAX_REQUESTS,
        remaining,
        resetMs,
    };
}

/**
 * Create rate limit headers for the response.
 */
export function rateLimitHeaders(rateResult) {
    return {
        'X-RateLimit-Limit': MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateResult.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateResult.resetMs / 1000).toString(),
    };
}

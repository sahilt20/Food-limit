/**
 * In-memory rate limiter for API routes.
 * Limits by IP address with per-endpoint configuration.
 *
 * NOTE: This is process-local. For multi-instance deployments,
 * replace with a Redis-backed solution (e.g. Upstash).
 */

const store = new Map();

// Configs per route
const ROUTE_CONFIGS = {
    default:                { windowMs: 60_000, max: 10  },  // 10 req/min
    'analyze-nutrition':    { windowMs: 60_000, max: 15  },  // heavier but cacheable
    'analyze-receipt':      { windowMs: 60_000, max: 5   },  // vision — expensive
    'generate-recipes':     { windowMs: 60_000, max: 5   },
    'generate-meal-plan':   { windowMs: 60_000, max: 5   },
    'generate-diet-plan':   { windowMs: 60_000, max: 5   },
    'ai-analytics':         { windowMs: 60_000, max: 5   },
    'recommend-foods':      { windowMs: 60_000, max: 10  },
    'history-recommendations': { windowMs: 60_000, max: 5 },
    'analyze-consumed-item': { windowMs: 60_000, max: 8  },
    'log-consumed-item':     { windowMs: 60_000, max: 20 },
};

function getIP(request) {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
}

function evictExpired(now) {
    // Evict stale entries when map grows large
    if (store.size > 5_000) {
        for (const [k, v] of store) {
            if (now - v.windowStart > v.windowMs) {
                store.delete(k);
            }
        }
    }
}

/**
 * Check rate limit for a request.
 * @param {Request} request
 * @param {string} [routeKey]  - matches a key in ROUTE_CONFIGS
 * @returns {{ allowed: boolean, remaining: number, resetMs: number, limit: number }}
 */
export function checkRateLimit(request, routeKey = 'default') {
    const cfg = ROUTE_CONFIGS[routeKey] ?? ROUTE_CONFIGS.default;
    const ip = getIP(request);
    const storeKey = `${routeKey}:${ip}`;
    const now = Date.now();

    evictExpired(now);

    let entry = store.get(storeKey);
    if (!entry || now - entry.windowStart >= cfg.windowMs) {
        entry = { windowStart: now, count: 0, windowMs: cfg.windowMs };
        store.set(storeKey, entry);
    }

    entry.count++;

    const remaining = Math.max(0, cfg.max - entry.count);
    const resetMs = entry.windowStart + cfg.windowMs - now;

    return {
        allowed: entry.count <= cfg.max,
        remaining,
        resetMs,
        limit: cfg.max,
    };
}

/**
 * Create standard rate-limit response headers.
 */
export function rateLimitHeaders(rateResult) {
    return {
        'X-RateLimit-Limit':     rateResult.limit.toString(),
        'X-RateLimit-Remaining': rateResult.remaining.toString(),
        'X-RateLimit-Reset':     Math.ceil(rateResult.resetMs / 1000).toString(),
        'Retry-After':           Math.ceil(rateResult.resetMs / 1000).toString(),
    };
}

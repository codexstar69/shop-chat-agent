/**
 * Rate Limiting Service
 * Simple in-memory rate limiter for chat requests
 */
import AppConfig from "./config.server";

// In-memory store for rate limiting
// In production, consider using Redis for distributed rate limiting
const rateLimitStore = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > AppConfig.rateLimit.windowMs * 2) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get a unique identifier for rate limiting
 * Uses IP address and shop ID when available
 * @param {Request} request - The request object
 * @returns {string} Rate limit key
 */
function getRateLimitKey(request) {
  // Get IP from various headers (cloudflare, proxies, etc.)
  const ip = request.headers.get('CF-Connecting-IP') ||
             request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
             request.headers.get('X-Real-IP') ||
             'unknown';

  const shopId = request.headers.get('X-Shopify-Shop-Id') || 'no-shop';

  return `${ip}:${shopId}`;
}

/**
 * Check if a request should be rate limited
 * @param {Request} request - The request object
 * @returns {{ allowed: boolean, remaining: number, resetTime: number }}
 */
export function checkRateLimit(request) {
  const key = getRateLimitKey(request);
  const now = Date.now();
  const { maxRequests, windowMs } = AppConfig.rateLimit;

  let data = rateLimitStore.get(key);

  // Create new window if doesn't exist or window has expired
  if (!data || (now - data.windowStart) > windowMs) {
    data = {
      windowStart: now,
      count: 0,
    };
  }

  // Increment request count
  data.count++;
  rateLimitStore.set(key, data);

  const remaining = Math.max(0, maxRequests - data.count);
  const resetTime = data.windowStart + windowMs;

  return {
    allowed: data.count <= maxRequests,
    remaining,
    resetTime,
    retryAfter: Math.ceil((resetTime - now) / 1000),
  };
}

/**
 * Get rate limit headers for response
 * @param {{ remaining: number, resetTime: number }} rateLimit - Rate limit info
 * @returns {Object} Headers object
 */
export function getRateLimitHeaders(rateLimit) {
  return {
    'X-RateLimit-Limit': AppConfig.rateLimit.maxRequests.toString(),
    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(rateLimit.resetTime / 1000).toString(),
  };
}

/**
 * Create a rate limit exceeded response
 * @param {Request} request - The request object
 * @param {{ retryAfter: number }} rateLimit - Rate limit info
 * @returns {Response} Rate limit response
 */
export function createRateLimitResponse(request, rateLimit) {
  const origin = request.headers.get("Origin") || "*";

  return new Response(
    JSON.stringify({
      error: AppConfig.errorMessages.tooManyRequests,
      retryAfter: rateLimit.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': rateLimit.retryAfter.toString(),
        'Access-Control-Allow-Origin': origin,
        ...getRateLimitHeaders(rateLimit),
      },
    }
  );
}

export default {
  checkRateLimit,
  getRateLimitHeaders,
  createRateLimitResponse,
};

import { ApiError } from "./errors";

/**
 * Fixed-window limiter, per isolate. A Worker can run in several isolates, so this is a
 * best-effort abuse brake, not a hard quota (see HANDBACK gaps).
 */
const hits = new Map<string, { start: number; n: number }>();

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): void {
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
  const h = hits.get(key);
  if (!h || now - h.start >= windowMs) {
    hits.set(key, { start: now, n: 1 });
    return;
  }
  if (++h.n > max) throw new ApiError(429, "E_RATE_LIMIT", "too many requests, slow down");
}

export const resetRateLimits = (): void => hits.clear();

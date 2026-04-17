const buckets = new Map<string, { count: number; resetAt: number }>();

export class RateLimitError extends Error {
  status = 429;

  constructor(message = "Too many requests. Try again shortly.") {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Fixed-window limiter (in-memory). Suitable for single-instance or as a first line of defense.
 */
export function assertWithinRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    throw new RateLimitError();
  }

  bucket.count += 1;
}

export function clientIpFromRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

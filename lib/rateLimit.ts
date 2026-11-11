/**
 * Limiteur simple en mémoire (par instance serveur).
 * Suffisant pour un MVP ; en production, utiliser Upstash Redis ou équivalent.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 15, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}

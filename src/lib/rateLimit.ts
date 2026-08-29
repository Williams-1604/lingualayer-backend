import { config } from "../config/env.js";

export type RateLimitTier = "public" | "authenticated" | "tx" | "upload";

/**
 * Per-tier rate limit config for `@fastify/rate-limit`'s route-level
 * `config.rateLimit` override. The global default registered in index.ts
 * covers the "public" tier; routes that need a stricter or looser limit
 * (expensive Horizon calls, uploads, authenticated traffic) opt in with
 * `{ config: { rateLimit: rateLimitTierConfig("tx") } }`.
 */
export function rateLimitTierConfig(tier: RateLimitTier) {
  const max =
    tier === "public"
      ? config.rateLimitPublicMax
      : tier === "authenticated"
        ? config.rateLimitAuthenticatedMax
        : tier === "tx"
          ? config.rateLimitTxMax
          : config.rateLimitUploadMax;

  const timeWindow = tier === "upload" ? "1 hour" : "1 minute";

  return { max, timeWindow };
}

/**
 * Rate-limit key: the JWT subject when an Authorization header is present
 * and decodable (so authenticated traffic is limited per-subject, not
 * per-IP — a shared NAT/proxy shouldn't throttle every user behind it
 * together), falling back to IP for anonymous requests. Only decodes the
 * payload for keying purposes; signature verification is the auth
 * middleware's job, not the rate limiter's — a forged token just gets its
 * own (unearned) bucket, it doesn't bypass limiting.
 */
export function rateLimitKeyGenerator(req: { headers: Record<string, unknown>; ip: string }): string {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    try {
      const payload = header.slice("Bearer ".length).split(".")[1];
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (typeof decoded.sub === "string") return `sub:${decoded.sub}`;
    } catch {
      // fall through to IP keying
    }
  }
  return `ip:${req.ip}`;
}

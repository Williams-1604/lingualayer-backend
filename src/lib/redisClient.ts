import { Redis } from "ioredis";
import { config } from "../config/env.js";

/**
 * Shared Redis client, lazily constructed so importing this module has no
 * side effect when REDIS_URL isn't set (dev/CI without a Redis instance).
 * `enableOfflineQueue: false` + a bounded retry strategy means a command
 * against a dead Redis fails fast (rejects) instead of hanging — callers
 * are expected to catch and fall back (see cache.ts / rate-limit wiring).
 */
let client: Redis | null | undefined;

export function getRedisClient(): Redis | null {
  if (!config.redisUrl) return null;
  if (client === undefined) {
    client = new Redis(config.redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
      maxRetriesPerRequest: 1,
    });
    client.on("error", (err) => {
      console.error("[redis] connection error:", err.message);
    });
  }
  return client;
}

export async function isRedisAvailable(): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    if (redis.status === "wait" || redis.status === "end") {
      await redis.connect();
    }
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

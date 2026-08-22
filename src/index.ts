import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config/env.js";
import { isRedisAvailable, getRedisClient } from "./lib/redisClient.js";
import { rateLimitKeyGenerator } from "./lib/rateLimit.js";
import { healthRoutes } from "./routes/health.js";
import { v1Routes } from "./routes/v1/index.js";

async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.corsOrigin,
  });

  // Global default covers the "public" tier (60 req/min per IP or JWT
  // subject); routes needing a different tier override via
  // `config.rateLimit` (see lib/rateLimit.ts). Backed by Redis when
  // configured and reachable so limits survive a restart — falls back to
  // the plugin's built-in in-memory store otherwise rather than failing
  // to start.
  const redisAvailable = await isRedisAvailable();
  await app.register(rateLimit, {
    max: config.rateLimitPublicMax,
    timeWindow: "1 minute",
    keyGenerator: rateLimitKeyGenerator,
    redis: redisAvailable ? (getRedisClient() ?? undefined) : undefined,
  });
  if (config.redisUrl && !redisAvailable) {
    app.log.warn("REDIS_URL is set but unreachable; rate limiting falling back to in-memory store");
  }

  await app.register(healthRoutes);
  await app.register(v1Routes, { prefix: config.apiPrefix });

  return app;
}

buildServer()
  .then((app) =>
    app.listen({ port: config.port, host: "0.0.0.0" }),
  )
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

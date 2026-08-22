import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8080),
  API_PREFIX: z.string().default("/api/v1"),
  RATE_LIMIT_PUBLIC_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_AUTHENTICATED_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_TX_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().positive().default(20),
  REDIS_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

const raw = schema.parse(process.env);

export const config = {
  nodeEnv: raw.NODE_ENV,
  port: raw.PORT,
  apiPrefix: raw.API_PREFIX,
  rateLimitPublicMax: raw.RATE_LIMIT_PUBLIC_MAX,
  rateLimitAuthenticatedMax: raw.RATE_LIMIT_AUTHENTICATED_MAX,
  rateLimitTxMax: raw.RATE_LIMIT_TX_MAX,
  rateLimitUploadMax: raw.RATE_LIMIT_UPLOAD_MAX,
  redisUrl: raw.REDIS_URL,
  corsOrigin: raw.CORS_ORIGIN,
};

// improvement #9

// improvement #14

// improvement #32

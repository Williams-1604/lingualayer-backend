import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  JWT_SECRET: z.string().default("dev-insecure-secret-change-in-production"),
  PORT: z.coerce.number().default(8080),
  API_PREFIX: z.string().default("/api/v1"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

const raw = schema.parse(process.env);

export const config = {
  nodeEnv: raw.NODE_ENV,
  jwtSecret: raw.JWT_SECRET,
  port: raw.PORT,
  apiPrefix: raw.API_PREFIX,
  corsOrigin: raw.CORS_ORIGIN,
};

// improvement #9

// improvement #14

// improvement #32

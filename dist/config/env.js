import "dotenv/config";
import { z } from "zod";
const schema = z.object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().default(8080),
    API_PREFIX: z.string().default("/api/v1"),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),
    // SEP-0010 Web Authentication (GET /auth/challenge, POST /auth/token)
    STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
    SEP10_SERVER_SECRET: z.string().optional(),
    SEP10_HOME_DOMAIN: z.string().default("lingualayer.app"),
    SEP10_WEB_AUTH_DOMAIN: z.string().optional(),
    SEP10_CHALLENGE_TIMEOUT_SECONDS: z.coerce.number().default(300),
    JWT_SECRET: z.string().default("dev-insecure-jwt-secret-change-me"),
    JWT_TTL_SECONDS: z.coerce.number().default(3600),
    // DataCommission event indexer (GET /commissions, GET /commissions/:id)
    SOROBAN_RPC_URL: z.string().optional(),
    DATA_COMMISSION_CONTRACT_ID: z.string().optional(),
    COMMISSION_INDEXER_POLL_INTERVAL_MS: z.coerce.number().default(5000),
});
const raw = schema.parse(process.env);
export const config = {
    nodeEnv: raw.NODE_ENV,
    port: raw.PORT,
    apiPrefix: raw.API_PREFIX,
    corsOrigin: raw.CORS_ORIGIN,
    stellarNetwork: raw.STELLAR_NETWORK,
    sep10ServerSecret: raw.SEP10_SERVER_SECRET,
    sep10HomeDomain: raw.SEP10_HOME_DOMAIN,
    sep10WebAuthDomain: raw.SEP10_WEB_AUTH_DOMAIN ?? raw.SEP10_HOME_DOMAIN,
    sep10ChallengeTimeoutSeconds: raw.SEP10_CHALLENGE_TIMEOUT_SECONDS,
    jwtSecret: raw.JWT_SECRET,
    jwtTtlSeconds: raw.JWT_TTL_SECONDS,
    sorobanRpcUrl: raw.SOROBAN_RPC_URL,
    dataCommissionContractId: raw.DATA_COMMISSION_CONTRACT_ID,
    commissionIndexerPollIntervalMs: raw.COMMISSION_INDEXER_POLL_INTERVAL_MS,
};
// improvement #9
// improvement #14
// improvement #32

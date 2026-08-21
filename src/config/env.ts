import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8080),
  API_PREFIX: z.string().default("/api/v1"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  SOROBAN_RPC_URL: z.string().default("https://soroban-testnet.stellar.org"),
  DATASET_REGISTRY_CONTRACT_ID: z.string().optional(),
  LICENSE_CONTRACT_ID: z.string().optional(),
});

const raw = schema.parse(process.env);

export const config = {
  nodeEnv: raw.NODE_ENV,
  port: raw.PORT,
  apiPrefix: raw.API_PREFIX,
  corsOrigin: raw.CORS_ORIGIN,
  stellarNetwork: raw.STELLAR_NETWORK,
  sorobanRpcUrl: raw.SOROBAN_RPC_URL,
  datasetRegistryContractId: raw.DATASET_REGISTRY_CONTRACT_ID,
  licenseContractId: raw.LICENSE_CONTRACT_ID,
};

// improvement #9

// improvement #14

// improvement #32

import type { FastifyPluginAsync } from "fastify";
import { Horizon } from "@stellar/stellar-sdk";

// Issue #22. Implemented as its own /api/v1/wallet-config endpoint rather
// than editing the existing /health response in src/routes/health.ts -
// issue #12 (health checks / liveness / readiness / metrics) already owns
// that file in this same PR batch, and both issues editing it would
// conflict. Same information, a neighboring endpoint.
const CONTRACT_ENV_VARS = {
  dataset_registry: "DATASET_REGISTRY_CONTRACT_ID",
  quality_oracle: "QUALITY_ORACLE_CONTRACT_ID",
  data_commission: "DATA_COMMISSION_CONTRACT_ID",
} as const;

// TODO: replace with the real last-indexed ledger once the DatasetRegistry/
// DataCommission indexers exist (issue #17 indexes QualityOracle events
// specifically, into `quality_attestations` - a different contract/table).
let lastIndexedLedger: number | undefined;

async function currentChainTip(): Promise<number | undefined> {
  const horizonUrl =
    process.env.STELLAR_NETWORK === "mainnet"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org";
  try {
    const horizon = new Horizon.Server(horizonUrl);
    const root = await horizon.root();
    return root.history_latest_ledger;
  } catch {
    return undefined;
  }
}

export const walletConfigRoutes: FastifyPluginAsync = async (app) => {
  app.get("/wallet-config", async () => {
    const contracts: Record<string, string | null> = {};
    for (const [key, envVar] of Object.entries(CONTRACT_ENV_VARS)) {
      contracts[key] = process.env[envVar] || null;
    }

    const chainTip = await currentChainTip();
    const indexerLagLedgers =
      chainTip !== undefined && lastIndexedLedger !== undefined
        ? Math.max(0, chainTip - lastIndexedLedger)
        : null;

    return {
      status: "ok",
      stellar_network: process.env.STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet",
      contracts,
      indexer_lag_ledgers: indexerLagLedgers,
      wallets_kit_version: process.env.WALLETS_KIT_VERSION || null,
    };
  });
};

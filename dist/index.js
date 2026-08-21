import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";
import { v1Routes } from "./routes/v1/index.js";
import { startCommissionIndexer } from "./services/commission-indexer.js";
async function buildServer() {
    const app = Fastify({ logger: true });
    await app.register(cors, {
        origin: config.corsOrigin,
    });
    await app.register(healthRoutes);
    await app.register(v1Routes, { prefix: config.apiPrefix });
    return app;
}
buildServer()
    .then((app) => {
    if (config.sorobanRpcUrl && config.dataCommissionContractId) {
        startCommissionIndexer({
            rpcUrl: config.sorobanRpcUrl,
            contractId: config.dataCommissionContractId,
            pollIntervalMs: config.commissionIndexerPollIntervalMs,
        });
    }
    else {
        app.log.warn("SOROBAN_RPC_URL/DATA_COMMISSION_CONTRACT_ID not set — commission indexer disabled");
    }
    return app.listen({ port: config.port, host: "0.0.0.0" });
})
    .catch((err) => {
    console.error(err);
    process.exit(1);
});

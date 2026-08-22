import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { config } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";
import { v1Routes } from "./routes/v1/index.js";
import { wsRoutes } from "./routes/ws.js";
import { startCommissionIndexer } from "./services/commission-indexer.js";
import { recordHttpRequest, renderMetrics } from "./metrics.js";

const SHUTDOWN_DRAIN_MS = 15_000;

async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.corsOrigin,
  });

  await app.register(websocket);
  app.addHook("onResponse", async (req, reply) => {
    recordHttpRequest(req.routeOptions?.url ?? req.url, reply.statusCode);
  });

  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", "text/plain; version=0.0.4");
    return renderMetrics();
  });

  await app.register(healthRoutes);
  await app.register(v1Routes, { prefix: config.apiPrefix });
  await app.register(wsRoutes);

  return app;
}

function registerGracefulShutdown(app: Awaited<ReturnType<typeof buildServer>>) {
  let shuttingDown = false;
  process.on("SIGTERM", () => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`SIGTERM received, draining for up to ${SHUTDOWN_DRAIN_MS}ms`);

    const forceExit = setTimeout(() => {
      app.log.warn("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_DRAIN_MS);
    forceExit.unref();

    app
      .close()
      .then(() => {
        clearTimeout(forceExit);
        process.exit(0);
      })
      .catch((err) => {
        app.log.error(err);
        clearTimeout(forceExit);
        process.exit(1);
      });
  });
}

buildServer()
  .then((app) => {
    if (config.sorobanRpcUrl && config.dataCommissionContractId) {
      startCommissionIndexer({
        rpcUrl: config.sorobanRpcUrl,
        contractId: config.dataCommissionContractId,
        pollIntervalMs: config.commissionIndexerPollIntervalMs,
      });
    } else {
      app.log.warn(
        "SOROBAN_RPC_URL/DATA_COMMISSION_CONTRACT_ID not set — commission indexer disabled",
      );
    }
    return app.listen({ port: config.port, host: "0.0.0.0" });
  });

  .then(async (app) => {
    registerGracefulShutdown(app);
    await app.listen({ port: config.port, host: "0.0.0.0" });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

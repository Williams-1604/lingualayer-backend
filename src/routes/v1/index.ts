import type { FastifyPluginAsync } from "fastify";
import { sep010Routes } from "../sep010.js";
import { commissionRoutes } from "./commissions.js";
import { txRoutes } from "./tx.js";
import { qualityRoutes } from "./quality.js";
import { commissionRoutes } from "./commissions.js";
import { walletConfigRoutes } from "./wallet-config.js";
import { contributorRoutes } from "./contributors.js";

export const v1Routes: FastifyPluginAsync = async (app) => {
  app.get("/meta", async () => ({
    name: "lingualayer-api",
    version: "0.1.0",
    description: "REST facade for Soroban contracts and indexers (scaffold).",
  }));

  await app.register(sep010Routes);
  await app.register(commissionRoutes);
  await app.register(txRoutes);

  // TODO: routes for webhook ingestion, admin ops
  await app.register(qualityRoutes);
  await app.register(commissionRoutes);
  await app.register(walletConfigRoutes);
  await app.register(contributorRoutes);

  // TODO: routes for contract invocation prep, webhook ingestion, admin ops
};

// improvement #17

// improvement #19

// improvement #27

// improvement #29

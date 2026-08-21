import type { FastifyPluginAsync } from "fastify";
import { txRoutes } from "./tx.js";

export const v1Routes: FastifyPluginAsync = async (app) => {
  app.get("/meta", async () => ({
    name: "lingualayer-api",
    version: "0.1.0",
    description: "REST facade for Soroban contracts and indexers (scaffold).",
  }));

  await app.register(txRoutes);

  // TODO: routes for webhook ingestion, admin ops
};

// improvement #16

// improvement #17

// improvement #19

// improvement #27

// improvement #29

import type { FastifyPluginAsync } from "fastify";
import { rolesRoutes } from "./roles.js";

export const v1Routes: FastifyPluginAsync = async (app) => {
  app.get("/meta", async () => ({
    name: "lingualayer-api",
    version: "0.1.0",
    description: "REST facade for Soroban contracts and indexers (scaffold).",
  }));

  // TODO: routes for contract invocation prep, webhook ingestion

  await app.register(rolesRoutes);
};

// improvement #16

// improvement #17

// improvement #19

// improvement #27

// improvement #29

import test from "node:test";
import assert from "node:assert";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { wsRoutes } from "./ws.js";
import { upsertCommission, resetCommissionStore } from "../services/commission-indexer.js";

test("WS /ws/commissions broadcasts newly-indexed commissions", async () => {
  resetCommissionStore();
  const app = Fastify();
  await app.register(websocket);
  await app.register(wsRoutes);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const address = app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/commissions`);

  const message = await new Promise<string>((resolve, reject) => {
    socket.addEventListener("open", () => {
      upsertCommission({
        id: "c1",
        commissioner: "GABC",
        bountyAmountUsdc: 100,
        languageCode: "yo",
        state: "open",
        createdLedger: 1,
        updatedLedger: 1,
      });
    });
    socket.addEventListener("message", (event) => resolve(event.data.toString()));
    socket.addEventListener("error", reject);
    setTimeout(() => reject(new Error("timed out waiting for broadcast")), 2000);
  });

  const parsed = JSON.parse(message);
  assert.strictEqual(parsed.type, "commission:new");
  assert.strictEqual(parsed.commission.id, "c1");

  socket.close();
  await app.close();
});

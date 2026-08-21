import type { FastifyPluginAsync } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { commissionEvents, type Commission } from "../services/commission-indexer.js";

const sockets = new Set<WebSocket>();

function broadcastNewCommission(commission: Commission): void {
  const payload = JSON.stringify({ type: "commission:new", commission });
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}

commissionEvents.on("commission:new", broadcastNewCommission);

/** WebSocket channel that pushes each newly-indexed commission as it's posted. */
export const wsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/ws/commissions", { websocket: true }, (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
};

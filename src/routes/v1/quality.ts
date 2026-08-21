import type { FastifyPluginAsync } from "fastify";
import { qualityOracleAttestationsTotal } from "../../metrics.js";
import { getLeaderboard, recordAttestation } from "../../services/curator-stats.js";

export const qualityRoutes: FastifyPluginAsync = async (app) => {
  app.get("/datasets/:id/quality", async (req) => {
    const { id } = req.params as { id: string };
    // TODO: query QualityOracle contract + local DB cache
    return {
      dataset_id: id,
      average_score: 0,
      attestation_count: 0,
      tier: "Unrated",
      royalty_multiplier_bps: 10000,
    };
  });

  app.post("/quality/attest/prepare", async (req, reply) => {
    const { curator, score } = (req.body ?? {}) as { curator?: string; score?: number };
    if (!curator || typeof score !== "number") {
      return reply.status(400).send({ error: "curator and numeric score are required" });
    }

    qualityOracleAttestationsTotal.inc();
    recordAttestation(curator, score);
    // Prepare unsigned XDR for QualityOracle.attest_quality()
    return { xdr: "" };
  });

  app.get("/quality/leaderboard", async (req) => {
    const { limit = "20" } = req.query as Record<string, string>;
    return { curators: getLeaderboard(Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100)) };
  });
};

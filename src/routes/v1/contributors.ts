import type { FastifyPluginAsync } from "fastify";

type ReputationTier = "Newcomer" | "Contributor" | "Veteran" | "Legend";

interface ReputationRecord {
  address: string;
  reputation_score: number;
  datasets_registered: number;
  total_royalties_usdc: number;
  quality_average: number;
}

// TODO: replace with a real on-chain read from DatasetRegistry + a DB
// aggregate query once the indexer (issue #17) is populating contributor
// stats. This in-memory fixture keeps the endpoint's shape and behavior
// (404, tiering, ranking) correct and testable ahead of that wiring.
const RECORDS: ReputationRecord[] = [
  { address: "GA1CONTRIBUTOR1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", reputation_score: 920, datasets_registered: 41, total_royalties_usdc: 12500, quality_average: 91 },
  { address: "GA2CONTRIBUTOR2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", reputation_score: 640, datasets_registered: 12, total_royalties_usdc: 3100, quality_average: 78 },
  { address: "GA3CONTRIBUTOR3XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", reputation_score: 210, datasets_registered: 3, total_royalties_usdc: 400, quality_average: 62 },
];

function tierFor(score: number): ReputationTier {
  if (score >= 900) return "Legend";
  if (score >= 500) return "Veteran";
  if (score >= 100) return "Contributor";
  return "Newcomer";
}

function rankOf(address: string): number | undefined {
  const sorted = [...RECORDS].sort((a, b) => b.reputation_score - a.reputation_score);
  const idx = sorted.findIndex((r) => r.address === address);
  return idx === -1 ? undefined : idx + 1;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { body: unknown; expiresAt: number }>();

export const contributorRoutes: FastifyPluginAsync = async (app) => {
  app.get("/contributors/:address/reputation", async (req, reply) => {
    const { address } = req.params as { address: string };

    const cached = cache.get(address);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.body;
    }

    const record = RECORDS.find((r) => r.address === address);
    if (!record) {
      return reply.status(404).send({ error: "No reputation record for this address" });
    }

    const body = {
      address: record.address,
      reputation_score: record.reputation_score,
      reputation_tier: tierFor(record.reputation_score),
      datasets_registered: record.datasets_registered,
      total_royalties_usdc: record.total_royalties_usdc,
      quality_average: record.quality_average,
      rank: rankOf(address),
    };

    cache.set(address, { body, expiresAt: Date.now() + CACHE_TTL_MS });
    return body;
  });
};

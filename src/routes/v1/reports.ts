import type { FastifyPluginAsync } from "fastify";
import { listCommissions } from "../../services/commission-indexer.js";

interface LanguageReportRow {
  languageCode: string;
  commissionCount: number;
  fulfilledCount: number;
  totalBountyUsdc: number;
}

function buildLanguageReport(): LanguageReportRow[] {
  const { items } = listCommissions({ limit: Number.MAX_SAFE_INTEGER });
  const byLanguage = new Map<string, LanguageReportRow>();

  for (const commission of items) {
    const row = byLanguage.get(commission.languageCode) ?? {
      languageCode: commission.languageCode,
      commissionCount: 0,
      fulfilledCount: 0,
      totalBountyUsdc: 0,
    };
    row.commissionCount += 1;
    if (commission.state === "fulfilled") row.fulfilledCount += 1;
    row.totalBountyUsdc += commission.bountyAmountUsdc;
    byLanguage.set(commission.languageCode, row);
  }

  return Array.from(byLanguage.values()).sort((a, b) => b.commissionCount - a.commissionCount);
}

function toCsv(rows: LanguageReportRow[]): string {
  const header = "language_code,commission_count,fulfilled_count,total_bounty_usdc";
  const lines = rows.map(
    (r) => `${r.languageCode},${r.commissionCount},${r.fulfilledCount},${r.totalBountyUsdc}`,
  );
  return [header, ...lines].join("\n");
}

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.get("/reports/export", async (req, reply) => {
    const { format = "json" } = req.query as { format?: string };
    const rows = buildLanguageReport();

    if (format === "csv") {
      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", 'attachment; filename="language-community-report.csv"');
      return toCsv(rows);
    }

    if (format !== "json") {
      return reply.status(400).send({ error: "format must be 'json' or 'csv'" });
    }

    return { languages: rows };
  });
};

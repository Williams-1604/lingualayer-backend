import test from "node:test";
import assert from "node:assert";
import Fastify from "fastify";
import { reportRoutes } from "./reports.js";
import { upsertCommission, resetCommissionStore } from "../../services/commission-indexer.js";

function seed() {
  resetCommissionStore();
  upsertCommission({
    id: "c1",
    commissioner: "GABC",
    bountyAmountUsdc: 100,
    languageCode: "yo",
    state: "fulfilled",
    createdLedger: 1,
    updatedLedger: 1,
  });
  upsertCommission({
    id: "c2",
    commissioner: "GDEF",
    bountyAmountUsdc: 50,
    languageCode: "yo",
    state: "open",
    createdLedger: 2,
    updatedLedger: 2,
  });
  upsertCommission({
    id: "c3",
    commissioner: "GHIJ",
    bountyAmountUsdc: 200,
    languageCode: "ig",
    state: "open",
    createdLedger: 3,
    updatedLedger: 3,
  });
}

test("GET /reports/export?format=json aggregates by language", async () => {
  seed();
  const app = Fastify();
  await app.register(reportRoutes);

  const res = await app.inject({ method: "GET", url: "/reports/export?format=json" });
  assert.strictEqual(res.statusCode, 200);
  const { languages } = res.json();

  const yo = languages.find((l: any) => l.languageCode === "yo");
  assert.strictEqual(yo.commissionCount, 2);
  assert.strictEqual(yo.fulfilledCount, 1);
  assert.strictEqual(yo.totalBountyUsdc, 150);
});

test("GET /reports/export?format=csv returns CSV", async () => {
  seed();
  const app = Fastify();
  await app.register(reportRoutes);

  const res = await app.inject({ method: "GET", url: "/reports/export?format=csv" });
  assert.strictEqual(res.statusCode, 200);
  assert.match(res.headers["content-type"] as string, /text\/csv/);
  assert.match(res.payload, /language_code,commission_count,fulfilled_count,total_bounty_usdc/);
  assert.match(res.payload, /yo,2,1,150/);
});

test("GET /reports/export?format=bogus returns 400", async () => {
  const app = Fastify();
  await app.register(reportRoutes);

  const res = await app.inject({ method: "GET", url: "/reports/export?format=bogus" });
  assert.strictEqual(res.statusCode, 400);
});

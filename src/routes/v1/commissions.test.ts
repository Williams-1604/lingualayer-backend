import test from "node:test";
import assert from "node:assert";
import Fastify from "fastify";
import { commissionRoutes } from "./commissions.js";
import { Horizon } from "@stellar/stellar-sdk";

// We mock the Horizon behavior inside the test
test("POST /commissions/prepare - 422 on insufficient USDC", async (t) => {
  const app = Fastify();
  await app.register(commissionRoutes);

  // We'll intercept or mock the loadAccount behavior natively if we can.
  // Actually, since we're using real stellar-sdk in the route, we can just hit a real testnet account with 0 USDC,
  // or use a non-existent account and get 404, but let's test the 422 if possible.
  // Wait, let's mock it by injecting the horizon object into the app, or just hijacking the fetch global since stellar-sdk uses it.
  
  // Or, a simpler way: just test that it returns 422 when we mock the global fetch for horizon
  // Mock loadAccount directly on Horizon Server prototype
  const originalLoadAccount = Horizon.Server.prototype.loadAccount;
  Horizon.Server.prototype.loadAccount = async function (accountId: string) {
    if (accountId === "GAQ35U6Z27A6C3W3I2YQY33DCR3FDR27XDFV7Q4O2PCHZZTCRWNN2QYB") {
      return {
        id: accountId,
        balances: [
          {
            asset_type: "credit_alphanum4",
            asset_code: "USDC",
            asset_issuer: "GBBD47IF6LWK7P7MDEVSCWTTCJM4RFCKMMGNEQ3C7OQ72N7K6O4LUKXP",
            balance: "10.0000000"
          }
        ]
      } as any;
    }
    throw new Error("Not found");
  };

  const response = await app.inject({
    method: "POST",
    url: "/commissions/prepare",
    payload: {
      commissioner: "GAQ35U6Z27A6C3W3I2YQY33DCR3FDR27XDFV7Q4O2PCHZZTCRWNN2QYB",
      language_code: "yo",
      bounty_amount_usdc: 50,
      description_markdown: "# Yoruba proverbs dataset",
      min_sample_count: 100,
      min_duration_hours: 1,
      deadline_days: 14
    }
  });

  Horizon.Server.prototype.loadAccount = originalLoadAccount;

  if (response.statusCode === 500) {
    console.error("500 Payload:", response.payload);
  }
  assert.strictEqual(response.statusCode, 422);
  const body = JSON.parse(response.payload);
  assert.strictEqual(body.error, "Insufficient USDC: need 50, have 10.0000000");
});

test("GET /commissions returns paginated indexed commissions", async () => {
  const { upsertCommission, resetCommissionStore } = await import("../../services/commission-indexer.js");
  resetCommissionStore();
  upsertCommission({
    id: "c1",
    commissioner: "GABC",
    bountyAmountUsdc: 100,
    languageCode: "yo",
    state: "open",
    createdLedger: 1,
    updatedLedger: 1,
  });

  const app = Fastify();
  await app.register(commissionRoutes);

  const response = await app.inject({ method: "GET", url: "/commissions" });
  assert.strictEqual(response.statusCode, 200);
  const body = response.json();
  assert.strictEqual(body.total, 1);
  assert.strictEqual(body.items[0].id, "c1");
});

test("GET /commissions?state=invalid returns 400", async () => {
  const app = Fastify();
  await app.register(commissionRoutes);

  const response = await app.inject({ method: "GET", url: "/commissions?state=bogus" });
  assert.strictEqual(response.statusCode, 400);
});

test("GET /commissions/:id returns 404 for an unknown commission", async () => {
  const { resetCommissionStore } = await import("../../services/commission-indexer.js");
  resetCommissionStore();

  const app = Fastify();
  await app.register(commissionRoutes);

  const response = await app.inject({ method: "GET", url: "/commissions/does-not-exist" });
  assert.strictEqual(response.statusCode, 404);
});

test("POST /commissions/:id/fulfil marks the commission fulfilled", async () => {
  const { upsertCommission, resetCommissionStore, getCommissionById } = await import(
    "../../services/commission-indexer.js"
  );
  resetCommissionStore();
  upsertCommission({
    id: "c1",
    commissioner: "GABC",
    bountyAmountUsdc: 100,
    languageCode: "yo",
    state: "open",
    createdLedger: 1,
    updatedLedger: 1,
  });

  const app = Fastify();
  await app.register(commissionRoutes);

  const response = await app.inject({ method: "POST", url: "/commissions/c1/fulfil", payload: {} });
  assert.strictEqual(response.statusCode, 200);
  const body = response.json();
  assert.strictEqual(body.commission.state, "fulfilled");
  assert.strictEqual(body.emailSent, false);
  assert.strictEqual(getCommissionById("c1")?.state, "fulfilled");
});

test("POST /commissions/:id/fulfil returns 404 for an unknown commission", async () => {
  const { resetCommissionStore } = await import("../../services/commission-indexer.js");
  resetCommissionStore();

  const app = Fastify();
  await app.register(commissionRoutes);

  const response = await app.inject({ method: "POST", url: "/commissions/nope/fulfil", payload: {} });
  assert.strictEqual(response.statusCode, 404);
});

test("POST /commissions/:id/fulfil returns 409 if already fulfilled", async () => {
  const { upsertCommission, resetCommissionStore } = await import("../../services/commission-indexer.js");
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

  const app = Fastify();
  await app.register(commissionRoutes);

  const response = await app.inject({ method: "POST", url: "/commissions/c1/fulfil", payload: {} });
  assert.strictEqual(response.statusCode, 409);
});

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

import test from "node:test";
import assert from "node:assert";
import { sendCommissionFulfilmentEmail } from "./notifications.js";
import type { Commission } from "./commission-indexer.js";

const commission: Commission = {
  id: "c1",
  commissioner: "GABC",
  bountyAmountUsdc: 100,
  languageCode: "yo",
  state: "fulfilled",
  createdLedger: 1,
  updatedLedger: 2,
};

test("sendCommissionFulfilmentEmail sends via the provided sender", async () => {
  const calls: unknown[] = [];
  const sent = await sendCommissionFulfilmentEmail("dev@example.com", commission, {
    send: async (msg) => {
      calls.push(msg);
    },
  });

  assert.strictEqual(sent, true);
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual((calls[0] as any).to, "dev@example.com");
  assert.match((calls[0] as any).subject, /fulfilled/);
});

test("sendCommissionFulfilmentEmail no-ops without SENDGRID_API_KEY configured", async () => {
  const sent = await sendCommissionFulfilmentEmail("dev@example.com", commission);
  assert.strictEqual(sent, false);
});

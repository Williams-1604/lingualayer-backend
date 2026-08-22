import test from "node:test";
import assert from "node:assert";
import {
  upsertCommission,
  listCommissions,
  getCommissionById,
  resetCommissionStore,
  parseCommissionEvent,
  commissionEvents,
  type Commission,
} from "./commission-indexer.js";
import { nativeToScVal, xdr } from "@stellar/stellar-sdk";

function fixture(overrides: Partial<Commission> = {}): Commission {
  return {
    id: "c1",
    commissioner: "GABC",
    bountyAmountUsdc: 100,
    languageCode: "yo",
    state: "open",
    createdLedger: 1,
    updatedLedger: 1,
    ...overrides,
  };
}

test("upsertCommission then getCommissionById returns it", () => {
  resetCommissionStore();
  upsertCommission(fixture());
  assert.strictEqual(getCommissionById("c1")?.commissioner, "GABC");
});

test("getCommissionById returns undefined for an unknown id", () => {
  resetCommissionStore();
  assert.strictEqual(getCommissionById("nope"), undefined);
});

test("listCommissions filters by state", () => {
  resetCommissionStore();
  upsertCommission(fixture({ id: "c1", state: "open" }));
  upsertCommission(fixture({ id: "c2", state: "fulfilled" }));

  const { items, total } = listCommissions({ state: "fulfilled" });
  assert.strictEqual(total, 1);
  assert.strictEqual(items[0]?.id, "c2");
});

test("listCommissions paginates newest-first", () => {
  resetCommissionStore();
  for (let i = 1; i <= 5; i++) {
    upsertCommission(fixture({ id: `c${i}`, createdLedger: i }));
  }

  const page1 = listCommissions({ page: 1, limit: 2 });
  assert.strictEqual(page1.total, 5);
  assert.deepStrictEqual(page1.items.map((c) => c.id), ["c5", "c4"]);

  const page2 = listCommissions({ page: 2, limit: 2 });
  assert.deepStrictEqual(page2.items.map((c) => c.id), ["c3", "c2"]);
});

test("upsertCommission emits commission:new then commission:updated", () => {
  resetCommissionStore();
  const seen: string[] = [];
  const onNew = () => seen.push("new");
  const onUpdated = () => seen.push("updated");
  commissionEvents.once("commission:new", onNew);
  commissionEvents.once("commission:updated", onUpdated);

  upsertCommission(fixture({ id: "c1" }));
  upsertCommission(fixture({ id: "c1", state: "fulfilled" }));

  assert.deepStrictEqual(seen, ["new", "updated"]);
});

test("parseCommissionEvent parses a well-formed posted event", () => {
  resetCommissionStore();
  const event = {
    id: "evt1",
    type: "contract",
    ledger: 42,
    ledgerClosedAt: new Date().toISOString(),
    transactionIndex: 0,
    operationIndex: 0,
    topic: [xdr.ScVal.scvSymbol("commission"), xdr.ScVal.scvSymbol("posted")],
    value: nativeToScVal({ id: "c9", commissioner: "GXYZ", bounty_amount_usdc: 250, language_code: "ig" }),
  } as any;

  const parsed = parseCommissionEvent(event);
  assert.strictEqual(parsed?.kind, "posted");
  assert.strictEqual(parsed?.commission.id, "c9");
  assert.strictEqual(parsed?.commission.state, "open");
  assert.strictEqual(parsed?.commission.bountyAmountUsdc, 250);
});

test("parseCommissionEvent returns null for an unrelated event", () => {
  const event = {
    id: "evt2",
    type: "contract",
    ledger: 1,
    ledgerClosedAt: new Date().toISOString(),
    transactionIndex: 0,
    operationIndex: 0,
    topic: [xdr.ScVal.scvSymbol("unrelated")],
    value: nativeToScVal({}),
  } as any;

  assert.strictEqual(parseCommissionEvent(event), null);
});

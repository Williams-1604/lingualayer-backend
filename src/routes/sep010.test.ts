import test from "node:test";
import assert from "node:assert";
import Fastify from "fastify";
import { Keypair, Networks, Transaction } from "@stellar/stellar-sdk";
import { sep010Routes } from "./sep010.js";

async function buildApp() {
  const app = Fastify();
  await app.register(sep010Routes);
  return app;
}

test("GET /auth/challenge returns a signed challenge transaction", async () => {
  const app = await buildApp();
  const client = Keypair.random();

  const res = await app.inject({
    method: "GET",
    url: `/auth/challenge?account=${client.publicKey()}`,
  });

  assert.strictEqual(res.statusCode, 200);
  const body = res.json();
  assert.ok(body.transaction);
  assert.ok(body.network_passphrase);
});

test("POST /auth/token issues a token for a correctly-signed challenge", async () => {
  const app = await buildApp();
  const client = Keypair.random();

  const challengeRes = await app.inject({
    method: "GET",
    url: `/auth/challenge?account=${client.publicKey()}`,
  });
  const { transaction, network_passphrase } = challengeRes.json();

  const tx = new Transaction(transaction, network_passphrase) as Transaction;
  tx.sign(client);

  const tokenRes = await app.inject({
    method: "POST",
    url: "/auth/token",
    payload: { transaction: tx.toXDR() },
  });

  assert.strictEqual(tokenRes.statusCode, 200);
  const body = tokenRes.json();
  assert.ok(body.token);
  assert.strictEqual(body.token.split(".").length, 3);
});

test("POST /auth/token rejects a challenge with no client signature", async () => {
  const app = await buildApp();
  const client = Keypair.random();

  const challengeRes = await app.inject({
    method: "GET",
    url: `/auth/challenge?account=${client.publicKey()}`,
  });
  const { transaction } = challengeRes.json();

  const tokenRes = await app.inject({
    method: "POST",
    url: "/auth/token",
    payload: { transaction },
  });

  assert.strictEqual(tokenRes.statusCode, 401);
});

test("POST /auth/token rejects a tampered challenge signed by the wrong account", async () => {
  const app = await buildApp();
  const client = Keypair.random();
  const attacker = Keypair.random();

  const challengeRes = await app.inject({
    method: "GET",
    url: `/auth/challenge?account=${client.publicKey()}`,
  });
  const { transaction, network_passphrase } = challengeRes.json();

  const tx = new Transaction(transaction, network_passphrase) as Transaction;
  tx.sign(attacker);

  const tokenRes = await app.inject({
    method: "POST",
    url: "/auth/token",
    payload: { transaction: tx.toXDR() },
  });

  assert.strictEqual(tokenRes.statusCode, 401);
});

import test from "node:test";
import assert from "node:assert";
import Fastify from "fastify";
import { Keypair, Transaction, Networks } from "@stellar/stellar-sdk";
import { sep010Routes, verifyJwt } from "./sep010.js";

test("SEP-10: full challenge -> sign -> token flow", async () => {
  const app = Fastify();
  await app.register(sep010Routes);

  const client = Keypair.random();

  const challengeRes = await app.inject({
    method: "GET",
    url: `/auth/challenge?address=${client.publicKey()}`,
  });
  assert.strictEqual(challengeRes.statusCode, 200);
  const { transaction, network_passphrase } = JSON.parse(challengeRes.payload);
  assert.ok(transaction.length > 0);

  const tx = new Transaction(transaction, network_passphrase);
  // Server already signed it when issuing the challenge; add the client's.
  tx.sign(client);

  const tokenRes = await app.inject({
    method: "POST",
    url: "/auth/token",
    payload: { transaction: tx.toXDR() },
  });
  assert.strictEqual(tokenRes.statusCode, 200, tokenRes.payload);
  const { token, expires_at } = JSON.parse(tokenRes.payload);
  assert.ok(token.split(".").length === 3);
  assert.ok(expires_at > Math.floor(Date.now() / 1000));

  const claims = verifyJwt(token);
  assert.strictEqual(claims?.sub, client.publicKey());
});

test("SEP-10: token endpoint rejects an unsigned challenge", async () => {
  const app = Fastify();
  await app.register(sep010Routes);

  const client = Keypair.random();
  const challengeRes = await app.inject({
    method: "GET",
    url: `/auth/challenge?address=${client.publicKey()}`,
  });
  const { transaction } = JSON.parse(challengeRes.payload);

  const tokenRes = await app.inject({
    method: "POST",
    url: "/auth/token",
    payload: { transaction },
  });
  assert.strictEqual(tokenRes.statusCode, 401);
});

test("SEP-10: challenge endpoint rejects an invalid address", async () => {
  const app = Fastify();
  await app.register(sep010Routes);

  const res = await app.inject({ method: "GET", url: "/auth/challenge?address=not-a-key" });
  assert.strictEqual(res.statusCode, 400);
});

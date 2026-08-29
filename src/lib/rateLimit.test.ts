import test from "node:test";
import assert from "node:assert";
import { rateLimitTierConfig, rateLimitKeyGenerator } from "./rateLimit.js";

test("rateLimitTierConfig returns distinct per-tier limits", () => {
  const publicTier = rateLimitTierConfig("public");
  const authenticated = rateLimitTierConfig("authenticated");
  const tx = rateLimitTierConfig("tx");
  const upload = rateLimitTierConfig("upload");

  assert.strictEqual(publicTier.max, 60);
  assert.strictEqual(authenticated.max, 300);
  assert.strictEqual(tx.max, 10);
  assert.strictEqual(upload.max, 20);
  assert.strictEqual(upload.timeWindow, "1 hour");
  assert.strictEqual(publicTier.timeWindow, "1 minute");
});

test("rateLimitKeyGenerator keys authenticated requests by JWT subject", () => {
  const payload = Buffer.from(JSON.stringify({ sub: "GADDRESS123" })).toString("base64url");
  const token = `header.${payload}.signature`;
  const key = rateLimitKeyGenerator({
    headers: { authorization: `Bearer ${token}` },
    ip: "1.2.3.4",
  });
  assert.strictEqual(key, "sub:GADDRESS123");
});

test("rateLimitKeyGenerator falls back to IP for anonymous or malformed requests", () => {
  assert.strictEqual(rateLimitKeyGenerator({ headers: {}, ip: "1.2.3.4" }), "ip:1.2.3.4");
  assert.strictEqual(
    rateLimitKeyGenerator({ headers: { authorization: "Bearer not-a-jwt" }, ip: "1.2.3.4" }),
    "ip:1.2.3.4",
  );
});

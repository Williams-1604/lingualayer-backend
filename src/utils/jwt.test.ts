import test from "node:test";
import assert from "node:assert";
import { signJwt, verifyJwt } from "./jwt.js";

test("signJwt/verifyJwt round-trips valid claims", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt({ sub: "GABC", iat: now, exp: now + 60 }, "secret");
  const claims = verifyJwt(token, "secret");
  assert.strictEqual(claims?.sub, "GABC");
});

test("verifyJwt rejects a token signed with a different secret", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt({ sub: "GABC", iat: now, exp: now + 60 }, "secret-a");
  assert.strictEqual(verifyJwt(token, "secret-b"), null);
});

test("verifyJwt rejects an expired token", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt({ sub: "GABC", iat: now - 120, exp: now - 60 }, "secret");
  assert.strictEqual(verifyJwt(token, "secret"), null);
});

test("verifyJwt rejects a malformed token", () => {
  assert.strictEqual(verifyJwt("not-a-jwt", "secret"), null);
});

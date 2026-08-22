import test from "node:test";
import assert from "node:assert";
import { signJwt, verifyJwt, JwtError } from "./jwt.js";

test("signJwt/verifyJwt round-trips claims", () => {
  const token = signJwt({ sub: "GADDRESS", role: "curator" });
  const claims = verifyJwt(token);
  assert.strictEqual(claims.sub, "GADDRESS");
  assert.strictEqual(claims.role, "curator");
});

test("verifyJwt rejects a tampered payload", () => {
  const token = signJwt({ sub: "GADDRESS", role: "contributor" });
  const [header, payload, signature] = token.split(".");
  const tamperedPayload = Buffer.from(
    JSON.stringify({ sub: "GADDRESS", role: "admin", iat: 0, exp: 9999999999 }),
  ).toString("base64url");
  const tampered = `${header}.${tamperedPayload}.${signature}`;
  assert.throws(() => verifyJwt(tampered), JwtError);
});

test("verifyJwt rejects an expired token", () => {
  const token = signJwt({ sub: "GADDRESS", role: "admin" }, -10);
  assert.throws(() => verifyJwt(token), /expired/);
});

test("verifyJwt rejects a malformed token", () => {
  assert.throws(() => verifyJwt("not-a-jwt"), JwtError);
});

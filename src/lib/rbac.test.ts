import test from "node:test";
import assert from "node:assert";
import Fastify from "fastify";
import { signJwt } from "./jwt.js";
import { assignRole, getRole, requireRole } from "./rbac.js";

function buildProtectedApp(minimumRole: "contributor" | "curator" | "admin") {
  const app = Fastify();
  app.get("/protected", { preHandler: requireRole(minimumRole) }, async () => ({ ok: true }));
  return app;
}

test("unauthenticated request to a protected route returns 401", async () => {
  const app = buildProtectedApp("curator");
  const res = await app.inject({ method: "GET", url: "/protected" });
  assert.strictEqual(res.statusCode, 401);
});

test("authenticated but under-ranked role returns 403 with insufficient_role", async () => {
  const app = buildProtectedApp("admin");
  const token = signJwt({ sub: "GADDRESS", role: "curator" });
  const res = await app.inject({
    method: "GET",
    url: "/protected",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.json().error, "insufficient_role");
});

test("sufficient role passes through to the handler", async () => {
  const app = buildProtectedApp("curator");
  const token = signJwt({ sub: "GADDRESS", role: "admin" });
  const res = await app.inject({
    method: "GET",
    url: "/protected",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.strictEqual(res.statusCode, 200);
});

test("assignRole/getRole round-trips through the in-memory store", () => {
  assert.strictEqual(getRole("GUNASSIGNED"), "contributor");
  assignRole("GTESTADDR", "curator");
  assert.strictEqual(getRole("GTESTADDR"), "curator");
});

test("an expired token is rejected as unauthenticated", async () => {
  const app = buildProtectedApp("contributor");
  const token = signJwt({ sub: "GADDRESS", role: "admin" }, -1);
  const res = await app.inject({
    method: "GET",
    url: "/protected",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.strictEqual(res.statusCode, 401);
});

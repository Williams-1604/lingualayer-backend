import test from "node:test";
import assert from "node:assert";
import Fastify from "fastify";
import { healthRoutes } from "./health.js";
import { dataCommissionEventsIndexedTotal } from "../metrics.js";

test("GET /health returns ok", async () => {
  const app = Fastify();
  await app.register(healthRoutes);

  const res = await app.inject({ method: "GET", url: "/health" });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.json().status, "ok");
});

test("GET /metrics exposes Prometheus text format including counted events", async () => {
  const app = Fastify();
  await app.register(healthRoutes);

  dataCommissionEventsIndexedTotal.inc({ kind: "posted" });

  const res = await app.inject({ method: "GET", url: "/metrics" });
  assert.strictEqual(res.statusCode, 200);
  assert.match(res.headers["content-type"] as string, /text\/plain/);
  assert.match(res.payload, /lingualayer_data_commission_events_indexed_total\{kind="posted"\} \d/);
});

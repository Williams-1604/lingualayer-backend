import test from "node:test";
import assert from "node:assert";
import Fastify from "fastify";
import { qualityRoutes } from "./quality.js";
import { resetCuratorStats } from "../../services/curator-stats.js";

test("POST /quality/attest/prepare requires curator and score", async () => {
  const app = Fastify();
  await app.register(qualityRoutes);

  const res = await app.inject({ method: "POST", url: "/quality/attest/prepare", payload: {} });
  assert.strictEqual(res.statusCode, 400);
});

test("GET /quality/leaderboard reflects recorded attestations", async () => {
  resetCuratorStats();
  const app = Fastify();
  await app.register(qualityRoutes);

  await app.inject({
    method: "POST",
    url: "/quality/attest/prepare",
    payload: { curator: "GABC", score: 90 },
  });

  const res = await app.inject({ method: "GET", url: "/quality/leaderboard" });
  assert.strictEqual(res.statusCode, 200);
  const body = res.json();
  assert.strictEqual(body.curators[0].curator, "GABC");
  assert.strictEqual(body.curators[0].averageScore, 90);
});


test("POST /quality/attest/prepare - 400 when score is out of range", async () => {
  const app = Fastify();
  await app.register(qualityRoutes);

  const response = await app.inject({
    method: "POST",
    url: "/quality/attest/prepare",
    payload: {
      curator_address: "GAQ35U6Z27A6C3W3I2YQY33DCR3FDR27XDFV7Q4O2PCHZZTCRWNN2QYB",
      dataset_id: "ds-1",
      score: 101,
      rubric_markdown: "# Rubric",
    },
  });

  assert.strictEqual(response.statusCode, 400);
});

test("POST /quality/attest/prepare - 500 when contract id is not configured", async () => {
  const app = Fastify();
  await app.register(qualityRoutes);

  const response = await app.inject({
    method: "POST",
    url: "/quality/attest/prepare",
    payload: {
      curator_address: "GAQ35U6Z27A6C3W3I2YQY33DCR3FDR27XDFV7Q4O2PCHZZTCRWNN2QYB",
      dataset_id: "ds-1",
      score: 85,
      rubric_markdown: "# Rubric",
    },
  });

  assert.strictEqual(response.statusCode, 500);
});

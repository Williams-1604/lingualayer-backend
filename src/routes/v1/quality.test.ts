import test from "node:test";
import assert from "node:assert";
import Fastify from "fastify";
import { qualityRoutes } from "./quality.js";

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

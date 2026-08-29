import test from "node:test";
import assert from "node:assert";
import { getRedisClient, isRedisAvailable } from "./redisClient.js";

test("getRedisClient returns null when REDIS_URL is not configured", () => {
  assert.strictEqual(getRedisClient(), null);
});

test("isRedisAvailable resolves false gracefully when REDIS_URL is not configured", async () => {
  assert.strictEqual(await isRedisAvailable(), false);
});

import test from "node:test";
import assert from "node:assert";
import { fetchFromIPFS, metrics } from "./ipfs.js";

test("fetchFromIPFS should failover on timeout", async (t) => {
  // We mock fetch globally
  const originalFetch = global.fetch;

  let attemptCount = 0;
  global.fetch = async (url: RequestInfo | URL, options?: RequestInit) => {
    attemptCount++;
    const urlStr = url.toString();
    
    // Simulate failure for first two gateways
    if (urlStr.includes("pinata.cloud") || urlStr.includes("cloudflare-ipfs")) {
      throw new Error("Simulated network failure");
    }
    
    // Succeed on the third gateway (ipfs.io)
    if (urlStr.includes("ipfs.io")) {
      return {
        ok: true,
        json: async () => ({ mock: "data" })
      } as Response;
    }
    
    throw new Error("Should not reach here");
  };

  try {
    const data = await fetchFromIPFS("QmTest");
    assert.deepStrictEqual(data, { mock: "data" });
    assert.strictEqual(attemptCount, 3);
    
    assert.strictEqual(metrics.ipfs_gateway_failures_total["https://gateway.pinata.cloud/ipfs"], 1);
    assert.strictEqual(metrics.ipfs_gateway_failures_total["https://cloudflare-ipfs.com/ipfs"], 1);
    assert.strictEqual(metrics.ipfs_gateway_failures_total["https://ipfs.io/ipfs"], undefined); // No failure recorded for successful
  } finally {
    global.fetch = originalFetch;
  }
});

import test from "node:test";
import assert from "node:assert";
import { recordAttestation, getLeaderboard, resetCuratorStats } from "./curator-stats.js";

test("recordAttestation tracks count and running average score", () => {
  resetCuratorStats();
  recordAttestation("GABC", 80);
  const updated = recordAttestation("GABC", 100);

  assert.strictEqual(updated.attestationCount, 2);
  assert.strictEqual(updated.averageScore, 90);
});

test("getLeaderboard ranks by attestation count, then average score", () => {
  resetCuratorStats();
  recordAttestation("low-count-high-score", 100);
  recordAttestation("high-count", 50);
  recordAttestation("high-count", 60);

  const leaderboard = getLeaderboard();
  assert.strictEqual(leaderboard[0]?.curator, "high-count");
  assert.strictEqual(leaderboard[0]?.attestationCount, 2);
  assert.strictEqual(leaderboard[1]?.curator, "low-count-high-score");
});

test("getLeaderboard respects the limit", () => {
  resetCuratorStats();
  for (let i = 0; i < 5; i++) recordAttestation(`curator-${i}`, 50);
  assert.strictEqual(getLeaderboard(2).length, 2);
});

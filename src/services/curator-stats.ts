export interface CuratorStats {
  curator: string;
  attestationCount: number;
  averageScore: number;
}

const stats = new Map<string, CuratorStats>();

export function recordAttestation(curator: string, score: number): CuratorStats {
  const existing = stats.get(curator);
  const attestationCount = (existing?.attestationCount ?? 0) + 1;
  const averageScore = existing
    ? (existing.averageScore * existing.attestationCount + score) / attestationCount
    : score;

  const updated: CuratorStats = { curator, attestationCount, averageScore };
  stats.set(curator, updated);
  return updated;
}

export function getLeaderboard(limit = 20): CuratorStats[] {
  return Array.from(stats.values())
    .sort((a, b) => b.attestationCount - a.attestationCount || b.averageScore - a.averageScore)
    .slice(0, limit);
}

/** Test/dev helper — clears the in-memory store between test cases. */
export function resetCuratorStats(): void {
  stats.clear();
}

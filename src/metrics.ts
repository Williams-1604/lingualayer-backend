import { Counter, Registry, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const dataCommissionEventsIndexedTotal = new Counter({
  name: "lingualayer_data_commission_events_indexed_total",
  help: "DataCommission contract events processed by the commission indexer",
  labelNames: ["kind"] as const,
  registers: [registry],
});

// No QualityOracle event indexer exists yet (attestations are currently
// read on demand, not indexed — see src/routes/v1/quality.ts), so this
// tracks attest-prepare requests as the closest available signal of
// QualityOracle activity until #18-style event indexing lands for it too.
export const qualityOracleAttestationsTotal = new Counter({
  name: "lingualayer_quality_oracle_attestations_total",
  help: "QualityOracle attestation preparations handled",
  registers: [registry],
});
// Minimal hand-rolled Prometheus text-exposition-format registry (issue
// #12) - avoids adding prom-client as a new dependency for four counters/
// gauges. If metrics needs grow (histograms with real buckets, summaries),
// swap this for prom-client; the /metrics route in health.ts only depends
// on `renderMetrics()`'s output shape, not this implementation.

const httpRequestsTotal = new Map<string, number>();

export function recordHttpRequest(route: string, statusCode: number) {
  const key = `${route}|${statusCode}`;
  httpRequestsTotal.set(key, (httpRequestsTotal.get(key) ?? 0) + 1);
}

// TODO: wire to the real indexer lag / redis hit ratio / db query duration
// once those subsystems exist (issue #17's indexer, a Redis cache layer).
// Exported setters so those features can report real values without this
// file needing to know about them.
let indexerLagLedgers = 0;
let redisHitRatio = 0;
const dbQueryDurationsMs: number[] = [];

export function setIndexerLagLedgers(n: number) {
  indexerLagLedgers = n;
}

export function setRedisHitRatio(ratio: number) {
  redisHitRatio = ratio;
}

export function recordDbQueryDuration(ms: number) {
  dbQueryDurationsMs.push(ms);
  if (dbQueryDurationsMs.length > 1000) dbQueryDurationsMs.shift();
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function renderMetrics(): string {
  const lines: string[] = [];

  lines.push("# HELP http_requests_total Total HTTP requests by route and status");
  lines.push("# TYPE http_requests_total counter");
  for (const [key, count] of httpRequestsTotal) {
    const [route, status] = key.split("|");
    lines.push(`http_requests_total{route="${escapeLabel(route)}",status="${status}"} ${count}`);
  }

  lines.push("# HELP indexer_lag_ledgers Current indexer lag from chain tip");
  lines.push("# TYPE indexer_lag_ledgers gauge");
  lines.push(`indexer_lag_ledgers ${indexerLagLedgers}`);

  lines.push("# HELP redis_hit_ratio Cache hit ratio, 0-1");
  lines.push("# TYPE redis_hit_ratio gauge");
  lines.push(`redis_hit_ratio ${redisHitRatio}`);

  lines.push("# HELP db_query_duration_ms Database query duration in milliseconds");
  lines.push("# TYPE db_query_duration_ms histogram");
  const buckets = [5, 10, 25, 50, 100, 250, 500, 1000];
  let cumulative = 0;
  for (const bucket of buckets) {
    cumulative = dbQueryDurationsMs.filter((d) => d <= bucket).length;
    lines.push(`db_query_duration_ms_bucket{le="${bucket}"} ${cumulative}`);
  }
  lines.push(`db_query_duration_ms_bucket{le="+Inf"} ${dbQueryDurationsMs.length}`);
  lines.push(`db_query_duration_ms_sum ${dbQueryDurationsMs.reduce((a, b) => a + b, 0)}`);
  lines.push(`db_query_duration_ms_count ${dbQueryDurationsMs.length}`);

  return lines.join("\n") + "\n";
}

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

import { qualityOracleAttestationsTotal } from "../../metrics.js";
export const qualityRoutes = async (app) => {
    app.get("/datasets/:id/quality", async (req) => {
        const { id } = req.params;
        // TODO: query QualityOracle contract + local DB cache
        return {
            dataset_id: id,
            average_score: 0,
            attestation_count: 0,
            tier: "Unrated",
            royalty_multiplier_bps: 10000,
        };
    });
    app.post("/quality/attest/prepare", async (req) => {
        qualityOracleAttestationsTotal.inc();
        // Prepare unsigned XDR for QualityOracle.attest_quality()
        return { xdr: "" };
    });
};

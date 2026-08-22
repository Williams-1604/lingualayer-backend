import { Horizon } from "@stellar/stellar-sdk";
import { getCommissionById, listCommissions, } from "../../services/commission-indexer.js";
const VALID_STATES = ["open", "fulfilled", "cancelled"];
export const commissionRoutes = async (app) => {
    app.get("/commissions", async (req, reply) => {
        const { state, page = "1", limit = "20" } = req.query;
        if (state && !VALID_STATES.includes(state)) {
            return reply.status(400).send({ error: `state must be one of: ${VALID_STATES.join(", ")}` });
        }
        return listCommissions({
            state: state,
            page: Math.max(parseInt(page, 10) || 1, 1),
            limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
        });
    });
    app.get("/commissions/:id", async (req, reply) => {
        const { id } = req.params;
        const commission = getCommissionById(id);
        if (!commission) {
            return reply.status(404).send({ error: "commission not found" });
        }
        return commission;
    });
    app.post("/commissions/prepare", async (req, reply) => {
        const { commissioner, bountyAmountUsdc } = req.body;
        if (!commissioner || !bountyAmountUsdc) {
            return reply.status(400).send({ error: "Missing commissioner or bountyAmountUsdc" });
        }
        const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWTTCJM4RFCKMMGNEQ3C7OQ72N7K6O4LUKXP";
        const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
        try {
            const accountData = await horizon.loadAccount(commissioner);
            const usdcBalance = accountData.balances.find((b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER);
            if (!usdcBalance || parseFloat(usdcBalance.balance) < bountyAmountUsdc) {
                return reply.status(422).send({
                    error: `Insufficient USDC: need ${bountyAmountUsdc}, have ${usdcBalance?.balance ?? 0}`
                });
            }
            return { xdr: "" };
        }
        catch (e) {
            if (e.response && e.response.status === 404) {
                return reply.status(404).send({ error: "Commissioner account not found" });
            }
            throw e;
        }
    });
};

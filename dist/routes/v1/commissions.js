import { Horizon } from "@stellar/stellar-sdk";
export const commissionRoutes = async (app) => {
    app.get("/commissions", async (req) => {
        const { state = "open", page = "1", limit = "20" } = req.query;
        // TODO: query Prisma for commissions with state filter
        return {
            items: [],
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
        };
    });
    app.get("/commissions/:id", async (req) => {
        const { id } = req.params;
        // TODO: fetch commission by ID from DB + on-chain data
        return { id, state: "open" };
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

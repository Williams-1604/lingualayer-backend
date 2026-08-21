import type { FastifyPluginAsync } from "fastify";
import { Horizon } from "@stellar/stellar-sdk";
import {
  getCommissionById,
  upsertCommission,
  listCommissions,
  type CommissionState,
} from "../../services/commission-indexer.js";
import { sendCommissionFulfilmentEmail } from "../../services/notifications.js";

const VALID_STATES: CommissionState[] = ["open", "fulfilled", "cancelled"];

export const commissionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/commissions", async (req, reply) => {
    const { state, page = "1", limit = "20" } = req.query as Record<string, string>;

    if (state && !VALID_STATES.includes(state as CommissionState)) {
      return reply.status(400).send({ error: `state must be one of: ${VALID_STATES.join(", ")}` });
    }

    return listCommissions({
      state: state as CommissionState | undefined,
      page: Math.max(parseInt(page, 10) || 1, 1),
      limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
    });
  });

  app.get("/commissions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const commission = getCommissionById(id);
    if (!commission) {
      return reply.status(404).send({ error: "commission not found" });
    }
    return commission;
  });

  app.post("/commissions/:id/fulfil", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { notifyEmail } = (req.body ?? {}) as { notifyEmail?: string };

    const commission = getCommissionById(id);
    if (!commission) {
      return reply.status(404).send({ error: "commission not found" });
    }
    if (commission.state === "fulfilled") {
      return reply.status(409).send({ error: "commission already fulfilled" });
    }

    const fulfilled = { ...commission, state: "fulfilled" as const };
    upsertCommission(fulfilled);

    let emailSent = false;
    if (notifyEmail) {
      emailSent = await sendCommissionFulfilmentEmail(notifyEmail, fulfilled);
    }

    return { commission: fulfilled, emailSent };
  });

  app.post("/commissions/prepare", async (req, reply) => {
    const { commissioner, bountyAmountUsdc } = req.body as { commissioner: string; bountyAmountUsdc: number };
    
    if (!commissioner || !bountyAmountUsdc) {
      return reply.status(400).send({ error: "Missing commissioner or bountyAmountUsdc" });
    }

    const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWTTCJM4RFCKMMGNEQ3C7OQ72N7K6O4LUKXP";
    const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");

    try {
      const accountData = await horizon.loadAccount(commissioner);              
      const usdcBalance = accountData.balances.find(                            
        (b: any) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER          
      );                                                                        
      
      if (!usdcBalance || parseFloat(usdcBalance.balance) < bountyAmountUsdc) { 
        return reply.status(422).send({ 
          error: `Insufficient USDC: need ${bountyAmountUsdc}, have ${usdcBalance?.balance ?? 0}`
        });
      }
      
      return { xdr: "" };
    } catch (e: any) {
      if (e.response && e.response.status === 404) {
        return reply.status(404).send({ error: "Commissioner account not found" });
      }
      throw e;
    }
  });
};

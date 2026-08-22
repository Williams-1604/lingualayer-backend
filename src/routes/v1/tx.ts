import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { config } from "../../config/env.js";
import {
  AccountNotFoundError,
  addressArg,
  buildFeeBumpXdr,
  prepareContractCallXdr,
  submitSignedXdr,
  TxSimulationError,
} from "../../lib/txBuilder.js";

const registerDatasetSchema = z.object({
  sourceAccount: z.string().min(1),
  cid: z.string().min(1),
  language: z.string().min(1),
});

const issueLicenseSchema = z.object({
  sourceAccount: z.string().min(1),
  datasetId: z.string().min(1),
  licensee: z.string().min(1),
});

const submitSchema = z.object({
  signedXdr: z.string().min(1),
  feeBump: z
    .object({ feeSourceAccount: z.string().min(1), newBaseFee: z.string().min(1) })
    .optional(),
});

function requireContractId(contractId: string | undefined, name: string): string {
  if (!contractId) {
    throw new Error(`${name} is not configured`);
  }
  return contractId;
}

/** Unsigned XDR transaction preparation and submission for Freighter-signed contract calls. */
export const txRoutes: FastifyPluginAsync = async (app) => {
  app.post("/tx/prepare/register-dataset", async (req, reply) => {
    const parsed = registerDatasetSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const contractId = requireContractId(
        config.datasetRegistryContractId,
        "DATASET_REGISTRY_CONTRACT_ID",
      );
      const xdr = await prepareContractCallXdr({
        sourceAccount: parsed.data.sourceAccount,
        contractId,
        functionName: "register_dataset",
        args: [
          addressArg(parsed.data.sourceAccount),
          { value: parsed.data.cid },
          { value: parsed.data.language },
        ],
      });
      return { xdr };
    } catch (err) {
      return handlePrepareError(err, reply);
    }
  });

  app.post("/tx/prepare/issue-license", async (req, reply) => {
    const parsed = issueLicenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const contractId = requireContractId(config.licenseContractId, "LICENSE_CONTRACT_ID");
      const xdr = await prepareContractCallXdr({
        sourceAccount: parsed.data.sourceAccount,
        contractId,
        functionName: "issue_license",
        args: [
          { value: parsed.data.datasetId },
          addressArg(parsed.data.licensee),
        ],
      });
      return { xdr };
    } catch (err) {
      return handlePrepareError(err, reply);
    }
  });

  app.post("/tx/submit", async (req, reply) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      let toSubmit = parsed.data.signedXdr;
      if (parsed.data.feeBump) {
        toSubmit = buildFeeBumpXdr(
          parsed.data.signedXdr,
          parsed.data.feeBump.feeSourceAccount,
          parsed.data.feeBump.newBaseFee,
        );
      }
      const result = await submitSignedXdr(toSubmit);
      return result;
    } catch (err) {
      if (err instanceof TxSimulationError) {
        return reply.status(422).send({ error: err.message });
      }
      throw err;
    }
  });
};

function handlePrepareError(err: unknown, reply: import("fastify").FastifyReply) {
  if (err instanceof AccountNotFoundError) {
    return reply.status(404).send({ error: err.message });
  }
  if (err instanceof TxSimulationError) {
    return reply.status(422).send({ error: err.message });
  }
  if (err instanceof Error && err.message.endsWith("is not configured")) {
    return reply.status(503).send({ error: err.message });
  }
  throw err;
}

import test from "node:test";
import assert from "node:assert";
import { rpc, Keypair, Account } from "@stellar/stellar-sdk";
import {
  AccountNotFoundError,
  TxSimulationError,
  prepareContractCallXdr,
} from "./txBuilder.js";

const FAKE_ACCOUNT_ID = Keypair.random().publicKey();

function withMockedServer(
  overrides: {
    getAccount?: typeof rpc.Server.prototype.getAccount;
    simulateTransaction?: typeof rpc.Server.prototype.simulateTransaction;
  },
  run: () => Promise<void>,
) {
  const originalGetAccount = rpc.Server.prototype.getAccount;
  const originalSimulate = rpc.Server.prototype.simulateTransaction;
  if (overrides.getAccount) rpc.Server.prototype.getAccount = overrides.getAccount;
  if (overrides.simulateTransaction)
    rpc.Server.prototype.simulateTransaction = overrides.simulateTransaction;

  return run().finally(() => {
    rpc.Server.prototype.getAccount = originalGetAccount;
    rpc.Server.prototype.simulateTransaction = originalSimulate;
  });
}

test("prepareContractCallXdr throws AccountNotFoundError when the source account doesn't exist", async () => {
  await withMockedServer(
    {
      getAccount: async () => {
        throw new Error("404");
      },
    },
    async () => {
      await assert.rejects(
        () =>
          prepareContractCallXdr({
            sourceAccount: FAKE_ACCOUNT_ID,
            contractId: "CAEYWTIYD54VLFYIHTU42SAX44IRG5DA5KGLM7WLTWQP46MHBWVUM5WV",
            functionName: "register_dataset",
          }),
        AccountNotFoundError,
      );
    },
  );
});

test("prepareContractCallXdr surfaces a simulation error as TxSimulationError", async () => {
  await withMockedServer(
    {
      getAccount: async () =>
        new Account(FAKE_ACCOUNT_ID, "1") as unknown as Awaited<
          ReturnType<typeof rpc.Server.prototype.getAccount>
        >,
      simulateTransaction: async () =>
        ({
          error: "HostError: contract trapped",
        }) as unknown as Awaited<ReturnType<typeof rpc.Server.prototype.simulateTransaction>>,
    },
    async () => {
      await assert.rejects(
        () =>
          prepareContractCallXdr({
            sourceAccount: FAKE_ACCOUNT_ID,
            contractId: "CAEYWTIYD54VLFYIHTU42SAX44IRG5DA5KGLM7WLTWQP46MHBWVUM5WV",
            functionName: "register_dataset",
          }),
        TxSimulationError,
      );
    },
  );
});

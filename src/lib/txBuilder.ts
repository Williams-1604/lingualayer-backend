import {
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  Address,
  nativeToScVal,
  rpc,
  type xdr,
} from "@stellar/stellar-sdk";

type NativeToScValOpts = Parameters<typeof nativeToScVal>[1];
import { config } from "../config/env.js";

export class TxSimulationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TxSimulationError";
  }
}

export class AccountNotFoundError extends Error {
  constructor(accountId: string) {
    super(`account not found: ${accountId}`);
    this.name = "AccountNotFoundError";
  }
}

function networkPassphrase(): string {
  return config.stellarNetwork === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
}

function server(): rpc.Server {
  return new rpc.Server(config.sorobanRpcUrl, { allowHttp: config.sorobanRpcUrl.startsWith("http://") });
}

export interface ContractCallArg {
  /** Native JS value converted to ScVal via nativeToScVal. Use `type` to disambiguate (e.g. "address", "u64"). */
  value: unknown;
  type?: NonNullable<NativeToScValOpts>["type"];
}

export interface PrepareContractCallInput {
  sourceAccount: string;
  contractId: string;
  functionName: string;
  args?: ContractCallArg[];
}

/**
 * Builds, simulates, and (on success) assembles an unsigned XDR transaction
 * invoking a single contract function. Simulation runs before returning so
 * invalid operations are caught here rather than surfacing as an opaque
 * on-chain failure after the user has already signed in Freighter.
 *
 * Throws AccountNotFoundError if the source account doesn't exist yet, and
 * TxSimulationError (with the Soroban-provided diagnostic message) if
 * simulation fails.
 */
export async function prepareContractCallXdr(input: PrepareContractCallInput): Promise<string> {
  const rpcServer = server();

  let account;
  try {
    account = await rpcServer.getAccount(input.sourceAccount);
  } catch (err) {
    throw new AccountNotFoundError(input.sourceAccount);
  }

  const contract = new Contract(input.contractId);
  const scArgs: xdr.ScVal[] = (input.args ?? []).map((arg) =>
    arg.type ? nativeToScVal(arg.value, { type: arg.type }) : nativeToScVal(arg.value),
  );

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(contract.call(input.functionName, ...scArgs))
    .setTimeout(30)
    .build();

  const simulated = await rpcServer.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulated)) {
    throw new TxSimulationError(simulated.error);
  }
  if (rpc.Api.isSimulationRestore(simulated)) {
    throw new TxSimulationError(
      "contract state needs restoration before this call can succeed (simulation returned a restore preamble)",
    );
  }

  const assembled = rpc.assembleTransaction(tx, simulated).build();
  return assembled.toXDR();
}

export interface SubmitTxResult {
  status: string;
  hash: string;
  latestLedger?: number;
}

/** Relays a signed XDR to the network and polls until the transaction reaches a terminal status. */
export async function submitSignedXdr(signedXdr: string): Promise<SubmitTxResult> {
  const rpcServer = server();
  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase());

  const sendResult = await rpcServer.sendTransaction(tx);
  if (sendResult.status === "ERROR") {
    throw new TxSimulationError(
      `submission rejected: ${JSON.stringify(sendResult.errorResult ?? sendResult.status)}`,
    );
  }

  const hash = sendResult.hash;
  const maxAttempts = 15;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const got = await rpcServer.getTransaction(hash);
    if (got.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
      return { status: got.status, hash, latestLedger: got.latestLedger };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return { status: "PENDING", hash };
}

/** Wraps an existing signed transaction in a fee-bump transaction, for resubmission during slow-network periods. */
export function buildFeeBumpXdr(
  innerSignedXdr: string,
  feeSourceAccount: string,
  newBaseFee: string,
): string {
  const innerTx = TransactionBuilder.fromXDR(innerSignedXdr, networkPassphrase());
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    feeSourceAccount,
    newBaseFee,
    innerTx as import("@stellar/stellar-sdk").Transaction,
    networkPassphrase(),
  );
  return feeBump.toXDR();
}

export function addressArg(value: string): ContractCallArg {
  return { value: new Address(value), type: "address" };
}

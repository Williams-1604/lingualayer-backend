import { EventEmitter } from "node:events";
import { rpc, scValToNative } from "@stellar/stellar-sdk";

export type CommissionState = "open" | "fulfilled" | "cancelled";

export interface Commission {
  id: string;
  commissioner: string;
  bountyAmountUsdc: number;
  languageCode: string;
  state: CommissionState;
  createdLedger: number;
  updatedLedger: number;
}

/**
 * Emits "commission" with the upserted Commission whenever the indexer
 * processes a new or updated event — e.g. for a WebSocket broadcaster to
 * subscribe to.
 */
export const commissionEvents = new EventEmitter();

const store = new Map<string, Commission>();

export function upsertCommission(commission: Commission): void {
  const isNew = !store.has(commission.id);
  store.set(commission.id, commission);
  commissionEvents.emit(isNew ? "commission:new" : "commission:updated", commission);
}

export function getCommissionById(id: string): Commission | undefined {
  return store.get(id);
}

export interface ListCommissionsOptions {
  state?: CommissionState;
  page?: number;
  limit?: number;
}

export function listCommissions(options: ListCommissionsOptions = {}) {
  const { state, page = 1, limit = 20 } = options;

  let items = Array.from(store.values()).sort((a, b) => b.createdLedger - a.createdLedger);
  if (state) {
    items = items.filter((c) => c.state === state);
  }

  const total = items.length;
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    total,
    page,
    limit,
  };
}

/** Test/dev helper — clears the in-memory store between test cases. */
export function resetCommissionStore(): void {
  store.clear();
}

interface ParsedCommissionEvent {
  kind: "posted" | "fulfilled" | "cancelled";
  commission: Commission;
}

/**
 * Parses one DataCommission contract event into a Commission upsert.
 *
 * Event shape (topic, value): `(["commission", "<posted|fulfilled|cancelled>"],
 * { id, commissioner, bounty_amount_usdc, language_code })`. Returns null for
 * events that don't match this shape (defensive — a contract-level rename
 * shouldn't crash the indexer, just skip the event).
 */
export function parseCommissionEvent(
  event: rpc.Api.EventResponse,
): ParsedCommissionEvent | null {
  try {
    const topic = event.topic.map((t) => scValToNative(t));
    if (topic[0] !== "commission") return null;
    const kind = topic[1] as string;
    if (kind !== "posted" && kind !== "fulfilled" && kind !== "cancelled") return null;

    const data = scValToNative(event.value) as Record<string, unknown>;
    const id = String(data.id ?? data.commission_id);
    if (!id || id === "undefined") return null;

    const existing = store.get(id);
    const state: CommissionState =
      kind === "posted" ? "open" : kind === "fulfilled" ? "fulfilled" : "cancelled";

    const commission: Commission = {
      id,
      commissioner: String(data.commissioner ?? existing?.commissioner ?? ""),
      bountyAmountUsdc: Number(data.bounty_amount_usdc ?? existing?.bountyAmountUsdc ?? 0),
      languageCode: String(data.language_code ?? existing?.languageCode ?? ""),
      state,
      createdLedger: existing?.createdLedger ?? event.ledger,
      updatedLedger: event.ledger,
    };

    return { kind, commission };
  } catch {
    return null;
  }
}

export interface IndexerOptions {
  rpcUrl: string;
  contractId: string;
  pollIntervalMs?: number;
}

/**
 * Polls the Soroban RPC `getEvents` endpoint for DataCommission contract
 * events and upserts them into the in-memory store. Returns a stop()
 * function; safe to call multiple times (idempotent upserts keyed by
 * commission id).
 */
export function startCommissionIndexer(options: IndexerOptions): { stop: () => void } {
  const server = new rpc.Server(options.rpcUrl);
  let cursor: string | undefined;
  let stopped = false;

  const filters = [
    {
      type: "contract" as const,
      contractIds: [options.contractId],
    },
  ];

  const poll = async () => {
    if (stopped) return;
    try {
      const response = cursor
        ? await server.getEvents({ cursor, filters, limit: 100 })
        : await server.getEvents({
            startLedger: Math.max((await server.getLatestLedger()).sequence - 1000, 1),
            filters,
            limit: 100,
          });

      for (const event of response.events) {
        const parsed = parseCommissionEvent(event);
        if (parsed) upsertCommission(parsed.commission);
      }

      cursor = response.cursor;
    } catch (err) {
      console.error("commission indexer poll failed:", err);
    }
  };

  const interval = setInterval(poll, options.pollIntervalMs ?? 5000);
  void poll();

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
    },
  };
}

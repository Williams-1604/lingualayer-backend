import type { FastifyPluginAsync } from "fastify";
import {
  Account,
  Keypair,
  Networks,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
const HOME_DOMAIN = process.env.SEP10_HOME_DOMAIN || "linguaFoundation.io";
const WEB_AUTH_DOMAIN = process.env.SEP10_WEB_AUTH_DOMAIN || HOME_DOMAIN;
const CHALLENGE_TIMEOUT_S = 300;
const TOKEN_TTL_S = 3600;

// Falls back to an ephemeral in-memory keypair (with a loud warning) so
// `npm run dev` works out of the box - every real deployment must set
// SEP10_SERVER_SECRET, or every restart invalidates every outstanding
// challenge and the server's identity changes.
function loadServerKeypair(): Keypair {
  const secret = process.env.SEP10_SERVER_SECRET;
  if (secret) return Keypair.fromSecret(secret);
  console.warn(
    "[sep010] SEP10_SERVER_SECRET is not set - using an ephemeral keypair. " +
      "Set it in production; the server's SEP-10 identity must be stable."
  );
  return Keypair.random();
}
const SERVER_KEYPAIR = loadServerKeypair();

function loadJwtSecret(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (secret) return Buffer.from(secret, "utf8");
  console.warn("[sep010] JWT_SECRET is not set - using an ephemeral secret; tokens won't survive a restart.");
  return randomBytes(32);
}
const JWT_SECRET = loadJwtSecret();

// Minimal HMAC-SHA256 JWT (HS256) via node:crypto - avoids adding the
// `jsonwebtoken` dependency for a two-claim token.
function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signJwt(payload: Record<string, unknown>): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export const sep010Routes: FastifyPluginAsync = async (app) => {
  // SEP-0010 challenge endpoint
  app.get("/auth/challenge", async (req, reply) => {
    const { address } = req.query as { address?: string };
    if (!address) return reply.status(400).send({ error: "address required" });
    if (!StrKey.isValidEd25519PublicKey(address)) {
      return reply.status(400).send({ error: "address is not a valid Stellar public key" });
    }

    // 48 random bytes, base64-encoded - the SEP-10 nonce. manage_data values
    // are capped at 64 bytes, so this is the standard size used in the
    // reference implementations.
    const nonce = randomBytes(48);

    // SEP-10 challenge transactions use a fictitious source account at
    // sequence -1: this transaction is never submitted to the network, only
    // signed and handed back for verification, so there's no real sequence
    // number to consume.
    const sourceAccount = new Account(SERVER_KEYPAIR.publicKey(), "-1");

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASE,
      timebounds: {
        minTime: 0,
        maxTime: Math.floor(Date.now() / 1000) + CHALLENGE_TIMEOUT_S,
      },
    })
      .addOperation(
        Operation.manageData({
          name: `${HOME_DOMAIN} auth`,
          value: nonce,
          source: address,
        })
      )
      .addOperation(
        Operation.manageData({
          name: "web_auth_domain",
          value: Buffer.from(WEB_AUTH_DOMAIN),
          source: SERVER_KEYPAIR.publicKey(),
        })
      )
      .build();

    tx.sign(SERVER_KEYPAIR);

    return {
      transaction: tx.toXDR(),
      network_passphrase: NETWORK_PASSPHRASE,
    };
  });

  // SEP-0010 token endpoint
  app.post("/auth/token", async (req, reply) => {
    const { transaction } = req.body as { transaction?: string };
    if (!transaction) return reply.status(400).send({ error: "transaction required" });

    let tx: Transaction;
    try {
      tx = new Transaction(transaction, NETWORK_PASSPHRASE);
    } catch {
      return reply.status(400).send({ error: "Malformed transaction XDR" });
    }

    if (tx.source !== SERVER_KEYPAIR.publicKey()) {
      return reply.status(400).send({ error: "Transaction source is not this server" });
    }
    if (tx.sequence !== "0") {
      return reply.status(400).send({ error: "Transaction sequence must be 0" });
    }

    const [clientOp, domainOp] = tx.operations;
    if (
      clientOp?.type !== "manageData" ||
      clientOp.name !== `${HOME_DOMAIN} auth` ||
      !clientOp.source
    ) {
      return reply.status(400).send({ error: "First operation is not a valid client auth manageData op" });
    }
    if (
      domainOp?.type !== "manageData" ||
      domainOp.name !== "web_auth_domain" ||
      domainOp.value?.toString() !== WEB_AUTH_DOMAIN
    ) {
      return reply.status(400).send({ error: "Second operation is not a valid web_auth_domain manageData op" });
    }

    const clientPublicKey = clientOp.source;
    if (!StrKey.isValidEd25519PublicKey(clientPublicKey)) {
      return reply.status(400).send({ error: "Client auth operation has an invalid source account" });
    }

    const now = Math.floor(Date.now() / 1000);
    if (Number(tx.timeBounds?.maxTime ?? 0) < now) {
      return reply.status(400).send({ error: "Challenge transaction has expired" });
    }

    const hash = tx.hash();
    const serverKp = Keypair.fromPublicKey(SERVER_KEYPAIR.publicKey());
    const clientKp = Keypair.fromPublicKey(clientPublicKey);

    let serverSigned = false;
    let clientSigned = false;
    for (const sig of tx.signatures) {
      if (!serverSigned && serverKp.verify(hash, sig.signature())) serverSigned = true;
      if (!clientSigned && clientKp.verify(hash, sig.signature())) clientSigned = true;
    }

    if (!serverSigned) {
      return reply.status(400).send({ error: "Missing server signature" });
    }
    if (!clientSigned) {
      return reply.status(401).send({ error: "Missing or invalid client signature" });
    }

    const iat = now;
    const exp = now + TOKEN_TTL_S;
    const token = signJwt({ sub: clientPublicKey, iat, exp, home_domain: HOME_DOMAIN });

    return {
      token,
      expires_at: exp,
    };
  });
};

/** Verifies an HS256 JWT issued by signJwt above, for other routes to reuse. */
export function verifyJwt(token: string): { sub: string; iat: number; exp: number } | undefined {
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  const [encodedHeader, encodedPayload, signature] = parts;

  const expected = createHmac("sha256", JWT_SECRET).update(`${encodedHeader}.${encodedPayload}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return undefined;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return undefined;
    return payload;
  } catch {
    return undefined;
  }
}

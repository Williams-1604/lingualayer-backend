import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config/env.js";

/**
 * Minimal HS256 JWT sign/verify. No `jsonwebtoken` dependency — HMAC-SHA256
 * over base64url(header).base64url(payload) is the entire HS256 spec, and
 * this repo otherwise keeps its dependency footprint deliberately small
 * (see the hand-rolled multi-gateway IPFS client for the same pattern).
 */

export interface JwtClaims {
  sub: string;
  role: "contributor" | "curator" | "admin";
  iat: number;
  exp: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export class JwtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtError";
  }
}

export function signJwt(claims: Omit<JwtClaims, "iat" | "exp">, expiresInSeconds = 3600): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullClaims: JwtClaims = { ...claims, iat: now, exp: now + expiresInSeconds };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullClaims));
  const signature = createHmac("sha256", config.jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt(token: string): JwtClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JwtError("malformed token");
  }
  const [encodedHeader, encodedPayload, signature] = parts;

  const expectedSignature = createHmac("sha256", config.jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new JwtError("invalid signature");
  }

  let claims: JwtClaims;
  try {
    claims = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new JwtError("malformed payload");
  }

  if (claims.exp < Math.floor(Date.now() / 1000)) {
    throw new JwtError("token expired");
  }

  return claims;
}

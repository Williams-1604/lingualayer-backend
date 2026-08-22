import { createHmac, timingSafeEqual } from "node:crypto";

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

export interface JwtClaims {
  sub: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

/**
 * Minimal HS256 JWT signer/verifier. Avoids pulling in a JWT dependency for
 * a single-issuer, single-audience token used only by this API.
 */
export function signJwt(claims: JwtClaims, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const headerPart = base64url(JSON.stringify(header));
  const payloadPart = base64url(JSON.stringify(claims));
  const signature = createHmac("sha256", secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest();
  return `${headerPart}.${payloadPart}.${base64url(signature)}`;
}

export function verifyJwt(token: string, secret: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;

  const expected = createHmac("sha256", secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest();
  const actual = base64urlDecode(signaturePart);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  let claims: JwtClaims;
  try {
    claims = JSON.parse(base64urlDecode(payloadPart).toString("utf8"));
  } catch {
    return null;
  }

  if (typeof claims.exp === "number" && claims.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return claims;
}

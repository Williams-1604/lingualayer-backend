import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import { JwtError, verifyJwt, type JwtClaims } from "./jwt.js";

export type Role = JwtClaims["role"];

const ROLE_RANK: Record<Role, number> = {
  contributor: 0,
  curator: 1,
  admin: 2,
};

/**
 * Address → role assignments. In-memory since this scaffold has no
 * database yet — see roles.ts's admin-assignment endpoint for the only
 * write path. A contributor's implicit default (any authenticated address
 * not explicitly assigned a higher role) is "contributor".
 */
const roleAssignments = new Map<string, Role>();

export function assignRole(address: string, role: Role): void {
  roleAssignments.set(address, role);
}

export function getRole(address: string): Role {
  return roleAssignments.get(address) ?? "contributor";
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: JwtClaims;
  }
}

function extractBearerToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

/** Verifies the JWT and attaches claims to `req.auth`. Sends 401 if missing/invalid; does not check role. */
export const requireAuth: preHandlerHookHandler = async (req, reply) => {
  const token = extractBearerToken(req);
  if (!token) {
    return reply.status(401).send({ error: "unauthenticated" });
  }
  try {
    req.auth = verifyJwt(token);
  } catch (err) {
    const message = err instanceof JwtError ? err.message : "invalid token";
    return reply.status(401).send({ error: "unauthenticated", detail: message });
  }
};

/**
 * Requires the caller to be authenticated AND hold at least `minimumRole`
 * (role rank contributor < curator < admin — an admin passes a `curator`
 * check). 401 if unauthenticated, 403 with `{ error: "insufficient_role" }`
 * if authenticated but under-ranked, matching the acceptance criteria.
 */
export function requireRole(minimumRole: Role): preHandlerHookHandler {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const token = extractBearerToken(req);
    if (!token) {
      return reply.status(401).send({ error: "unauthenticated" });
    }
    let claims: JwtClaims;
    try {
      claims = verifyJwt(token);
    } catch (err) {
      const message = err instanceof JwtError ? err.message : "invalid token";
      return reply.status(401).send({ error: "unauthenticated", detail: message });
    }
    req.auth = claims;

    if (ROLE_RANK[claims.role] < ROLE_RANK[minimumRole]) {
      return reply.status(403).send({ error: "insufficient_role" });
    }
  };
}

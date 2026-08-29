import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assignRole, getRole, requireRole } from "../../lib/rbac.js";

const assignRoleSchema = z.object({
  address: z.string().min(1),
  role: z.enum(["contributor", "curator", "admin"]),
});

/** Admin-only role assignment. See lib/rbac.ts for the requireRole preHandler used throughout the API. */
export const rolesRoutes: FastifyPluginAsync = async (app) => {
  app.post("/admin/roles", { preHandler: requireRole("admin") }, async (req, reply) => {
    const parsed = assignRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    assignRole(parsed.data.address, parsed.data.role);
    return reply.status(200).send({ address: parsed.data.address, role: parsed.data.role });
  });

  app.get("/admin/roles/:address", { preHandler: requireRole("admin") }, async (req) => {
    const { address } = req.params as { address: string };
    return { address, role: getRole(address) };
  });
};

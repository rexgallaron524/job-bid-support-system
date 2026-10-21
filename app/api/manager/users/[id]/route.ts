import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { api, ApiError, json, jsonBody, managerFor } from "@/lib/server";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  return api(async () => {
    const manager = await managerFor(request);
    const { id } = await context.params;
    const input = z.object({ status: z.enum(["approved", "rejected", "suspended"]) }).strict().parse(await jsonBody(request, 4096));
    await getDb().transaction(async tx => {
      const [target] = await tx.select().from(users).where(eq(users.id, id)).for("update");
      if (!target) throw new ApiError(404, "User not found.");
      if (target.role === "manager" || id === manager.userId) throw new ApiError(403, "Manager accounts are managed from the server.");
      await tx.update(users).set({ status: input.status }).where(eq(users.id, id));
      // Reapproval also starts with fresh sessions.
      await tx.delete(sessions).where(eq(sessions.userId, id));
    });
    return json({ success: true });
  });
}
export async function DELETE(request: Request, context: Context) {
  return api(async () => {
    const manager = await managerFor(request);
    const { id } = await context.params;
    const input = z.object({ confirmationEmail: z.string() }).strict().parse(await jsonBody(request, 4096));
    await getDb().transaction(async tx => {
      const [target] = await tx.select().from(users).where(eq(users.id, id)).for("update");
      if (!target) throw new ApiError(404, "User not found.");
      if (target.role === "manager" || id === manager.userId) throw new ApiError(403, "Manager accounts are managed from the server.");
      if (input.confirmationEmail !== target.email) throw new ApiError(400, "Type the user's email to confirm deletion.");
      // PostgreSQL cascades through sessions, jobs, and resume bytes in this transaction.
      await tx.delete(users).where(eq(users.id, id));
    });
    return json({ success: true });
  });
}


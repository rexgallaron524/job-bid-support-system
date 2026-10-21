import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { api, json, jsonBody, userFor } from "@/lib/server";
export async function PATCH(request: Request) {
  return api(async () => {
    const user = await userFor(request);
    const input = z.object({ theme: z.enum(["dark", "light"]).optional(), applicationPageSize: z.union([z.literal(10), z.literal(20), z.literal(50)]).optional() }).strict()
      .refine(value => value.theme !== undefined || value.applicationPageSize !== undefined, "Choose a preference to update.").parse(await jsonBody(request, 1024));
    await getDb().update(users).set(input).where(eq(users.id, user.userId));
    return json({ success: true });
  });
}

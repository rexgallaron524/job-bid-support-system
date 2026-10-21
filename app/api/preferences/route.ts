import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { api, json, jsonBody, userFor } from "@/lib/server";
export async function PATCH(request: Request) {
  return api(async () => {
    const user = await userFor(request);
    const input = z.object({ theme: z.enum(["dark", "light"]) }).strict().parse(await jsonBody(request, 1024));
    await getDb().update(users).set(input).where(eq(users.id, user.userId));
    return json({ success: true });
  });
}

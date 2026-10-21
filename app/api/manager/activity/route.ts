import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { activityReport } from "@/lib/activity-server";
import { api, ApiError, json, managerFor } from "@/lib/server";
export async function GET(request: Request) {
  return api(async () => {
    await managerFor(request);
    const params = new URL(request.url).searchParams, owner = params.get("userId");
    if (!owner) throw new ApiError(400, "Choose a user.");
    const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.id, owner));
    if (!user) throw new ApiError(404, "This user was not found.");
    return json(await activityReport(owner, params));
  });
}

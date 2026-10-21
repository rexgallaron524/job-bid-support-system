import { activityReport } from "@/lib/activity-server";
import { api, json, userFor } from "@/lib/server";
export async function GET(request: Request) {
  return api(async () => {
    const user = await userFor(request);
    return json(await activityReport(user.userId, new URL(request.url).searchParams));
  });
}

import { notFound, redirect } from "next/navigation";
import { currentUser, managerPath } from "@/lib/auth";
import ManagerDashboard from "../manager-dashboard";
export const dynamic = "force-dynamic";
export default async function ManagerPage({ params }: { params: Promise<{ manager: string }> }) {
  if ("/" + (await params).manager !== managerPath()) notFound();
  const user = await currentUser();
  if (!user) redirect("/");
  if (user.role !== "manager") notFound();
  return <ManagerDashboard initialTheme={user.theme} />;
}


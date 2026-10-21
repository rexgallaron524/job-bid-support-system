import { currentUser, managerPath } from "@/lib/auth";
import Workspace from "./workspace";
import AuthScreen from "./auth-screen";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await currentUser();
  if (!user) return <AuthScreen />;
  return <Workspace user={{ name: user.name, email: user.email, theme: user.theme }} managerUrl={user.role === "manager" ? managerPath() : undefined} />;
}

"use client";
import { LogOut } from "lucide-react";
export default function SignOut({ compact = false }: { compact?: boolean }) {
  return <button className={compact ? "icon-button" : "btn"} aria-label="Sign out" title="Sign out" onClick={async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      window.location.assign("/");
    } catch (error) { window.alert((error as Error).message); }
  }}><LogOut size={16} />{!compact && "Sign out"}</button>;
}


import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await currentSession())) redirect("/login");
  return <AppShell>{children}</AppShell>;
}

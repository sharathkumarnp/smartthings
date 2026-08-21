import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
export default async function LoginPage() {
  if (await currentSession()) redirect("/");
  return (
    <main className="login-page">
      <div className="login-atmosphere" />
      <LoginForm />
      <p className="login-footnote">One owner · server-authorized · private by default</p>
    </main>
  );
}

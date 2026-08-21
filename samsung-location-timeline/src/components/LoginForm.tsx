"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") })
    });
    if (!response.ok) {
      setError((await response.json()).error || "Sign in failed");
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }
  return (
    <form className="login-card" onSubmit={submit}>
      <div className="brand-mark">
        <LocateFixed size={22} />
      </div>
      <p className="eyebrow">PRIVATE TIMELINE</p>
      <h1>Welcome back.</h1>
      <p className="muted">Your recorded locations stay behind this private session.</p>
      <label>
        Email
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" minLength={8} required />
      </label>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <button className="primary-button" disabled={loading}>
        {loading ? "Signing in…" : "Open timeline"}
      </button>
    </form>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { cn } from "@/lib/utils";

export default function SignInPage() {
  const router = useRouter();
  const [callbackUrl, setCallbackUrl] = useState("/app");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setCallbackUrl(sp.get("callbackUrl") ?? "/app");
    } catch {
      setCallbackUrl("/app");
    }
  }, []);

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length > 0,
    [email, password]
  );

  return (
    <div className="min-h-[100vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-7 shadow-[0_0_60px_rgba(99,102,241,0.10)]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="h-14 w-14 mb-4">
            <img
              src="/logo.png"
              alt="DataForge"
              className="h-full w-full object-contain drop-shadow-[0_0_15px_rgba(147,51,234,0.4)]"
            />
          </div>
          <div className="text-sm text-white/50 font-medium uppercase tracking-widest mb-1">DataForge AI</div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome back
          </h1>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            try {
              const res = await signIn("credentials", {
                email,
                password,
                redirect: false,
                callbackUrl,
              });

              if (res?.error) {
                setError("Invalid email or password.");
                return;
              }
              router.push(callbackUrl);
            } catch {
              setError("Something went wrong.");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div>
            <label className="text-sm text-white/70">Email</label>
            <input
              className={cn(
                "mt-1 w-full h-11 rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:ring-2 focus:ring-cyan-300/30"
              )}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              type="email"
            />
          </div>
          <div>
            <label className="text-sm text-white/70">Password</label>
            <input
              className={cn(
                "mt-1 w-full h-11 rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:ring-2 focus:ring-cyan-300/30"
              )}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              type="password"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-pink-400/30 bg-pink-500/10 p-3 text-sm text-pink-200">
              {error}
            </div>
          ) : null}

          <button
            disabled={!canSubmit || loading}
            className="w-full h-11 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <div className="text-xs text-white/60 text-center">
            New here?{" "}
            <button
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
              type="button"
              onClick={() => router.push("/sign-up")}
            >
              Create an account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
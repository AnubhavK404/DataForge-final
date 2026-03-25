"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { cn } from "@/lib/utils";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length >= 8,
    [email, password]
  );

  return (
    <div className="min-h-[100vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-7 shadow-[0_0_60px_rgba(99,102,241,0.10)]">
        <div className="mb-6">
          <div className="text-sm text-white/60">Create your DataForge account</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">
            Sign up
          </h1>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            try {
              const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email, password, name: name || undefined }),
              });
              const data = await res.json();
              if (!res.ok) {
                setError(data?.error ?? "Could not create account.");
                return;
              }

              const signInRes = await signIn("credentials", {
                email,
                password,
                redirect: false,
                callbackUrl: "/app",
              });
              if (signInRes?.error) {
                setError("Account created, but sign-in failed. Please sign in again.");
                return;
              }
              router.push("/app");
            } catch {
              setError("Something went wrong.");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div>
            <label className="text-sm text-white/70">Name (optional)</label>
            <input
              className={cn(
                "mt-1 w-full h-11 rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:ring-2 focus:ring-cyan-300/30"
              )}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              autoComplete="name"
            />
          </div>
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
              placeholder="At least 8 characters"
              autoComplete="new-password"
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
            {loading ? "Creating..." : "Create account"}
          </button>

          <div className="text-xs text-white/60 text-center">
            By continuing, you agree to our{" "}
            <span className="text-white/80">Terms</span> and{" "}
            <span className="text-white/80">Privacy</span>.
          </div>
        </form>

        <div className="mt-5 text-sm text-white/70 text-center">
          Already have an account?{" "}
          <button
            className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
            onClick={() => router.push("/sign-in")}
            type="button"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}


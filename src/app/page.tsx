"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <div className="min-h-[100vh] flex flex-col">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-background/70 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="relative h-10 w-10 transition-transform duration-300 group-hover:scale-110">
              <img
                src="/logo.png"
                alt="DataForge Logo"
                className="h-full w-full object-contain rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.4)]"
              />
            </div>
            <span className="font-bold tracking-tight text-xl text-foreground bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-purple-400">
              DataForge
            </span>
          </div>

          <div className="flex items-center gap-3">
            {status === "loading" ? (
              <div className="h-9 w-28 rounded-full animate-pulse bg-white/5" />
            ) : session ? (
              <>
                <Link
                  href="/app"
                  className="h-9 px-4 flex items-center justify-center rounded-full text-[13px] font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-all hover:border-white/20 active:scale-95"
                >
                  Open App
                </Link>
                <button
                  onClick={() => signOut()}
                  className="h-9 px-4 flex items-center justify-center rounded-full text-[13px] font-semibold text-white/60 hover:text-white transition-all active:scale-95"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in?callbackUrl=/app"
                  className="h-9 px-4 rounded-full text-[13px] font-semibold text-white/70 hover:text-white transition-all inline-flex items-center justify-center active:scale-95"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="h-9 px-5 rounded-full text-[13px] font-bold bg-white text-black hover:bg-white/90 transition-all active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.15)] flex items-center justify-center"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-16 flex flex-col gap-16">
        <section className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-purple-400">
              <span className="flex h-2 w-2 rounded-full bg-purple-400" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-purple-300/90">
                Data Analysis
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] text-white">
              Turn data into{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-red-400">
                clear reports
              </span>.
            </h1>
            <p className="text-white/60 text-xl leading-relaxed max-w-xl">
              Analyze your datasets, create visualizations, and generate reports that are easy to understand.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                href={session ? "/app" : "/sign-in"}
                className="h-12 px-8 rounded-full font-semibold bg-white text-black hover:bg-white/90 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(168,85,247,0.3)] retro-glow flex items-center justify-center"
              >
                Get Started
              </Link>
              <Link
                href="/demo"
                className="h-12 px-8 rounded-full font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-all hover:border-white/20 active:scale-95 flex items-center justify-center"
              >
                Watch Demo
              </Link>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative rounded-[2rem] border border-white/10 bg-[#0A0A0B] p-2 shadow-2xl overflow-hidden">
              <div className="rounded-[1.5rem] overflow-hidden border border-white/5">
                <img
                  src="/instant-dashboard.png"
                  alt="DataForge Dashboard Preview"
                  className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-[1.02]"
                />
              </div>
              <div className="absolute top-6 left-8 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/90">Live Dashboard</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Instant reports",
              desc: "Upload files and generate a dashboard in one click.",
              icon: "📄",
            },
            {
              title: "Data summary",
              desc: "Get a clear summary of your metrics in plain language.",
              icon: "📝",
            },
            {
              title: "Shareable PDF",
              desc: "Export your findings as clean PDF reports.",
              icon: "📤",
            },
          ].map(({ title, desc, icon }) => (
            <div
              key={title}
              className="group relative rounded-3xl border border-white/10 bg-white/5 p-8 transition-all hover:bg-white/[0.08] hover:border-white/20"
            >
              <div className="text-3xl mb-4 transform transition-transform group-hover:scale-110 group-hover:rotate-6 duration-300">
                {icon}
              </div>
              <div className="text-lg font-bold text-white">{title}</div>
              <div className="text-white/50 mt-3 leading-relaxed">{desc}</div>
            </div>
          ))}
        </section>

        <section className="grid md:grid-cols-2 gap-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 flex flex-col gap-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Advanced Trends</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                Visualize complex data movements across different segments with high-precision trend analysis.
              </p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/5 bg-black/40">
              <img src="/trend-analysis.png" alt="Trend Analysis" className="w-full h-auto" />
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 flex flex-col gap-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Smart Recommendations</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                Get actionable advice derived from deep statistical patterns identified in your datasets.
              </p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/5 bg-black/40">
              <img src="/recommendations.png" alt="Recommendations" className="w-full h-auto" />
            </div>
          </div>
        </section>

        <section className="mt-12 relative rounded-[2.5rem] overflow-hidden border border-white/10 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10 p-12 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Simple data analysis.</h2>
            <p className="text-white/60">
              Create reports and visualize your data without the complexity.
            </p>
            <div className="pt-4">
              <img
                src="/dashboard-preview.png"
                alt="Dashboard Preview"
                className="rounded-2xl border border-white/10 shadow-2xl transform hover:scale-[1.01] transition-transform duration-500"
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t border-white/5 py-12 bg-black/40">
        <div className="mx-auto w-full max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-8 text-white/40 text-sm">
          <div className="flex items-center gap-2 font-bold text-white/60">
            <img src="/logo.png" className="h-5 w-5 object-contain opacity-80" alt="" />
            DataForge
          </div>
          <div className="flex items-center gap-8">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div>
            © 2026 DataForge AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

 "use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Home() {
<<<<<<< HEAD
   const { data: session, status } = useSession();

   return (
     <div className="min-h-[100vh] flex flex-col">
       <header className="sticky top-0 z-40 border-b border-white/5 bg-background/70 backdrop-blur">
         <div className="mx-auto w-full max-w-6xl px-6 py-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 via-cyan-400 to-pink-500 shadow-[0_0_40px_rgba(99,102,241,0.25)]" />
             <span className="font-semibold tracking-tight text-foreground">
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
                   className="h-9 px-4 rounded-full text-sm border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                 >
                   Open App
                 </Link>
                 <button
                   onClick={() => signOut()}
                   className="h-9 px-4 rounded-full text-sm border border-white/10 bg-transparent hover:bg-white/5 transition-colors"
                 >
                   Sign out
                 </button>
               </>
             ) : (
               <>
                <Link
                  href="/sign-in?callbackUrl=/app"
                  className="h-9 px-4 rounded-full text-sm border border-white/10 bg-white/5 hover:bg-white/10 transition-colors inline-flex items-center justify-center"
                >
                  Sign in
                </Link>
                 <Link
                   href="/sign-up"
                   className="h-9 px-4 rounded-full text-sm border border-white/10 bg-transparent hover:bg-white/5 transition-colors"
                 >
                   Create account
                 </Link>
               </>
             )}
           </div>
         </div>
       </header>

       <main className="mx-auto w-full max-w-6xl px-6 py-14 flex flex-col gap-10">
         <section className="grid md:grid-cols-2 gap-10 items-center">
           <div className="space-y-6">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5">
               <span className="text-xs text-cyan-300/90">AI-assisted</span>
               <span className="text-xs text-white/60">
                 Upload → Insights → Interactive dashboard
               </span>
             </div>
             <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
               Turn messy data into{" "}
               <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-300 to-pink-300">
                 visual stories
               </span>{" "}
               in minutes.
             </h1>
             <p className="text-white/70 text-lg leading-7">
               DataForge analyzes your dataset, suggests jaw-dropping charts,
               and generates beginner-friendly insights you can share instantly.
             </p>
             <div className="flex flex-wrap gap-3">
               <Link
                 href={session ? "/app" : "/sign-in"}
                 className="h-11 px-6 rounded-full font-medium bg-white text-black hover:bg-white/90 transition-colors"
               >
                 Start for free
               </Link>
               <Link
                 href="/demo"
                 className="h-11 px-6 rounded-full font-medium border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
               >
                 See a sample dashboard
               </Link>
             </div>
           </div>

           <div className="relative">
             <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_60px_rgba(99,102,241,0.12)]">
               <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-2">
                   <div className="h-2.5 w-2.5 rounded-full bg-pink-400" />
                   <div className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
                   <div className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
                 </div>
                 <div className="text-xs text-white/60">Instant dashboard</div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                   <div className="animate-shimmer h-4 w-24 rounded bg-white/10 bg-gradient-to-r from-white/5 to-white/20" />
                   <div className="mt-3 h-28 rounded-xl bg-white/5" />
                 </div>
                 <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                   <div className="animate-shimmer h-4 w-32 rounded bg-white/10 bg-gradient-to-r from-white/5 to-white/20" />
                   <div className="mt-3 h-28 rounded-xl bg-white/5" />
                 </div>
                 <div className="col-span-2 rounded-2xl border border-white/10 bg-black/20 p-4">
                   <div className="animate-shimmer h-4 w-52 rounded bg-white/10 bg-gradient-to-r from-white/5 to-white/20" />
                   <div className="mt-3 h-36 rounded-xl bg-white/5" />
                 </div>
               </div>
               <div className="mt-6 flex items-center justify-between text-xs text-white/60">
                 <span>Drag charts to rearrange</span>
                 <span>Export PNG/PDF</span>
               </div>
             </div>
           </div>
         </section>

         <section className="grid md:grid-cols-3 gap-4">
           {[
             [
               "Instant magic",
               "Upload CSV/Excel/JSON and get charts + stats immediately.",
             ],
             ["Explain my data", "AI insights in plain English for beginners."],
             ["Shareable stories", "Build dashboards or one-click scroll narratives."],
           ].map(([title, desc]) => (
             <div
               key={title}
               className="rounded-2xl border border-white/10 bg-white/5 p-5"
             >
               <div className="text-sm font-medium">{title}</div>
               <div className="text-sm text-white/70 mt-2">{desc}</div>
             </div>
           ))}
         </section>
       </main>
     </div>
   );
 }
=======
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
                className="h-full w-full object-contain rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)]"
              />
            </div>
            <span className="font-bold tracking-tight text-xl text-foreground bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
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
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-cyan-300/90">
                AI-Powered Analytics
              </span>
              <span className="h-3 w-px bg-white/10" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">
                v2.0 Beta
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] text-white">
              Turn messy data into{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-300 to-pink-300">
                visual stories
              </span>{" "}
              in seconds.
            </h1>
            <p className="text-white/60 text-xl leading-relaxed max-w-xl">
              DataForge uses advanced AI to analyze your datasets, suggest high-impact visualizations,
              and generate shareable narratives that anyone can understand.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                href={session ? "/app" : "/sign-in"}
                className="h-12 px-8 rounded-full font-semibold bg-white text-black hover:bg-white/90 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center justify-center"
              >
                Start for free
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
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-pink-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
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
              title: "Instant magic",
              desc: "Upload CSV/Excel/JSON and get a fully interactive dashboard in one click.",
              icon: "✨",
            },
            {
              title: "Explain my data",
              desc: "Our AI translates complex metrics into plain English for non-technical users.",
              icon: "🤖",
            },
            {
              title: "Shareable stories",
              desc: "Export your insights as high-fidelity PDF reports or live web narratives.",
              icon: "🚀",
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

        <section className="mt-12 relative rounded-[2.5rem] overflow-hidden border border-white/10 bg-gradient-to-br from-indigo-500/10 via-transparent to-cyan-500/10 p-12 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Experience the future of analysis.</h2>
            <p className="text-white/60">
              Join thousands of data scientists and business analysts who are already 
              transforming their raw data into high-impact narratives.
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
>>>>>>> d0cf273 (Initial commit)

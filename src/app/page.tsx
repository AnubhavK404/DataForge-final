 "use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Home() {
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

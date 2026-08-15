"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <header className="sticky top-0 z-40 bg-[#f9f9f6] border-b-[3px] border-[#1a1a1a]">
        <div className="mx-auto w-full max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#1a1a1a] flex items-center justify-center border-[3px] border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a]">
              <div className="w-5 h-5 bg-gradient-to-b from-white to-gray-400 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] border-2 border-[#1a1a1a]" />
            </div>
            <span className="font-black tracking-tighter text-2xl text-[#1a1a1a] uppercase">
              DataForge
            </span>
          </div>

          <div className="flex items-center gap-4 font-mono text-sm">
            {status === "loading" ? (
              <div className="h-10 w-28 skeuo-panel animate-pulse" />
            ) : session ? (
              <>
                <Link
                  href="/app"
                  className="skeuo-btn px-6 py-2.5"
                >
                  Open App
                </Link>
                <button
                  onClick={() => signOut()}
                  className="font-bold text-[#1a1a1a] underline decoration-[3px] underline-offset-[5px] hover:bg-[#1a1a1a] hover:text-[#f9f9f6] px-3 py-1.5 transition-colors border-2 border-transparent hover:border-[#1a1a1a]"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in?callbackUrl=/app"
                  className="font-bold text-[#1a1a1a] underline decoration-[3px] underline-offset-[5px] hover:bg-[#1a1a1a] hover:text-[#f9f9f6] px-3 py-1.5 transition-colors border-2 border-transparent hover:border-[#1a1a1a]"
                >
                  Log In
                </Link>
                <Link
                  href="/sign-up"
                  className="skeuo-btn px-6 py-2.5"
                >
                  Forge Account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-20 flex flex-col gap-24 flex-1">
        <section className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-block font-mono border-[3px] border-[#1a1a1a] bg-[#ff6b35] text-white font-bold px-4 py-2 shadow-[4px_4px_0px_#1a1a1a] uppercase tracking-widest text-xs transform -rotate-2">
              &gt; Raw_Data_To_Hard_Facts
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.95] text-[#1a1a1a] uppercase">
              Build <br />
              <span className="text-[#2563eb] underline decoration-[8px] underline-offset-8">Reports</span> <br />
              Fast.
            </h1>
            <p className="text-[#1a1a1a] font-bold text-xl md:text-2xl leading-snug border-l-[6px] border-[#1a1a1a] pl-6 py-2 bg-white/50">
              Stop fighting with complicated tools. Upload data, view metrics, and export hard copies in seconds.
            </p>
            <div className="flex flex-wrap gap-6 pt-6">
              <Link
                href={session ? "/app" : "/sign-in"}
                className="skeuo-btn skeuo-btn-accent px-10 py-5 text-xl inline-flex items-center justify-center font-sans"
              >
                Start Forging
              </Link>
              <Link
                href="/demo"
                className="skeuo-btn px-10 py-5 text-xl inline-flex items-center justify-center font-sans"
              >
                Watch Demo
              </Link>
            </div>
          </div>

          <div className="relative z-10 hidden md:block pt-8 pl-8">
            <div className="absolute inset-0 bg-[#2563eb] border-[3px] border-[#1a1a1a] shadow-[8px_8px_0px_#1a1a1a] translate-x-4 translate-y-4"></div>
            <div className="skeuo-panel p-5 relative z-20 hover:-translate-y-1 hover:-translate-x-1 transition-transform duration-200 shadow-[8px_8px_0px_rgba(26,26,26,0.2)]">
              <div className="flex items-center justify-between border-b-[3px] border-[#1a1a1a] pb-3 mb-4">
                 <div className="flex gap-2">
                   <div className="w-5 h-5 rounded-full border-[3px] border-[#1a1a1a] bg-[#ff6b35] shadow-[inset_-1px_-1px_2px_rgba(0,0,0,0.4)]"></div>
                   <div className="w-5 h-5 rounded-full border-[3px] border-[#1a1a1a] bg-[#f59e0b] shadow-[inset_-1px_-1px_2px_rgba(0,0,0,0.4)]"></div>
                   <div className="w-5 h-5 rounded-full border-[3px] border-[#1a1a1a] bg-[#10b981] shadow-[inset_-1px_-1px_2px_rgba(0,0,0,0.4)]"></div>
                 </div>
                 <span className="font-mono font-bold text-sm uppercase tracking-widest text-[#1a1a1a]">Dashboard.exe</span>
              </div>
              <div className="border-[3px] border-[#1a1a1a] bg-[#f9f9f6] shadow-[inset_3px_3px_10px_rgba(0,0,0,0.15)] overflow-hidden">
                <img
                  src="/instant-dashboard.png"
                  alt="Dashboard Preview"
                  className="w-full h-auto object-cover opacity-90 saturate-50 contrast-125 mix-blend-multiply"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Drop Files",
              desc: "Throw your CSVs in. We forge the structure instantly.",
              number: "01",
              color: "#ff6b35" /* Action Orange */
            },
            {
              title: "Analyze",
              desc: "Raw metrics, no fluff. See exactly what your data says.",
              number: "02",
              color: "#2563eb" /* Trust Blue */
            },
            {
              title: "Export",
              desc: "Get a printable PDF. Analog ready for your next meeting.",
              number: "03",
              color: "#10b981" /* Success Emerald */
            }
          ].map(({ title, desc, number, color }) => (
            <div
              key={title}
              className="brutal-card p-10 bg-white relative overflow-hidden group"
            >
              <div 
                className="absolute -right-6 -top-6 text-[120px] font-mono font-black opacity-10 group-hover:scale-110 transition-transform duration-300 pointer-events-none"
                style={{ color }}
              >
                {number}
              </div>
              <div className="text-6xl font-mono font-black mb-6 drop-shadow-[3px_3px_0px_#1a1a1a]" style={{ color }}>{number}</div>
              <h3 className="text-3xl font-black uppercase mb-4 text-[#1a1a1a] border-b-[3px] border-[#1a1a1a] pb-2 inline-block">{title}</h3>
              <p className="text-[#1a1a1a] font-bold text-lg leading-relaxed relative z-10">{desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t-[4px] border-[#1a1a1a] bg-[#ffffff] py-12 mt-auto">
        <div className="mx-auto w-full max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
             <div className="h-8 w-8 bg-[#1a1a1a] border-2 border-[#1a1a1a]"></div>
            <span className="font-black text-2xl uppercase tracking-tighter text-[#1a1a1a]">DataForge</span>
          </div>
          <div className="flex items-center gap-8 font-mono font-bold uppercase text-sm text-[#1a1a1a]">
            <a href="#" className="hover:underline decoration-[3px] underline-offset-4 hover:text-[#2563eb] transition-colors">Privacy</a>
            <a href="#" className="hover:underline decoration-[3px] underline-offset-4 hover:text-[#2563eb] transition-colors">Terms</a>
            <a href="#" className="hover:underline decoration-[3px] underline-offset-4 hover:text-[#2563eb] transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

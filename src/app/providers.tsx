"use client";

import { SessionProvider } from "next-auth/react";
import { BeginnerModeProvider } from "@/context/beginner-mode-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BeginnerModeProvider>{children}</BeginnerModeProvider>
    </SessionProvider>
  );
}


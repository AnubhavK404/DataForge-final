"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type BeginnerModeContextValue = {
  beginnerMode: boolean;
  setBeginnerMode: (next: boolean) => Promise<void>;
  saving: boolean;
};

const BeginnerModeContext = createContext<BeginnerModeContextValue | null>(null);

const STORAGE_KEY = "dataforge.beginnerMode";

export function BeginnerModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status, update } = useSession();

  const [beginnerMode, setBeginnerModeState] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  // localStorage fallback for unsigned users + immediate UX.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return;
      setBeginnerModeState(raw === "true");
    } catch {
      // ignore
    }
  }, []);

  // If signed in, prefer DB-derived value from the session.
  useEffect(() => {
    const v = (session?.user as unknown as { beginnerMode?: unknown })
      ?.beginnerMode;
    if (typeof v === "boolean") {
      setBeginnerModeState(v);
      try {
        localStorage.setItem(STORAGE_KEY, String(v));
      } catch {
        // ignore
      }
    }
  }, [session?.user]);

  const value = useMemo<BeginnerModeContextValue>(
    () => ({
      beginnerMode,
      saving,
      setBeginnerMode: async (next) => {
        setBeginnerModeState(next);
        try {
          localStorage.setItem(STORAGE_KEY, String(next));
        } catch {
          // ignore
        }

        if (status !== "authenticated") return;

        setSaving(true);
        try {
          const res = await fetch("/api/user/preferences", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ beginnerMode: next }),
          });
          if (!res.ok) throw new Error("Preference update failed.");
          await update?.();
        } finally {
          setSaving(false);
        }
      },
    }),
    [beginnerMode, saving, status, update]
  );

  return (
    <BeginnerModeContext.Provider value={value}>
      {children}
    </BeginnerModeContext.Provider>
  );
}

export function useBeginnerMode() {
  const ctx = useContext(BeginnerModeContext);
  if (!ctx) throw new Error("useBeginnerMode must be used within provider");
  return ctx;
}


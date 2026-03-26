import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt" as const,
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email },
          });
        } catch {
          return null; // Never crash login if DB isn't ready.
        }
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, attach user metadata for tier gating.
      if (user?.id) {
        let dbUser;
        try {
          dbUser = await prisma.user.findUnique({
            where: { id: user.id as string },
            include: { subscription: true, preferences: true },
          });
        } catch {
          dbUser = null;
        }

        token.uid = dbUser?.id ?? user.id;
        token.plan = "PRO";
        token.beginnerMode = dbUser?.preferences?.beginnerMode ?? true;
      }

      return token;
    },
    async session({ session, token }) {
      if (!session.user) return session;

      const uid = token.uid;
      let plan = "PRO";
      let beginnerMode = (token.beginnerMode as boolean) ?? true;

      // Keep session metadata in sync with DB (e.g. Beginner Mode toggle).
      if (typeof uid === "string") {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: uid },
            include: { subscription: true, preferences: true },
          });
          if (dbUser) {
            plan = "PRO";
            beginnerMode = dbUser.preferences?.beginnerMode ?? true;
          }
        } catch {
          // If DB connection isn't ready (dev), fall back to JWT token values.
        }
      }

      return {
        ...session,
        user: {
          ...session.user,
          id: typeof uid === "string" ? uid : session.user.id,
          plan,
          beginnerMode,
        },
      } as typeof session;
    },
  },
};


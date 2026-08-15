import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const BodySchema = z.object({
  beginnerMode: z.boolean(),
});

export async function PUT(req: Request) {
  try {
    const session = (await getServerSession(authOptions)) as unknown;
    const userId = (session as { user?: { id?: string } } | null)?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().formErrors.join(", ") },
        { status: 400 }
      );
    }

    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      update: {
        beginnerMode: parsed.data.beginnerMode,
      },
      create: {
        userId,
        beginnerMode: parsed.data.beginnerMode,
        theme: "dark",
      },
    });

    return NextResponse.json({
      ok: true,
      beginnerMode: preferences.beginnerMode,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to update preferences." },
      { status: 500 }
    );
  }
}

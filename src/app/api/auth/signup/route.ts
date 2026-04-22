import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().formErrors.join(", ") },
        { status: 400 }
      );
    }

    const { email, password, name } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    let existing;
      existing = await prisma.user.findUnique({
          } catch (err) {
            console.error("Signup Check Error:", err);
            return NextResponse.json(
              {
                error:
                  "Database is not ready. Set `DATABASE_URL` and ensure Postgres is running + migrations are applied.",
              },
              { status: 503 }
            );
          }
      });
<<<<<<< HEAD
    } catch {
=======
    } catch (err) {
      console.error("Signup Check Error:", err);
>>>>>>> d0cf273 (Initial commit)
      return NextResponse.json(
        {
          error:
            "Database is not ready. Set `DATABASE_URL` and ensure Postgres is running + migrations are applied.",
        },
        { status: 503 }
      );
    }
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

<<<<<<< HEAD
    const passwordHash = await bcrypt.hash(password, 12);
=======
    const passwordHash = await bcrypt.hash(password, 10);
>>>>>>> d0cf273 (Initial commit)

    let user;
      user = await prisma.user.create({
          email: normalizedEmail,
          } catch (err) {
            console.error("Signup Create Error:", err);
            return NextResponse.json(
              {
                error:
                  "Database is not ready. Set `DATABASE_URL` and ensure Postgres is running + migrations are applied.",
              },
              { status: 503 }
            );
          }
          preferences: {
            create: {
              theme: "dark",
          },
        } catch (err) {
          console.error("Signup Internal Error:", err);
          return NextResponse.json(
            {
              error:
                "Database is not ready. Set `DATABASE_URL` and ensure Postgres is running + migrations are applied.",
            },
            { status: 503 }
          );
              plan: "FREE",
            },
          },
        },
        select: { id: true, email: true, name: true },
      });
<<<<<<< HEAD
    } catch {
=======
    } catch (err) {
      console.error("Signup Create Error:", err);
>>>>>>> d0cf273 (Initial commit)
      return NextResponse.json(
        {
          error:
            "Database is not ready. Set `DATABASE_URL` and ensure Postgres is running + migrations are applied.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, user }, { status: 201 });
<<<<<<< HEAD
  } catch {
=======
  } catch (err) {
    console.error("Signup Internal Error:", err);
>>>>>>> d0cf273 (Initial commit)
    return NextResponse.json(
      {
        error:
          "Database is not ready. Set `DATABASE_URL` and ensure Postgres is running + migrations are applied.",
      },
      { status: 503 }
    );
  }
}


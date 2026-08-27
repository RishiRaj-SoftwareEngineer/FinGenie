import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

// GET: list budgets, POST: create budget (admin only)
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });

    const admin = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!admin || admin.role !== "ADMIN")
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      });

    const budgets = await db.budget.findMany({
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return new Response(JSON.stringify(budgets), { status: 200 });
  } catch (err) {
    console.error("/api/admin/budgets GET error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });

    const admin = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!admin || admin.role !== "ADMIN")
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      });

    const body = await req.json();
    const { userId: targetUserId, amount } = body;
    const parsedAmount = Number(amount);
    if (!targetUserId || amount == null)
      return new Response(JSON.stringify({ error: "Invalid" }), {
        status: 400,
      });
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Amount must be greater than 0" }),
        { status: 400 },
      );
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!targetUser) {
      return new Response(JSON.stringify({ error: "Target user not found" }), {
        status: 404,
      });
    }

    const existing = await db.budget.findUnique({
      where: { userId: targetUserId },
      select: { id: true },
    });
    if (existing) {
      return new Response(
        JSON.stringify({
          error:
            "Budget already exists for this user. Edit the existing budget instead.",
        }),
        { status: 409 },
      );
    }

    const created = await db.budget.create({
      data: { amount: parsedAmount, userId: targetUserId },
    });
    return new Response(JSON.stringify({ success: true, budget: created }), {
      status: 201,
    });
  } catch (err) {
    console.error("/api/admin/budgets POST error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

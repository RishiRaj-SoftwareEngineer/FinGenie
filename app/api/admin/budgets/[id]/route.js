import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function GET(req, { params }) {
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

    const { id } = await params;
    const budget = await db.budget.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!budget)
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });
    return new Response(JSON.stringify(budget), { status: 200 });
  } catch (err) {
    console.error("/api/admin/budgets/[id] GET error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

export async function PATCH(req, { params }) {
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

    const { id } = await params;
    const body = await req.json();
    const updates = {};
    if (body.amount != null) {
      const parsedAmount = Number(body.amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return new Response(
          JSON.stringify({ error: "Amount must be greater than 0" }),
          { status: 400 },
        );
      }
      updates.amount = parsedAmount;
    }
    if (body.userId) updates.userId = String(body.userId);
    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: "No valid fields to update" }), {
        status: 400,
      });
    }

    const updated = await db.budget.update({
      where: { id },
      data: updates,
    });
    return new Response(JSON.stringify({ success: true, budget: updated }), {
      status: 200,
    });
  } catch (err) {
    console.error("/api/admin/budgets/[id] PATCH error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

export async function DELETE(req, { params }) {
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

    const { id } = await params;
    const found = await db.budget.findUnique({ where: { id } });
    if (!found)
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });

    await db.budget.delete({ where: { id } });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("/api/admin/budgets/[id] DELETE error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

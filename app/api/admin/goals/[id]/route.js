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

    const goal = await db.goal.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, email: true } },
        contributions: true,
      },
    });
    if (!goal)
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });
    return new Response(JSON.stringify(goal), { status: 200 });
  } catch (err) {
    console.error("/api/admin/goals/[id] GET error", err);
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

    const body = await req.json();
    const updates = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.targetAmount != null) updates.targetAmount = body.targetAmount;
    if (body.startDate) updates.startDate = new Date(body.startDate);
    if (body.endDate) updates.endDate = new Date(body.endDate);

    const updated = await db.goal.update({
      where: { id: params.id },
      data: updates,
    });
    return new Response(JSON.stringify({ success: true, goal: updated }), {
      status: 200,
    });
  } catch (err) {
    console.error("/api/admin/goals/[id] PATCH error", err);
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

    await db.goal.delete({ where: { id: params.id } });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("/api/admin/goals/[id] DELETE error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

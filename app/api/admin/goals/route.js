import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

// GET: list goals, POST: create goal (admin only)
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

    const goals = await db.goal.findMany({
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return new Response(JSON.stringify(goals), { status: 200 });
  } catch (err) {
    console.error("/api/admin/goals GET error", err);
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
    const {
      title,
      targetAmount,
      startDate,
      endDate,
      userId: targetUserId,
    } = body;
    if (
      !title ||
      targetAmount == null ||
      !startDate ||
      !endDate ||
      !targetUserId
    )
      return new Response(JSON.stringify({ error: "Invalid" }), {
        status: 400,
      });

    const created = await db.goal.create({
      data: {
        title,
        targetAmount,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        userId: targetUserId,
      },
    });
    return new Response(JSON.stringify({ success: true, goal: created }), {
      status: 201,
    });
  } catch (err) {
    console.error("/api/admin/goals POST error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

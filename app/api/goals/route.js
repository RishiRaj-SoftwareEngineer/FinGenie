import { db } from "@/lib/prisma";
import { getAuth } from "@clerk/nextjs/server";

async function findUserByClerkId(clerkUserId) {
  return db.user.findUnique({ where: { clerkUserId: clerkUserId } });
}

export async function POST(req) {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth?.userId;

    if (!clerkUserId) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = await findUserByClerkId(clerkUserId);
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { title, targetAmount, startDate, endDate, insight = null } = body;

    if (!title || !targetAmount || !startDate || !endDate) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const created = await db.goal.create({
      data: {
        userId: user.id,
        title: String(title),
        targetAmount: Number(targetAmount),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        achievability: insight?.achievability ?? null,
        monthlyTarget: insight?.monthlyTarget ?? null,
        timelineMonths: insight?.timelineMonths ?? null,
        recommendations: insight ? insight : null,
      },
    });

    return new Response(JSON.stringify({ goal: created }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(req) {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth?.userId;

    if (!clerkUserId) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = await findUserByClerkId(clerkUserId);
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const goals = await db.goal.findMany({
      where: { userId: user.id },
      include: { contributions: true },
      orderBy: { createdAt: "desc" },
    });

    return new Response(JSON.stringify(goals), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

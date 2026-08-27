import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });

    const body = await req.json();
    const { goalId, amount, date } = body;
    if (!goalId || !amount)
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
      });

    const user = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!user)
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
      });

    const goal = await db.goal.findUnique({ where: { id: goalId } });
    if (!goal || goal.userId !== user.id)
      return new Response(JSON.stringify({ error: "Goal not found" }), {
        status: 404,
      });

    // Basic validation: contribution should be positive
    const amt = Number(amount);
    if (amt <= 0)
      return new Response(
        JSON.stringify({ error: "Amount must be positive" }),
        { status: 400 },
      );

    const contribution = await db.contribution.create({
      data: {
        goalId,
        amount: amt,
        date: date ? new Date(date) : new Date(),
      },
    });

    return new Response(JSON.stringify(contribution), { status: 201 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const goalId = url.searchParams.get("goalId");

    if (!goalId)
      return new Response(JSON.stringify({ error: "Missing goalId" }), {
        status: 400,
      });

    const contributions = await db.contribution.findMany({
      where: { goalId },
      orderBy: { date: "desc" },
    });
    return new Response(JSON.stringify(contributions), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

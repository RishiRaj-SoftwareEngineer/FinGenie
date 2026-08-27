import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function POST(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });

    const user = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!user)
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
      });

    const { id } = await params; // goal id (params is a Promise in app routes)
    const goal = await db.goal.findUnique({ where: { id } });
    if (!goal || goal.userId !== user.id)
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });

    const body = await req.json();
    const amount = Number(body.amount || 0);
    if (!amount || amount <= 0)
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
      });

    const date = body.date ? new Date(body.date) : new Date();

    const contribution = await db.contribution.create({
      data: {
        goalId: id,
        amount,
        date,
      },
    });

    // Revalidate the goal page so fresh data is available
    try {
      revalidatePath(`/goals/${id}`);
    } catch (e) {
      console.warn("revalidatePath failed", e);
    }

    return new Response(JSON.stringify(contribution), { status: 201 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

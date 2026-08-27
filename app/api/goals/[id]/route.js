import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function GET(req, { params }) {
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

    const { id } = await params;
    const goal = await db.goal.findUnique({
      where: { id },
      include: { contributions: { orderBy: { date: "desc" } } },
    });

    if (!goal || goal.userId !== user.id)
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });

    return new Response(JSON.stringify(goal), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

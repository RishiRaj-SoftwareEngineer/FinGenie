import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

// GET /api/admin/users - list users (admin only)
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });

    const admin = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!admin || admin.role !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      });
    }

    const users = await db.user.findMany({
      select: {
        id: true,
        clerkUserId: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return new Response(JSON.stringify(users), { status: 200 });
  } catch (err) {
    console.error("/api/admin/users GET error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

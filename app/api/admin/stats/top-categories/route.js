import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function GET(req) {
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

    const url = new URL(req.url);
    const monthsParam = Number(url.searchParams.get("months") || 6);
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth(), 1);
    const startDate = new Date(
      end.getFullYear(),
      end.getMonth() - (monthsParam - 1),
      1,
    );

    const accountId = url.searchParams.get("accountId");

    // Prisma groupBy to aggregate by category
    const where = {
      date: {
        gte: startDate,
        lte: new Date(end.getFullYear(), end.getMonth() + 1, 0),
      },
    };
    if (accountId) where.accountId = accountId;

    const groups = await db.transaction.groupBy({
      by: ["category"],
      where,
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    });

    const result = groups.map((g) => ({
      category: g.category,
      total: Number(g._sum.amount || 0),
    }));

    return new Response(JSON.stringify({ topCategories: result }), {
      status: 200,
    });
  } catch (err) {
    console.error("/api/admin/stats/top-categories error", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500 },
    );
  }
}

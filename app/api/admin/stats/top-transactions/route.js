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
    const accountId = url.searchParams.get("accountId");
    const category = url.searchParams.get("category");
    const limit = Number(url.searchParams.get("limit") || 10);

    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = new Date(
      end.getFullYear(),
      end.getMonth() - (monthsParam - 1),
      1,
    );

    const where = {
      date: {
        gte: start,
        lte: new Date(end.getFullYear(), end.getMonth() + 1, 0),
      },
    };
    if (accountId) where.accountId = accountId;
    if (category) where.category = category;

    const txs = await db.transaction.findMany({
      where,
      orderBy: { amount: "desc" },
      take: limit,
      select: {
        id: true,
        amount: true,
        description: true,
        date: true,
        category: true,
        accountId: true,
        userId: true,
      },
    });

    return new Response(JSON.stringify({ topTransactions: txs }), {
      status: 200,
    });
  } catch (err) {
    console.error("/api/admin/stats/top-transactions error", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500 },
    );
  }
}

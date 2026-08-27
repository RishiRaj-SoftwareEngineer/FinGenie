import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

// GET: list transactions, POST: create transaction (admin only)
export async function GET(req) {
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

    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    const where = {};
    // optional filters: userId, accountId
    const userFilter = url.searchParams.get("userId");
    const accountFilter = url.searchParams.get("accountId");
    if (userFilter) where.userId = userFilter;
    if (accountFilter) where.accountId = accountFilter;
    if (start) {
      const s = new Date(start);
      if (!isNaN(s)) where.date = { ...(where.date || {}), gte: s };
    }
    if (end) {
      // include entire end day by using next day as exclusive upper bound
      const e = new Date(end);
      if (!isNaN(e)) {
        const next = new Date(e);
        next.setDate(next.getDate() + 1);
        where.date = { ...(where.date || {}), lt: next };
      }
    }

    const txs = await db.transaction.findMany({
      where,
      include: { user: { select: { id: true, email: true } }, account: true },
      orderBy: { date: "desc" },
      take: 1000,
    });

    // serialize Decimals and Dates for JSON
    const serial = txs.map((t) => ({
      ...t,
      amount: Number(t.amount),
      date: t.date ? t.date.toISOString() : null,
      createdAt: t.createdAt ? t.createdAt.toISOString() : null,
      updatedAt: t.updatedAt ? t.updatedAt.toISOString() : null,
    }));

    return new Response(JSON.stringify(serial), { status: 200 });
  } catch (err) {
    console.error("/api/admin/transactions GET error", err);
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
      type,
      amount,
      description,
      date,
      category,
      userId: targetUserId,
      accountId,
    } = body;
    if (!type || amount == null || !targetUserId || !accountId)
      return new Response(JSON.stringify({ error: "Invalid" }), {
        status: 400,
      });

    const created = await db.transaction.create({
      data: {
        type,
        amount,
        description,
        date: new Date(date),
        category,
        userId: targetUserId,
        accountId,
        status: "COMPLETED",
      },
    });

    try {
      await logAdminAction({
        actorId: admin.id,
        actorClerkId: userId,
        action: "create_transaction",
        resource: "transaction",
        resourceId: created.id,
        data: {
          type,
          amount,
          description,
          category,
          accountId,
          userId: targetUserId,
        },
        ip: req.headers.get("x-forwarded-for") || null,
        userAgent: req.headers.get("user-agent") || null,
      });
    } catch (e) {
      console.error("audit log failed", e);
    }

    return new Response(
      JSON.stringify({ success: true, transaction: created }),
      { status: 201 },
    );
  } catch (err) {
    console.error("/api/admin/transactions POST error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

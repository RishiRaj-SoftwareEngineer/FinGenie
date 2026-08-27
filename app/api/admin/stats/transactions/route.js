import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

function monthKey(d) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function monthsBetween(start, end) {
  const res = [];
  const s = new Date(start.getFullYear(), start.getMonth(), 1);
  const e = new Date(end.getFullYear(), end.getMonth(), 1);
  for (let d = new Date(s); d <= e; d.setMonth(d.getMonth() + 1)) {
    res.push(monthKey(new Date(d)));
  }
  return res;
}

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
    const startParam = url.searchParams.get("start");
    const endParam = url.searchParams.get("end");
    const monthsParam = Number(url.searchParams.get("months") || 6);
    const accountId = url.searchParams.get("accountId");
    const category = url.searchParams.get("category");

    let start, end;
    if (startParam && endParam) {
      start = new Date(startParam);
      end = new Date(endParam);
      if (isNaN(start) || isNaN(end)) {
        return new Response(JSON.stringify({ error: "Invalid date range" }), {
          status: 400,
        });
      }
    } else {
      // default to last `monthsParam` months
      const now = new Date();
      end = new Date(now.getFullYear(), now.getMonth(), 1);
      start = new Date(
        end.getFullYear(),
        end.getMonth() - (monthsParam - 1),
        1,
      );
    }

    // build where clause with optional filters (accountId, category)
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
      select: { amount: true, date: true, type: true },
      orderBy: { date: "asc" },
    });

    const keys = monthsBetween(start, end);
    const buckets = Object.fromEntries(
      keys.map((k) => [k, { income: 0, expense: 0 }]),
    );

    for (const t of txs) {
      const key = monthKey(new Date(t.date));
      const amt = Number(t.amount || 0);
      if (!(key in buckets)) continue;
      if (t.type === "EXPENSE") buckets[key].expense += amt;
      else buckets[key].income += amt;
    }

    const monthly = Object.keys(buckets).map((k) => ({
      month: k,
      income: Number(buckets[k].income || 0),
      expense: Number(buckets[k].expense || 0),
      total: Number((buckets[k].income || 0) - (buckets[k].expense || 0)),
    }));

    return new Response(JSON.stringify({ monthly }), { status: 200 });
  } catch (err) {
    console.error("/api/admin/stats/transactions error", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500 },
    );
  }
}

import { db } from "@/lib/prisma";

function monthKey(d) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export async function getAdminMetrics({ months = 6 } = {}) {
  // counts
  const [usersCount, txCount, budgetsCount, goalsCount] = await Promise.all([
    db.user.count(),
    db.transaction.count(),
    db.budget.count(),
    db.goal.count(),
  ]);

  // monthly totals for past `months` months
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const txs = await db.transaction.findMany({
    where: { date: { gte: start } },
    select: { amount: true, date: true, type: true },
    orderBy: { date: "asc" },
  });

  const buckets = {};
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
    buckets[monthKey(d)] = 0;
  }

  for (const t of txs) {
    const d = new Date(t.date);
    const key = monthKey(d);
    const amt = Number(t.amount);
    const signed = t.type === "EXPENSE" ? -amt : amt;
    if (key in buckets) buckets[key] += signed;
  }

  const monthly = Object.keys(buckets).map((k) => ({
    month: k,
    total: Number(buckets[k]),
  }));

  return { usersCount, txCount, budgetsCount, goalsCount, monthly };
}

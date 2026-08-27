import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        income: true,
        expenses: true,
      },
    });
    if (!user)
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
      });

    // compute recent monthly income/expenses from transactions (last 30 days)
    try {
      const since30 = new Date();
      since30.setDate(since30.getDate() - 30);
      const recent = await db.transaction.findMany({
        where: { userId: user.id, date: { gte: since30 } },
      });

      const monthlyExpenses = recent
        .filter((t) => t.type === "EXPENSE")
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      const monthlyIncome = recent
        .filter((t) => t.type === "INCOME")
        .reduce((s, t) => s + Number(t.amount || 0), 0);

      const profileIncome = Number(Number(user.income || 0).toFixed(2));
      const profileExpenses = Number(Number(user.expenses || 0).toFixed(2));
      const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        profileIncome,
        profileExpenses,
        monthlyIncome: Number(monthlyIncome.toFixed(2)),
        monthlyExpenses: Number(monthlyExpenses.toFixed(2)),
      };

      console.debug(
        "/api/me - user:",
        user.id,
        "monthlyIncome:",
        monthlyIncome,
        "monthlyExpenses:",
        monthlyExpenses,
      );

      return new Response(JSON.stringify(payload), { status: 200 });
    } catch (aggErr) {
      console.error("Error computing monthly totals:", aggErr);
      // fall back to profile values
      return new Response(JSON.stringify(user), { status: 200 });
    }
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

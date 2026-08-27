import { callGemini } from "@/lib/gemini";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

function tryParseJSON(text) {
  try {
    const cleaned = text.replace(/```(?:json)?\n?|```/g, "").trim();
    const m = cleaned.match(/({[\s\S]*}|\[[\s\S]*\])/);
    const jsonText = m ? m[0] : cleaned;
    return JSON.parse(jsonText);
  } catch (err) {
    return null;
  }
}

function heuristicInsights({
  income = 0,
  expenses = 0,
  goal,
  monthlyAvailableOverride = null,
}) {
  const monthsRemaining = Math.max(
    1,
    Math.ceil(
      (new Date(goal.endDate) - new Date()) / (1000 * 60 * 60 * 24 * 30),
    ),
  );
  const currentContributions = 0;
  const remaining = Math.max(0, goal.targetAmount - currentContributions);
  const monthlyTarget = remaining / monthsRemaining;
  const monthlyAvailable =
    monthlyAvailableOverride ?? Math.max(0, income - expenses);
  const achievability = Math.min(
    100,
    Math.round((monthlyAvailable / monthlyTarget) * 100) || 0,
  );

  const recommendations = [];
  if (achievability >= 80) {
    recommendations.push({
      title: "On track",
      description:
        "You're likely to hit this goal with current available savings.",
      impact: monthlyTarget,
      effort: "Low",
      timeframe: `${monthsRemaining} months`,
      priority: "Medium",
      action: "Maintain current allocation",
    });
  } else {
    recommendations.push({
      title: "Increase allocation or extend timeline",
      description:
        "Increase monthly contributions or extend the end date to reduce monthly burden.",
      impact: Math.max(0, monthlyTarget - monthlyAvailable),
      effort: "Medium",
      timeframe: `${monthsRemaining} months`,
      priority: "High",
      action: "Adjust budget or timeline",
    });
  }

  return {
    achievability,
    monthlyTarget: Number(monthlyTarget.toFixed(2)),
    timelineMonths: monthsRemaining,
    recommendations,
    detailedAnalysis: `Monthly available: Rs.${monthlyAvailable.toFixed(2)}. Remaining to save: Rs.${remaining.toFixed(2)} over ${monthsRemaining} months -> Rs.${monthlyTarget.toFixed(2)} per month. Achievability calculated as (monthlyAvailable / monthlyTarget)*100 = ${achievability}%`,
  };
}

export async function POST(req) {
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

    const body = await req.json();
    const { title, targetAmount, startDate, endDate } = body;
    if (!title || !targetAmount || !startDate || !endDate) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
      });
    }

    const goal = {
      title,
      targetAmount: Number(targetAmount),
      startDate,
      endDate,
    };

    // fetch recent transactions to include in prompt (last 90 days)
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const transactions = await db.transaction.findMany({
      where: { userId: user.id, date: { gte: since } },
      orderBy: { date: "desc" },
      take: 50,
    });

    const categorySums = await db.transaction.groupBy({
      by: ["category"],
      where: { userId: user.id, date: { gte: since } },
      _sum: { amount: true },
    });

    // compute monthly income/expenses from last 30 days of transactions
    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);
    const last30 = await db.transaction.findMany({
      where: { userId: user.id, date: { gte: since30 } },
    });
    const monthlyExpenses = last30
      .filter((t) => t.type === "EXPENSE")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const monthlyIncome = last30
      .filter((t) => t.type === "INCOME")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    console.debug(
      "simulate AI - user:",
      user.id,
      "monthlyIncome:",
      monthlyIncome,
      "monthlyExpenses:",
      monthlyExpenses,
    );

    const prompt = `You are a financial analyst. Given the user's income, expenses, and recent transactions, analyze achievability and produce a JSON object with keys: achievability (0-100), monthlyTarget (number), timelineMonths (int), recommendations (array of objects with title, description, impact, effort, timeframe, priority, action), and detailedAnalysis (string) which explains the reasoning. Respond only with JSON.

  User income (profile): ${Number(user.income || 0)}
  User expenses (profile): ${Number(user.expenses || 0)}
  User recent monthly income (30d): ${monthlyIncome}
  User recent monthly expenses (30d): ${monthlyExpenses}
Recent category spending (last 90 days): ${JSON.stringify(categorySums.map((c) => ({ category: c.category, total: Number(c._sum.amount || 0) })))}
Recent transactions (latest 10): ${JSON.stringify(transactions.slice(0, 10).map((t) => ({ date: t.date, amount: Number(t.amount || 0), category: t.category, description: t.description })))}
Goal: ${JSON.stringify(goal)}
`;

    const raw = await callGemini([{ role: "user", content: prompt }]);
    let insight = tryParseJSON(raw);
    if (!insight) {
      // fallback to heuristic using DB-derived monthly totals (30d)
      const monthlyAvailable = Math.max(0, monthlyIncome - monthlyExpenses);
      insight = heuristicInsights({
        income: Number(monthlyIncome),
        expenses: Number(monthlyExpenses),
        goal,
        monthlyAvailableOverride: monthlyAvailable,
      });
    }

    // normalize monthlyTarget to 2 decimals
    insight.monthlyTarget = Number(
      Number(insight.monthlyTarget || 0).toFixed(2),
    );

    // normalize recommendation impacts to two decimals
    if (Array.isArray(insight.recommendations)) {
      insight.recommendations = insight.recommendations.map((r) => {
        const rawImpact = r && r.impact != null ? r.impact : 0;
        const parsed = parseFloat(String(rawImpact).replace(/[^0-9.-]+/g, ""));
        const impactNum = Number.isFinite(parsed)
          ? parsed
          : Number(rawImpact || 0);
        return { ...r, impact: Number(Number(impactNum || 0).toFixed(2)) };
      });
    }

    // ensure there's a short summary for UI
    if (!insight.summary) {
      const ach = insight.achievability || 0;
      const mt = Number((insight.monthlyTarget || 0).toFixed(2));
      const months =
        insight.timelineMonths ||
        Math.ceil(
          (new Date(goal.endDate) - new Date()) / (1000 * 60 * 60 * 24 * 30),
        );
      insight.summary = `Achievability: ${ach}%. Need Rs.${mt} / month for ${months} months.`;
    }

    return new Response(JSON.stringify(insight), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

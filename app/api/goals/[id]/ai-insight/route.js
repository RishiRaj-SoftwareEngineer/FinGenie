import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { callGemini } from "@/lib/gemini";

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

  const currentContributions = (goal.contributions || []).reduce(
    (s, c) => s + c.amount,
    0,
  );
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
        "You're on track to hit this goal with current available savings.",
      impact: monthlyTarget,
      effort: "Low",
      timeframe: `${monthsRemaining} months`,
      priority: "Medium",
      action: "Maintain current savings allocation",
    });
  } else {
    recommendations.push({
      title: "Increase monthly allocation",
      description:
        "Consider increasing monthly contributions or extending the timeline.",
      impact: monthlyTarget - monthlyAvailable,
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
  };
}

function tryParseJSON(text) {
  try {
    // strip code fences
    const cleaned = text.replace(/```(?:json)?\n?|```/g, "").trim();
    // find first JSON object or array
    const m = cleaned.match(/({[\s\S]*}|\[[\s\S]*\])/);
    const jsonText = m ? m[0] : cleaned;
    return JSON.parse(jsonText);
  } catch (err) {
    return null;
  }
}

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

    const { id } = await params;
    const goal = await db.goal.findUnique({
      where: { id },
      include: { contributions: true },
    });
    if (!goal || goal.userId !== user.id)
      return new Response(JSON.stringify({ error: "Goal not found" }), {
        status: 404,
      });

    // Build a prompt for Gemini
    // compute recent monthly income/expenses from transactions (last 30 days)
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

    console.debug(
      "AI insight - user:",
      user.id,
      "monthlyIncome:",
      monthlyIncome,
      "monthlyExpenses:",
      monthlyExpenses,
    );

    const prompt = `
  You are a helpful financial assistant. Given the user context and a savings goal, analyze achievability and produce a JSON object with the following shape:
  {
    "achievability": number,         // 0-100 percent
    "monthlyTarget": number,         // suggested monthly contribution to meet the goal
    "timelineMonths": integer,       // months remaining to reach the goal
    "recommendations": [             // array of recommendation objects
      {
        "title": string,
        "description": string,
        "impact": number,
        "effort": string,
        "timeframe": string,
        "priority": string,
        "action": string
      }
    ],
    "detailedAnalysis": string       // human-readable explanation of the reasoning
    "summary": string                // short one-line summary for UI (e.g. "Achievability 72% — Rs.2,000/month for 24 months")
  }

  Respond ONLY with that JSON. Do NOT add any explanatory text.

  User income (profile): ${Number(user.income || 0)}
  User expenses (profile): ${Number(user.expenses || 0)}
  User recent monthly income (30d): ${monthlyIncome}
  User recent monthly expenses (30d): ${monthlyExpenses}
  Goal:
  - title: ${goal.title}
  - targetAmount: ${goal.targetAmount}
  - startDate: ${goal.startDate}
  - endDate: ${goal.endDate}
  - contributions: ${JSON.stringify(goal.contributions || [])}
  `;

    const raw = await callGemini([{ role: "user", content: prompt }]);
    let insight = tryParseJSON(raw);

    if (!insight) {
      // fallback to heuristic if Gemini fails or returns unparsable text
      insight = heuristicInsights({
        income: monthlyIncome || 0,
        expenses: monthlyExpenses || 0,
        goal,
        monthlyAvailableOverride: Math.max(
          0,
          (monthlyIncome || 0) - (monthlyExpenses || 0),
        ),
      });
    }

    // ensure numeric fields are normalized
    insight.monthlyTarget = Number(
      Number(insight.monthlyTarget || 0).toFixed(2),
    );

    // normalize recommendation impacts to two decimals (extract numeric if string)
    if (Array.isArray(insight.recommendations)) {
      insight.recommendations = insight.recommendations.map((r) => {
        const raw = r && r.impact != null ? r.impact : 0;
        const parsed = parseFloat(String(raw).replace(/[^0-9.-]+/g, ""));
        const impactNum = Number.isFinite(parsed) ? parsed : Number(raw || 0);
        return { ...r, impact: Number(Number(impactNum || 0).toFixed(2)) };
      });
    }

    // ensure detailedAnalysis exists (heuristic may provide it)
    if (!insight.detailedAnalysis) {
      const monthlyAvailableComputed = Math.max(
        0,
        (monthlyIncome || 0) - (monthlyExpenses || 0),
      );
      const remaining = Math.max(
        0,
        goal.targetAmount -
          (goal.contributions || []).reduce((s, c) => s + (c.amount || 0), 0),
      );
      insight.detailedAnalysis = `Monthly available: Rs.${monthlyAvailableComputed.toFixed(2)}. Remaining to save: Rs.${remaining.toFixed(2)} over ${insight.timelineMonths} months -> Rs.${Number(insight.monthlyTarget).toFixed(2)} per month.`;
    }

    // ensure short summary exists for UI
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

    // Persist insights to goal
    await db.goal.update({
      where: { id },
      data: {
        achievability: insight.achievability,
        monthlyTarget: insight.monthlyTarget,
        timelineMonths: insight.timelineMonths,
        recommendations: insight.recommendations,
      },
    });

    return new Response(JSON.stringify(insight), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { callGemini } from "@/lib/gemini";
import { defaultCategories } from "@/data/categories";
import {
  aggregateCashFlow,
  aggregateExpenses,
  forecastSeries,
} from "@/lib/ai/forecast";
import { fetchShareBazaar } from "@/lib/market/sharebazaar";
import { fetchNewsSentiment } from "@/lib/market/news";
import { AsyncLocalStorage } from "node:async_hooks";

const BodySchema = z.object({
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
  sessionId: z.string().optional(),
});

const chatRequestStore = new AsyncLocalStorage();

function lastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

function parseDateRange(text) {
  const now = new Date();
  let start = null;
  let end = null;
  let label = null;
  const monthMap = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };

  const daysMatch = text.match(/\b(?:last\s+)?(\d+)\s+days?\b/i);
  if (daysMatch) {
    const days = Math.max(1, Number(daysMatch[1] || 1));
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
    start = new Date(now);
    start.setDate(now.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    label = `last ${days} days`;
  } else if (/last year|previous year|past year/i.test(text)) {
    const lastYear = now.getFullYear() - 1;
    start = new Date(lastYear, 0, 1);
    end = new Date(lastYear, 11, 31);
    label = "last year";
  } else if (/last month|previous month|past month/i.test(text)) {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
    label = "last month";
  } else if (/this month/i.test(text)) {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    label = "this month";
  } else if (/last week/i.test(text)) {
    const day = now.getDay();
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - day);
    startOfThisWeek.setHours(0, 0, 0, 0);
    end = new Date(startOfThisWeek);
    end.setDate(startOfThisWeek.getDate() - 1); // Saturday
    start = new Date(end);
    start.setDate(end.getDate() - 6); // Sunday
    label = "last week";
  } else if (/this week/i.test(text)) {
    const day = now.getDay();
    start = new Date(now);
    start.setDate(now.getDate() - day);
    end = now;
    label = "this week";
  } else {
    const monthRegex =
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b(?:\s+(\d{4}))?/i;
    const m = text.match(monthRegex);
    if (m) {
      const monthIdx = monthMap[m[1].toLowerCase()];
      let year = m[2] ? Number(m[2]) : now.getFullYear();
      if (!m[2]) {
        // if asking for a month ahead in the calendar, assume last year
        if (monthIdx > now.getMonth()) year -= 1;
      }
      start = new Date(year, monthIdx, 1);
      end = new Date(year, monthIdx + 1, 0);
      label = formatMonthYear(start);
    }
  }

  if (start && end) {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end, label };
}

function parseExplicitRange(text) {
  const m = text.match(
    /\bbetween\s+([a-z]+\s+\d{1,2}|\d{4}-\d{2}-\d{2})\s+and\s+([a-z]+\s+\d{1,2}|\d{4}-\d{2}-\d{2})/i,
  );
  if (!m) return null;
  const a = new Date(m[1]);
  const b = new Date(m[2]);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  a.setHours(0, 0, 0, 0);
  b.setHours(23, 59, 59, 999);
  return { start: a, end: b };
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseCategory(text) {
  const lc = (text || "").toLowerCase();
  const found = defaultCategories.find(
    (c) => lc.includes(c.name.toLowerCase()) || lc.includes(c.id.toLowerCase()),
  );
  if (found) return found.id;
  if (lc.includes("income") || lc.includes("earned")) return "INCOME";
  if (lc.includes("expense") || lc.includes("spent")) return "EXPENSE";
  return null;
}

function parseCount(text, fallback = 20) {
  const m = text.match(/(?:last|recent|top)\s+(\d+)/i);
  if (!m) return fallback;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(200, Math.max(1, n));
}

function parseThreshold(text, fallback = 0.6) {
  const m = text.match(/confidence\s*(?:>|>=|=)?\s*(0?\.\d+|\d+%)/i);
  if (!m) return fallback;
  const raw = m[1];
  if (raw.includes("%")) {
    const pct = Number(raw.replace("%", ""));
    if (Number.isFinite(pct)) return Math.max(0, Math.min(1, pct / 100));
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function parseForecastGranularity(text) {
  if (/daily|day\b|days\b/i.test(text)) return "daily";
  if (/weekly|week\b|weeks\b/i.test(text)) return "weekly";
  if (/yearly|year\b|years\b/i.test(text)) return "yearly";
  return "monthly";
}

function parseForecastHorizon(text, granularity) {
  const m = text.match(
    /(?:next\s+)?(\d+)\s+(day|days|week|weeks|month|months|year|years)\b/i,
  );
  if (!m) {
    if (granularity === "daily") return 7;
    if (granularity === "weekly") return 4;
    if (granularity === "yearly") return 3;
    return 3;
  }
  const n = Math.max(1, Number(m[1] || 1));
  const unit = m[2].toLowerCase();
  let limit = 120;
  if (unit.startsWith("day")) limit = 365;
  else if (unit.startsWith("week")) limit = 520;
  else if (unit.startsWith("year")) limit = 10;
  return Math.min(n, limit);
}

function parseRuleCommand(text) {
  const add = /add rule|create rule|new rule/i.test(text);
  const list = /list rules|show rules/i.test(text);
  const remove = /delete rule|remove rule/i.test(text);
  if (list) return { action: "list" };
  if (remove) {
    const idMatch = text.match(/rule\s+([a-f0-9-]{8,})/i);
    return { action: "remove", id: idMatch ? idMatch[1] : null };
  }
  if (add) {
    const fieldMatch = text.match(
      /(merchant|description)\s*:\s*([^,]+?)(?:\s+category|$)/i,
    );
    const categoryMatch = text.match(/category\s*:\s*([a-z0-9-]+)/i);
    if (!fieldMatch || !categoryMatch) return { action: "add", ok: false };
    return {
      action: "add",
      ok: true,
      field: fieldMatch[1].toLowerCase(),
      pattern: fieldMatch[2].trim(),
      category: categoryMatch[1].toLowerCase(),
    };
  }
  return null;
}

function formatCurrency(n) {
  const num = Number(n || 0);
  return `Rs.${num.toFixed(2)}`;
}

function formatDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateShort(d) {
  return d.toLocaleString("en-US", { month: "short", day: "numeric" });
}

function isFullMonthRange(start, end) {
  if (!start || !end) return false;
  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();
  if (!sameMonth) return false;
  const startIsFirst = start.getDate() === 1;
  const lastDay = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    0,
  ).getDate();
  const endIsLast = end.getDate() === lastDay;
  return startIsFirst && endIsLast;
}

function formatMonthYear(d) {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function formatRangeLabel(start, end) {
  if (isFullMonthRange(start, end)) {
    return formatMonthYear(start);
  }
  return `${formatDateLocal(start)} to ${formatDateLocal(end)}`;
}

function isBudgetPlanningIntent(text) {
  const lc = (text || "").toLowerCase();
  return (
    /\bbudget\b|\bbudget plan\b|\bspending plan\b/.test(lc) &&
    (/\banaly[sz]e\b|\banalysis\b|\bplan\b|\bforecast\b|\bnext\b/.test(lc) ||
      /\btransaction\b|\btransactions\b|\btxns?\b/.test(lc))
  );
}

function isFinanceQuestion(text) {
  const lc = (text || "").toLowerCase();
  if (!lc.trim()) return false;

  return /\b(finance|financial|money|budget|budgeting|expense|expenses|income|salary|spend|spending|save|savings|investment|invest|portfolio|loan|debt|emi|cash flow|cashflow|net worth|profit|loss|tax|goal|goals|forecast|transaction|transactions|tranaction|tranactions|txn|txns|statement|category|categories)\b/.test(
    lc,
  );
}

function buildBudgetPlanReply(transactions, text) {
  const now = new Date();
  const since90 = new Date(now);
  since90.setDate(since90.getDate() - 90);

  const recent = transactions.filter((t) => new Date(t.date) >= since90);
  const incomeTx = recent.filter((t) => t.type === "INCOME");
  const expenseTx = recent.filter((t) => t.type === "EXPENSE");

  if (recent.length < 4 || incomeTx.length === 0 || expenseTx.length === 0) {
    return null;
  }

  const months = new Set(recent.map((t) => monthKey(new Date(t.date))));
  const monthCount = Math.max(1, months.size);
  const horizon = parseForecastHorizon(text, "monthly");

  const incomeTotal = incomeTx.reduce((s, t) => s + Number(t.amount || 0), 0);
  const expenseTotal = expenseTx.reduce((s, t) => s + Number(t.amount || 0), 0);
  const avgIncome = incomeTotal / monthCount;
  const avgExpense = expenseTotal / monthCount;
  const avgSavings = avgIncome - avgExpense;

  if (!Number.isFinite(avgIncome) || avgIncome <= 0) {
    return null;
  }

  const plannedSavings = Math.min(
    avgIncome * 0.5,
    Math.max(avgIncome * 0.2, avgSavings > 0 ? avgSavings : avgIncome * 0.15),
  );
  const plannedSpend = Math.max(0, avgIncome - plannedSavings);
  const suggestedCut = Math.max(0, avgExpense - plannedSpend);

  const categoryTotals = expenseTx.reduce((acc, t) => {
    const key = (t.category || "uncategorized").toLowerCase();
    acc[key] = (acc[key] || 0) + Number(t.amount || 0);
    return acc;
  }, {});

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const lines = [];
  lines.push(
    `Based on the last ${monthCount} month(s): income ${formatCurrency(avgIncome)}/month, expenses ${formatCurrency(avgExpense)}/month, savings ${formatCurrency(avgSavings)}/month.`,
  );
  lines.push(
    `Recommended monthly target: spend ${formatCurrency(plannedSpend)}, save ${formatCurrency(plannedSavings)}.`,
  );
  if (suggestedCut > 0) {
    lines.push(
      `To follow this plan, reduce monthly spending by about ${formatCurrency(suggestedCut)}.`,
    );
  }
  if (topCategories.length > 0 && expenseTotal > 0) {
    lines.push("Category caps:");
    topCategories.forEach(([cat, total]) => {
      const share = total / expenseTotal;
      const cap = plannedSpend * share;
      lines.push(`- ${cat}: keep near ${formatCurrency(cap)}/month`);
    });
  }

  let cumulative = 0;
  lines.push(`Budget plan for next ${horizon} month(s):`);
  for (let i = 1; i <= horizon; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    cumulative += plannedSavings;
    lines.push(
      `- ${formatMonthYear(d)}: Income ${formatCurrency(avgIncome)}, Spend ${formatCurrency(plannedSpend)}, Save ${formatCurrency(plannedSavings)} (cumulative ${formatCurrency(cumulative)}).`,
    );
  }

  lines.push(
    "Action: review top spending categories weekly and move extra savings to your goal account.",
  );

  return lines.join("\n");
}

function normalizeGeminiFinanceReply(text) {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\*\s+/gm, "- ")
    .trim();
}

function monthDifferenceInclusive(start, end) {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1
  );
}

function isUsableFinanceDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  // Guard against epoch/default dates or far-future bad values.
  if (d.getFullYear() < 2000) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d <= tomorrow;
}

async function resolveChatSessionId(userId, preferredSessionId, seedTitle = "") {
  if (preferredSessionId) {
    const existing = await db.chatSession.findFirst({
      where: { id: preferredSessionId, userId },
      select: { id: true },
    });
    if (existing?.id) return existing.id;
  }

  const latest = await db.chatSession.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (latest?.id) return latest.id;

  const title = String(seedTitle || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 72) || "New Chat";

  const created = await db.chatSession.create({
    data: { userId, title },
    select: { id: true },
  });
  return created.id;
}

async function saveChat(userId, userText, replyText) {
  try {
    const context = chatRequestStore.getStore() || {};
    const sessionId = await resolveChatSessionId(
      userId,
      context.sessionId || null,
      context.seedTitle || userText,
    );
    context.sessionId = sessionId;
    chatRequestStore.enterWith(context);

    await db.chatMessage.createMany({
      data: [
        { userId, sessionId, role: "user", content: userText },
        { userId, sessionId, role: "assistant", content: replyText },
      ],
    });
    await db.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
  } catch (err) {
    console.error("Failed to save chat messages", err);
  }
}

function matchesGoalTitle(text, title) {
  if (!text || !title) return false;
  return text.toLowerCase().includes(title.toLowerCase());
}

async function categorizeTransactions(userId, text) {
  const count = parseCount(text, 20);
  const threshold = parseThreshold(text, 0.6);
  const preview = /\bpreview|dry run|show first\b/i.test(text);
  const txs = await db.transaction.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: count,
  });

  if (txs.length === 0) {
    return { reply: "No transactions found to categorize." };
  }

  const allowed = defaultCategories
    .filter((c) => c.type === "EXPENSE" || c.type === "INCOME")
    .map((c) => c.id);

  const rules = await db.categoryRule.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const ruleMatches = [];
  const remaining = [];
  for (const t of txs) {
    let matched = false;
    for (const r of rules) {
      const hay =
        r.field === "merchant"
          ? (t.merchant || "").toLowerCase()
          : (t.description || "").toLowerCase();
      if (hay.includes(r.pattern.toLowerCase())) {
        if (allowed.includes(r.category)) {
          ruleMatches.push({
            id: t.id,
            category: r.category,
            confidence: 1,
            source: "rule",
            oldCategory: t.category || null,
          });
          matched = true;
          break;
        }
      }
    }
    if (!matched) remaining.push(t);
  }

  const prompt = `You are a financial categorization assistant.
Given the transactions below, assign a category to each item.
Return ONLY JSON in the format: [{ "id": "...", "category": "category_id", "confidence": 0.0-1.0 }, ...]
Allowed categories: ${allowed.join(", ")}

Transactions:
${JSON.stringify(
  remaining.map((t) => ({
    id: t.id,
    amount: Number(t.amount),
    type: t.type,
    description: t.description,
    merchant: t.merchant,
    category: t.category,
    date: t.date,
  })),
)}
`;

  let modelUpdates = [];
  if (remaining.length > 0) {
    const raw = await callGemini([{ role: "user", content: prompt }]);
    const cleaned = raw.replace(/```(?:json)?\n?|```/g, "").trim();

    let parsed = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      const m = cleaned.match(/(\[[\s\S]*\])/);
      if (m) parsed = JSON.parse(m[1]);
    }

    if (!Array.isArray(parsed)) {
      return { reply: "Failed to parse categories from Gemini response." };
    }

    const byId = new Map(remaining.map((t) => [t.id, t]));
    modelUpdates = parsed
      .filter((p) => p && p.id && allowed.includes(p.category))
      .map((p) => {
        const conf = Number(p.confidence);
        return {
          id: p.id,
          category: p.category,
          confidence: Number.isFinite(conf) ? conf : 0.5,
          source: "model",
          oldCategory: byId.get(p.id)?.category || null,
        };
      });
  }

  const combined = [...ruleMatches, ...modelUpdates].filter(
    (u) => u.category && allowed.includes(u.category),
  );

  const valid = combined.filter(
    (u) => u.source === "rule" || u.confidence >= threshold,
  );
  if (valid.length === 0) {
    return { reply: "No category updates met the confidence threshold." };
  }

  const run = await db.categorizeRun.create({
    data: {
      userId,
      preview,
      threshold,
      totalInput: txs.length,
      totalApplied: preview ? 0 : valid.length,
    },
  });

  await db.categorizeUpdate.createMany({
    data: valid.map((v) => ({
      runId: run.id,
      transactionId: v.id,
      oldCategory: v.oldCategory,
      newCategory: v.category,
      confidence: v.confidence,
      source: v.source,
    })),
  });

  if (!preview) {
    await Promise.all(
      valid.map((v) =>
        db.transaction.update({
          where: { id: v.id },
          data: { category: v.category },
        }),
      ),
    );
  }

  const counts = {};
  valid.forEach((v) => {
    counts[v.category] = (counts[v.category] || 0) + 1;
  });

  const summary = Object.entries(counts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  if (preview) {
    return {
      reply: `Preview: ${valid.length} updates would be applied (threshold ${threshold}). ${summary}.`,
    };
  }

  return {
    reply: `Updated ${valid.length} transactions. ${summary}.`,
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = BodySchema.parse(body);
    const userText = lastUserMessage(parsed.messages);
    chatRequestStore.enterWith({
      sessionId: parsed.sessionId || null,
      seedTitle: userText,
    });

    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { start, end, label } = parseDateRange(userText);
    const category = parseCategory(userText);
    const wantsSavings =
      /\b(save|saved|savings)\b/i.test(userText) &&
      /(last|this)\s+(month|week|year)|last\s+\d+\s+days/i.test(userText);

    // Quick intent: create savings suggestion for buying an item (e.g., "buy laptop Rs.100000 save Rs.5000/month saved Rs.2000")
    const purchaseIntent =
      /\bbuy\b.*\b(laptop|computer|macbook|notebook)\b/i.test(userText);
    if (purchaseIntent) {
      let target = null;
      const buyTargetMatch = userText.match(/buy[^\d]*rs\.?\s*([0-9,]+)/i);
      if (buyTargetMatch) target = Number(buyTargetMatch[1].replace(/,/g, ""));
      if (!target) {
        const anyRs = userText.match(/rs\.?\s*([0-9,]+)/i);
        if (anyRs) target = Number(anyRs[1].replace(/,/g, ""));
      }

      const hideCurrentSaving =
        /\b(don'?t|dont)\s+show\b.*\bcurrent\s+sav(?:ing|ings)\b/i.test(
          userText,
        ) ||
        /\b(ignore|exclude|without)\b.*\bcurrent\s+sav(?:ing|ings)\b/i.test(
          userText,
        );

      const savedMatch =
        userText.match(/saved\s+rs\.?\s*([0-9,]+)/i) ||
        userText.match(/saved\s+([0-9,]+)/i);
      const savedAmt = hideCurrentSaving
        ? 0
        : savedMatch
          ? Number(savedMatch[1].replace(/,/g, ""))
          : 0;

      const saveRateMatch =
        userText.match(
          /save[s]?\s+rs\.?\s*([0-9,]+)\s*(?:\/|per)?\s*(day|daily|week|weekly|month|monthly|year|yearly)\b/i,
        ) ||
        userText.match(
          /rs\.?\s*([0-9,]+)\s*(?:\/|per)\s*(day|daily|week|weekly|month|monthly|year|yearly)\b/i,
        ) ||
        userText.match(
          /save[s]?\s+([0-9,]+)\s*(day|daily|week|weekly|month|monthly|year|yearly)\b/i,
        );

      const monthlyMatch =
        userText.match(/rs\.?\s*([0-9,]+)\s*(?:\/|per)?\s*month/i) ||
        userText.match(/save[s]?\s+rs\.?\s*([0-9,]+)\s*\/\s*month/i) ||
        userText.match(/(\d{3,6})\s*per\s*month/i) ||
        userText.match(/(\d{3,6})\s*month(s)?/i);

      const planAmount = saveRateMatch
        ? Number(saveRateMatch[1].replace(/,/g, ""))
        : monthlyMatch
          ? Number(monthlyMatch[1].replace(/,/g, ""))
          : 5000;
      const planUnitRaw = saveRateMatch
        ? saveRateMatch[2].toLowerCase()
        : "month";
      const planUnit = planUnitRaw.startsWith("day")
        ? "day"
        : planUnitRaw.startsWith("week")
          ? "week"
          : planUnitRaw.startsWith("year")
            ? "year"
            : "month";
      const monthlyAmt =
        planUnit === "day"
          ? planAmount * 30
          : planUnit === "week"
            ? (planAmount * 52) / 12
            : planUnit === "year"
              ? planAmount / 12
              : planAmount;
      const planLabel =
        planUnit === "day"
          ? "daily"
          : planUnit === "week"
            ? "weekly"
            : planUnit === "year"
              ? "yearly"
              : "monthly";

      if (!target) target = 100000;

      const oneYearSaved = savedAmt + monthlyAmt * 12;
      const oneYearShort = Math.max(0, target - oneYearSaved);
      const requiredMonth1 = Math.ceil(Math.max(0, target - savedAmt) / 12);

      const twoYearSaved = savedAmt + monthlyAmt * 24;
      const twoYearShort = Math.max(0, target - twoYearSaved);
      const requiredMonth2 = Math.ceil(Math.max(0, target - savedAmt) / 24);

      const monthsNeededAtMonthly =
        monthlyAmt > 0
          ? Math.ceil(Math.max(0, target - savedAmt) / monthlyAmt)
          : Infinity;

      const lines = [];
      lines.push(
        "Goal: Buy a laptop - Target " +
          formatCurrency(target) +
          (hideCurrentSaving
            ? "."
            : " - Saved " + formatCurrency(savedAmt) + "."),
      );
      lines.push("");
      lines.push(
        "If you save " +
          formatCurrency(planAmount) +
          "/" +
          planLabel +
          " (approx " +
          formatCurrency(monthlyAmt) +
          "/month):",
      );
      lines.push(
        `- In 12 months you will have ${formatCurrency(oneYearSaved)}. Shortfall: ${formatCurrency(oneYearShort)}.`,
      );
      lines.push(
        `- In 24 months you will have ${formatCurrency(twoYearSaved)}. Shortfall: ${formatCurrency(twoYearShort)}.`,
      );
      lines.push("");
      lines.push("To meet deadlines:");
      lines.push(
        `- To reach the target in 1 year you need ~${formatCurrency(requiredMonth1)} / month.`,
      );
      lines.push(
        `- To reach the target in 2 years you need ~${formatCurrency(requiredMonth2)} / month.`,
      );
      lines.push("");
      lines.push(
        `At your current plan (${formatCurrency(monthlyAmt)}/month) you'll reach the target in ~${monthsNeededAtMonthly} months.`,
      );

      const reply = ["Goal suggestion:", ...lines].join("\n");
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const txWhere =
      start && end
        ? { userId: user.id, date: { gte: start, lte: end } }
        : { userId: user.id };
    const transactions = await db.transaction.findMany({
      where: txWhere,
      orderBy: { date: "desc" },
    });

    const financeQuery = isFinanceQuestion(userText);
    if (financeQuery) {
      const financeTransactionsRaw = await db.transaction.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
      });
      const financeTransactions = financeTransactionsRaw.filter((t) =>
        isUsableFinanceDate(t.date),
      );
      const scopedTransactions =
        start && end
          ? financeTransactions.filter((t) => {
              const d = new Date(t.date);
              return d >= start && d <= end;
            })
          : financeTransactions;

      const wantsTips = /\b(financial tips?|money tips?|tips?|advice)\b/i.test(
        userText,
      );
      const sortedByDateAsc = [...scopedTransactions].sort(
        (a, b) => new Date(a.date) - new Date(b.date),
      );
      const firstTxDate =
        sortedByDateAsc.length > 0 ? new Date(sortedByDateAsc[0].date) : null;
      const lastTxDate =
        sortedByDateAsc.length > 0
          ? new Date(sortedByDateAsc[sortedByDateAsc.length - 1].date)
          : null;
      let monthsCovered = 0;
      if (firstTxDate && lastTxDate) {
        monthsCovered = monthDifferenceInclusive(firstTxDate, lastTxDate);
      }

      const incomeTotal = scopedTransactions
        .filter((t) => t.type === "INCOME")
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      const expenseTotal = scopedTransactions
        .filter((t) => t.type === "EXPENSE")
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      const savings = incomeTotal - expenseTotal;

      const categoryTotals = scopedTransactions
        .filter((t) => t.type === "EXPENSE")
        .reduce((acc, t) => {
          const k = t.category || "UNCATEGORIZED";
          acc[k] = (acc[k] || 0) + Number(t.amount || 0);
          return acc;
        }, {});

      const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, v]) => `- ${k}: ${formatCurrency(v)}`)
        .join("\n");

      const recentSnippet = scopedTransactions
        .slice(0, 30)
        .map(
          (t) =>
            `${formatDateLocal(new Date(t.date))} | ${t.type} | ${formatCurrency(t.amount)} | ${t.category || "UNCATEGORIZED"} | ${t.merchant || t.description || "-"}`,
        )
        .join("\n");

      const rangeLabel =
        start && end ? label || formatRangeLabel(start, end) : "all time";

      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
      );
      const lastMonthEnd = endOfMonth(
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
      );

      const wantsExpenseIncrease =
        /\b(expense|expenses|spending)\b.*\b(increase|increased|up|higher|grew|growth)\b|\bhow much\b.*\b(expense|expenses)\b/i.test(
          userText,
        );
      if (wantsExpenseIncrease) {
        const thisMonthExpense = financeTransactions
          .filter((t) => t.type === "EXPENSE")
          .filter((t) => {
            const d = new Date(t.date);
            return d >= thisMonthStart && d <= thisMonthEnd;
          })
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const lastMonthExpense = financeTransactions
          .filter((t) => t.type === "EXPENSE")
          .filter((t) => {
            const d = new Date(t.date);
            return d >= lastMonthStart && d <= lastMonthEnd;
          })
          .reduce((s, t) => s + Number(t.amount || 0), 0);

        if (lastMonthExpense <= 0 && thisMonthExpense <= 0) {
          const reply = "No expense data found for this and last month.";
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }
        if (lastMonthExpense <= 0) {
          const reply = `Last month expense is ${formatCurrency(
            0,
          )}. This month is ${formatCurrency(
            thisMonthExpense,
          )}, so percentage increase cannot be computed from zero baseline.`;
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }

        const diff = thisMonthExpense - lastMonthExpense;
        const pct = (diff / lastMonthExpense) * 100;
        const direction =
          diff >= 0
            ? `increased by ${pct.toFixed(1)}%`
            : `decreased by ${Math.abs(pct).toFixed(1)}%`;
        const reply = `Your expenses ${direction} this month vs last month (${formatCurrency(
          thisMonthExpense,
        )} vs ${formatCurrency(lastMonthExpense)}; change ${formatCurrency(
          diff,
        )}).`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      const wantsHousingShare =
        /\b(housing|rent|mortgage)\b.*\b(income|salary|earnings|percent|%)\b|\bwhat percent\b.*\b(housing|rent)\b/i.test(
          userText,
        );
      if (wantsHousingShare) {
        const thisMonthIncome = financeTransactions
          .filter((t) => t.type === "INCOME")
          .filter((t) => {
            const d = new Date(t.date);
            return d >= thisMonthStart && d <= thisMonthEnd;
          })
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const thisMonthHousing = financeTransactions
          .filter((t) => t.type === "EXPENSE")
          .filter((t) => {
            const d = new Date(t.date);
            return d >= thisMonthStart && d <= thisMonthEnd;
          })
          .filter((t) => {
            const cat = (t.category || "").toLowerCase();
            const desc = (t.description || "").toLowerCase();
            return (
              cat.includes("housing") ||
              desc.includes("rent") ||
              desc.includes("mortgage")
            );
          })
          .reduce((s, t) => s + Number(t.amount || 0), 0);

        if (thisMonthIncome <= 0) {
          const reply =
            "No income recorded for this month, so housing % of income cannot be calculated.";
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }

        const pct = (thisMonthHousing / thisMonthIncome) * 100;
        const reply = `This month you are spending ${pct.toFixed(
          1,
        )}% of your income on housing (${formatCurrency(
          thisMonthHousing,
        )} of ${formatCurrency(thisMonthIncome)}).`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      const wantsEntertainmentSavings =
        /\b(save|saving|savings)\b.*\b(reduce|cut|lower)\b.*\b(entertainment)\b|\b(entertainment)\b.*\b(save)\b/i.test(
          userText,
        );
      if (wantsEntertainmentSavings) {
        const reductionMatch = userText.match(/(\d+)\s*%/);
        const reductionRate = reductionMatch
          ? Math.max(0, Math.min(100, Number(reductionMatch[1])))
          : 20;

        const since90 = new Date(now);
        since90.setDate(since90.getDate() - 90);
        const recentEntertainment = financeTransactions
          .filter((t) => t.type === "EXPENSE")
          .filter((t) => new Date(t.date) >= since90)
          .filter((t) => (t.category || "").toLowerCase() === "entertainment");

        const monthsRecent = new Set(
          recentEntertainment.map((t) => monthKey(new Date(t.date))),
        );
        const monthCount = Math.max(1, monthsRecent.size);
        const entertainmentAvgMonthly =
          recentEntertainment.reduce((s, t) => s + Number(t.amount || 0), 0) /
          monthCount;
        const possibleSave = entertainmentAvgMonthly * (reductionRate / 100);

        const reply = `If you reduce entertainment spending by ${reductionRate}%, you can save about ${formatCurrency(
          possibleSave,
        )} more per month (based on recent average ${formatCurrency(
          entertainmentAvgMonthly,
        )}/month).`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      const wantsGoalRisk =
        /\b(goal|savings goal|target)\b.*\b(reach|achieve|complete)\b|\bmay not reach\b|\bcurrent contribution\b/i.test(
          userText,
        );
      if (wantsGoalRisk) {
        const goals = await db.goal.findMany({
          where: { userId: user.id },
          include: { contributions: true },
          orderBy: { endDate: "asc" },
        });
        if (!goals.length) {
          const reply = "No goals found. Create a goal first to analyze risk.";
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }

        const activeGoal =
          goals.find((g) => new Date(g.endDate) >= now) || goals[0];
        const contributed = (activeGoal.contributions || []).reduce(
          (s, c) => s + Number(c.amount || 0),
          0,
        );
        const target = Number(activeGoal.targetAmount || 0);
        const remaining = Math.max(0, target - contributed);
        const monthsLeft = Math.max(
          0,
          monthDifferenceInclusive(now, new Date(activeGoal.endDate)),
        );

        const last90 = new Date(now);
        last90.setDate(last90.getDate() - 90);
        const recentContrib = (activeGoal.contributions || []).filter(
          (c) => new Date(c.date) >= last90,
        );
        const recentMonths = new Set(
          recentContrib.map((c) => monthKey(new Date(c.date))),
        );
        const contribMonthCount = Math.max(1, recentMonths.size);
        const currentMonthlyRate =
          recentContrib.reduce((s, c) => s + Number(c.amount || 0), 0) /
          contribMonthCount;
        const requiredMonthly =
          monthsLeft > 0
            ? remaining / monthsLeft
            : remaining > 0
              ? Infinity
              : 0;

        let reply = "";
        if (remaining <= 0) {
          reply = `Your goal "${activeGoal.title}" is already achieved.`;
        } else if (monthsLeft <= 0) {
          reply = `Your goal "${activeGoal.title}" deadline has passed and ${formatCurrency(
            remaining,
          )} is still remaining.`;
        } else if (currentMonthlyRate + 0.01 >= requiredMonthly) {
          reply = `You are on track for "${activeGoal.title}". Current contribution rate is about ${formatCurrency(
            currentMonthlyRate,
          )}/month, required is ${formatCurrency(
            requiredMonthly,
          )}/month for the remaining ${monthsLeft} month(s).`;
        } else {
          reply = `You may not reach "${activeGoal.title}" at the current contribution rate. Current is about ${formatCurrency(
            currentMonthlyRate,
          )}/month, but you need ${formatCurrency(
            requiredMonthly,
          )}/month for the remaining ${monthsLeft} month(s).`;
        }

        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      const wantsTopExpenseTips =
        /\b(high|highest|top|major|most)\b.*\b(expense|expenses|spending)\b.*\b(category|categories)\b|\b(expense|spending)\b.*\b(category|categories)\b.*\b(tip|tips|suggest|advice)\b/i.test(
          userText,
        );
      if (wantsTopExpenseTips) {
        const expenseTx = scopedTransactions.filter(
          (t) => t.type === "EXPENSE",
        );
        if (!expenseTx.length) {
          const reply = "No expense data found to analyze categories.";
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }

        const totalExpense = expenseTx.reduce(
          (s, t) => s + Number(t.amount || 0),
          0,
        );
        const totalsByCategory = expenseTx.reduce((acc, t) => {
          const key = (t.category || "uncategorized").toLowerCase();
          acc[key] = (acc[key] || 0) + Number(t.amount || 0);
          return acc;
        }, {});

        const top = Object.entries(totalsByCategory)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        const categoryLines = top.map(([cat, amt], idx) => {
          const pct = totalExpense > 0 ? (amt / totalExpense) * 100 : 0;
          return `${idx + 1}. ${cat}: ${formatCurrency(amt)} (${pct.toFixed(
            1,
          )}% of expenses)`;
        });

        const tipByCategory = (cat) => {
          if (cat === "housing")
            return "review rent/utility contracts and cut avoidable utility usage.";
          if (cat === "travel")
            return "set a fixed monthly travel cap and book transport in advance.";
          if (cat === "groceries")
            return "use a weekly meal plan and fixed shopping list to reduce impulse buys.";
          if (cat === "food")
            return "limit food delivery frequency and set a weekly dining budget.";
          if (cat === "entertainment")
            return "set a monthly entertainment cap and pause unused subscriptions.";
          if (cat === "transportation")
            return "combine trips and prefer lower-cost transport options.";
          if (cat === "healthcare")
            return "schedule preventive care and use in-network providers where possible.";
          return "set a strict category cap and track it weekly.";
        };

        const tips = top.slice(0, 3).map(([cat], idx) => {
          return `${idx + 1}. ${cat}: ${tipByCategory(cat)}`;
        });

        const reply = [
          `Top expense categories (${rangeLabel}):`,
          ...categoryLines,
          "",
          "Tips to reduce high expenses:",
          ...tips,
        ].join("\n");
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      const tipsFormat = wantsTips
        ? `Reply format (plain text, no markdown):
Line 1: Data period: <start> to <end>.
Line 2: Snapshot: income <x>, expenses <y>, savings <z>, savings rate <p>%.
Line 3: Top expense categories: <cat1>, <cat2>, <cat3>.
Line 4: Tip 1: ...
Line 5: Tip 2: ...
Line 6: Tip 3: ...
Line 7: Tip 4: ...
Max 7 lines total, keep each line short and practical.`
        : `Reply in plain text with short sections:
1) Summary
2) Recommendation
3) Action steps
Avoid markdown symbols like ** or #.`;

      const rawReply = await callGemini(
        [
          {
            role: "system",
            content:
              "You are FinGen financial assistant. Always provide concise, direct financial answers in plain text with numeric calculations in Rs. Do not dump raw transaction logs unless explicitly asked to list transactions.",
          },
          {
            role: "user",
            content: `${userText}

Context (${rangeLabel}):
- Data period start: ${firstTxDate ? formatDateLocal(firstTxDate) : "N/A"}
- Data period end: ${lastTxDate ? formatDateLocal(lastTxDate) : "N/A"}
- Months covered: ${monthsCovered}
- Transactions counted: ${scopedTransactions.length}
- Income total: ${formatCurrency(incomeTotal)}
- Expense total: ${formatCurrency(expenseTotal)}
- Savings: ${formatCurrency(savings)}
- Expense by top categories:
${topCategories || "- None"}

Recent transactions:
${recentSnippet || "No recent transactions."}

${tipsFormat}`,
          },
        ],
        { model: "gemini-2.5-flash" },
      );
      const reply = normalizeGeminiFinanceReply(rawReply);

      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsBudgetPlan = isBudgetPlanningIntent(userText);
    if (wantsBudgetPlan) {
      const localReply = buildBudgetPlanReply(transactions, userText);
      if (localReply) {
        await saveChat(user.id, userText, localReply);
        return NextResponse.json({ reply: localReply });
      }

      const fallbackTransactions = transactions.slice(0, 80).map((t) => ({
        date: formatDateLocal(new Date(t.date)),
        type: t.type,
        amount: Number(t.amount || 0),
        category: t.category || "uncategorized",
        description: t.merchant || t.description || "-",
      }));

      const geminiPrompt = `User asked for transaction analysis and a budget plan.
Generate only a concise actionable answer with:
1) monthly income, expenses, savings estimate
2) category-wise budget caps
3) next 3 month budget plan
4) 3 action steps
Do not print raw transaction list.
Use Rs. currency.

Transactions:
${JSON.stringify(fallbackTransactions)}`;

      try {
        const reply = await callGemini(
          [
            {
              role: "system",
              content:
                "You are a financial planning assistant. Answer in plain text with concise calculations and no markdown.",
            },
            { role: "user", content: geminiPrompt },
          ],
          { model: "gemini-2.5-flash" },
        );
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      } catch {
        const reply =
          "I could not generate a detailed budget plan right now. Please try again, or share at least one month with both income and expense transactions.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }
    }

    const wantsTxAdvanced =
      /\b(transaction|transactions|txns|statement|history)\b/i.test(userText);
    if (wantsTxAdvanced) {
      const allTx = await db.transaction.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
      });

      let filtered = allTx;

      const range = parseExplicitRange(userText);
      if (range) {
        filtered = filtered.filter((t) => {
          const d = new Date(t.date);
          return d >= range.start && d <= range.end;
        });
      } else if (start && end) {
        filtered = filtered.filter((t) => {
          const d = new Date(t.date);
          return d >= start && d <= end;
        });
      }

      const above = userText.match(/above\s+([0-9,]+(?:\.[0-9]+)?)/i);
      if (above) {
        const amt = Number(above[1].replace(/,/g, ""));
        filtered = filtered.filter((t) => Number(t.amount) > amt);
      }

      const near = userText.match(/near\s+([0-9,]+(?:\.[0-9]+)?)/i);
      if (near) {
        const amt = Number(near[1].replace(/,/g, ""));
        const low = amt * 0.9;
        const high = amt * 1.1;
        filtered = filtered.filter(
          (t) => Number(t.amount) >= low && Number(t.amount) <= high,
        );
      }

      const pending = /pending/i.test(userText);
      const failed = /failed/i.test(userText);
      if (pending) filtered = filtered.filter((t) => t.status === "PENDING");
      if (failed) filtered = filtered.filter((t) => t.status === "FAILED");

      if (/recurring/i.test(userText)) {
        filtered = filtered.filter((t) => t.isRecurring);
      }

      const cat = parseCategory(userText);
      if (cat && cat !== "INCOME" && cat !== "EXPENSE") {
        filtered = filtered.filter((t) => (t.category || "") === cat);
      }

      const searchMatch = userText.match(/find\s+([a-z0-9\s-]+)/i);
      if (searchMatch) {
        const term = searchMatch[1].trim().toLowerCase();
        filtered = filtered.filter(
          (t) =>
            (t.merchant || "").toLowerCase().includes(term) ||
            (t.description || "").toLowerCase().includes(term),
        );
      }

      if (/highest\s+\d+/i.test(userText)) {
        const m = userText.match(/highest\s+(\d+)/i);
        const n = m ? Number(m[1]) : 5;
        filtered = filtered
          .filter((t) => t.type === "EXPENSE")
          .sort((a, b) => Number(b.amount) - Number(a.amount))
          .slice(0, n);
      } else if (/lowest\s+\d+/i.test(userText)) {
        const m = userText.match(/lowest\s+(\d+)/i);
        const n = m ? Number(m[1]) : 5;
        filtered = filtered
          .filter((t) => t.type === "EXPENSE")
          .sort((a, b) => Number(a.amount) - Number(b.amount))
          .slice(0, n);
      } else if (/most recent/i.test(userText)) {
        filtered = filtered
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 10);
      }

      const lines = filtered.slice(0, 50).map((t) => {
        const desc = t.merchant || t.description || "-";
        return `${formatDateLocal(new Date(t.date))}: ${t.type} ${formatCurrency(
          t.amount,
        )}${desc ? ` (${desc})` : ""}`;
      });
      const reply =
        lines.length > 0
          ? ["Transactions:", ...lines].join("\n")
          : "No matching transactions found.";
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsSpending = /\bspend|spending|expense|expenses|category\b/i.test(
      userText,
    );
    if (wantsSpending) {
      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const lastMonthStart = startOfMonth(
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
      );
      const lastMonthEnd = endOfMonth(
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
      );

      const allExpenses = transactions.filter((t) => t.type === "EXPENSE");
      const thisMonthExpenses = allExpenses.filter((t) => {
        const d = new Date(t.date);
        return d >= thisMonthStart && d <= endOfMonth(now);
      });
      const lastMonthExpenses = allExpenses.filter((t) => {
        const d = new Date(t.date);
        return d >= lastMonthStart && d <= lastMonthEnd;
      });

      const sumByCategory = (items) =>
        items.reduce((acc, t) => {
          const key = t.category || "uncategorized";
          acc[key] = (acc[key] || 0) + Number(t.amount || 0);
          return acc;
        }, {});

      if (
        /compare.*(this month|current month).*(last month|previous month)/i.test(
          userText,
        )
      ) {
        const a = sumByCategory(thisMonthExpenses);
        const b = sumByCategory(lastMonthExpenses);
        const lines = Object.keys({ ...a, ...b }).map((k) => {
          return `- ${k}: this month ${formatCurrency(a[k] || 0)} vs last month ${formatCurrency(b[k] || 0)}`;
        });
        const reply = [
          "Category comparison (this vs last month):",
          ...lines,
        ].join("\n");
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (
        /highest.*category.*last month|top category.*last month/i.test(userText)
      ) {
        const totals = sumByCategory(lastMonthExpenses);
        const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
        const reply = top
          ? `Highest spending category last month: ${top[0]} (${formatCurrency(top[1])}).`
          : "No expenses found last month.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/which category increased the most/i.test(userText)) {
        const a = sumByCategory(thisMonthExpenses);
        const b = sumByCategory(lastMonthExpenses);
        let best = null;
        for (const k of Object.keys({ ...a, ...b })) {
          const diff = (a[k] || 0) - (b[k] || 0);
          if (!best || diff > best.diff) best = { k, diff };
        }
        const reply = best
          ? `Category increased most this month: ${best.k} (${formatCurrency(best.diff)}).`
          : "Not enough data to compare categories.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (
        /spending breakdown.*last month|breakdown by category.*last month/i.test(
          userText,
        )
      ) {
        const totals = sumByCategory(lastMonthExpenses);
        const lines = Object.entries(totals)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `- ${k}: ${formatCurrency(v)}`);
        const reply =
          lines.length > 0
            ? ["Spending breakdown last month:", ...lines].join("\n")
            : "No expenses found last month.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (
        /top\s*3.*category.*this year|top\s*3.*spending categories this year/i.test(
          userText,
        )
      ) {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearExpenses = allExpenses.filter(
          (t) => new Date(t.date) >= yearStart,
        );
        const totals = sumByCategory(yearExpenses);
        const top3 = Object.entries(totals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        const reply = top3.length
          ? [
              "Top 3 categories this year:",
              ...top3.map(([k, v]) => `- ${k}: ${formatCurrency(v)}`),
            ].join("\n")
          : "No expenses found this year.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/percentage of income.*rent/i.test(userText)) {
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const income = transactions
          .filter((t) => t.type === "INCOME" && new Date(t.date) >= since30)
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const rent = allExpenses
          .filter(
            (t) =>
              (t.category || "").toLowerCase().includes("housing") ||
              (t.description || "").toLowerCase().includes("rent"),
          )
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const pct = income > 0 ? (rent / income) * 100 : 0;
        const reply = `Rent as % of income: ${pct.toFixed(1)}%.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/monthly spending trend.*last\s+6/i.test(userText)) {
        const map = {};
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        allExpenses.forEach((t) => {
          const d = new Date(t.date);
          if (d < start) return;
          const k = monthKey(d);
          map[k] = (map[k] || 0) + Number(t.amount || 0);
        });
        const months = [];
        for (let i = 5; i >= 0; i -= 1) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const k = monthKey(d);
          months.push(`${k}: ${formatCurrency(map[k] || 0)}`);
        }
        const reply = [
          "Monthly spending trend (last 6 months):",
          ...months,
        ].join("\n");
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/average monthly spending this year/i.test(userText)) {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearExpenses = allExpenses.filter(
          (t) => new Date(t.date) >= yearStart,
        );
        const total = yearExpenses.reduce(
          (s, t) => s + Number(t.amount || 0),
          0,
        );
        const monthsElapsed = now.getMonth() + 1;
        const avg = monthsElapsed > 0 ? total / monthsElapsed : 0;
        const reply = `Average monthly spending this year: ${formatCurrency(avg)}.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/daily average spending/i.test(userText)) {
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const last30 = allExpenses.filter((t) => new Date(t.date) >= since30);
        const total = last30.reduce((s, t) => s + Number(t.amount || 0), 0);
        const avg = total / 30;
        const reply = `Daily average spending (last 30 days): ${formatCurrency(avg)}.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/biggest expense ever|highest expense/i.test(userText)) {
        const top = allExpenses.sort(
          (a, b) => Number(b.amount) - Number(a.amount),
        )[0];
        const reply = top
          ? `Biggest expense: ${formatCurrency(top.amount)} on ${formatDateLocal(new Date(top.date))} (${top.description || top.category || "expense"}).`
          : "No expenses found.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/monthly budget|budget/i.test(userText)) {
        const budget = await db.budget.findUnique({
          where: { userId: user.id },
        });
        if (!budget) {
          const reply = "No monthly budget set.";
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }
        const spent = thisMonthExpenses.reduce(
          (s, t) => s + Number(t.amount || 0),
          0,
        );
        const budgetAmt = Number(budget.amount || 0);
        const remaining = Math.max(0, budgetAmt - spent);
        const pct = budgetAmt > 0 ? (spent / budgetAmt) * 100 : 0;
        let reply = `Monthly budget: ${formatCurrency(budgetAmt)}. Spent: ${formatCurrency(spent)} (${pct.toFixed(1)}%). Remaining: ${formatCurrency(remaining)}.`;
        if (/exceed/i.test(userText)) {
          reply =
            spent > budgetAmt
              ? "Yes, you exceeded your budget."
              : "No, you are within your budget.";
        }
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }
    }

    const wantsGoals = /\b(goal|goals)\b/i.test(userText);
    if (wantsGoals) {
      const goals = await db.goal.findMany({
        where: { userId: user.id },
        include: { contributions: true },
        orderBy: { createdAt: "desc" },
      });

      if (!goals || goals.length === 0) {
        const reply = "You don’t have any goals yet.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      const wantsList = /\b(list|show|all)\b.*\bgoals?\b/i.test(userText);
      const wantsProgress = /\b(progress|status|track)\b/i.test(userText);
      const wantsCompare = /\bcompare\b.*\bgoals?\b/i.test(userText);
      const wantsClosest =
        /\bclosest\b.*\bcompletion|closest to completion\b/i.test(userText);
      const wantsBehind = /\bbehind schedule|late\b/i.test(userText);
      const wantsCompletion = /\bwhen\b.*\bcomplete|completion date\b/i.test(
        userText,
      );
      const wantsRemaining = /\bhow much more|remaining\b/i.test(userText);
      const wantsOptimize =
        /\bfaster|increase monthly|reduce contribution|what happens if/i.test(
          userText,
        );
      const wantsRank = /\brank\b.*\bgoals?|priority\b/i.test(userText);

      let filteredGoals = goals;
      for (const g of goals) {
        if (matchesGoalTitle(userText, g.title)) {
          filteredGoals = [g];
          break;
        }
      }

      if (wantsProgress || filteredGoals.length === 1) {
        const lines = filteredGoals.map((g) => {
          const saved = (g.contributions || []).reduce(
            (s, c) => s + Number(c.amount || 0),
            0,
          );
          const target = Number(g.targetAmount || 0);
          const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
          const remaining = Math.max(0, target - saved);
          return `- ${g.title}: saved ${formatCurrency(saved)} / ${formatCurrency(
            target,
          )} (${pct.toFixed(1)}%), remaining ${formatCurrency(remaining)}.`;
        });
        const reply = ["Goal progress:", ...lines].join("\n");
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (wantsCompare) {
        const lines = goals.map((g) => {
          const saved = (g.contributions || []).reduce(
            (s, c) => s + Number(c.amount || 0),
            0,
          );
          const target = Number(g.targetAmount || 0);
          const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
          return `- ${g.title}: ${pct.toFixed(1)}%`;
        });
        const reply = ["Goals progress comparison:", ...lines].join("\n");
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (wantsClosest) {
        const sorted = goals
          .map((g) => {
            const saved = (g.contributions || []).reduce(
              (s, c) => s + Number(c.amount || 0),
              0,
            );
            const target = Number(g.targetAmount || 0);
            const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
            return { g, pct };
          })
          .sort((a, b) => b.pct - a.pct);
        const top = sorted[0];
        const reply = top
          ? `Closest to completion: ${top.g.title} (${top.pct.toFixed(1)}%).`
          : "No goals available.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (wantsBehind) {
        const now = new Date();
        const behind = goals.filter((g) => {
          const saved = (g.contributions || []).reduce(
            (s, c) => s + Number(c.amount || 0),
            0,
          );
          const target = Number(g.targetAmount || 0);
          const elapsed =
            (now - new Date(g.startDate)) /
            (new Date(g.endDate) - new Date(g.startDate));
          const expected = Math.max(0, Math.min(1, elapsed)) * target;
          return saved < expected;
        });
        const reply =
          behind.length > 0
            ? [
                "Goals behind schedule:",
                ...behind.map((g) => `- ${g.title}`),
              ].join("\n")
            : "No goals are behind schedule.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (wantsCompletion) {
        const lines = filteredGoals.map((g) => {
          return `- ${g.title}: target end ${formatDateLocal(
            new Date(g.endDate),
          )}`;
        });
        const reply = ["Projected completion dates:", ...lines].join("\n");
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (wantsRemaining) {
        const lines = filteredGoals.map((g) => {
          const saved = (g.contributions || []).reduce(
            (s, c) => s + Number(c.amount || 0),
            0,
          );
          const target = Number(g.targetAmount || 0);
          const remaining = Math.max(0, target - saved);
          return `- ${g.title}: remaining ${formatCurrency(remaining)}`;
        });
        const reply = ["Remaining to reach goals:", ...lines].join("\n");
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (wantsRank) {
        const ranked = goals
          .map((g) => {
            const saved = (g.contributions || []).reduce(
              (s, c) => s + Number(c.amount || 0),
              0,
            );
            const target = Number(g.targetAmount || 0);
            const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
            return { g, pct };
          })
          .sort((a, b) => b.pct - a.pct);
        const reply = [
          "Goals ranked by progress:",
          ...ranked.map(
            (r, i) => `${i + 1}. ${r.g.title} (${r.pct.toFixed(1)}%)`,
          ),
        ].join("\n");
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (wantsOptimize) {
        const g = filteredGoals[0];
        const saved = (g.contributions || []).reduce(
          (s, c) => s + Number(c.amount || 0),
          0,
        );
        const target = Number(g.targetAmount || 0);
        const remaining = Math.max(0, target - saved);
        const monthsLeft = Math.max(
          1,
          Math.ceil(
            (new Date(g.endDate) - new Date()) / (1000 * 60 * 60 * 24 * 30),
          ),
        );
        const required = remaining / monthsLeft;
        const reply = `To reach "${g.title}" faster, aim for ~${formatCurrency(
          required,
        )} per month over ${monthsLeft} months.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (wantsList) {
        const lines = goals.map((g) => {
          return `- ${g.title} (target ${formatCurrency(
            g.targetAmount,
          )}, end ${formatDateLocal(new Date(g.endDate))})`;
        });
        const reply = ["Your goals:", ...lines].join("\n");
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }
    }

    const ruleCmd = parseRuleCommand(userText);
    if (ruleCmd) {
      let reply = "Unknown rule command.";
      if (ruleCmd.action === "list") {
        const rules = await db.categoryRule.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
        if (rules.length === 0) {
          reply = "No category rules found.";
        } else {
          reply = rules
            .map(
              (r) =>
                `- ${r.id}: ${r.field} contains "${r.pattern}" -> ${r.category}`,
            )
            .join("\n");
        }
      } else if (ruleCmd.action === "remove") {
        if (!ruleCmd.id) {
          reply = "Please provide a rule id to delete.";
        } else {
          await db.categoryRule.delete({ where: { id: ruleCmd.id } });
          reply = `Deleted rule ${ruleCmd.id}.`;
        }
      } else if (ruleCmd.action === "add") {
        if (!ruleCmd.ok) {
          reply =
            'Format: "add rule merchant:Worldlink category:bills" or "add rule description:Salary category:salary".';
        } else if (!defaultCategories.find((c) => c.id === ruleCmd.category)) {
          reply = `Unknown category "${ruleCmd.category}".`;
        } else {
          const created = await db.categoryRule.create({
            data: {
              userId: user.id,
              field: ruleCmd.field,
              pattern: ruleCmd.pattern,
              category: ruleCmd.category,
            },
          });
          reply = `Rule saved: ${created.id}.`;
        }
      }
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsHelp =
      /\b(help|commands|what can you do|how can you help)\b/i.test(userText);
    if (wantsHelp) {
      const reply = [
        "Here are examples you can ask:",
        "",
        "Spending",
        "- How much did I spend on groceries last month?",
        "- How much did I spend on housing this month?",
        "- How much did I spend last week?",
        "- Compare grocery spending this month vs last month.",
        "- What was my highest spending category last month?",
        "- Show monthly spending trend for last 6 months.",
        "- What’s my daily average spending?",
        "- What’s my biggest expense ever?",
        "",
        "Transactions",
        "- Show last 5 days transactions",
        "- Provide me last 10 days transactions",
        "- Show all transactions last 7 days",
        "- Show transactions above 10000.",
        "- Show all dining transactions last month.",
        "- Show transactions between 2026-01-01 and 2026-01-15.",
        "- Find transaction from Worldlink.",
        "- Show highest 5 transactions.",
        "- Show most recent transactions.",
        "",
        "Savings",
        "- How much did I save last month?",
        "- How much did I save last week?",
        "- How much did I save last year?",
        "- What is my savings rate?",
        "- Compare savings this year vs last year.",
        "- What was my best savings month?",
        "- Am I saving enough?",
        "",
        "Goals",
        "- List my goals",
        "- Show my goals",
        "- Goal progress",
        "- Progress for <goal title>",
        "- Which goal is closest to completion?",
        "- Which goal is behind schedule?",
        "- How much more do I need to reach my emergency fund?",
        "- Compare all goals progress.",
        "- Rank goals by priority.",
        "",
        "Forecasts",
        "- Predict spending next 3 months",
        "- Predict spending next 7 months",
        "- Spending forecast next 4 weeks",
        "- Predict expenses next 2 years",
        "- Spending forecast next 10 years",
        "- Spending forecast by category next 6 months",
        "- Cash flow forecast next 6 months",
        "- Forecast year-end expenses.",
        "- When will my spending peak?",
        "- Will I have surplus next quarter?",
        "- How is this forecast predicted?",
        "",
        "Investing",
        "- Provide me best investment plan.",
        "- Investment recommendations",
        "- How should I invest?",
        "- How should I invest in Nepal market?",
        "- Suggest portfolio allocation.",
        "- How much can I invest monthly?",
        "- What’s my risk profile?",
        "- Update my risk level to high.",
        "",
        "Categorization",
        "- Categorize my last 20 transactions",
        "- Preview categorize last 20",
        "- Categorize last 50 with confidence 0.7",
        "- Show categorization details for last run",
        "- Revert categorization",
        "",
        "Category rules",
        "- Add rule merchant:Worldlink category:bills",
        "- Add rule description:Salary category:salary",
        "- List rules",
        "- Delete rule <ruleId>",
        "",
        "Quick commands",
        "- Add 500 dining.",
        "- Add 2000 rent today.",
        "- Update last expense to 800.",
        "- Delete last transaction.",
        "- Split 3000 between groceries and dining.",
        "- Add recurring 1500 Netflix monthly.",
        "",
        "Help",
        "- help",
        "- commands",
        "- what can you do",
      ].join("\n");
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsExplainAnomaly =
      /\bhow is anomaly detected|anomaly detected|why anomaly\b/i.test(
        userText,
      );
    if (wantsExplainAnomaly) {
      const reply =
        "Anomaly detection flags expenses in the last 30 days that are above your mean plus 2 standard deviations.";
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsWhyRecommend =
      /\bwhy did you recommend this|why recommend\b/i.test(userText);
    if (wantsWhyRecommend) {
      const reply =
        "Recommendations are based on your recent income, expenses, savings rate, and risk profile, plus basic market context.";
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsModelConfidence = /\bmodel confidence|confidence\b/i.test(
      userText,
    );
    if (wantsModelConfidence) {
      const reply =
        "Confidence is used for categorization only and reflects model certainty. Higher confidence means a safer auto‑update.";
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsLastForecast = /\blast forecast updated\b/i.test(userText);
    if (wantsLastForecast) {
      const reply = "Forecasts are generated on demand when you ask.";
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsForecastExplain =
      /\b(how|why)\b.*\b(forecast|prediction|predicted|calculated)\b/i.test(
        userText,
      );
    if (wantsForecastExplain) {
      const reply = [
        "Forecasts use Holt’s exponential smoothing with trend on your recent spending history.",
        "Recent months/weeks/days get more weight than older data, and a trend is estimated.",
        "The forecast projects the smoothed level plus the trend forward for the requested period.",
      ].join("\n");
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsForecast =
      /\b(forecast|predict|prediction|projection)\b/i.test(userText) &&
      /\b(spend|spending|expense|expenses)\b/i.test(userText);
    if (wantsForecast) {
      const wantsCategoryForecast =
        /\b(category|categories|category-wise|category wise|by category)\b/i.test(
          userText,
        );
      const granularity = parseForecastGranularity(userText);
      const horizon = parseForecastHorizon(userText, granularity);
      const wantsDashboard = /\bdashboard\b/i.test(userText);

      if (wantsCategoryForecast) {
        const totals = {};
        transactions.forEach((t) => {
          if (t.type !== "EXPENSE") return;
          const key = t.category || "uncategorized";
          totals[key] = (totals[key] || 0) + Number(t.amount || 0);
        });
        const topCategories = Object.entries(totals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([k]) => k);

        if (topCategories.length === 0) {
          const reply = "Not enough data to forecast spending by category.";
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }

        const lines = [];
        for (const cat of topCategories) {
          const catTx = transactions.filter(
            (t) =>
              t.type === "EXPENSE" && (t.category || "uncategorized") === cat,
          );
          const series = aggregateExpenses(catTx, granularity);
          const forecast = forecastSeries(series, granularity, horizon);
          if (forecast.length === 0) continue;
          lines.push(`Category: ${cat}`);
          forecast.forEach((f) => {
            lines.push(`- ${f.label}: ${formatCurrency(f.amount)}`);
          });
          lines.push("");
        }

        const reply = [
          `Spending forecast by category (${granularity}, next ${horizon}):`,
          "",
          ...lines.filter(Boolean),
          ...(wantsDashboard
            ? ["To view on dashboard, open:", "`/dashboard?forecast=1`"]
            : []),
        ].join("\n");
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      const series = aggregateExpenses(transactions, granularity);
      const forecast = forecastSeries(series, granularity, horizon);
      if (forecast.length === 0) {
        const reply = "Not enough data to forecast spending.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }
      const lines = forecast.map(
        (f) => `${f.label}: ${formatCurrency(f.amount)}`,
      );
      const reply = [
        `Spending forecast (${granularity}, next ${horizon}):`,
        "",
        ...lines,
        ...(wantsDashboard
          ? ["", "To view on dashboard, open:", "`/dashboard?forecast=1`"]
          : []),
      ].join("\n");
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsCashflow =
      /\b(cash\s*flow|cashflow)\b/i.test(userText) &&
      /\b(forecast|predict|prediction|projection)\b/i.test(userText);
    if (wantsCashflow) {
      const granularity = parseForecastGranularity(userText);
      const horizon = parseForecastHorizon(userText, granularity);
      const series = aggregateCashFlow(transactions, granularity);
      if (!series || series.length === 0) {
        const reply = "Not enough data to forecast cash flow.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }
      const incomeSeries = series.map((s) => ({
        date: s.date,
        amount: s.income,
      }));
      const expenseSeries = series.map((s) => ({
        date: s.date,
        amount: s.expense,
      }));
      const incomeForecast = forecastSeries(incomeSeries, granularity, horizon);
      const expenseForecast = forecastSeries(
        expenseSeries,
        granularity,
        horizon,
      );
      const lines = incomeForecast.map((f, i) => {
        const exp = expenseForecast[i] ? expenseForecast[i].amount : 0;
        const net = Number((f.amount - exp).toFixed(2));
        return `${f.label}: In ${formatCurrency(f.amount)}, Out ${formatCurrency(
          exp,
        )}, Net ${formatCurrency(net)}`;
      });
      const reply = [
        `Cash flow forecast (${granularity}, next ${horizon}):`,
        "",
        ...lines,
      ].join("\n");
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsAdvancedForecast =
      /\b(peak|grow|next quarter|year[-\s]?end|discretionary|run out|surplus|lowest balance|worst[-\s]?case)\b/i.test(
        userText,
      );
    if (wantsAdvancedForecast) {
      const granularity = "monthly";
      const series = aggregateExpenses(transactions, granularity);
      const horizon = 12;
      const forecast = forecastSeries(series, granularity, horizon);

      if (/spending peak/i.test(userText)) {
        const peak = forecast.reduce(
          (best, f) => (!best || f.amount > best.amount ? f : best),
          null,
        );
        const reply = peak
          ? `Spending is projected to peak around ${peak.label} at ${formatCurrency(
              peak.amount,
            )}.`
          : "Not enough data to forecast spending peak.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/category.*grow.*next quarter/i.test(userText)) {
        const now = new Date();
        const last3Start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const last3 = transactions.filter(
          (t) => new Date(t.date) >= last3Start,
        );
        const byCat = {};
        last3.forEach((t) => {
          if (t.type !== "EXPENSE") return;
          const k = t.category || "uncategorized";
          if (!byCat[k]) byCat[k] = [];
          byCat[k].push({
            date: new Date(t.date),
            amount: Number(t.amount || 0),
          });
        });
        let best = null;
        Object.entries(byCat).forEach(([cat, items]) => {
          const monthly = aggregateExpenses(
            items.map((i) => ({ ...i, type: "EXPENSE" })),
            "monthly",
          );
          if (monthly.length < 2) return;
          const growth = monthly[monthly.length - 1].amount - monthly[0].amount;
          if (!best || growth > best.growth) best = { cat, growth };
        });
        const reply = best
          ? `Category likely to grow most next quarter: ${best.cat} (recent trend +${formatCurrency(
              best.growth,
            )}).`
          : "Not enough data to estimate category growth.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/discretionary/i.test(userText)) {
        const discretionary = new Set([
          "entertainment",
          "shopping",
          "travel",
          "food",
          "personal",
          "gifts",
        ]);
        const discTx = transactions.filter(
          (t) =>
            t.type === "EXPENSE" &&
            discretionary.has((t.category || "").toLowerCase()),
        );
        const discSeries = aggregateExpenses(discTx, "monthly");
        const discForecast = forecastSeries(discSeries, "monthly", 6);
        const total = discForecast.reduce((s, f) => s + f.amount, 0);
        const reply = `Projected discretionary spending over next 6 months: ${formatCurrency(
          total,
        )}.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/year[-\s]?end expenses/i.test(userText)) {
        const now = new Date();
        const monthsLeft = 12 - (now.getMonth() + 1);
        const total = forecast
          .slice(0, monthsLeft)
          .reduce((s, f) => s + f.amount, 0);
        const reply = `Forecast year‑end expenses (remaining months): ${formatCurrency(
          total,
        )}.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (
        /run out of funds|lowest balance|surplus|worst[-\s]?case/i.test(
          userText,
        )
      ) {
        const accounts = await db.account.findMany({
          where: { userId: user.id },
        });
        const balance = accounts.reduce(
          (s, a) => s + Number(a.balance?.toNumber?.() ?? a.balance ?? 0),
          0,
        );
        const cashSeries = aggregateCashFlow(transactions, "monthly");
        const incSeries = cashSeries.map((s) => ({
          date: s.date,
          amount: s.income,
        }));
        const expSeries = cashSeries.map((s) => ({
          date: s.date,
          amount: s.expense,
        }));
        const incFc = forecastSeries(incSeries, "monthly", 12);
        const expFc = forecastSeries(expSeries, "monthly", 12);
        let minBal = balance;
        let minLabel = null;
        let curr = balance;
        for (let i = 0; i < incFc.length; i += 1) {
          const net = incFc[i].amount - (expFc[i]?.amount || 0);
          const worstNet = /worst[-\s]?case/i.test(userText) ? net * 0.7 : net;
          curr += worstNet;
          if (curr < minBal) {
            minBal = curr;
            minLabel = incFc[i].label;
          }
        }
        if (/run out of funds/i.test(userText)) {
          const reply =
            minBal < 0
              ? `You may run out of funds around ${minLabel}.`
              : "No projected shortfall in the next 12 months.";
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }
        if (/surplus/i.test(userText)) {
          const netNext3 = incFc
            .slice(0, 3)
            .reduce((s, f, i) => s + (f.amount - (expFc[i]?.amount || 0)), 0);
          const reply =
            netNext3 > 0
              ? `Projected surplus next quarter: ${formatCurrency(netNext3)}.`
              : `Projected deficit next quarter: ${formatCurrency(netNext3)}.`;
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }
        const reply = minLabel
          ? `Lowest projected balance around ${minLabel}: ${formatCurrency(minBal)}.`
          : "Not enough data to project lowest balance.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }
    }

    const wantsInvest =
      /\b(invest|investment|recommendation|allocate|best investment plan)\b/i.test(
        userText,
      );
    if (wantsInvest) {
      const wantsStructuredPlan = true;
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

      const income = monthlyIncome || Number(user.income || 0);
      const expenses = monthlyExpenses || Number(user.expenses || 0);
      const available = Math.max(0, income - expenses);
      const savingsRate = income > 0 ? (available / income) * 100 : 0;

      const lines = [];
      if (wantsStructuredPlan) {
        lines.push("Best Investment Plan (general guidance):");
        lines.push(
          `- Monthly income: ${formatCurrency(income)} | Expenses: ${formatCurrency(
            expenses,
          )} | Available: ${formatCurrency(available)} | Savings rate: ${savingsRate.toFixed(
            1,
          )}%`,
        );
      } else {
        lines.push("Investment recommendations (general guidance):");
        lines.push(
          `- Monthly income: ${formatCurrency(income)} | Expenses: ${formatCurrency(
            expenses,
          )} | Available: ${formatCurrency(available)} | Savings rate: ${savingsRate.toFixed(
            1,
          )}%`,
        );
      }

      lines.push("- Analysis Nepal market:");
      const market = await fetchShareBazaar("NEPSE");
      if (market) {
        const change = Number(market.change || 0);
        const changePct = Number(market.changePercent || 0);
        if (Number(market.lastTradedPrice || 0) > 0) {
          lines.push(
            `- Market snapshot (NEPSE): ${Number(
              market.lastTradedPrice || 0,
            ).toFixed(
              2,
            )} (${change >= 0 ? "+" : ""}${change.toFixed(2)}, ${changePct.toFixed(
              2,
            )}%)`,
          );
        } else {
          lines.push(
            "- Market snapshot unavailable (market closed or no data).",
          );
        }
      } else {
        lines.push("- Market snapshot unavailable right now.");
      }

      const sentiment = await fetchNewsSentiment();
      if (sentiment) {
        lines.push(
          `- Global news sentiment: ${sentiment.sentiment} (score ${sentiment.score}).`,
        );
      } else {
        lines.push("- Global news sentiment unavailable (set NEWS_API_KEY).");
      }

      if (available <= 0) {
        lines.push(
          "- Focus on reducing expenses or increasing income before investing.",
        );
      } else if (wantsStructuredPlan) {
        lines.push(
          "- Emergency fund: 3–6 months of expenses in liquid savings/FD.",
        );
        lines.push("- Short‑term (0–2 years): FDs or savings products.");
        lines.push(
          "- Mid‑term (2–5 years): diversified mutual funds / index funds.",
        );
        lines.push(
          "- Long‑term (5+ years): equity funds / NEPSE exposure for growth.",
        );
        lines.push(
          "- Monthly split example: 50% low‑risk, 30% diversified funds, 20% higher‑risk.",
        );
        lines.push("- Rebalance quarterly based on goals and risk tolerance.");
      } else if (savingsRate < 15) {
        lines.push("- Build an emergency fund first (3–6 months of expenses).");
        lines.push(
          "- Use low‑risk options (e.g., fixed deposits, government bonds).",
        );
      } else {
        lines.push("- Maintain an emergency fund (3–6 months of expenses).");
        lines.push(
          "- Split new savings: 50% low‑risk (FDs/bonds), 30% diversified mutual funds/ETFs, 20% higher‑risk assets if comfortable.",
        );
      }

      lines.push(
        "- This is general guidance, not financial advice. Consider your risk tolerance and time horizon.",
      );

      const reply = lines.join("\n");
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsRisk =
      /\b(risk profile|risk level|risk appetite)\b/i.test(userText) ||
      /\bupdate my risk\b/i.test(userText);
    if (wantsRisk) {
      const match = userText.match(/\b(low|moderate|medium|high)\b/i);
      if (/update my risk|set risk|risk level/i.test(userText) && match) {
        const profile = match[1].toUpperCase();
        await db.user.update({
          where: { id: user.id },
          data: { riskProfile: profile },
        });
        const reply = `Risk profile updated to ${profile}.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }
      const reply = `Your risk profile is ${user.riskProfile || "MODERATE"}.`;
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsQuick = /\b(add|delete|update|split)\b/i.test(userText);
    if (wantsQuick) {
      // add transaction: "add 500 dining" or "add 2000 rent today"
      const addMatch = userText.match(
        /add\s+([0-9,]+)\s+([a-z\s-]+)(?:\s+today)?/i,
      );
      if (addMatch) {
        const amount = Number(addMatch[1].replace(/,/g, ""));
        const label = addMatch[2].trim();
        const category = parseCategory(label) || "other-expense";
        const account = await db.account.findFirst({
          where: { userId: user.id },
        });
        if (!account) {
          const reply = "No account found to add transaction.";
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }
        const created = await db.transaction.create({
          data: {
            userId: user.id,
            accountId: account.id,
            type: "EXPENSE",
            amount,
            date: new Date(),
            category,
            description: label,
          },
        });
        const reply = `Added expense ${formatCurrency(created.amount)} to ${category}.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/delete last transaction/i.test(userText)) {
        const last = await db.transaction.findFirst({
          where: { userId: user.id },
          orderBy: { date: "desc" },
        });
        if (!last) {
          const reply = "No transactions to delete.";
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }
        await db.transaction.delete({ where: { id: last.id } });
        const reply = "Deleted last transaction.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/update last expense to\s+([0-9,]+)/i.test(userText)) {
        const m = userText.match(/update last expense to\s+([0-9,]+)/i);
        const amt = Number(m[1].replace(/,/g, ""));
        const last = await db.transaction.findFirst({
          where: { userId: user.id, type: "EXPENSE" },
          orderBy: { date: "desc" },
        });
        if (!last) {
          const reply = "No expense found to update.";
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }
        await db.transaction.update({
          where: { id: last.id },
          data: { amount: amt },
        });
        const reply = `Updated last expense to ${formatCurrency(amt)}.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (
        /split\s+([0-9,]+)\s+between\s+([a-z-]+)\s+and\s+([a-z-]+)/i.test(
          userText,
        )
      ) {
        const m = userText.match(
          /split\s+([0-9,]+)\s+between\s+([a-z-]+)\s+and\s+([a-z-]+)/i,
        );
        const amt = Number(m[1].replace(/,/g, ""));
        const c1 = m[2];
        const c2 = m[3];
        const account = await db.account.findFirst({
          where: { userId: user.id },
        });
        if (!account) {
          const reply = "No account found to add split transaction.";
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }
        const half = amt / 2;
        await db.transaction.createMany({
          data: [
            {
              userId: user.id,
              accountId: account.id,
              type: "EXPENSE",
              amount: half,
              date: new Date(),
              category: parseCategory(c1) || c1,
              description: `Split: ${c1}`,
            },
            {
              userId: user.id,
              accountId: account.id,
              type: "EXPENSE",
              amount: half,
              date: new Date(),
              category: parseCategory(c2) || c2,
              description: `Split: ${c2}`,
            },
          ],
        });
        const reply = `Split ${formatCurrency(amt)} between ${c1} and ${c2}.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/add recurring\s+([0-9,]+)\s+([a-z-]+)\s+monthly/i.test(userText)) {
        const m = userText.match(
          /add recurring\s+([0-9,]+)\s+([a-z-]+)\s+monthly/i,
        );
        const amt = Number(m[1].replace(/,/g, ""));
        const cat = parseCategory(m[2]) || m[2];
        const account = await db.account.findFirst({
          where: { userId: user.id },
        });
        if (!account) {
          const reply = "No account found to add recurring transaction.";
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }
        await db.transaction.create({
          data: {
            userId: user.id,
            accountId: account.id,
            type: "EXPENSE",
            amount: amt,
            date: new Date(),
            category: cat,
            description: `Recurring ${cat}`,
            isRecurring: true,
            recurringInterval: "MONTHLY",
          },
        });
        const reply = `Added recurring monthly ${formatCurrency(amt)} for ${cat}.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }
    }

    const wantsReport =
      /\b(report|export|download)\b/i.test(userText) &&
      /\b(transaction|transactions)\b/i.test(userText);
    if (wantsReport) {
      const range = /\bweekly|week\b/i.test(userText)
        ? "weekly"
        : /\byearly|year\b/i.test(userText)
          ? "yearly"
          : "monthly";
      const format = /\bcsv\b/i.test(userText) ? "csv" : "pdf";
      const reply = [
        "Download your report:",
        `[DOWNLOAD:/api/reports/transactions?range=${range}&format=${format}]`,
        format === "pdf"
          ? "- PDF is provided as a print‑ready HTML file (download and print to PDF)."
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    if (
      /\bportfolio allocation|suggest portfolio|how much can i invest\b/i.test(
        userText,
      )
    ) {
      const available =
        Number(user.income || 0) - Number(user.expenses || 0) || 0;
      const profile = (user.riskProfile || "MODERATE").toUpperCase();
      const splits =
        profile === "HIGH"
          ? "30% low‑risk, 40% diversified funds, 30% higher‑risk"
          : profile === "LOW"
            ? "70% low‑risk, 20% diversified funds, 10% higher‑risk"
            : "50% low‑risk, 30% diversified funds, 20% higher‑risk";
      const reply = `Based on ${profile} risk, suggested allocation: ${splits}. You can invest about ${formatCurrency(
        Math.max(0, available),
      )} per month.`;
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsAnomaly =
      /\b(unusual|suspicious|anomaly|anomalies|overspend|spike)\b/i.test(
        userText,
      );
    if (wantsAnomaly) {
      const now = new Date();
      const since30 = new Date();
      since30.setDate(since30.getDate() - 30);
      const recent = transactions.filter(
        (t) => t.type === "EXPENSE" && new Date(t.date) >= since30,
      );
      const amounts = recent.map((t) => Number(t.amount || 0));
      const mean =
        amounts.reduce((s, v) => s + v, 0) / Math.max(1, amounts.length);
      const variance =
        amounts.reduce((s, v) => s + (v - mean) ** 2, 0) /
        Math.max(1, amounts.length);
      const std = Math.sqrt(variance);
      const threshold = mean + std * 2;

      if (/why did .* spike/i.test(userText)) {
        const cat = parseCategory(userText);
        if (cat) {
          const catTx = recent.filter((t) => t.category === cat);
          const catMean =
            catTx.reduce((s, t) => s + Number(t.amount || 0), 0) /
            Math.max(1, catTx.length);
          const reply =
            catTx.length > 0
              ? `Recent ${cat} average: ${formatCurrency(
                  catMean,
                )}. Spikes are transactions significantly above this average.`
              : `No recent ${cat} transactions found to analyze.`;
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }
      }

      if (/was this\s+([0-9,]+)\s+.*normal/i.test(userText)) {
        const m = userText.match(/was this\s+([0-9,]+)\s+.*normal/i);
        const amt = Number(m[1].replace(/,/g, ""));
        const reply =
          amt > threshold
            ? `That amount is above your recent norm (threshold ${formatCurrency(
                threshold,
              )}).`
            : `That amount is within your recent normal range.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      const anomalies = recent.filter((t) => Number(t.amount || 0) > threshold);
      if (anomalies.length === 0) {
        const reply = "No unusual transactions detected in the last 30 days.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }
      const lines = anomalies.slice(0, 10).map((t) => {
        const desc = t.merchant || t.description || "-";
        return `- ${formatDateLocal(new Date(t.date))}: ${formatCurrency(
          t.amount,
        )} (${desc})`;
      });
      const reply = ["Unusual transactions (last 30 days):", ...lines].join(
        "\n",
      );
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsSubscriptions =
      /\b(subscription|subscriptions|recurring|membership|auto[-\s]?pay)\b/i.test(
        userText,
      );
    if (wantsSubscriptions) {
      const recurring = transactions.filter((t) => t.isRecurring);
      if (recurring.length === 0) {
        const reply = "No recurring transactions found.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      const toMonthly = (t) => {
        const amt = Number(t.amount || 0);
        const interval = t.recurringInterval || "MONTHLY";
        if (interval === "DAILY") return amt * 30;
        if (interval === "WEEKLY") return amt * 4;
        if (interval === "YEARLY") return amt / 12;
        return amt;
      };

      const grouped = {};
      recurring.forEach((t) => {
        const key = t.merchant || t.description || "Unknown";
        if (!grouped[key]) grouped[key] = { items: [], total: 0 };
        grouped[key].items.push(t);
        grouped[key].total += toMonthly(t);
      });

      const entries = Object.entries(grouped).sort(
        (a, b) => b[1].total - a[1].total,
      );
      const totalMonthly = entries.reduce((s, [, v]) => s + v.total, 0);

      if (/how much.*monthly/i.test(userText)) {
        const reply = `Estimated monthly subscriptions total: ${formatCurrency(
          totalMonthly,
        )}.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/which subscription costs most/i.test(userText)) {
        const top = entries[0];
        const reply = top
          ? `Highest subscription: ${top[0]} (~${formatCurrency(top[1].total)}/month).`
          : "No subscriptions found.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      const lines = entries
        .slice(0, 20)
        .map(([name, v]) => `- ${name}: ~${formatCurrency(v.total)}/month`);
      const reply = ["Subscriptions:", ...lines].join("\n");
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsInsights =
      /\b(insight|insights|overspending|improve|improvement|cut expenses|habits)\b/i.test(
        userText,
      );
    if (wantsInsights) {
      const now = new Date();
      const since30 = new Date();
      since30.setDate(since30.getDate() - 30);
      const recent = transactions.filter(
        (t) => t.type === "EXPENSE" && new Date(t.date) >= since30,
      );
      const totals = recent.reduce((acc, t) => {
        const k = t.category || "uncategorized";
        acc[k] = (acc[k] || 0) + Number(t.amount || 0);
        return acc;
      }, {});
      const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
      const top = sorted.slice(0, 3);
      const total = sorted.reduce((s, [, v]) => s + v, 0);

      if (top.length === 0) {
        const reply = "Not enough recent spending data to generate insights.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      const lines = [];
      lines.push("Financial insights (last 30 days):");
      top.forEach(([k, v]) => {
        const pct = total > 0 ? (v / total) * 100 : 0;
        lines.push(`- ${k}: ${formatCurrency(v)} (${pct.toFixed(1)}%)`);
      });
      lines.push(
        "- Consider reducing your top category by 10% to boost savings.",
      );
      lines.push("- Review recurring subscriptions and cut unused ones.");
      lines.push("- Aim for a 20%+ savings rate if possible.");

      const reply = lines.join("\n");
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsAdmin =
      /\b(recalculate|regenerate|usage stats|reset|export)\b/i.test(userText);
    if (wantsAdmin) {
      if (/usage stats/i.test(userText)) {
        const total = await db.chatMessage.count({
          where: { userId: user.id },
        });
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const last30 = await db.chatMessage.count({
          where: { userId: user.id, createdAt: { gte: since30 } },
        });
        const runs = await db.categorizeRun.count({
          where: { userId: user.id },
        });
        const reply = `AI usage stats: ${total} messages total, ${last30} in last 30 days, ${runs} categorize runs.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/export.*summary/i.test(userText)) {
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const recent = transactions.filter((t) => new Date(t.date) >= since30);
        const income = recent
          .filter((t) => t.type === "INCOME")
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const expenses = recent
          .filter((t) => t.type === "EXPENSE")
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const topCats = recent
          .filter((t) => t.type === "EXPENSE")
          .reduce((acc, t) => {
            const k = t.category || "uncategorized";
            acc[k] = (acc[k] || 0) + Number(t.amount || 0);
            return acc;
          }, {});
        const top = Object.entries(topCats)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([k, v]) => `- ${k}: ${formatCurrency(v)}`);
        const reply = [
          "Financial summary (last 30 days):",
          `- Income: ${formatCurrency(income)}`,
          `- Expenses: ${formatCurrency(expenses)}`,
          `- Savings: ${formatCurrency(income - expenses)}`,
          "Top categories:",
          ...(top.length ? top : ["- none"]),
        ].join("\n");
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/regenerate insights|recalculate insights/i.test(userText)) {
        const recent = transactions.filter((t) => t.type === "EXPENSE");
        const totals = recent.reduce((acc, t) => {
          const k = t.category || "uncategorized";
          acc[k] = (acc[k] || 0) + Number(t.amount || 0);
          return acc;
        }, {});
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        const top = sorted.slice(0, 3);
        const total = sorted.reduce((s, [, v]) => s + v, 0);
        const lines = [];
        lines.push("Regenerated insights:");
        top.forEach(([k, v]) => {
          const pct = total > 0 ? (v / total) * 100 : 0;
          lines.push(`- ${k}: ${formatCurrency(v)} (${pct.toFixed(1)}%)`);
        });
        const reply = lines.join("\n");
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/recalculate.*prediction|recalculate.*forecast/i.test(userText)) {
        const series = aggregateExpenses(transactions, "monthly");
        const forecast = forecastSeries(series, "monthly", 3);
        const reply = [
          "Recalculated forecast (next 3 months):",
          ...forecast.map((f) => `- ${f.label}: ${formatCurrency(f.amount)}`),
        ].join("\n");
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/reset.*financial analytics|reset analytics/i.test(userText)) {
        if (!/confirm/i.test(userText)) {
          const reply =
            'This will clear chat history and categorization runs. Reply with "confirm reset analytics" to proceed.';
          await saveChat(user.id, userText, reply);
          return NextResponse.json({ reply });
        }
        await db.categorizeRun.deleteMany({ where: { userId: user.id } });
        await db.chatMessage.deleteMany({ where: { userId: user.id } });
        const reply =
          "Analytics reset: cleared chat history and categorization runs.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }
    }

    const wantsShowLast =
      /\b(show|view)\b.*\b(last run|categorization details|details)\b/i.test(
        userText,
      );
    if (wantsShowLast) {
      const run = await db.categorizeRun.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { updates: true },
      });
      if (!run || run.updates.length === 0) {
        const reply = "No categorization details found.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }
      const lines = run.updates.slice(0, 50).map((u) => {
        const conf = Number(u.confidence || 0).toFixed(2);
        return `- ${u.transactionId}: ${u.oldCategory || "none"} -> ${u.newCategory} (conf ${conf}, ${u.source})`;
      });
      if (run.updates.length > 50) {
        lines.push(`- ...and ${run.updates.length - 50} more`);
      }
      const reply = [
        `Last categorization run (${run.createdAt.toLocaleString()}):`,
        ...lines,
      ].join("\n");
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsWhatIf =
      /\bwhat if|simulate|simulation|scenario|recession\b/i.test(userText);
    if (wantsWhatIf) {
      const now = new Date();
      const since90 = new Date();
      since90.setDate(since90.getDate() - 90);
      const recent = transactions.filter((t) => new Date(t.date) >= since90);
      const baseIncome =
        recent
          .filter((t) => t.type === "INCOME")
          .reduce((s, t) => s + Number(t.amount || 0), 0) / 3;
      const baseExpense =
        recent
          .filter((t) => t.type === "EXPENSE")
          .reduce((s, t) => s + Number(t.amount || 0), 0) / 3;

      let income = baseIncome;
      let expense = baseExpense;
      const incMatch = userText.match(/income.*(increase|up).*?(\d+)%/i);
      const decMatch = userText.match(
        /reduce.*(dining|expense|spending).*?(\d+)%/i,
      );

      if (/income increases?|increase income/i.test(userText) && incMatch) {
        income = baseIncome * (1 + Number(incMatch[2]) / 100);
      }
      if (/reduce.*dining/i.test(userText) && decMatch) {
        expense = baseExpense * (1 - Number(decMatch[2]) / 100);
      }
      if (/recession/i.test(userText)) {
        income = baseIncome * 0.85;
        expense = baseExpense * 1.1;
      }

      if (/add a new goal/i.test(userText)) {
        const amt = userText.match(/(\d{3,})/);
        const reply = amt
          ? `Simulation: adding a new goal of ${formatCurrency(
              Number(amt[1]),
            )} will require additional monthly savings based on your plan.`
          : "Simulation: new goal added. Provide a target amount for details.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      const net = income - expense;
      const reply = [
        "Simulation (monthly):",
        `- Income: ${formatCurrency(income)}`,
        `- Expenses: ${formatCurrency(expense)}`,
        `- Net: ${formatCurrency(net)}`,
      ].join("\n");
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsRevert = /\brevert\b/i.test(userText);
    if (wantsRevert) {
      const run = await db.categorizeRun.findFirst({
        where: { userId: user.id, preview: false, revertedAt: null },
        orderBy: { createdAt: "desc" },
        include: { updates: true },
      });
      if (!run) {
        const reply = "No categorization run found to revert.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }
      await Promise.all(
        run.updates.map((u) =>
          db.transaction.update({
            where: { id: u.transactionId },
            data: { category: u.oldCategory },
          }),
        ),
      );
      await db.categorizeRun.update({
        where: { id: run.id },
        data: { revertedAt: new Date() },
      });
      const reply = `Reverted ${run.updates.length} updates from the last categorization run.`;
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsCategorize =
      /\b(categorize|category|auto[-\s]?categorize)\b/i.test(userText);
    if (wantsCategorize) {
      const result = await categorizeTransactions(user.id, userText);
      await saveChat(user.id, userText, result.reply);
      return NextResponse.json({ reply: result.reply });
    }

    const categoryTotals = {};
    const incomeTotals = {};
    transactions.forEach((t) => {
      const key = t.category || "UNCATEGORIZED";
      if (t.type === "INCOME") {
        incomeTotals[key] = (incomeTotals[key] || 0) + Number(t.amount);
      } else if (t.type === "EXPENSE") {
        categoryTotals[key] = (categoryTotals[key] || 0) + Number(t.amount);
      }
    });

    const wantsTransactions =
      /transactions?|tranaction|tranactions|txns?|statement|history/i.test(
        userText,
      );

    if (wantsTransactions && start && end) {
      const rangeLabel = label || formatRangeLabel(start, end);
      const showAll =
        /all|full|detailed|everything/i.test(userText) ||
        /last\s+\d+\s+days/i.test(userText);
      const sorted = transactions
        .slice(0, 200)
        .map((t) => ({ ...t, _d: new Date(t.date) }))
        .sort((a, b) => b._d - a._d);

      const limit = showAll ? sorted.length : 2;
      const toShow = sorted.slice(0, limit);

      if (toShow.length === 0) {
        const reply = "No transactions found.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      const lines = toShow.map((t) => {
        const desc = t.merchant || t.description || "-";
        return `${formatDateLocal(t._d)}: ${t.type} ${formatCurrency(
          t.amount,
        )}${desc ? ` (${desc})` : ""}`;
      });

      const reply = showAll
        ? [
            `Here are your transactions for ${rangeLabel} (${formatDateShort(
              start,
            )} to ${formatDateShort(end)}):`,
            ...lines.map((l) => `- ${l}`),
          ].join("\n")
        : lines.join("\n\n");

      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    if (wantsSavings && start && end) {
      const incomeTotal = Object.values(incomeTotals).reduce(
        (s, v) => s + v,
        0,
      );
      const expenseTotal = Object.values(categoryTotals).reduce(
        (s, v) => s + v,
        0,
      );
      const saved = incomeTotal - expenseTotal;
      const rangeLabel = label || formatRangeLabel(start, end);
      const reply = `In ${rangeLabel}, you saved ${formatCurrency(saved)}.`;
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    const wantsSavingsAdvanced = /\b(savings|save)\b/i.test(userText);
    if (wantsSavingsAdvanced) {
      const now = new Date();
      const since30 = new Date();
      since30.setDate(since30.getDate() - 30);
      const last30 = transactions.filter((t) => new Date(t.date) >= since30);
      const inc30 = last30
        .filter((t) => t.type === "INCOME")
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      const exp30 = last30
        .filter((t) => t.type === "EXPENSE")
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      const saved30 = inc30 - exp30;
      const rate30 = inc30 > 0 ? (saved30 / inc30) * 100 : 0;

      if (/savings rate/i.test(userText)) {
        const reply = `Your savings rate (last 30 days): ${rate30.toFixed(1)}%.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/percentage of income.*save/i.test(userText)) {
        const reply = `You saved ${rate30.toFixed(1)}% of income in the last 30 days.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (
        /compare savings.*this year.*last year|savings this year vs last year/i.test(
          userText,
        )
      ) {
        const thisYearStart = new Date(now.getFullYear(), 0, 1);
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(
          now.getFullYear() - 1,
          11,
          31,
          23,
          59,
          59,
          999,
        );

        const thisYearTx = transactions.filter(
          (t) => new Date(t.date) >= thisYearStart,
        );
        const lastYearTx = transactions.filter((t) => {
          const d = new Date(t.date);
          return d >= lastYearStart && d <= lastYearEnd;
        });
        const sumSaved = (arr) => {
          const inc = arr
            .filter((t) => t.type === "INCOME")
            .reduce((s, t) => s + Number(t.amount || 0), 0);
          const exp = arr
            .filter((t) => t.type === "EXPENSE")
            .reduce((s, t) => s + Number(t.amount || 0), 0);
          return inc - exp;
        };
        const thisSaved = sumSaved(thisYearTx);
        const lastSaved = sumSaved(lastYearTx);
        const reply = `Savings comparison: this year ${formatCurrency(thisSaved)} vs last year ${formatCurrency(lastSaved)}.`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/best savings month/i.test(userText)) {
        const map = {};
        transactions.forEach((t) => {
          const d = new Date(t.date);
          const key = monthKey(d);
          if (!map[key]) map[key] = { inc: 0, exp: 0 };
          if (t.type === "INCOME") map[key].inc += Number(t.amount || 0);
          if (t.type === "EXPENSE") map[key].exp += Number(t.amount || 0);
        });
        let best = null;
        Object.entries(map).forEach(([k, v]) => {
          const saved = v.inc - v.exp;
          if (!best || saved > best.saved) best = { k, saved };
        });
        const reply = best
          ? `Best savings month: ${best.k} with ${formatCurrency(best.saved)} saved.`
          : "Not enough data to calculate best savings month.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/save monthly to reach\s*20%|reach 20% savings/i.test(userText)) {
        const targetRate = 0.2;
        const target = inc30 * targetRate;
        const reply = `To reach a 20% savings rate, you should save about ${formatCurrency(
          target,
        )} per month (based on last 30 days income).`;
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }

      if (/am i saving enough|saving enough/i.test(userText)) {
        const reply =
          rate30 >= 20
            ? "Yes. Your savings rate is healthy (20%+)."
            : "You may want to increase savings. Aim for at least 20%.";
        await saveChat(user.id, userText, reply);
        return NextResponse.json({ reply });
      }
    }

    if (category && start && end) {
      let total = 0;
      if (category === "INCOME") {
        total = Object.values(incomeTotals).reduce((s, v) => s + v, 0);
      } else if (category === "EXPENSE") {
        total = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
      } else {
        total = categoryTotals[category] || 0;
      }

      const rangeLabel = label || formatRangeLabel(start, end);
      const reply = `In ${rangeLabel}, you spent ${formatCurrency(total)} on ${category}.`;
      await saveChat(user.id, userText, reply);
      return NextResponse.json({ reply });
    }

    let summaryText = "";
    const allTotals = { ...incomeTotals, ...categoryTotals };
    if (Object.keys(allTotals).length > 0) {
      if (start && end) {
        summaryText = `Summary for ${label || formatRangeLabel(start, end)}:\n`;
      } else {
        summaryText = "Summary for all available transactions:\n";
      }
      for (const [cat, amount] of Object.entries(allTotals)) {
        summaryText += `- ${cat}: ${formatCurrency(amount)}\n`;
      }
    }

    const recentSnippet = transactions
      .slice(0, 10)
      .map(
        (t) =>
          `${formatDateLocal(new Date(t.date))} | ${t.merchant || t.description || "-"} | ${t.type} ${formatCurrency(t.amount)}`,
      )
      .join("\n");

    const system = {
      role: "system",
      content:
        "You are FinGen Assistant. Use the provided transaction summaries and recent snippets when they are relevant. For general finance or goal-related questions, provide concise, actionable answers and concrete numeric calculations (use Rs. for currency). If the user asks about savings or goals, calculate totals, shortfalls, required monthly contributions, and offer clear options. If the user requests creating or updating a goal, ask a short confirmation before making changes. When there is not enough information to answer, ask one concise clarifying question. Keep replies short and use plain text (no markdown).",
    };

    const userMsg = {
      role: "user",
      content: `${userText}\n\nCONTEXT SUMMARY:\n${summaryText}\n\nRECENT_TRANSACTIONS_SNIPPET:\n${recentSnippet}`,
    };

    // Few-shot examples to help Gemini produce better budget and goal suggestions
    const exUser1 = {
      role: "user",
      content:
        "Analyze these transactions and provide a monthly budget plan for next 3 months:\nTransactions:\n2026-02-01: INCOME Rs.6000\n2026-02-02: EXPENSE Rs.2000 (rent)\n2026-02-10: EXPENSE Rs.800 (groceries)\n2026-02-15: EXPENSE Rs.300 (transport)",
    };
    const exAssistant1 = {
      role: "assistant",
      content:
        "Monthly income: Rs.6,000. Fixed: rent Rs.2,000. Essentials (groceries+transport) ~ Rs.1,100. Recommended budget: Rent Rs.2,000, Essentials Rs.1,200, Savings Rs.1,500, Discretionary Rs.300. Monitor groceries; reduce discretionary to increase savings.",
    };

    const exAssistant2 = {
      role: "assistant",
      content:
        "At Rs.5,000/month you'll save Rs.60,000 in 12 months; with Rs.2,000 current you'll have Rs.62,000 — shortfall Rs.38,000. To meet 1 year you need ~Rs.8,167/month. In 24 months at Rs.5,000/month you'll reach the target (you'll have Rs.122,000).",
    };

    const messages = [system, exUser1, exAssistant1, exAssistant2, userMsg];

    const replyText = await callGemini(messages, {
      model: process.env.GEMINI_MODEL,
    });

    await saveChat(user.id, userText, replyText);
    return NextResponse.json({ reply: replyText });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 400 },
    );
  }
}

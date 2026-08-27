import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function GET(req) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const [items, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
      db.notification.count({
        where: { userId: user.id, isRead: false },
      }),
    ]);

    const txIds = new Set();
    const accountIds = new Set();
    const goalIds = new Set();
    const budgetIds = new Set();

    for (const item of items) {
      const metadata =
        item?.metadata &&
        typeof item.metadata === "object" &&
        !Array.isArray(item.metadata)
          ? item.metadata
          : null;
      if (!metadata) continue;

      if (metadata.sourceTransactionId)
        txIds.add(String(metadata.sourceTransactionId));
      if (metadata.transactionId) txIds.add(String(metadata.transactionId));
      if (metadata.accountId) accountIds.add(String(metadata.accountId));
      if (metadata.goalId) goalIds.add(String(metadata.goalId));
      if (metadata.budgetId) budgetIds.add(String(metadata.budgetId));
    }

    const [transactions, accounts, goals, budgets] = await Promise.all([
      txIds.size
        ? db.transaction.findMany({
            where: { userId: user.id, id: { in: Array.from(txIds) } },
            select: {
              id: true,
              type: true,
              amount: true,
              category: true,
              description: true,
              date: true,
              accountId: true,
            },
          })
        : Promise.resolve([]),
      accountIds.size
        ? db.account.findMany({
            where: { userId: user.id, id: { in: Array.from(accountIds) } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      goalIds.size
        ? db.goal.findMany({
            where: { userId: user.id, id: { in: Array.from(goalIds) } },
            select: {
              id: true,
              title: true,
              targetAmount: true,
              endDate: true,
              achievability: true,
            },
          })
        : Promise.resolve([]),
      budgetIds.size
        ? db.budget.findMany({
            where: { userId: user.id, id: { in: Array.from(budgetIds) } },
            select: { id: true, amount: true },
          })
        : Promise.resolve([]),
    ]);

    const txMap = new Map(transactions.map((t) => [t.id, t]));
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const goalMap = new Map(goals.map((g) => [g.id, g]));
    const budgetMap = new Map(budgets.map((b) => [b.id, b]));

    const enrichedItems = items.map((item) => {
      const baseMetadata =
        item?.metadata &&
        typeof item.metadata === "object" &&
        !Array.isArray(item.metadata)
          ? { ...item.metadata }
          : {};

      const txId =
        baseMetadata.sourceTransactionId || baseMetadata.transactionId || null;
      const tx = txId ? txMap.get(String(txId)) : null;
      const account = baseMetadata.accountId
        ? accountMap.get(String(baseMetadata.accountId))
        : null;
      const goal = baseMetadata.goalId
        ? goalMap.get(String(baseMetadata.goalId))
        : null;
      const budget = baseMetadata.budgetId
        ? budgetMap.get(String(baseMetadata.budgetId))
        : null;

      if (tx) {
        baseMetadata.amount =
          baseMetadata.amount ??
          (typeof tx.amount?.toNumber === "function"
            ? tx.amount.toNumber()
            : Number(tx.amount || 0));
        baseMetadata.category = baseMetadata.category || tx.category || "";
        baseMetadata.transactionType = baseMetadata.transactionType || tx.type;
        baseMetadata.transactionDate =
          baseMetadata.transactionDate ||
          (tx.date ? new Date(tx.date).toISOString() : null);
        baseMetadata.accountId = baseMetadata.accountId || tx.accountId;
        baseMetadata.transactionDescription =
          baseMetadata.transactionDescription || tx.description || "";
      }

      const accountResolved =
        account ||
        (baseMetadata.accountId
          ? accountMap.get(String(baseMetadata.accountId))
          : null);
      if (accountResolved && !baseMetadata.accountName) {
        baseMetadata.accountName = accountResolved.name;
      }

      if (goal) {
        baseMetadata.goalTitle = baseMetadata.goalTitle || goal.title;
        baseMetadata.targetAmount =
          baseMetadata.targetAmount ?? Number(goal.targetAmount || 0);
        baseMetadata.endDate =
          baseMetadata.endDate ||
          (goal.endDate ? new Date(goal.endDate).toISOString() : null);
        baseMetadata.achievability =
          baseMetadata.achievability ??
          (goal.achievability != null ? Number(goal.achievability) : null);
      }

      if (budget && baseMetadata.budgetAmount == null) {
        baseMetadata.budgetAmount =
          typeof budget.amount?.toNumber === "function"
            ? budget.amount.toNumber()
            : Number(budget.amount || 0);
      }

      return { ...item, metadata: baseMetadata };
    });

    return Response.json({
      success: true,
      data: { items: enrichedItems, unreadCount },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    await db.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    const message = String(body?.message || "").trim();
    const type = String(body?.type || "info").trim() || "info";
    const metadata =
      body?.metadata &&
      typeof body.metadata === "object" &&
      !Array.isArray(body.metadata)
        ? body.metadata
        : null;

    if (!title || !message) {
      return Response.json(
        { error: "title and message are required" },
        { status: 400 },
      );
    }

    const created = await db.notification.create({
      data: {
        userId: user.id,
        title,
        message,
        type,
        metadata: metadata || undefined,
      },
    });

    return Response.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

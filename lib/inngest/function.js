import Email from "@/emails/template";
import { db } from "../prisma";
import { inngest } from "./client";
import { sendEmail } from "@/actions/send-emails";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function createInAppNotification({
  userId,
  title,
  message,
  type = "info",
  metadata = null,
}) {
  try {
    if (!userId || !title || !message) return;
    await db.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        metadata: metadata || undefined,
      },
    });
  } catch (error) {
    console.error("Failed to create in-app notification:", error);
  }
}

export const checkBudgetAlerts = inngest.createFunction(
  {
    id: "check-budget-alerts",
    name: "Check Budget Alerts",
    triggers: {
      cron: "0 */6 * * *",
    },
  },
  async ({ step }) => {
    const budgets = await step.run("fetch-budgets", async () => {
      return await db.budget.findMany({
        include: {
          user: {
            include: {
              accounts: {
                where: {
                  isDefault: true,
                },
              },
            },
          },
        },
      });
    });

    for (const budget of budgets) {
      const defaultAccount = budget.user.accounts[0];
      if (!defaultAccount) continue; // Skip if no default account

      await step.run(`check-budget-${budget.id}`, async () => {
        const startDate = new Date();
        startDate.setDate(1); // Start of current month

        // Calculate total expenses for the default account only
        const expenses = await db.transaction.aggregate({
          where: {
            userId: budget.userId,
            accountId: defaultAccount.id, // Only consider default account
            type: "EXPENSE",
            date: {
              gte: startDate,
            },
          },
          _sum: {
            amount: true,
          },
        });

        const totalExpenses = expenses._sum.amount?.toNumber() || 0;
        const budgetAmount =
          typeof budget.amount?.toNumber === "function"
            ? budget.amount.toNumber()
            : Number(budget.amount) || 0;

        // Skip budgets with zero amount to avoid division by zero
        if (!budgetAmount || budgetAmount <= 0) return;

        const percentageUsed = (totalExpenses / budgetAmount) * 100;

        // Check if we should send an alert
        if (
          percentageUsed >= 80 && // Default threshold of 80%
          (!budget.lastAlertSent ||
            isNewMonth(new Date(budget.lastAlertSent), new Date()))
        ) {
          //send email
          await sendEmail({
            to: budget.user.email,
            subject: `Budget Alert for ${defaultAccount.name}`,
            react: Email({
              userName: budget.user.name,
              type: "budget-alert",
              data: {
                percentageUsed: Number(percentageUsed),
                budgetAmount: Number(budgetAmount).toFixed(1),
                totalExpenses: Number(totalExpenses).toFixed(1),
                accountName: defaultAccount.name,
              },
            }),
          });

          // Update last alert sent
          await db.budget.update({
            where: { id: budget.id },
            data: { lastAlertSent: new Date() },
          });

          await createInAppNotification({
            userId: budget.userId,
            title: "Budget Alert",
            message: `${Number(percentageUsed).toFixed(1)}% of budget used on ${defaultAccount.name}.`,
            type: "warning",
            metadata: {
              budgetId: budget.id,
              accountId: defaultAccount.id,
              percentageUsed: Number(percentageUsed),
            },
          });
        }
      });
    }
  },
);
function isNewMonth(lastAlertDate, currentDate) {
  return (
    lastAlertDate.getMonth() !== currentDate.getMonth() ||
    lastAlertDate.getFullYear() !== currentDate.getFullYear()
  );
}

// Check goals for completion and monthly shortfalls
export const checkGoalProgress = inngest.createFunction(
  {
    id: "check-goal-progress",
    name: "Check Goal Progress",
    triggers: {
      cron: "0 10 * * *",
    },
  }, // Daily at 10:00
  async ({ step }) => {
    const goals = await step.run("fetch-goals", async () => {
      return await db.goal.findMany({
        include: { user: true, contributions: true },
      });
    });

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const isMonthEnd = (() => {
      const lastDay = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      return now.getDate() === lastDay;
    })();

    for (const g of goals) {
      await step.run(`goal-${g.id}`, async () => {
        const contributions = g.contributions || [];
        const total = contributions.reduce(
          (s, c) => s + Number(c.amount || 0),
          0,
        );

        // 1) Completion alert: if goal reached and a contribution in the last day pushed it over
        if (total >= (g.targetAmount || 0)) {
          const newly = contributions.some(
            (c) => new Date(c.createdAt) >= yesterday,
          );
          if (newly) {
            await sendEmail({
              to: g.user.email,
              subject: `Goal Completed: ${g.title}`,
              react: Email({
                userName: g.user.name || "",
                type: "goal-completed",
                data: {
                  goalTitle: g.title,
                  total: Number(total).toFixed(2),
                  target: Number(g.targetAmount).toFixed(2),
                },
              }),
            });
            await createInAppNotification({
              userId: g.userId,
              title: "Goal Completed",
              message: `Congratulations! You completed goal "${g.title}" with Rs.${Number(total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
              type: "success",
              metadata: {
                goalId: g.id,
                goalTitle: g.title,
                completedAmount: Number(total),
                targetAmount: Number(g.targetAmount || 0),
              },
            });
          }
          return; // nothing else for completed goals
        }

        // 2) Monthly shortfall alert: only check on month end to avoid noise
        if (isMonthEnd) {
          const end = new Date(g.endDate || now);
          const monthsLeft = Math.max(
            1,
            Math.ceil((end - now) / (1000 * 60 * 60 * 24 * 30)),
          );
          const remaining = Math.max(0, (g.targetAmount || 0) - total);
          const requiredMonthly = remaining / monthsLeft;

          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const contributionsThisMonth = contributions.reduce((s, c) => {
            const d = new Date(c.date || c.createdAt);
            return d >= startOfMonth && d <= now
              ? s + Number(c.amount || 0)
              : s;
          }, 0);

          if (contributionsThisMonth < requiredMonthly) {
            await sendEmail({
              to: g.user.email,
              subject: `Goal Monthly Check: ${g.title}`,
              react: Email({
                userName: g.user.name || "",
                type: "goal-warning",
                data: {
                  goalTitle: g.title,
                  contributedThisMonth: Number(contributionsThisMonth).toFixed(
                    2,
                  ),
                  requiredMonthly: Number(requiredMonthly).toFixed(2),
                  remaining: Number(remaining).toFixed(2),
                },
              }),
            });
            await createInAppNotification({
              userId: g.userId,
              title: "Goal Progress Alert",
              message: `Contribution this month is below required for "${g.title}".`,
              type: "warning",
              metadata: {
                goalId: g.id,
                contributionsThisMonth: Number(contributionsThisMonth),
                requiredMonthly: Number(requiredMonthly),
              },
            });
          }
        }
      });
    }

    return { checked: goals.length };
  },
);

// Trigger recurring transactions
export const triggerRecurringTransactions = inngest.createFunction(
  {
    id: "trigger-recurring-transactions",
    name: "Trigger Recurring Transactions",
    triggers: {
      cron: "0 0 * * *",
    },
  }, // Daily at midnight
  async ({ step }) => {
    //1. Fetch recurring transactions
    const recurringTransactions = await step.run(
      "fetch-recurring-transactions",
      async () => {
        return await db.transaction.findMany({
          where: {
            isRecurring: true,
            status: "COMPLETED",
            OR: [
              { lastProcessed: null }, // If no lastProcessed date, transaction is due
              {
                nextRecurringDate: {
                  lte: new Date(), // Compare with nextDue date
                },
              },
            ],
          },
        });
      },
    );

    //2. Create event for each transaction
    if (recurringTransactions.length > 0) {
      const events = recurringTransactions.map((transaction) => ({
        name: "transaction.recurring.process",
        data: {
          transactionId: transaction.id,
          userId: transaction.userId,
        },
      }));

      // 3.  Send events directly using inngest.send()
      await inngest.send(events);

      const uniqueUserIds = [
        ...new Set(recurringTransactions.map((t) => t.userId)),
      ];
      await Promise.all(
        uniqueUserIds.map((userId) =>
          createInAppNotification({
            userId,
            title: "Recurring Transactions Scheduled",
            message: "Recurring transactions are being processed.",
            type: "info",
          }),
        ),
      );
    }

    return { triggered: recurringTransactions.length };
  },
);

export const processRecurringTransaction = inngest.createFunction(
  {
    id: "process-recurring-transaction",
    name: "Process Recurring Transaction",
    throttle: {
      limit: 100, // Process 100 transactions
      period: "1m", // per minute
      key: "event.data.userId", // Throttle per user
    },
    triggers: {
      event: "transaction.recurring.process",
    },
  },
  async ({ event, step }) => {
    // Validate event data
    if (!event?.data?.transactionId || !event?.data?.userId) {
      console.error("Invalid event data:", event);
      return { error: "Missing required event data" };
    }
    await step.run("process-transaction", async () => {
      const transaction = await db.transaction.findUnique({
        where: {
          id: event.data.transactionId,
          userId: event.data.userId,
        },
        include: {
          account: true,
        },
      });

      if (!transaction || !isTransactionDue(transaction)) return;

      // Create new transaction and update account balance in a transaction
      await db.$transaction(async (tx) => {
        // Create new transaction
        await tx.transaction.create({
          data: {
            type: transaction.type,
            amount: transaction.amount,
            description: `${transaction.description} (Recurring)`,
            date: new Date(),
            category: transaction.category,
            userId: transaction.userId,
            accountId: transaction.accountId,
            isRecurring: false,
          },
        });

        // Update account balance
        const balanceChange =
          transaction.type === "EXPENSE"
            ? -transaction.amount.toNumber()
            : transaction.amount.toNumber();

        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: balanceChange } },
        });

        // Update last processed date and next recurring date
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            lastProcessed: new Date(),
            nextRecurringDate: calculateNextRecurringDate(
              new Date(),
              transaction.recurringInterval,
            ),
          },
        });
      });

      await createInAppNotification({
        userId: transaction.userId,
        title: "Recurring Transaction Added",
        message: `${transaction.description || transaction.category} was added automatically.`,
        type: "info",
        metadata: {
          sourceTransactionId: transaction.id,
          accountId: transaction.accountId,
          accountName: transaction.account?.name || "",
          amount:
            typeof transaction.amount?.toNumber === "function"
              ? transaction.amount.toNumber()
              : Number(transaction.amount || 0),
          category: transaction.category,
          recurringInterval: transaction.recurringInterval,
          processedAt: new Date().toISOString(),
        },
      });
    });
  },
);

// Utility functions
function isTransactionDue(transaction) {
  // If no lastProcessed date, transaction is due
  if (!transaction.lastProcessed) return true;

  const today = new Date();
  const nextDue = new Date(transaction.nextRecurringDate);

  // Compare with nextDue date
  return nextDue <= today;
}

function calculateNextRecurringDate(date, interval) {
  const next = new Date(date);
  switch (interval) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

export const generateMonthlyReports = inngest.createFunction(
  {
    id: "generate-monthly-reports",
    name: "Generate Monthly Reports",
    triggers: {
      cron: "0 0 1 * *",
    },
  },
  async ({ step }) => {
    const users = await step.run("fetch-users", async () => {
      return await db.user.findMany({
        include: { accounts: true },
      });
    });

    for (const user of users) {
      await step.run(`generate-report-${user.id}`, async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const stats = await getMonthlyStats(user.id, lastMonth);
        const monthName = lastMonth.toLocaleString("default", {
          month: "long",
        });

        // Generate AI insights
        const insights = await generateFinancialInsights(stats, monthName);

        await sendEmail({
          to: user.email,
          subject: `Your Monthly Financial Report - ${monthName}`,
          react: Email({
            userName: user.name,
            type: "monthly-report",
            data: {
              stats,
              month: monthName,
              insights,
            },
          }),
        });

        await createInAppNotification({
          userId: user.id,
          title: "Monthly Report Ready",
          message: `Your ${monthName} financial report has been generated.`,
          type: "success",
          metadata: { month: monthName },
        });
      });
    }

    return { processed: users.length };
  },
);

async function getMonthlyStats(userId, month) {
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  return transactions.reduce(
    (stats, t) => {
      const amount = t.amount.toNumber();
      if (t.type === "EXPENSE") {
        stats.totalExpenses += amount;
        stats.byCategory[t.category] =
          (stats.byCategory[t.category] || 0) + amount;
      } else {
        stats.totalIncome += amount;
      }
      return stats;
    },
    {
      totalExpenses: 0,
      totalIncome: 0,
      byCategory: {},
      transactionCount: transactions.length,
    },
  );
}
async function generateFinancialInsights(stats, month) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  const prompt = `
    Analyze this financial data and provide 3 concise, actionable insights.
    Focus on spending patterns and practical advice.
    Keep it friendly and conversational.
Financial Data for ${month}:
- Total Income: Rs.${stats.totalIncome.toFixed(2)}
- Total Expenses: Rs.${stats.totalExpenses.toFixed(2)}
- Net Income: Rs.${(stats.totalIncome - stats.totalExpenses).toFixed(2)}
- Expense Categories: ${Object.entries(stats.byCategory)
    .map(([category, amount]) => `${category}: Rs.${Number(amount).toFixed(2)}`)
    .join(", ")}


    Format the response as a JSON array of strings, like this:
    ["insight 1", "insight 2", "insight 3"]
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error generating insights:", error);
    return [
      "Your highest expense category this month might need attention.",
      "Consider setting up a budget for better financial management.",
      "Track your recurring expenses to identify potential savings.",
      "Review your spending habits to identify areas for improvement.",
    ];
  }
}

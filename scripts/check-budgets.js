#!/usr/bin/env node
import "dotenv/config";
import { db } from "../lib/prisma.js";

async function run() {
  const budgets = await db.budget.findMany({
    include: {
      user: {
        include: {
          accounts: {
            where: { isDefault: true },
          },
        },
      },
    },
  });

  for (const budget of budgets) {
    const defaultAccount = budget.user.accounts[0];
    if (!defaultAccount) continue;

    const startDate = new Date();
    startDate.setDate(1);

    const expenses = await db.transaction.aggregate({
      where: {
        userId: budget.userId,
        accountId: defaultAccount.id,
        type: "EXPENSE",
        date: { gte: startDate },
      },
      _sum: { amount: true },
    });

    const totalExpenses = expenses._sum.amount?.toNumber() || 0;
    const budgetAmount =
      typeof budget.amount?.toNumber === "function"
        ? budget.amount.toNumber()
        : Number(budget.amount) || 0;

    if (!budgetAmount || budgetAmount <= 0) {
      console.log(
        `Skipping budget ${budget.id} for ${budget.user.email} (zero amount)`,
      );
      continue;
    }

    const percentageUsed = (totalExpenses / budgetAmount) * 100;

    if (percentageUsed >= 80) {
      console.log(
        `ALERT -> ${budget.user.email}: ${percentageUsed.toFixed(1)}% used of Rs.${budgetAmount.toFixed(1)} (spent Rs.${totalExpenses.toFixed(1)}) on account ${defaultAccount.name}`,
      );
    } else {
      console.log(
        `OK -> ${budget.user.email}: ${percentageUsed.toFixed(1)}% used of Rs.${budgetAmount.toFixed(1)} (spent Rs.${totalExpenses.toFixed(1)})`,
      );
    }
  }
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

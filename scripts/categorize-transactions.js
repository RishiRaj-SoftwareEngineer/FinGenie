#!/usr/bin/env node
/**
 * Simple batch job to categorize uncategorized transactions.
 * Run with: node scripts/categorize-transactions.js
 */
import { db } from "../lib/prisma";
import { categorizeTransactions } from "../lib/ai/categorize";

async function run() {
  console.log("Starting categorize-transactions job...");
  try {
    const txs = await db.transaction.findMany({
      where: { categoryId: null },
      take: 200,
    });
    if (!txs.length) {
      console.log("No uncategorized transactions found.");
      process.exit(0);
    }

    const input = txs.map((t) => ({ id: t.id, merchant: t.merchant, description: t.description, amount: t.amount }));
    const results = categorizeTransactions(input);

    const updates = results
      .filter((r) => r.category && r.transactionId)
      .map((r) => db.transaction.update({ where: { id: r.transactionId }, data: { categoryId: r.category } }));

    await Promise.all(updates);
    console.log(`Updated ${updates.length} transactions.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();

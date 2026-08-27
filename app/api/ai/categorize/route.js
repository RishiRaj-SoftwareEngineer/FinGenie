import { NextResponse } from "next/server";
import { categorizeTransactions } from "../../../../lib/ai/categorize";
import { db } from "../../../../lib/prisma";

export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, transactions } = body || {};

    if (!Array.isArray(transactions)) {
      return NextResponse.json({ status: "error", message: "transactions must be an array" }, { status: 400 });
    }

    const result = categorizeTransactions(transactions);

    // If userId provided and Prisma available, update transactions in DB (best-effort)
    if (userId && db && result.length) {
      const updates = [];
      for (const r of result) {
        if (!r.transactionId || !r.category) continue;
        updates.push(
          db.transaction.updateMany({
            where: { id: r.transactionId, userId },
            data: { categoryId: r.category },
          })
        );
      }
      try {
        await Promise.all(updates);
      } catch (e) {
        // continue silently; don't fail the API because of DB update issues
        console.warn("Failed to update transactions:", e?.message || e);
      }
    }

    return NextResponse.json({ status: "ok", data: result });
  } catch (err) {
    console.error("/api/ai/categorize error", err);
    return NextResponse.json({ status: "error", message: err.message || String(err) }, { status: 500 });
  }
}

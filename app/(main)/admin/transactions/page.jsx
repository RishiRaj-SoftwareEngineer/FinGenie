import React from "react";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/isAdmin";
import { db } from "@/lib/prisma";
import TransactionForm from "@/components/admin/transaction-form";
import TransactionActions from "@/components/admin/transaction-actions";

export default async function TransactionsPage() {
  const is_admin = await isAdmin();
  if (!is_admin) return redirect("/");

  const txs = await db.transaction.findMany({
    include: { user: { select: { id: true, email: true } }, account: true },
    orderBy: { date: "desc" },
    take: 200,
  });
  const serialTxs = txs.map((t) => ({
    id: t.id,
    date: t.date ? new Date(t.date).toISOString() : null,
    userEmail: t.user?.email ?? null,
    accountName: t.account?.name ?? null,
    type: t.type,
    amount:
      typeof t.amount?.toNumber === "function"
        ? t.amount.toNumber()
        : Number(t.amount || 0),
    category: t.category,
    status: t.status,
    description: t.description ?? "",
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Transactions</h1>

      <TransactionForm />

      <div className="overflow-auto bg-card border-border">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">User</th>
              <th className="p-2 text-left">Account</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Amount</th>
              <th className="p-2 text-left">Category</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {serialTxs.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-2">
                  {t.date ? new Date(t.date).toLocaleString() : "-"}
                </td>
                <td className="p-2">{t.userEmail ?? "-"}</td>
                <td className="p-2">{t.accountName ?? "-"}</td>
                <td className="p-2">{t.type}</td>
                <td className="p-2">Rs.{Number(t.amount)}</td>
                <td className="p-2">{t.category}</td>
                <td className="p-2">{t.status}</td>
                <td className="p-2">
                  <TransactionActions transaction={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

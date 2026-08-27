import React from "react";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/isAdmin";
import { db } from "@/lib/prisma";
import BudgetActions from "@/components/admin/budget-actions";
import BudgetCreateForm from "@/components/admin/budget-create-form";

export default async function BudgetsPage() {
  const is_admin = await isAdmin();
  if (!is_admin) return redirect("/");

  const budgets = await db.budget.findMany({
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Budgets</h1>
      <div className="mb-4">
        <BudgetCreateForm />
      </div>

      <div className="overflow-auto bg-card border-border">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="p-2 text-left">User</th>
              <th className="p-2 text-left">Amount</th>
              <th className="p-2 text-left">Last Alert</th>
              <th className="p-2 text-left">Created</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((b) => {
              const plain = {
                id: b.id,
                amount: Number(b.amount),
                lastAlertSent: b.lastAlertSent
                  ? b.lastAlertSent.toISOString()
                  : null,
                userId: b.userId,
                createdAt: b.createdAt.toISOString(),
                updatedAt: b.updatedAt.toISOString(),
                user: b.user
                  ? { id: b.user.id, email: b.user.email, name: b.user.name }
                  : null,
              };

              return (
                <tr key={b.id} className="border-t">
                  <td className="p-2">{b.user?.email ?? b.userId}</td>
                  <td className="p-2">Rs.{plain.amount}</td>
                  <td className="p-2">
                    {plain.lastAlertSent
                      ? new Date(plain.lastAlertSent).toLocaleString()
                      : "-"}
                  </td>
                  <td className="p-2">
                    {new Date(plain.createdAt).toLocaleString()}
                  </td>
                  <td className="p-2">
                    <BudgetActions budget={plain} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React from "react";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/isAdmin";
import { db } from "@/lib/prisma";

export default async function GoalsPage() {
  const is_admin = await isAdmin();
  if (!is_admin) return redirect("/");

  const goals = await db.goal.findMany({
    include: {
      user: { select: { id: true, email: true } },
      contributions: {
        select: { amount: true, date: true, createdAt: true },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Goals</h1>
      <div className="overflow-auto bg-card border-border">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="p-2 text-left">User</th>
              <th className="p-2 text-left">Title</th>
              <th className="p-2 text-left">Target</th>
              <th className="p-2 text-left">Timeline</th>
              <th className="p-2 text-left">Completed Date</th>
              <th className="p-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {goals.map((g) => {
              const target = Number(g.targetAmount || 0);
              let runningTotal = 0;
              let completedDate = null;

              for (const c of g.contributions || []) {
                runningTotal += Number(c.amount || 0);
                if (runningTotal >= target) {
                  completedDate = c.date || c.createdAt || null;
                  break;
                }
              }

              return (
                <tr key={g.id} className="border-t">
                  <td className="p-2">{g.user?.email ?? g.userId}</td>
                  <td className="p-2">{g.title}</td>
                  <td className="p-2">Rs.{g.targetAmount}</td>
                  <td className="p-2">{g.timelineMonths ?? "-"}</td>
                  <td className="p-2">
                    {completedDate ? new Date(completedDate).toLocaleString() : "-"}
                  </td>
                  <td className="p-2">
                    {new Date(g.createdAt).toLocaleString()}
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

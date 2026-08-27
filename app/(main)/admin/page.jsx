import React from "react";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/isAdmin";
import { db } from "@/lib/prisma";
import { getAdminMetrics } from "@/lib/admin-stats";
import MetricsCards from "@/components/admin/metrics-cards";
import TransactionsChartClient from "@/components/admin/transactions-chart-client";
import TopCategoriesWidget from "@/components/admin/top-categories-widget";
import TopTransactionsWidget from "@/components/admin/top-transactions-widget";

export default async function AdminPage() {
  const is_admin = await isAdmin();
  if (!is_admin) return redirect("/");

  // simple metrics
  const stats = await getAdminMetrics({ months: 6 });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      {/* Promote button removed */}
      <MetricsCards stats={stats} />
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <TransactionsChartClient defaultMonths={6} />
        </div>
        <div className="col-span-1 space-y-4">
          <TopCategoriesWidget months={6} />
          <TopTransactionsWidget months={6} limit={8} />
        </div>
      </div>
    </div>
  );
}

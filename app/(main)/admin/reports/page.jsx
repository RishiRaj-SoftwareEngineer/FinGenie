import React from "react";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/isAdmin";
import ReportsExporter from "@/components/admin/reports-exporter-client";

export default async function ReportsPage() {
  const is_admin = await isAdmin();
  if (!is_admin) return redirect("/");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Reports & Exports</h1>
      <div className="mb-4 text-sm text-gray-600">
        Export transactions or monthly stats as CSV for external analysis.
      </div>
      <ReportsExporter />
    </div>
  );
}

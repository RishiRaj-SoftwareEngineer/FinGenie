"use client";
import { defaultCategories } from "@/data/categories";
import React, { useEffect, useState } from "react";

export default function TopTransactionsWidget({
  months = 6,
  accountId = "",
  category = "",
  limit = 10,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("months", String(months));
      qs.set("limit", String(limit));
      if (accountId) qs.set("accountId", accountId);
      if (category) qs.set("category", category);
      const res = await fetch(
        `/api/admin/stats/top-transactions?${qs.toString()}`,
      );
      const json = await res.json();
      if (res.ok) setItems(json.topTransactions || []);
      else alert(json.error || "Failed to load top transactions");
    } catch (err) {
      alert("Failed to load: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [months, accountId, category, limit]);

  return (
    <div className="p-1 bg-card border-border rounded">
      <h3 className="font-semibold mb-2">Largest Transactions</h3>
      {loading && <div>Loading...</div>}
      {!loading && (
        <div className="overflow-x-auto max-h-64">
          <table className="min-w-full text-left table-fixed">
            <thead>
              <tr>
                <th className="p-2">Amount</th>
                <th className="p-2">Category</th>
                <th className="p-2">Date</th>
                <th className="p-1">Description</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-1 whitespace-nowrap">
                    Rs.{Number(t.amount).toFixed(2)}
                  </td>
                  <td className="p-1 whitespace-nowrap">
                    {(() => {
                      const found = defaultCategories.find(
                        (c) => c.id === t.category,
                      );
                      return found
                        ? found.name || found.title || t.category
                        : t.category;
                    })()}
                  </td>
                  <td className="p-1 whitespace-nowrap">
                    {new Date(t.date).toLocaleDateString()}
                  </td>
                  <td className="p-1 max-w-xs">
                    <div className="truncate">{t.description}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

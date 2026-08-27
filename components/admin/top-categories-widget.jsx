"use client";
import React, { useEffect, useState } from "react";
import { categoryColors, defaultCategories } from "@/data/categories";

export default function TopCategoriesWidget({ months = 6, accountId = "" }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("months", String(months));
      if (accountId) qs.set("accountId", accountId);
      const res = await fetch(
        `/api/admin/stats/top-categories?${qs.toString()}`,
      );
      const json = await res.json();
      if (res.ok) setItems(json.topCategories || []);
      else alert(json.error || "Failed to load top categories");
    } catch (err) {
      alert("Failed to load: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [months, accountId]);

  return (
    <div className="p-4 bg-card border-border rounded">
      <h3 className="font-semibold mb-2">Top Expense Categories</h3>
      {loading && <div>Loading...</div>}
      {!loading && (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.category} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  style={{
                    width: 12,
                    height: 12,
                    background: categoryColors[it.category] || "#ddd",
                    borderRadius: 4,
                  }}
                />
                <div>
                  {(() => {
                    const found = defaultCategories.find(
                      (c) => c.id === it.category,
                    );
                    return found
                      ? found.name || found.title || it.category
                      : it.category;
                  })()}
                </div>
              </div>
              <div className="font-medium">
                Rs.{Number(it.total).toFixed(2)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

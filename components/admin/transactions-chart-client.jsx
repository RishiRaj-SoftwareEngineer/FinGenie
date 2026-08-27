"use client";
import React, { useEffect, useState } from "react";
import { defaultCategories } from "@/data/categories";
import SearchableSelect from "../ui/searchable-select";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  BarController,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  BarController,
  Title,
  Tooltip,
  Legend,
);

export default function TransactionsChartClient({ defaultMonths = 6 }) {
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(false);
  const [start, setStart] = useState(() => {
    try {
      const d = new Date();
      d.setMonth(d.getMonth() - defaultMonths);
      return d.toISOString().slice(0, 10);
    } catch (e) {
      return "";
    }
  });
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [accounts, setAccounts] = useState([]);

  async function fetchAccounts() {
    try {
      const res = await fetch("/api/admin/accounts");
      const json = await res.json();
      if (res.ok) setAccounts(json.accounts || []);
    } catch (err) {
      console.error("Failed to load accounts", err);
    }
  }

  async function fetchData(params = {}) {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (params.start) qs.set("start", params.start);
      if (params.end) qs.set("end", params.end);
      if (params.months) qs.set("months", String(params.months));
      if (params.accountId) qs.set("accountId", params.accountId);
      if (params.category) qs.set("category", params.category);
      const res = await fetch(`/api/admin/stats/transactions?${qs.toString()}`);
      const json = await res.json();
      if (res.ok) setMonthly(json.monthly || []);
      else alert(json.error || "Failed to load stats");
    } catch (err) {
      alert("Failed to fetch stats: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAccounts();
    fetchData({ months: defaultMonths });
  }, [defaultMonths]);

  const labels = monthly.map((m) => m.month);
  const data = {
    labels,
    datasets: [
      {
        type: "bar",
        label: "Income",
        data: monthly.map((m) => m.income || 0),
        backgroundColor: "#10b981",
      },
      {
        type: "bar",
        label: "Expense",
        data: monthly.map((m) => m.expense || 0),
        backgroundColor: "#ef4444",
      },
      {
        type: "line",
        label: "Net",
        data: monthly.map((m) => m.total || 0),
        borderColor: "#2563eb",
        backgroundColor: "rgba(37,99,235,0.2)",
        tension: 0.3,
        yAxisID: "y",
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: { legend: { position: "top" }, title: { display: false } },
    interaction: { mode: "index", intersect: false },
    scales: {
      x: { stacked: false },
      y: { beginAtZero: true },
    },
  };

  return (
    <div>
      <div className="flex gap-2 mb-3 items-end">
        <div>
          <label className="text-sm text-muted-foreground block">Start</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="border p-1 rounded"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground block">End</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="border p-1 rounded"
          />
        </div>
        <div style={{ minWidth: 180 }}>
          <label className="text-sm text-muted-foreground block">Account</label>
          <SearchableSelect
            options={[
              { value: "", label: "All accounts" },
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
            value={accountId}
            onChange={setAccountId}
            placeholder="Search accounts"
          />
        </div>
        <div style={{ minWidth: 180 }}>
          <label className="text-sm text-muted-foreground block">
            Category
          </label>
          <SearchableSelect
            options={[
              { value: "", label: "All categories" },
              ...defaultCategories.map((c) => ({
                value: c.id,
                label: c.name || c.title || c.id,
              })),
            ]}
            value={category}
            onChange={setCategory}
            placeholder="Search categories"
          />
        </div>
        <div>
          <button
            onClick={() =>
              fetchData(
                start && end
                  ? { start, end, accountId, category }
                  : { months: defaultMonths, accountId, category },
              )
            }
            disabled={loading}
            className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-60"
          >
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>
      </div>

      <div className="p-4 bg-card border-border rounded">
        <Line options={options} data={data} />
      </div>
    </div>
  );
}

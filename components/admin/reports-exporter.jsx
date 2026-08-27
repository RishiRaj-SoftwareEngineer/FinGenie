"use client";
import React, { useState } from "react";

function toCSV(rows) {
  if (!rows || rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") {
      try {
        return '"' + JSON.stringify(v).replace(/"/g, '\"') + '"';
      } catch (e) {
        return '"' + String(v).replace(/"/g, '\"') + '"';
      }
    }
    const s = String(v);
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [keys.join(",")];
  for (const r of rows) {
    lines.push(keys.map((k) => escape(r[k])).join(","));
  }
  return lines.join("\n");
}

export default function ReportsExporter() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [userId, setUserId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function exportCSV() {
    setMessage(null);
    setLoading(true);
    try {
      // Prefer transactions endpoint; fall back to stats if not available
      const q = new URLSearchParams();
      if (start) q.set("start", start);
      if (end) q.set("end", end);
      if (userId) q.set("userId", userId);
      if (accountId) q.set("accountId", accountId);

      let res = await fetch(`/api/admin/transactions?${q.toString()}`);
      if (!res.ok) {
        // fallback to stats
        res = await fetch(`/api/admin/stats/transactions?${q.toString()}`);
      }

      if (!res.ok) throw new Error("No data");
      const data = await res.json();

      // if stats endpoint returned monthly buckets, normalize
      const rows = Array.isArray(data) ? data.map((r) => ({ ...r })) : [data];

      const csv = toCSV(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fingen_report_${start || "start"}_${end || "end"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage("Download started");
    } catch (err) {
      console.error(err);
      setMessage("Failed to export: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <label className="text-sm">Start</label>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="border p-2"
        />
        <label className="text-sm">End</label>
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="border p-2"
        />
        <label className="text-sm">User ID</label>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="optional user id"
          className="border p-2"
        />
        <label className="text-sm">Account ID</label>
        <input
          type="text"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="optional account id"
          className="border p-2"
        />
        <button
          onClick={exportCSV}
          disabled={loading}
          className="px-3 py-2 bg-blue-600 text-white rounded"
        >
          {loading ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      {message && <div className="text-sm text-slate-700">{message}</div>}
      <div className="text-xs text-gray-500">
        This will attempt to fetch transactions first, falling back to stats.
      </div>
    </div>
  );
}

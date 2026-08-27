"use client";
import React, { useState } from "react";

export default function AccountsListClient({ initialAccounts = [] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [loadingId, setLoadingId] = useState(null);

  async function handleDelete(id) {
    if (!confirm("Delete this account? This cannot be undone.")) return;
    try {
      setLoadingId(id);
      const res = await fetch(`/api/admin/accounts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setAccounts((s) => s.filter((a) => a.id !== id));
    } catch (err) {
      console.error(err);
      alert("Unable to delete account");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      <div className="overflow-auto bg-card border-border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-card/5">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-right">Balance</th>
              <th className="p-2 text-left">Currency</th>
              <th className="p-2 text-left">Owner</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-2">{a.name || "(no name)"}</td>
                <td className="p-2">{a.type ?? "—"}</td>
                <td className="p-2 text-right">{a.balance ?? 0}</td>
                <td className="p-2">{a.currency ?? "NPR"}</td>
                <td className="p-2">{a.userEmail ?? a.userId}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={loadingId === a.id}
                      className="px-2 py-1 bg-red-600 text-white rounded disabled:opacity-50"
                    >
                      {loadingId === a.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td className="p-4 text-center" colSpan={6}>
                  No accounts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

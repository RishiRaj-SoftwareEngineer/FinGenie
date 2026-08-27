"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function BudgetActions({ budget }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [amount, setAmount] = React.useState(String(budget.amount ?? ""));

  const patchBudget = async () => {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/budgets/${budget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to update budget");
      setEditing(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to update budget");
    } finally {
      setLoading(false);
    }
  };

  const deleteBudget = async () => {
    if (!confirm("Delete this budget?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/budgets/${budget.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to delete budget");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to delete budget");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      {editing ? (
        <>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-28 border rounded px-2 py-1"
            disabled={loading}
          />
          <button
            className="px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-60"
            onClick={patchBudget}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save"}
          </button>
          <button
            className="px-2 py-1 bg-gray-500 text-white rounded"
            onClick={() => {
              setAmount(String(budget.amount ?? ""));
              setEditing(false);
            }}
            disabled={loading}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            className="px-2 py-1 bg-yellow-600 text-white rounded disabled:opacity-60"
            onClick={() => setEditing(true)}
            disabled={loading}
          >
            Edit
          </button>
          <button
            className="px-2 py-1 bg-red-600 text-white rounded disabled:opacity-60"
            onClick={deleteBudget}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </>
      )}
    </div>
  );
}

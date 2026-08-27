"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function TransactionActions({ transaction }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const edit = async () => {
    const newAmount = prompt("Amount", String(transaction.amount));
    if (newAmount == null) return;
    const newDesc = prompt("Description", transaction.description || "");
    setLoading(true);
    try {
      await fetch(`/api/admin/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(newAmount),
          description: newDesc,
        }),
      });
      alert("Updated");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this transaction?")) return;
    setLoading(true);
    try {
      await fetch(`/api/admin/transactions/${transaction.id}`, {
        method: "DELETE",
      });
      alert("Deleted");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        className="px-2 py-1 bg-yellow-600 text-white rounded"
        onClick={edit}
        disabled={loading}
      >
        Edit
      </button>
      <button
        className="px-2 py-1 bg-red-600 text-white rounded"
        onClick={remove}
        disabled={loading}
      >
        Delete
      </button>
    </div>
  );
}

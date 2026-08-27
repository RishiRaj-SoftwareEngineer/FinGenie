"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function BudgetCreateForm() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [usersLoading, setUsersLoading] = React.useState(true);
  const [users, setUsers] = React.useState([]);
  const [form, setForm] = React.useState({
    userId: "",
    amount: "",
  });

  React.useEffect(() => {
    let mounted = true;

    async function loadUsers() {
      try {
        setUsersLoading(true);
        const res = await fetch("/api/admin/users", { cache: "no-store" });
        const json = await res.json().catch(() => []);
        if (!res.ok) throw new Error("Failed to load users");
        if (!mounted) return;

        const list = Array.isArray(json) ? json : [];
        setUsers(list);

        if (!form.userId && list.length > 0) {
          const firstNonAdmin = list.find((u) => u.role !== "ADMIN");
          setForm((prev) => ({
            ...prev,
            userId: firstNonAdmin?.id || list[0].id,
          }));
        }
      } catch (err) {
        console.error(err);
        if (mounted) setUsers([]);
      } finally {
        if (mounted) setUsersLoading(false);
      }
    }

    loadUsers();
    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    const userId = form.userId;
    const amount = form.amount;
    if (!userId || !amount) return alert("userId and amount required");
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return alert("Enter a valid amount greater than 0");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount: parsedAmount }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to create budget");

      setForm((prev) => ({ ...prev, amount: "" }));
      router.refresh();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to create budget");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="flex gap-2 flex-wrap">
        <select
          name="userId"
          className="border p-2 min-w-96"
          value={form.userId}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, userId: e.target.value }))
          }
          disabled={usersLoading || loading}
          required
        >
          <option value="">
            {usersLoading ? "Loading users..." : "Select user"}
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {(u.name || "Unnamed User").trim()} - {u.email}
              {u.clerkUserId ? ` (${u.clerkUserId})` : ""}
              {u.role === "ADMIN" ? " [ADMIN]" : ""}
            </option>
          ))}
        </select>
        <input
          name="amount"
          placeholder="Amount"
          type="number"
          step="0.01"
          className="border p-2"
          value={form.amount}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, amount: e.target.value }))
          }
        />
        <button
          type="submit"
          className="px-3 py-2 bg-green-600 text-white rounded"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
}

"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function AccountCreateForm() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [users, setUsers] = React.useState([]);
  const [usersLoading, setUsersLoading] = React.useState(true);
  const [form, setForm] = React.useState({
    userId: "",
    name: "",
    bankAccountNumber: "",
    type: "CURRENT",
    balance: "",
    isDefault: false,
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

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.userId) return alert("Please select a user");
    if (!form.name.trim()) return alert("Account name is required");
    if (!/^\d{16}$/.test(form.bankAccountNumber)) {
      return alert("Bank account number must be exactly 16 digits");
    }
    const balance = Number(form.balance || 0);
    if (!Number.isFinite(balance)) return alert("Initial balance is invalid");

    setLoading(true);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: form.userId,
          name: form.name.trim(),
          bankAccountNumber: form.bankAccountNumber,
          type: form.type,
          balance,
          isDefault: form.isDefault,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to create account");

      router.push("/admin/accounts");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <h2 className="text-2xl font-semibold text-center">Create New Account</h2>

      <div>
        <label className="block text-sm font-medium mb-2">User</label>
        <select
          className="w-full rounded-lg border p-3"
          value={form.userId}
          onChange={(e) => onChange("userId", e.target.value)}
          disabled={usersLoading || loading}
          required
        >
          <option value="">
            {usersLoading ? "Loading users..." : "Select a user"}
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {(u.name || "Unnamed User").trim()} - {u.email}
              {u.clerkUserId ? ` (${u.clerkUserId})` : ""}
              {u.role === "ADMIN" ? " [ADMIN]" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Account Name</label>
        <input
          className="w-full rounded-lg border p-3"
          placeholder="e.g., Main Checking"
          value={form.name}
          onChange={(e) => onChange("name", e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Bank Account Number
        </label>
        <input
          className="w-full rounded-lg border p-3"
          placeholder="Enter 16-digit account number"
          value={form.bankAccountNumber}
          onChange={(e) =>
            onChange("bankAccountNumber", e.target.value.replace(/\D/g, "").slice(0, 16))
          }
          inputMode="numeric"
          maxLength={16}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Account Type</label>
        <select
          className="rounded-lg border p-3 min-w-32"
          value={form.type}
          onChange={(e) => onChange("type", e.target.value)}
        >
          <option value="CURRENT">Current</option>
          <option value="SAVINGS">Savings</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Initial Balance</label>
        <input
          className="w-full rounded-lg border p-3"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={form.balance}
          onChange={(e) => onChange("balance", e.target.value)}
          required
        />
      </div>

      <div className="rounded-lg border p-4 flex items-center justify-between">
        <div>
          <div className="font-medium">Set as Default</div>
          <div className="text-sm text-gray-500">
            This account will be selected by default for transactions
          </div>
        </div>
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={(e) => onChange("isDefault", e.target.checked)}
          className="h-5 w-5"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => router.push("/admin/accounts")}
          className="rounded-lg border p-3"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-black text-white p-3 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Account"}
        </button>
      </div>
    </form>
  );
}

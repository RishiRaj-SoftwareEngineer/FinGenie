"use client";

import React, { useEffect, useState } from "react";
import SearchableSelect from "../ui/searchable-select";
import { defaultCategories } from "@/data/categories";

export default function TransactionForm({
  defaultUserId = "",
  defaultAccountId = "",
}) {
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId || "");
  const [accountOptions, setAccountOptions] = useState([
    { value: "", label: "Select account" },
  ]);

  useEffect(() => {
    let mounted = true;
    async function fetchAccounts() {
      try {
        const res = await fetch("/api/admin/accounts");
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted) return;
        const opts = [
          { value: "", label: "Select account" },
          ...(json.accounts || []).map((a) => ({ value: a.id, label: a.name })),
        ];
        setAccountOptions(opts);
        if (defaultAccountId) setAccountId(defaultAccountId);
      } catch (e) {
        console.error("Failed to load accounts", e);
      }
    }
    fetchAccounts();
    return () => {
      mounted = false;
    };
  }, [defaultAccountId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      type: f.get("type"),
      amount: Number(f.get("amount")),
      description: f.get("description"),
      date: f.get("date"),
      category: f.get("category") || category,
      userId: f.get("userId") || defaultUserId,
      accountId: f.get("accountId") || accountId,
    };

    setLoading(true);
    try {
      const res = await fetch("/api/admin/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      alert("Transaction created");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Failed to create transaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 items-end">
        <select
          name="type"
          defaultValue="EXPENSE"
          className="border p-2 w-full"
        >
          <option value="INCOME">INCOME</option>
          <option value="EXPENSE">EXPENSE</option>
        </select>
        <input
          name="amount"
          type="number"
          step="0.01"
          placeholder="Amount"
          className="border p-2 w-full"
          required
        />
        <input
          name="description"
          placeholder="Description"
          className="border p-2 w-full"
        />
        <input name="date" type="date" className="border p-2 w-full" required />
        <div className="w-full">
          <SearchableSelect
            options={[
              { value: "", label: "Select category" },
              ...defaultCategories.map((c) => ({
                value: c.id,
                label: c.title,
              })),
            ]}
            value={category}
            onChange={(v) => setCategory(v)}
            placeholder="Search categories"
          />
          <input type="hidden" name="category" value={category} />
        </div>
        <input
          name="userId"
          placeholder="User ID"
          defaultValue={defaultUserId}
          className="border p-2 w-full"
        />
        <div className="w-full">
          <SearchableSelect
            options={accountOptions}
            value={accountId}
            onChange={(v) => setAccountId(v)}
            placeholder="Search accounts"
          />
          <input type="hidden" name="accountId" value={accountId} />
        </div>
        <button
          className="px-3 py-2 bg-green-600 text-white rounded w-full xl:w-auto"
          disabled={loading}
        >
          Create
        </button>
      </div>
    </form>
  );
}

"use client";
import React, { useEffect, useMemo, useState } from "react";

export default function GoalDetailClient({ goalId }) {
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterWindow, setFilterWindow] = useState("all");
  const [formAmount, setFormAmount] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("Bank");
  const [showForm, setShowForm] = useState(false);

  /* ---------------- Utilities ---------------- */
  const formatCurrency = (n) =>
    Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

  /* ---------------- Load ---------------- */
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/goals/${goalId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load goal");
        const data = await res.json();
        setGoal(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [goalId]);

  /* ---------------- Derived ---------------- */
  const contributions = useMemo(() => goal?.contributions || [], [goal]);

  const totalContributed = useMemo(
    () => contributions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0),
    [contributions],
  );

  const thisMonthContributed = useMemo(() => {
    const now = new Date();
    return contributions
      .filter((c) => {
        const d = new Date(c.date);
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
  }, [contributions]);

  const remaining = Math.max(0, (goal?.targetAmount || 0) - totalContributed);

  const progressPct = goal?.targetAmount
    ? clamp((totalContributed / goal.targetAmount) * 100, 0, 100)
    : 0;

  /* ---------------- Submit ---------------- */
  async function submitContribution(e) {
    e.preventDefault();
    const amount = Number(formAmount);
    if (!amount || amount <= 0) {
      alert("Enter valid amount");
      return;
    }
    const payload = {
      amount,
      method: formPaymentMethod,
      date: new Date().toISOString(),
      goalId: goal.id,
    };

    const tempId = `temp-${Date.now()}`;
    // optimistic update
    setGoal((g) => ({
      ...g,
      contributions: [
        { id: tempId, amount, date: payload.date, method: formPaymentMethod },
        ...(g.contributions || []),
      ],
    }));

    setFormAmount("");
    setShowForm(false);

    try {
      const res = await fetch(`/api/goals/${goal.id}/contributions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("Save failed:", res.status, txt);
        throw new Error(txt || "Save failed");
      }
      const saved = await res.json();
      // replace temp entry with saved contribution
      setGoal((g) => ({
        ...g,
        contributions: [
          saved,
          ...(g.contributions || []).filter(
            (c) => !String(c.id).startsWith("temp-"),
          ),
        ],
      }));
    } catch (err) {
      console.error(err);
      // rollback optimistic
      setGoal((g) => ({
        ...g,
        contributions: (g.contributions || []).filter(
          (c) => !String(c.id).startsWith("temp-"),
        ),
      }));
      alert(err?.message || "Failed to save contribution");
    }
  }

  if (loading) return <div className="p-10 text-center">Loading...</div>;
  if (!goal) return <div className="p-10 text-center">No goal found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      {/* Centered Container */}
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{goal.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Track progress toward your financial goal
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full shadow-md hover:shadow-lg transition"
          >
            + Add Contribution
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid sm:grid-cols-3 gap-5">
          <StatCard
            label="Total Saved"
            value={formatCurrency(totalContributed)}
          />
          <StatCard
            label="This Month"
            value={formatCurrency(thisMonthContributed)}
          />
          <StatCard label="Remaining" value={formatCurrency(remaining)} />
        </div>

        {/* Goal Progress Card */}
        <div className="bg-white rounded-3xl shadow-lg p-8">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Target: Rs.{formatCurrency(goal.targetAmount)}</span>
            <span>Due: {new Date(goal.endDate).toLocaleDateString()}</span>
          </div>

          <div className="mt-6">
            <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-5 bg-gradient-to-r from-green-400 to-emerald-600 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-3 text-center text-lg font-semibold text-green-600">
              {progressPct.toFixed(1)}% Completed
            </div>
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-3xl shadow-lg p-8">
          <div className="flex justify-between mb-6">
            <h3 className="font-semibold text-gray-800">
              Contribution History
            </h3>
            <select
              value={filterWindow}
              onChange={(e) => setFilterWindow(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All</option>
              <option value="this_month">This Month</option>
            </select>
          </div>

          {contributions.length === 0 && (
            <p className="text-gray-500 text-sm">No contributions yet.</p>
          )}

          <div className="space-y-4">
            {contributions.map((c) => (
              <div
                key={c.id}
                className="flex justify-between items-center bg-gray-50 rounded-xl p-4"
              >
                <div>
                  <div className="font-medium text-gray-800">
                    Rs.{formatCurrency(c.amount)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(c.date).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-gray-500">{c.method}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          />

          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
            <h4 className="text-xl font-semibold mb-6">Add Contribution</h4>

            <form onSubmit={submitContribution} className="space-y-4">
              <input
                type="number"
                placeholder="Amount"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="w-full p-3 border rounded-xl"
              />

              <select
                value={formPaymentMethod}
                onChange={(e) => setFormPaymentMethod(e.target.value)}
                className="w-full p-3 border rounded-xl"
              >
                <option>Bank</option>
                <option>Card</option>
                <option>Cash</option>
              </select>

              <button
                type="submit"
                className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 transition"
              >
                Save Contribution
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Styled Stat Card ---------- */
function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold mt-2">Rs.{value}</div>
    </div>
  );
}

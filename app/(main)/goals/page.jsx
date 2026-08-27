"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterWindow, setFilterWindow] = useState("all");

  // Global modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [modalAmount, setModalAmount] = useState("");
  const [modalMethod, setModalMethod] = useState("Bank");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/goals", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load goals");
      const data = await res.json();
      setGoals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Filtered + searched goals
  const displayedGoals = useMemo(() => {
    const now = new Date();
    return (goals || []).filter((g) => {
      if (
        searchTerm &&
        !g.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;

      if (filterWindow === "due_30") {
        const end = new Date(g.endDate || now);
        const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        if (diffDays > 30) return false;
      }
      if (filterWindow === "overdue") {
        const end = new Date(g.endDate || now);
        if (end >= now) return false;
      }

      return true;
    });
  }, [goals, searchTerm, filterWindow]);

  /* -------------------- Modal submit handler -------------------- */
  async function submitModalContribution(e) {
    e.preventDefault();
    const goalIdToUse = selectedGoalId;
    const amount = Number(modalAmount);
    if (!goalIdToUse || !amount || amount <= 0)
      return alert("Enter a valid amount");

    const payload = {
      amount,
      method: modalMethod,
      date: new Date().toISOString(),
      goalId: goalIdToUse,
    };

    // optimistic update
    setGoals((gs) =>
      gs.map((g) =>
        g.id === goalIdToUse
          ? {
              ...g,
              contributions: [
                {
                  id: `temp-${Date.now()}`,
                  amount,
                  date: payload.date,
                  method: modalMethod,
                },
                ...(g.contributions || []),
              ],
            }
          : g,
      ),
    );

    setModalAmount("");
    setShowModal(false);

    try {
      const res = await fetch(`/api/goals/${goalIdToUse}/contributions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      const saved = await res.json();
      // replace temp with saved id
      setGoals((gs) =>
        gs.map((g) =>
          g.id === goalIdToUse
            ? {
                ...g,
                contributions: [
                  saved,
                  ...(g.contributions || []).filter(
                    (c) => !String(c.id).startsWith("temp-"),
                  ),
                ],
              }
            : g,
        ),
      );
    } catch (err) {
      console.error(err);
    }
  }

  // Derived aggregates for KPI cards
  const { monthlyTargetAcross, thisMonthAcross, totalAcross } =
    React.useMemo(() => {
      const now = new Date();
      let total = 0;
      let thisMonth = 0;
      let monthlyTargetSum = 0;

      for (const g of goals || []) {
        const contributions = g.contributions || [];
        const contributed = contributions.reduce(
          (s, c) => s + (Number(c.amount) || 0),
          0,
        );
        total += contributed;

        // this month
        thisMonth += contributions.reduce((s, c) => {
          const d = new Date(c.date);
          return d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
            ? s + (Number(c.amount) || 0)
            : s;
        }, 0);

        const remaining = Math.max(0, (g.targetAmount || 0) - contributed);
        const end = new Date(g.endDate || now);
        const monthsLeft = Math.max(
          1,
          Math.ceil((end - now) / (1000 * 60 * 60 * 24 * 30)),
        );
        monthlyTargetSum += remaining / monthsLeft;
      }

      return {
        monthlyTargetAcross: monthlyTargetSum,
        thisMonthAcross: thisMonth,
        totalAcross: total,
      };
    }, [goals]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Goals
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-300">
            Create and track your savings goals
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            placeholder="Search goals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border p-2 rounded-md bg-white text-gray-900 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-700"
          />

          <select
            value={filterWindow}
            onChange={(e) => setFilterWindow(e.target.value)}
            className="border p-2 rounded-md bg-white text-gray-900 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-700"
          >
            <option value="all">All</option>
            <option value="due_30">Due in 30 days</option>
            <option value="overdue">Overdue</option>
          </select>

          <div className="flex items-center gap-2">
            <Link
              href="/goals/create"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg"
            >
              Create Goal
            </Link>
            <Link
              href="/goals/recommendations"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
            >
              Recommendations
            </Link>
          </div>
        </div>
      </div>

      {/* Global Add Contribution Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Add Contribution
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select goal, enter amount and payment method.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 dark:text-gray-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitModalContribution} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Goal
                </label>
                <select
                  value={selectedGoalId || ""}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                >
                  <option value="">Choose a goal</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                  placeholder="e.g. 5000"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Payment Method
                </label>
                <select
                  value={modalMethod}
                  onChange={(e) => setModalMethod(e.target.value)}
                  className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                >
                  <option>Bank</option>
                  <option>Card</option>
                  <option>UPI</option>
                  <option>Cash</option>
                </select>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-md text-sm text-gray-700 dark:text-gray-200">
                <div>
                  Preview: Saved Rs.{" "}
                  {Number(
                    (() => {
                      const g = goals.find((x) => x.id === selectedGoalId);
                      const total = g
                        ? (g.contributions || []).reduce(
                            (s, c) => s + (Number(c.amount) || 0),
                            0,
                          )
                        : 0;
                      return total + (Number(modalAmount) || 0);
                    })(),
                  ).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg"
                >
                  Add Contribution
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-3 rounded-lg border dark:border-slate-700 text-gray-700 dark:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KPI summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="text-xs text-gray-500 dark:text-gray-300">
            Monthly Target
          </div>
          <div className="text-xl font-semibold mt-2 text-gray-900 dark:text-gray-100">
            Rs.
            {monthlyTargetAcross.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-400">
            Across all goals
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="text-xs text-gray-500 dark:text-gray-300">
            This Month Contributed
          </div>
          <div className="text-xl font-semibold mt-2 text-gray-900 dark:text-gray-100">
            Rs.
            {thisMonthAcross.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-400">
            This calendar month
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="text-xs text-gray-500 dark:text-gray-300">
            Total Contributed
          </div>
          <div className="text-xl font-semibold mt-2 text-gray-900 dark:text-gray-100">
            Rs.
            {totalAcross.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-400">
            Sum of all contributions
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-700 dark:text-gray-200">Loading...</div>
      ) : displayedGoals.length === 0 ? (
        <div className="text-gray-600 dark:text-gray-300">
          No goals match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedGoals.map((g) => {
            const contributions = g.contributions || [];
            const total = contributions.reduce(
              (s, c) => s + (Number(c.amount) || 0),
              0,
            );
            const progress = Math.min(
              100,
              (total / (g.targetAmount || 1)) * 100 || 0,
            ).toFixed(1);

            // per-goal monthly target
            const now = new Date();
            const end = new Date(g.endDate || now);
            const monthsLeft = Math.max(
              1,
              Math.ceil((end - now) / (1000 * 60 * 60 * 24 * 30)),
            );
            const monthlyTarget = Math.max(
              0,
              ((g.targetAmount || 0) - total) / monthsLeft,
            );

            return (
              <div
                key={g.id}
                className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {g.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Target: Rs.{g.targetAmount.toLocaleString()}
                      </p>
                      <div className="text-xs text-gray-400 dark:text-gray-400 mt-1">
                        Monthly target: Rs.
                        {monthlyTarget.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedGoalId(g.id);
                          setShowModal(true);
                        }}
                        className="px-3 py-1 bg-green-600 text-white rounded-md text-sm"
                      >
                        + Add
                      </button>
                      <Link
                        href={`/goals/${g.id}`}
                        className="text-xs text-gray-500 dark:text-gray-400"
                      >
                        Open
                      </Link>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-3 bg-green-400"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                      {progress}% • Saved Rs.{total.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

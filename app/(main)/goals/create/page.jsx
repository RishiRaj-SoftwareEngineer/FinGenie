"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateGoalPage() {
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 30 * 6)
      .toISOString()
      .slice(0, 10),
  );
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const parsedTarget = useMemo(
    () => parseFloat(String(targetAmount).replace(/,/g, "")) || 0,
    [targetAmount],
  );

  const monthsRemainingPreview = useMemo(() => {
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);

      if (e <= s) return 1;

      return Math.max(
        1,
        Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30)),
      );
    } catch {
      return 1;
    }
  }, [startDate, endDate]);

  const previewMonthly =
    monthsRemainingPreview > 0 ? parsedTarget / monthsRemainingPreview : 0;
  const achievabilityLabel = useMemo(() => {
    if (!insight) return "";
    if (insight.achievability >= 80) return "High";
    if (insight.achievability >= 50) return "Moderate";
    return "Low";
  }, [insight]);
  const shouldWarnBeforeSave =
    !!insight &&
    (achievabilityLabel === "Low" || achievabilityLabel === "Moderate");

  async function getInsight() {
    if (!title.trim() || parsedTarget <= 0) {
      alert("Please enter a valid title and target amount.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/goals/ai-insight-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          targetAmount: parsedTarget,
          startDate,
          endDate,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to generate AI insight");
      }

      const data = await res.json();
      setInsight({
        ...data,
        achievability: Number(data?.achievability || 0),
        monthlyTarget: Number(data?.monthlyTarget || 0),
        timelineMonths: Number(data?.timelineMonths || monthsRemainingPreview),
        summary:
          data?.summary ||
          "Insight generated based on your target amount and timeline.",
      });
    } catch (err) {
      console.error(err);
      alert("Failed to generate AI insight");
    } finally {
      setLoading(false);
    }
  }

  async function saveGoal() {
    try {
      if (shouldWarnBeforeSave) {
        const warningText =
          achievabilityLabel === "Low"
            ? `This goal looks difficult to achieve (${insight.achievability}% achievability). Do you still want to create this goal?`
            : `This goal has moderate achievability (${insight.achievability}%). Do you want to continue creating this goal?`;
        const confirmed = window.confirm(warningText);
        if (!confirmed) return;
      }

      setSaving(true);

      const payload = {
        title,
        targetAmount: parsedTarget,
        startDate,
        endDate,
        insight,
      };

      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Failed to save goal", err);
        alert("Failed to save goal");
        return;
      }

      // Redirect to goals list
      router.push("/goals");
    } catch (err) {
      console.error(err);
      alert("Failed to save goal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 px-6 lg:px-12">
      <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        <main className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
            <h1 className="text-3xl font-semibold mb-1 text-gray-900 dark:text-gray-100">
              Create Goal
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-300 mb-6">
              Define a savings goal and get AI recommendations.
            </p>

            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title
                </label>
                <input
                  className="w-full p-3 rounded-lg border shadow-sm focus:ring-2 focus:ring-indigo-200 bg-white dark:bg-slate-700 dark:text-gray-100 dark:border-slate-700"
                  placeholder="e.g. Vacation fund"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Target Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Amount (Rs.)
                </label>
                <input
                  className="w-full p-3 rounded-lg border shadow-sm focus:ring-2 focus:ring-indigo-200 bg-white dark:bg-slate-700 dark:text-gray-100 dark:border-slate-700"
                  type="number"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  className="w-full p-3 rounded-lg border shadow-sm bg-white dark:bg-slate-700 dark:text-gray-100 dark:border-slate-700"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <input
                  className="w-full p-3 rounded-lg border shadow-sm bg-white dark:bg-slate-700 dark:text-gray-100 dark:border-slate-700"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              {/* Preview + Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Preview:
                  <span className="font-medium ml-1">
                    Rs.
                    {previewMonthly.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>{" "}
                  / month •{" "}
                  <span className="font-medium">{monthsRemainingPreview}</span>{" "}
                  months
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    className="flex-1 sm:flex-none px-5 py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 disabled:opacity-60"
                    onClick={getInsight}
                    disabled={loading}
                  >
                    {loading ? "Generating..." : "Get AI Insight"}
                  </button>

                  <button
                    className="flex-1 sm:flex-none px-5 py-3 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 disabled:opacity-60"
                    onClick={saveGoal}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Goal"}
                  </button>
                </div>
              </div>
              {shouldWarnBeforeSave ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
                  Warning: This goal is currently{" "}
                  {achievabilityLabel.toLowerCase()} in achievability (
                  {insight.achievability}%). You will need to confirm before
                  saving.
                </div>
              ) : null}
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-28 space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                AI Insight
              </h4>

              {!insight ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                  Generate AI Insight to see achievability, monthly target and
                  recommendations.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Achievability
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {insight.achievability}%
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      Feasibility: {achievabilityLabel}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Monthly Target
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Rs.
                      {insight.monthlyTarget.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Timeline
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {insight.timelineMonths} months
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Summary
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-200 mt-1">
                      {insight.summary}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow">
              <h5 className="font-medium text-gray-900 dark:text-gray-100">
                Quick tips
              </h5>
              <ul className="mt-3 text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <li>- Choose realistic end dates to lower monthly burden.</li>
                <li>- Use AI Insight to get personalized recommendations.</li>
                <li>- Add contributions over time to improve achievability.</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

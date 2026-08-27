"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

function fmt(n) {
  return (Number(n) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Currency({ children }) {
  return <span>Rs.{fmt(children)}</span>;
}

function Progress({ value = 0 }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className="h-2 bg-gradient-to-r from-purple-300 to-green-300 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function RecommendationsDashboard() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState(null);
  const [appliedById, setAppliedById] = useState({});
  const [justAppliedById, setJustAppliedById] = useState({});
  const dashboardRef = useRef(null);
  const appliedStorageKey = "fingen_recommendations_applied_v1";

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      let y = 18;

      const ensureSpace = (height = 12) => {
        if (y + height <= pageHeight - margin) return;
        pdf.addPage();
        y = margin;
      };
      const heading = (text) => {
        ensureSpace(14);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(30, 41, 59);
        pdf.text(text, margin, y);
        y += 9;
      };
      const line = (label, value) => {
        ensureSpace(8);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(71, 85, 105);
        pdf.text(label, margin, y);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(15, 23, 42);
        pdf.text(String(value), margin + 58, y);
        y += 7;
      };
      const paragraph = (text) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(51, 65, 85);
        const lines = pdf.splitTextToSize(String(text), contentWidth - 6);
        ensureSpace(lines.length * 5 + 4);
        pdf.text(lines, margin + 3, y);
        y += lines.length * 5 + 4;
      };

      pdf.setFillColor(79, 70, 229);
      pdf.rect(0, 0, pageWidth, 34, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.text("Fingenie Recommendation Dashboard", margin, 17);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(`Generated ${new Date().toLocaleString()}`, margin, 25);
      y = 44;

      heading("Financial summary");
      line("Monthly income", `Rs. ${fmt(profile.monthlyIncome)}`);
      line("Monthly expenses", `Rs. ${fmt(profile.monthlyExpenses)}`);
      line("Monthly available", `Rs. ${fmt(monthlyAvailable)}`);
      line("Total saved", `Rs. ${fmt(currentSavedTotal)}`);
      line("Savings rate", `${Math.round(savingsRate)}%`);
      line("Emergency progress", `${Math.round(emergencyProgress)}%`);

      y += 3;
      heading("Recommended monthly allocation");
      allocations.forEach((allocation) => {
        line(
          `${allocation.label} (${Math.round(allocation.weight * 100)}%)`,
          `Rs. ${fmt(allocation.amount)}`,
        );
      });

      y += 3;
      heading("Savings accounts");
      accounts.forEach((account) => {
        ensureSpace(18);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(15, 23, 42);
        pdf.text(account.name, margin, y);
        y += 6;
        paragraph(
          `Balance: Rs. ${fmt(account.current)} | Target: Rs. ${fmt(account.target)} | APY: ${account.apy || 0}%`,
        );
      });

      y += 3;
      heading("Recommendations");
      if (visibleRecommendations.length === 0) {
        paragraph("No urgent recommendations. You are on track.");
      } else {
        visibleRecommendations.forEach((recommendation, index) => {
          ensureSpace(22);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.setTextColor(79, 70, 229);
          pdf.text(`${index + 1}. ${recommendation.title}`, margin, y);
          y += 6;
          paragraph(recommendation.description);
          paragraph(
            `Impact: Rs. ${fmt(recommendation.impact)} | Effort: ${recommendation.effort} | Timeframe: ${recommendation.timeframe} | Priority: ${recommendation.priority}`,
          );
        });
      }

      pdf.save(
        `fingen-recommendations-${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  };
  useEffect(() => {
    let mounted = true;
    async function fetchAll() {
      try {
        const [profileRes, goalsRes, marketRes, accountsRes] =
          await Promise.all([
            fetch("/api/me"),
            fetch("/api/goals"),
            fetch("/api/market"),
            fetch("/api/accounts"),
          ]);

        const profileJson = profileRes.ok ? await profileRes.json() : null;
        const goalsJson = goalsRes.ok ? await goalsRes.json() : null;
        const marketJson = marketRes.ok ? await marketRes.json() : null;
        const accountsJson =
          accountsRes && accountsRes.ok ? await accountsRes.json() : null;

        // debug: log raw accounts response for shape inspection
        try {
          console.debug("/api/accounts response:", accountsJson);
        } catch (e) {
          /* ignore */
        }

        if (!mounted) return;

        setData((d) => ({
          ...d,
          profile: profileJson || { monthlyIncome: 0, monthlyExpenses: 0 },
          goals: goalsJson || [],
          market: marketJson || null,
          accounts: accountsJson || null,
        }));
      } catch (e) {
        if (!mounted) return;
        setData((d) => ({
          ...d,
          profile: { monthlyIncome: 90000, monthlyExpenses: 45000 },
          goals: [],
          market: null,
        }));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchAll();
    return () => (mounted = false);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(appliedStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") setAppliedById(parsed);
    } catch {
      // ignore localStorage errors
    }
  }, []);

  // prefer accounts from server when available; fallback to local samples
  const serverAccounts = Array.isArray(data.accounts) ? data.accounts : null;
  const fallbackAccounts = [
    {
      id: 1,
      name: "Emergency Savings",
      apy: 3.2,
      current: 60000,
      target: 270000,
    },
    {
      id: 2,
      name: "Short-term Goals",
      apy: 4.1,
      current: 30000,
      target: 50000,
    },
    { id: 3, name: "Investments", apy: 6.5, current: 30000, target: 100000 },
  ];

  // Normalize server accounts shape to match fallback shape so UI fields
  // like `current` and `target` render correctly regardless of API naming.
  const accounts = serverAccounts
    ? serverAccounts.map((a) => ({
        id: a.id ?? a.accountId,
        name: a.name ?? a.title ?? a.accountName ?? "Account",
        apy: a.apy ?? a.interestRate ?? a.rate ?? 0,
        current: Number(a.current ?? a.balance ?? a.amount ?? 0),
        target: Number(a.target ?? a.targetAmount ?? a.goalTarget ?? 0),
      }))
    : fallbackAccounts;

  const currentSavedTotal = useMemo(() => {
    return (
      Math.round(
        accounts.reduce((s, a) => s + (Number(a.current) || 0), 0) * 100,
      ) / 100
    );
  }, [accounts]);

  const profile = data.profile || { monthlyIncome: 0, monthlyExpenses: 0 };

  const monthlyAvailable = Math.max(
    0,
    (profile.monthlyIncome || 0) - (profile.monthlyExpenses || 0),
  );
  const monthlySavings = useMemo(
    () => Math.max(0, monthlyAvailable),
    [monthlyAvailable],
  );
  const savingsRate = profile.monthlyIncome
    ? (monthlySavings / profile.monthlyIncome) * 100
    : 0;
  // Emergency target = 6 months of expenses
  const emergencyTarget = 6 * profile.monthlyExpenses;

  // Find the emergency account
  const emergencyAccount = accounts.find((acc) =>
    String(acc.name || "")
      .toLowerCase()
      .includes("emergency"),
  );

  // Get its current balance safely
  const emergencyBalance = Number(emergencyAccount?.current ?? 0);

  // Compute progress (clamp to 100%)
  const emergencyProgress =
    emergencyTarget > 0
      ? Math.min(100, (emergencyBalance / emergencyTarget) * 100)
      : 0;

  // recommended allocation split (weights) and computed amounts
  const allocationWeights = [
    { id: "emergency", label: "Emergency", weight: 0.4 },
    { id: "goals", label: "Savings Goals", weight: 0.3 },
    { id: "invest", label: "Investments", weight: 0.2 },
    { id: "short", label: "Short-term", weight: 0.1 },
  ];

  const allocations = allocationWeights.map((a) => ({
    ...a,
    amount: Math.round(monthlyAvailable * a.weight * 100) / 100,
  }));
  // adjust rounding remainder into first bucket
  const sumAlloc = allocations.reduce((s, x) => s + x.amount, 0);
  if (sumAlloc !== Math.round(monthlyAvailable * 100) / 100) {
    const diff = Math.round(monthlyAvailable * 100) / 100 - sumAlloc;
    allocations[0].amount += diff;
  }

  // dynamic recommendations based on gaps, goals and market
  const recommendations = [];

  // goal-oriented recommendations
  const goals = data.goals && Array.isArray(data.goals) ? data.goals : [];
  const now = Date.now();
  for (const g of goals) {
    // Normalize fields — adapt to whatever the API returns
    const target = Number(g.targetAmount || g.target || 0);
    const saved = Number(g.currentSaved || g.saved || 0);
    const end = g.endDate ? new Date(g.endDate).getTime() : now;
    const monthsLeft = Math.max(
      1,
      Math.ceil((end - now) / (1000 * 60 * 60 * 24 * 30)),
    );
    const remaining = Math.max(0, target - saved);
    const requiredMonthly = Math.round((remaining / monthsLeft) * 100) / 100;

    if (remaining > 0) {
      const goalRec = {
        id: `goal-${g.id || g.title || g.name || "unknown"}`,
        actionType: "goal_focus",
        goalId: g.id || null,
        title: `Goal: ${g.title || g.name || "Untitled"}`,
        description: `To meet '${g.title || g.name}', you need ~Rs.${fmt(requiredMonthly)}/month for ${monthsLeft} months.`,
        impact: requiredMonthly,
        effort:
          requiredMonthly > allocations.find((a) => a.id === "goals").amount
            ? "High"
            : "Low",
        timeframe: `${monthsLeft} months`,
        priority:
          requiredMonthly > allocations.find((a) => a.id === "goals").amount
            ? "High"
            : "Medium",
      };
      recommendations.push(goalRec);
    }
  }

  // emergency and savings rate recommendations (kept from earlier logic)
  const emergencyCurrent = Number(
    emergencyAccount?.current ?? accounts[0]?.current ?? 0,
  );
  if (emergencyCurrent < emergencyTarget) {
    recommendations.push({
      id: "emergency-fund-topup",
      actionType: "emergency_topup",
      title: "Increase Emergency Contributions",
      description: `You're ${Math.round(((emergencyTarget - emergencyCurrent) / (emergencyTarget || 1)) * 100)}% short of a 6-month emergency fund.`,
      impact: Math.round((emergencyTarget - emergencyCurrent) / 6),
      effort: "Medium",
      timeframe: "6 months",
      priority: "High",
    });
  }

  if (savingsRate < 20) {
    recommendations.push({
      id: "savings-rate-improve",
      actionType: "savings_rate",
      title: "Improve Savings Rate",
      description: `Your current savings rate is ${Math.round(savingsRate)}%. Aim for at least 20% by trimming discretionary spend.`,
      impact: Math.round(monthlyAvailable * 0.1),
      effort: "Low",
      timeframe: "3 months",
      priority: "Medium",
    });
  }

  const investmentAccount = accounts.find((a) =>
    String(a.name || "")
      .toLowerCase()
      .includes("invest"),
  );
  const investmentCurrent = Number(investmentAccount?.current ?? 0);
  const investmentTarget = Number(investmentAccount?.target ?? 0);
  if (investmentAccount && investmentCurrent < investmentTarget) {
    recommendations.push({
      id: "investment-topup",
      actionType: "investment_topup",
      title: "Top-up Investment Account",
      description: `Consider allocating part of monthly savings to investments to meet long-term targets.`,
      impact: Math.round(allocations.find((a) => a.id === "invest").amount),
      effort: "Low",
      timeframe: "12 months",
      priority: "Low",
    });
  }

  // market-based recommendation
  const market = data.market || null;
  if (market && market.macro && market.macro.savingsYields) {
    // pick the best short-term yield for liquid allocation
    const yields = market.macro.savingsYields;
    const best = Object.entries(yields).sort((a, b) => b[1] - a[1])[0];
    if (best) {
      recommendations.unshift({
        id: "market-insight",
        actionType: "market_insight",
        title: "Market Insight",
        description: `Market: ${market.insight || "See latest yields."} Best short-term yield: ${best[0]} @ ${best[1]}%`,
        impact: Math.round(
          allocations.find((a) => a.id === "short")?.amount || 0,
        ),
        effort: "Low",
        timeframe: "Immediate",
        priority: "Medium",
      });
    }
  }
  const visibleRecommendations = recommendations.filter((r) => {
    const recId = r.id || `${r.title}-${r.timeframe}`;
    return !appliedById[recId];
  });

  async function handleApplyRecommendation(r) {
    const recId = r.id || `${r.title}-${r.timeframe}`;
    if (appliedById[recId] || applyingId === recId) return;

    setApplyingId(recId);
    try {
      if (r.actionType === "goal_focus" && r.goalId) {
        const insightRes = await fetch(`/api/goals/${r.goalId}/ai-insight`, {
          method: "POST",
        });
        if (!insightRes.ok) {
          const err = await insightRes.json().catch(() => ({}));
          throw new Error(err?.error || "Failed to apply goal recommendation");
        }
      }

      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Recommendation Applied",
          message: `Applied: ${r.title}`,
          type: "success",
          metadata: {
            recommendationId: recId,
            recommendationTitle: r.title,
            impact: Number(r.impact || 0),
            effort: r.effort || "",
            timeframe: r.timeframe || "",
            priority: r.priority || "",
            actionType: r.actionType || "generic",
            goalId: r.goalId || null,
            appliedAt: new Date().toISOString(),
          },
        }),
      }).catch(() => null);

      setJustAppliedById((prev) => ({ ...prev, [recId]: true }));
      setTimeout(() => {
        setAppliedById((prev) => {
          const next = { ...prev, [recId]: true };
          try {
            localStorage.setItem(appliedStorageKey, JSON.stringify(next));
          } catch {
            // ignore localStorage errors
          }
          return next;
        });
        setJustAppliedById((prev) => {
          const next = { ...prev };
          delete next[recId];
          return next;
        });
      }, 1500);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to apply recommendation.");
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <div className="min-h-screen p-6 lg:p-12 bg-gradient-to-b from-white via-purple-50 to-green-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
      <div ref={dashboardRef} className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Recommendation Dashboard
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Personalized savings plan and recommended allocations
            </p>
          </div>
          <div className="flex gap-4 items-center">
            <button
              onClick={exportPDF}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700"
            >
              Export PDF
            </button>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-4 w-48">
              <div className="text-xs text-gray-500 dark:text-gray-300">
                Monthly Income
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                <Currency>{profile.monthlyIncome}</Currency>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-4 w-48">
              <div className="text-xs text-gray-500 dark:text-gray-300">
                Available For Goals
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                <Currency>{monthlyAvailable}</Currency>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-5">
            <div className="text-xs text-gray-500 dark:text-gray-300">
              Savings Rate
            </div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-semibold">
                {Math.round(savingsRate)}%
              </div>
              <div className="text-sm text-gray-500">of income</div>
            </div>
            <div className="mt-3">
              <Progress value={savingsRate} />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-5">
            <div className="text-xs text-gray-500 dark:text-gray-300">
              Emergency Fund Progress
            </div>
            <div className="text-2xl font-semibold mt-1 text-gray-900 dark:text-gray-100">
              {Math.round(emergencyProgress)}%
            </div>
            <div className="mt-3">
              <Progress value={emergencyProgress} />
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-400 mt-2">
              Target: <Currency>{emergencyTarget}</Currency>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-5">
            <div className="text-xs text-gray-500 dark:text-gray-300">
              Total Saved
            </div>
            <div className="text-2xl font-semibold mt-1 text-gray-900 dark:text-gray-100">
              <Currency>{currentSavedTotal}</Currency>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-400 mt-2">
              Across accounts
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-5">
            <div className="text-xs text-gray-500 dark:text-gray-300">
              Monthly Available
            </div>
            <div className="text-2xl font-semibold mt-1 text-gray-900 dark:text-gray-100">
              <Currency>{monthlyAvailable}</Currency>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-400 mt-2">
              Recommended allocations below
            </div>
          </div>
        </div>

        {/* Allocation cards */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-6 mb-6">
          <h4 className="font-medium mb-4">Recommended Monthly Allocation</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {allocations.map((a) => (
              <div
                key={a.id}
                className="p-4 rounded-lg border border-gray-100 dark:border-slate-700 shadow-sm bg-gradient-to-br from-white to-purple-50 dark:from-slate-800 dark:to-slate-800"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-semibold">{a.label}</div>
                    <div className="text-xs text-gray-500">
                      {Math.round(a.weight * 100)}% of available
                    </div>
                  </div>
                  <div className="text-lg font-semibold">
                    <Currency>{a.amount}</Currency>
                  </div>
                </div>
                <div className="mt-3">
                  <Progress
                    value={(a.amount / (monthlyAvailable || 1)) * 100}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-3">
            Values sum to{" "}
            <strong>
              <Currency>{monthlyAvailable}</Currency>
            </strong>
          </div>
        </div>

        {/* Savings Accounts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-6">
            <h4 className="font-medium mb-3">Savings Accounts</h4>
            <div className="space-y-4">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-4 rounded-lg border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <div className="text-sm font-semibold">{acc.name}</div>
                      <div className="text-xs text-gray-500">
                        APY {acc.apy ? `${acc.apy}%` : "Not set"}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      <Currency>{acc.current}</Currency>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    Target:{" "}
                    {acc.target ? (
                      <Currency>{acc.target}</Currency>
                    ) : (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </div>
                  <Progress value={(acc.current / acc.target) * 100} />
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations stacked */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-6">
            <h4 className="font-medium mb-3">Recommendations</h4>
            <div className="space-y-4">
              {visibleRecommendations.map((r, idx) => {
                const recId = r.id || `${r.title}-${r.timeframe}`;
                const isApplying = applyingId === recId;
                const isApplied = !!justAppliedById[recId];
                return (
                  <div
                    key={r.id || idx}
                    className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-white dark:from-slate-800 dark:to-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div className="text-sm font-semibold">{r.title}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {r.description}
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Impact: <Currency>{r.impact}</Currency> • Effort:{" "}
                          {r.effort} • {r.timeframe}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 font-semibold">
                          {r.priority}
                        </div>
                        <button
                          onClick={() => handleApplyRecommendation(r)}
                          disabled={isApplying || isApplied}
                          className={`mt-3 px-3 py-2 text-white rounded-lg text-sm transition disabled:opacity-60 disabled:cursor-not-allowed ${
                            isApplied
                              ? "bg-green-600"
                              : "bg-purple-600 hover:opacity-90"
                          }`}
                        >
                          {isApplied
                            ? "Applied"
                            : isApplying
                              ? "Applying..."
                              : "Apply"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {visibleRecommendations.length === 0 && (
                <div className="text-sm text-gray-500">
                  No urgent recommendations. You're on track.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from "react";

export default function MetricsCards({ stats }) {
  const cards = [
    { title: "Users", value: stats.usersCount },
    { title: "Transactions", value: stats.txCount },
    { title: "Budgets", value: stats.budgetsCount },
    { title: "Goals", value: stats.goalsCount },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.title} className="p-4 bg-card border-border rounded">
          <div className="text-sm text-muted-foreground">{c.title}</div>
          <div className="text-2xl font-bold">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

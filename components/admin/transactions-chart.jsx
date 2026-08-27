import React from "react";

function buildPath(values, width = 600, height = 100) {
  const max = Math.max(...values.map((v) => Math.abs(v))) || 1;
  const step = width / Math.max(1, values.length - 1);

  return values
    .map((v, i) => {
      const x = i * step;
      const y = height / 2 - (v / max) * (height / 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function TransactionsChart({ monthly = [] }) {
  const values = monthly.map((m) => m.total || 0);
  const labels = monthly.map((m) => m.month);

  const path = buildPath(values);

  return (
    <div className="p-4 bg-card border-border rounded">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-muted-foreground">
          Transactions (last {monthly.length} months)
        </div>
      </div>
      <svg
        viewBox={`0 0 600 100`}
        width="100%"
        height="120"
        preserveAspectRatio="none"
      >
        <path d={path} fill="none" stroke="#2563eb" strokeWidth="2" />
        {/* simple x labels */}
        {labels.map((l, i) => (
          <text
            key={l}
            x={(i * 600) / Math.max(1, labels.length - 1)}
            y="96"
            fontSize="10"
            fill="#6b7280"
            textAnchor="middle"
          >
            {l.split("-")[1]}
          </text>
        ))}
      </svg>
    </div>
  );
}

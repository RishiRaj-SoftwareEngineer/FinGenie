function formatDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d) {
  const out = new Date(d);
  out.setDate(out.getDate() - out.getDay());
  out.setHours(0, 0, 0, 0);
  return out;
}

export function aggregateExpenses(transactions, granularity) {
  const map = new Map();
  for (const t of transactions) {
    if (t.type !== "EXPENSE") continue;
    const d = new Date(t.date);
    let key = "";
    let keyDate = null;
    if (granularity === "daily") {
      keyDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      key = formatDateLocal(keyDate);
    } else if (granularity === "weekly") {
      keyDate = startOfWeek(d);
      key = formatDateLocal(keyDate);
    } else if (granularity === "yearly") {
      keyDate = new Date(d.getFullYear(), 0, 1);
      key = String(d.getFullYear());
    } else {
      keyDate = new Date(d.getFullYear(), d.getMonth(), 1);
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    if (!map.has(key)) map.set(key, { date: keyDate, amount: 0, label: key });
    map.get(key).amount += Number(t.amount || 0);
  }
  return Array.from(map.values()).sort((a, b) => a.date - b.date);
}

export function aggregateCashFlow(transactions, granularity) {
  const map = new Map();
  for (const t of transactions) {
    const d = new Date(t.date);
    let key = "";
    let keyDate = null;
    if (granularity === "daily") {
      keyDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      key = formatDateLocal(keyDate);
    } else if (granularity === "weekly") {
      keyDate = startOfWeek(d);
      key = formatDateLocal(keyDate);
    } else if (granularity === "yearly") {
      keyDate = new Date(d.getFullYear(), 0, 1);
      key = String(d.getFullYear());
    } else {
      keyDate = new Date(d.getFullYear(), d.getMonth(), 1);
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    if (!map.has(key)) {
      map.set(key, { date: keyDate, label: key, income: 0, expense: 0 });
    }
    const bucket = map.get(key);
    if (t.type === "INCOME") bucket.income += Number(t.amount || 0);
    else if (t.type === "EXPENSE") bucket.expense += Number(t.amount || 0);
  }
  return Array.from(map.values())
    .sort((a, b) => a.date - b.date)
    .map((b) => ({ ...b, net: b.income - b.expense }));
}

export function forecastSeries(series, granularity, periods) {
  if (!series || series.length === 0 || periods <= 0) return [];
  const window =
    granularity === "daily"
      ? 7
      : granularity === "weekly"
        ? 4
        : granularity === "yearly"
          ? 2
          : 3;
  const recent = series.slice(-window);
  const alpha =
    granularity === "daily"
      ? 0.3
      : granularity === "weekly"
        ? 0.35
        : granularity === "yearly"
          ? 0.4
          : 0.3;
  const beta =
    granularity === "daily"
      ? 0.2
      : granularity === "weekly"
        ? 0.25
        : granularity === "yearly"
          ? 0.3
          : 0.2;

  let level = recent[0]?.amount || 0;
  let trend =
    recent.length >= 2
      ? (recent[1].amount - recent[0].amount) / 1
      : 0;
  for (let i = 1; i < recent.length; i += 1) {
    const prevLevel = level;
    level = alpha * recent[i].amount + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  const last = series[series.length - 1].date;
  const out = [];
  for (let i = 1; i <= periods; i += 1) {
    const d = new Date(last);
    if (granularity === "daily") d.setDate(d.getDate() + i);
    else if (granularity === "weekly") d.setDate(d.getDate() + i * 7);
    else if (granularity === "yearly") d.setFullYear(d.getFullYear() + i);
    else d.setMonth(d.getMonth() + i);

    const label =
      granularity === "daily"
        ? formatDateLocal(d)
        : granularity === "weekly"
          ? formatDateLocal(startOfWeek(d))
          : granularity === "yearly"
            ? String(d.getFullYear())
            : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const forecastVal = level + trend * i;
    out.push({ label, amount: Number(forecastVal.toFixed(2)) });
  }
  return out;
}

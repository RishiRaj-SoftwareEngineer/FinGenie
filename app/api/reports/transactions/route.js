import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfYear(d) {
  return new Date(d.getFullYear(), 0, 1);
}

function formatDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function escapeCsv(val) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes("\"")) {
    return `"${s.replace(/"/g, "\"\"")}"`;
  }
  return s;
}

export async function GET(req) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const user = await db.user.findUnique({ where: { clerkUserId } });
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
    });
  }

  const { searchParams } = new URL(req.url);
  const range = (searchParams.get("range") || "monthly").toLowerCase();
  const format = (searchParams.get("format") || "csv").toLowerCase();

  const now = new Date();
  let start = null;
  let end = null;
  if (range === "weekly") {
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
    start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (range === "yearly") {
    start = startOfYear(now);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else {
    start = startOfMonth(now);
    end = endOfMonth(now);
  }

  const transactions = await db.transaction.findMany({
    where: { userId: user.id, date: { gte: start, lte: end } },
    orderBy: { date: "desc" },
  });

  if (format === "pdf") {
    const rows = transactions
      .map(
        (t) => `<tr>
  <td>${formatDateLocal(new Date(t.date))}</td>
  <td>${t.type}</td>
  <td>Rs.${Number(t.amount || 0).toFixed(2)}</td>
  <td>${t.category || "-"}</td>
  <td>${(t.merchant || t.description || "-").toString()}</td>
</tr>`,
      )
      .join("");
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Transactions Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; }
    h1 { font-size: 18px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
    th { background: #f5f5f5; text-align: left; }
  </style>
</head>
<body>
  <h1>Transactions Report (${range})</h1>
  <p>Range: ${formatDateLocal(start)} to ${formatDateLocal(end)}</p>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Amount</th>
        <th>Category</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="transactions-${range}.html"`,
      },
    });
  }

  const header = [
    "date",
    "type",
    "amount",
    "category",
    "description",
    "merchant",
    "status",
    "isRecurring",
  ].join(",");
  const lines = transactions.map((t) =>
    [
      formatDateLocal(new Date(t.date)),
      t.type,
      Number(t.amount || 0).toFixed(2),
      t.category || "",
      t.description || "",
      t.merchant || "",
      t.status || "",
      t.isRecurring ? "true" : "false",
    ]
      .map(escapeCsv)
      .join(","),
  );
  const csv = [header, ...lines].join("\n");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions-${range}.csv"`,
    },
  });
}

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

const CATEGORY_COLORS = {
  Budget: "bg-blue-100 text-blue-700",
  Spending: "bg-rose-100 text-rose-700",
  "Income & Savings": "bg-emerald-100 text-emerald-700",
  Goals: "bg-violet-100 text-violet-700",
  Investments: "bg-amber-100 text-amber-800",
  Reports: "bg-cyan-100 text-cyan-700",
  Categorization: "bg-fuchsia-100 text-fuchsia-700",
  Accounts: "bg-indigo-100 text-indigo-700",
  General: "bg-slate-100 text-slate-700",
};

function detectHistoryCategory(text) {
  const lc = (text || "").toLowerCase();
  if (/\b(budget|budget plan|overspend|monthly budget)\b/.test(lc)) {
    return "Budget";
  }
  if (/\b(expense|expenses|spending|category|categories)\b/.test(lc)) {
    return "Spending";
  }
  if (/\b(income|salary|earn|earnings|cash flow|cashflow|savings)\b/.test(lc)) {
    return "Income & Savings";
  }
  if (/\b(goal|goals|target|contribution|timeline)\b/.test(lc)) {
    return "Goals";
  }
  if (/\b(invest|investment|portfolio|stock|mutual fund)\b/.test(lc)) {
    return "Investments";
  }
  if (/\b(report|pdf|export|download)\b/.test(lc)) {
    return "Reports";
  }
  if (/\b(categorize|auto[-\s]?categorize|rule)\b/.test(lc)) {
    return "Categorization";
  }
  if (/\b(account|balance|transfer)\b/.test(lc)) {
    return "Accounts";
  }
  return "General";
}

function buildTitleFromText(text, fallbackCategory) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return `${fallbackCategory} Chat`;
  const sentence = clean.split(/[.!?]/)[0].trim();
  const title = sentence || clean;
  return title.length > 72 ? `${title.slice(0, 69)}...` : title;
}

function buildConversationItems(messages) {
  const items = [];
  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const assistant =
      i + 1 < messages.length && messages[i + 1].role === "assistant"
        ? messages[i + 1]
        : null;
    const category = detectHistoryCategory(m.content);
    const previewSource = assistant?.content || m.content || "";
    items.push({
      id: m.id,
      category,
      title: buildTitleFromText(m.content, category),
      preview: previewSource.replace(/\s+/g, " ").trim().slice(0, 140),
      createdAt: m.createdAt,
    });
  }
  return items;
}

export default async function ChatHistoryPage() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold">Chat History</h1>
        <p className="text-sm text-slate-600 mt-2">
          Please sign in to view your chat history.
        </p>
      </div>
    );
  }

  const user = await db.user.findUnique({ where: { clerkUserId } });
  if (!user) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold">Chat History</h1>
        <p className="text-sm text-slate-600 mt-2">
          User not found.
        </p>
      </div>
    );
  }

  const recentMessages = await db.chatMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const messages = [...recentMessages].reverse();
  const conversations = buildConversationItems(messages).reverse();
  const grouped = conversations.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});
  const categoryOrder = [
    "Budget",
    "Spending",
    "Income & Savings",
    "Goals",
    "Investments",
    "Reports",
    "Categorization",
    "Accounts",
    "General",
  ];
  const categories = categoryOrder.filter((c) => grouped[c]?.length);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Chat History</h1>
        <div className="text-xs text-slate-500">
          Showing latest {conversations.length} conversations
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {conversations.length === 0 ? (
          <div className="text-sm text-slate-600">No messages yet.</div>
        ) : (
          categories.map((category) => (
            <section key={category}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-700">{category}</h2>
                <span className="text-xs text-slate-500">
                  {grouped[category].length} item(s)
                </span>
              </div>
              <div className="space-y-2">
                {grouped[category].map((item) => (
                  <article
                    key={item.id}
                    className="border border-slate-200 rounded-lg p-3 bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.General}`}
                        >
                          {item.category}
                        </span>
                        <div className="font-medium text-slate-900">{item.title}</div>
                        <div className="mt-1 text-sm text-slate-600">{item.preview}</div>
                      </div>
                      <div className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

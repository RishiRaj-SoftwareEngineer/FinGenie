import { defaultCategories } from "../../data/categories";

const keywordMap = {
  food: ["starbucks", "coffee", "latte", "mcdonald", "burger", "food", "kfc", "dominos"],
  groceries: ["grocery", "walmart", "tesco", "aldi", "supermarket"],
  transportation: ["uber", "lyft", "taxi", "metro", "bus", "train", "fuel", "gas station"],
  housing: ["rent", "apartment", "mortgage"],
  entertainment: ["netflix", "spotify", "hulu", "prime video", "disney+", "movie", "cinema"],
  utilities: ["electricity", "water", "gas bill", "internet", "phone bill"],
  shopping: ["amazon", "flipkart", "bestbuy", "ebay", "shop"],
  healthcare: ["hospital", "clinic", "pharmacy", "drugstore"],
  bills: ["fee", "charge", "service charge", "bank fee"],
  salary: ["salary", "payroll", "payroll deposit", "salary credit"],
};

function findCategoryIdByKey(key) {
  // Map our keyword group to an existing category id from defaultCategories
  const map = {
    food: "food",
    groceries: "groceries",
    transportation: "transportation",
    housing: "housing",
    entertainment: "entertainment",
    utilities: "utilities",
    shopping: "shopping",
    healthcare: "healthcare",
    bills: "bills",
    salary: "salary",
  };
  return map[key] || null;
}

export function categorizeTransactions(transactions = []) {
  return transactions.map((tx) => {
    const text = `${tx.merchant || ""} ${tx.description || ""}`.toLowerCase();
    let assigned = null;

    for (const [group, keywords] of Object.entries(keywordMap)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          assigned = findCategoryIdByKey(group);
          break;
        }
      }
      if (assigned) break;
    }

    // fallback: small-amount heuristic
    if (!assigned && Math.abs(tx.amount) < 5) {
      assigned = "food";
    }

    return {
      transactionId: tx.id || tx.transactionId || null,
      category: assigned,
    };
  });
}

export default { categorizeTransactions };

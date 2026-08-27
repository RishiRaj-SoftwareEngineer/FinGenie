"use server";
import aj from "@/lib/arcjet";
import { db } from "@/lib/prisma";
import { request } from "@arcjet/next";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const serializeAmount = (obj) => ({
  ...obj,
  amount: obj.amount.toNumber(),
});

const incomeHintPattern =
  /\b(credit|credited|deposit|deposited|salary|received|refund|interest|cashback|incoming|cr)\b/i;
const expenseHintPattern =
  /\b(debit|debited|withdraw|withdrawn|withdrawal|purchase|spent|payment|paid|bill|charge|fee|transfer|atm|upi|pos|dr)\b/i;

const incomeCategoryKeywords = [
  { category: "salary", keywords: ["salary", "payroll", "stipend"] },
  { category: "investments", keywords: ["dividend", "interest", "investment"] },
  { category: "business", keywords: ["business", "client"] },
  { category: "freelance", keywords: ["freelance", "gig", "project"] },
  { category: "rental", keywords: ["rent received", "rental"] },
];

const expenseCategoryKeywords = [
  { category: "housing", keywords: ["rent", "mortgage", "property"] },
  { category: "transportation", keywords: ["fuel", "uber", "taxi", "metro", "bus"] },
  { category: "groceries", keywords: ["grocery", "supermarket", "mart"] },
  { category: "utilities", keywords: ["electricity", "water", "internet", "gas"] },
  { category: "entertainment", keywords: ["movie", "netflix", "spotify", "game"] },
  { category: "food", keywords: ["restaurant", "food", "dining", "cafe", "swiggy", "zomato"] },
  { category: "shopping", keywords: ["amazon", "flipkart", "shopping", "store"] },
  { category: "healthcare", keywords: ["hospital", "clinic", "pharmacy", "medical"] },
  { category: "education", keywords: ["school", "tuition", "course", "college"] },
  { category: "travel", keywords: ["flight", "hotel", "travel", "booking"] },
  { category: "insurance", keywords: ["insurance", "premium"] },
  { category: "bills", keywords: ["fee", "charge", "penalty", "bill"] },
];

function parseAmountFromStatement(text) {
  const line = text || "";
  const explicitPatterns = [
    /([+-]?\d[\d,]*(?:\.\d{1,2})?)\s+(?:has been\s+)?(?:deposited|withdrawn)\b/gi,
    /(?:rs\.?|inr|npr|\$)\s*([+-]?\d[\d,]*(?:\.\d{1,2})?)/gi,
    /(?:amount|amt|debited|credited|withdrawn|deposited|spent|paid)\s*(?:of|by|:)?\s*(?:rs\.?|inr|npr|\$)?\s*([+-]?\d[\d,]*(?:\.\d{1,2})?)/gi,
  ];

  const parseNumeric = (value) => {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const candidates = [];
  for (const pattern of explicitPatterns) {
    const matches = [...line.matchAll(pattern)];
    for (const match of matches) {
      const value = parseNumeric(match[1] || "");
      if (value !== null) candidates.push(value);
    }
  }

  if (candidates.length) return candidates[0];

  const fallbackMatches = [...line.matchAll(/([+-]?\d[\d,]*(?:\.\d{1,2})?)/g)];
  const fallbackCandidates = fallbackMatches
    .map((match) => {
      const token = match[1] || "";
      const index = match.index || 0;
      const context = line.slice(Math.max(0, index - 8), index + token.length + 2);
      // Skip account-number fragments like "A/C 0#1080000348".
      if (/a\/c\s*0?#?\s*$/i.test(context.slice(0, 8))) return null;
      if (/#\d{6,}/.test(context)) return null;
      return parseNumeric(token);
    })
    .filter((value) => {
      if (value === null) return false;
      // Ignore likely date/year fragments and tiny ids.
      if (value >= 1900 && value <= 2100) return false;
      if (Math.abs(value) > 100000000) return false;
      return Math.abs(value) >= 10;
    });

  if (!fallbackCandidates.length) return null;

  return fallbackCandidates[0];
}

function parseDateFromStatement(text) {
  const patterns = [
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{2})\/(\d{2})\/(\d{4})/,
    /(\d{2})-(\d{2})-(\d{4})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    let year;
    let month;
    let day;

    if (pattern.source.startsWith("(\\d{4})")) {
      year = Number.parseInt(match[1], 10);
      month = Number.parseInt(match[2], 10) - 1;
      day = Number.parseInt(match[3], 10);
    } else {
      day = Number.parseInt(match[1], 10);
      month = Number.parseInt(match[2], 10) - 1;
      year = Number.parseInt(match[3], 10);
    }

    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return new Date();
}

function parseDescriptionFromStatement(text, type) {
  const remarksMatch = text.match(/remarks?\s*:\s*([^,.\n]+(?:[,/\-][^,.\n]+)*)/i);
  if (remarksMatch?.[1]) {
    return remarksMatch[1].trim().slice(0, 160);
  }
  const reMatch = text.match(/\bre\s*:\s*([^,.\n]+(?:[,/\-][^,.\n]+)*)/i);
  if (reMatch?.[1]) {
    return reMatch[1].trim().slice(0, 160);
  }

  const sanitized = text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/dear customer[,:\s]*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const fallbackPrefix = type === "INCOME" ? "Bank deposit" : "Bank withdrawal";
  return sanitized ? sanitized.slice(0, 160) : fallbackPrefix;
}

function parseDDMMYYYYToISO(dateText) {
  const match = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  const year = Number.parseInt(match[3], 10);
  const date = new Date(year, month, day);

  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function extractStatementTransactions(rawText) {
  const normalized = (rawText || "").replace(/\r/g, "");
  const txPattern =
    /Dear Customer,\s*Your\s+.+?\s+has been\s+(deposited|withdrawn)\s+by\s+NPR\s+([\d,]+(?:\.\d{1,2})?)\s+on\s+(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2},\s*Remarks:\s*([\s\S]*?)(?=(?:\n(?:Activate|Download App|For A\/C Balance):)|(?:\nDear Customer,)|$)/gi;

  const matches = [];
  for (const match of normalized.matchAll(txPattern)) {
    const direction = (match[1] || "").toLowerCase();
    const amount = Number.parseFloat((match[2] || "").replace(/,/g, ""));
    const dateIso = parseDDMMYYYYToISO(match[3] || "");
    const remarks = (match[4] || "").replace(/\s+/g, " ").trim();

    if (!Number.isFinite(amount) || !dateIso) continue;

    matches.push({
      type: direction === "deposited" ? "INCOME" : "EXPENSE",
      amount: Math.abs(amount),
      date: dateIso,
      description:
        remarks.slice(0, 160) ||
        (direction === "deposited" ? "Bank deposit" : "Bank withdrawal"),
      fullText: `has been ${direction} by NPR ${match[2]}, Remarks: ${remarks}`,
    });
  }

  return matches;
}

function inferCategory(text, type) {
  const haystack = text.toLowerCase();
  const keywords = type === "INCOME" ? incomeCategoryKeywords : expenseCategoryKeywords;

  for (const item of keywords) {
    if (item.keywords.some((keyword) => haystack.includes(keyword))) {
      return item.category;
    }
  }

  return type === "INCOME" ? "other-income" : "other-expense";
}

function normalizeStatementType(value) {
  const raw = String(value || "").toUpperCase();
  if (raw === "INCOME" || raw === "EXPENSE") return raw;
  if (/\b(deposit|credit|credited|income|received|salary|earning|earnings|payroll|allowance|net salary)\b/i.test(raw)) {
    return "INCOME";
  }
  return "EXPENSE";
}

function normalizeScannedCategory(categoryValue, type, contextText = "") {
  const raw = String(categoryValue || "")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .trim();
  const context = String(contextText || "").toLowerCase();

  const incomeAliases = new Map([
    ["income", "other-income"],
    ["salary-slip", "salary"],
    ["salary", "salary"],
    ["payroll", "salary"],
    ["wage", "salary"],
    ["wages", "salary"],
    ["freelancing", "freelance"],
    ["investment", "investments"],
    ["rent", "rental"],
  ]);

  const expenseAliases = new Map([
    ["expense", "other-expense"],
    ["expenses", "other-expense"],
    ["bill", "bills"],
    ["fees", "bills"],
    ["gift", "gifts"],
    ["donation", "gifts"],
  ]);

  if (type === "INCOME") {
    if (incomeAliases.has(raw)) return incomeAliases.get(raw);
    if (/\b(salary|payroll|earning|net salary)\b/i.test(context)) return "salary";
    return raw;
  }

  if (expenseAliases.has(raw)) return expenseAliases.get(raw);
  return raw;
}

function normalizeStatementDate(value) {
  if (!value) return new Date().toISOString();
  const raw = String(value).trim();
  const ddmmyyyy = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (ddmmyyyy) {
    const day = Number.parseInt(ddmmyyyy[1], 10);
    const month = Number.parseInt(ddmmyyyy[2], 10) - 1;
    const year = Number.parseInt(ddmmyyyy[3], 10);
    const dt = new Date(year, month, day);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }

  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return new Date().toISOString();
  return dt.toISOString();
}

function normalizeExtractedStatementTx(item) {
  const type = normalizeStatementType(item?.type);
  const amount = Number.parseFloat(String(item?.amount ?? "").replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const description = String(item?.description || item?.remarks || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  const inferredCategory = inferCategory(
    `${description} ${item?.category || ""}`,
    type,
  );

  return {
    type,
    amount: Math.abs(amount),
    date: normalizeStatementDate(item?.date || item?.transactionDate),
    description: description || (type === "INCOME" ? "Bank deposit" : "Bank withdrawal"),
    category: String(item?.category || inferredCategory)
      .toLowerCase()
      .trim() || (type === "INCOME" ? "other-income" : "other-expense"),
  };
}

export async function analyzeStatementText(statementText) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const rawText = (statementText || "").trim();
    if (!rawText) {
      throw new Error("Statement text is required");
    }

    const extractedTransactions = extractStatementTransactions(rawText);
    if (extractedTransactions.length) {
      const latest = extractedTransactions[extractedTransactions.length - 1];
      return {
        success: true,
        data: {
          type: latest.type,
          amount: latest.amount,
          date: latest.date,
          description: latest.description,
          category: inferCategory(latest.fullText, latest.type),
        },
      };
    }

    const cleaned = rawText.replace(/\s+/g, " ").trim();
    const amount = parseAmountFromStatement(cleaned);
    if (!amount) {
      throw new Error("Could not detect transaction amount in statement");
    }

    const isIncome = incomeHintPattern.test(cleaned);
    const isExpense = expenseHintPattern.test(cleaned);
    const type = isIncome && !isExpense ? "INCOME" : "EXPENSE";
    const category = inferCategory(cleaned, type);

    return {
      success: true,
      data: {
        type,
        amount: Math.abs(amount),
        date: parseDateFromStatement(cleaned).toISOString(),
        description: parseDescriptionFromStatement(cleaned, type),
        category,
      },
    };
  } catch (error) {
    throw new Error(error.message || "Failed to analyze statement");
  }
}

export async function analyzeStatementPdf(file) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");
    if (!file) throw new Error("PDF file is required");

    const isPdf =
      file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");
    if (!isPdf) throw new Error("Please upload a PDF statement");
    if (file.size > 15 * 1024 * 1024) {
      throw new Error("PDF size should be less than 15MB");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const arrayBuffer = await file.arrayBuffer();
    const base64String = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `
Extract all bank transactions from this statement PDF.
Ignore OTP/security alerts/non-transaction text.

Return ONLY valid JSON in this exact shape:
{
  "transactions": [
    {
      "type": "INCOME or EXPENSE",
      "amount": number,
      "date": "YYYY-MM-DD or DD/MM/YYYY",
      "description": "short description",
      "category": "one of salary,freelance,investments,business,rental,other-income,housing,transportation,groceries,utilities,entertainment,food,shopping,healthcare,education,personal,travel,insurance,gifts,bills,other-expense"
    }
  ]
}
`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64String,
          mimeType: "application/pdf",
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
    const jsonStart = cleanedText.indexOf("{");
    const jsonEnd = cleanedText.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd < 0) {
      throw new Error("Could not parse transactions from PDF");
    }

    const parsed = JSON.parse(cleanedText.slice(jsonStart, jsonEnd + 1));
    const sourceList = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.transactions)
        ? parsed.transactions
        : [];
    const transactions = sourceList
      .map(normalizeExtractedStatementTx)
      .filter(Boolean);

    if (!transactions.length) {
      throw new Error("No transactions detected in this PDF statement");
    }

    return {
      success: true,
      data: { transactions },
    };
  } catch (error) {
    throw new Error(error.message || "Failed to analyze PDF statement");
  }
}

export async function importStatementTransactions(payload) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const accountId = payload?.accountId;
    const transactionsRaw = Array.isArray(payload?.transactions)
      ? payload.transactions
      : [];

    if (!accountId) throw new Error("Account is required");
    if (!transactionsRaw.length) {
      throw new Error("No transactions to import");
    }
    if (transactionsRaw.length > 500) {
      throw new Error("Too many transactions in one import (max 500)");
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) throw new Error("User not found");

    const account = await db.account.findUnique({
      where: {
        id: accountId,
        userId: user.id,
      },
    });
    if (!account) throw new Error("Account not found");

    const transactions = transactionsRaw
      .map(normalizeExtractedStatementTx)
      .filter(Boolean);
    if (!transactions.length) {
      throw new Error("No valid transactions found for import");
    }

    const balanceIncrement = transactions.reduce((sum, tx) => {
      return sum + (tx.type === "INCOME" ? tx.amount : -tx.amount);
    }, 0);

    await db.$transaction(async (tx) => {
      await tx.transaction.createMany({
        data: transactions.map((item) => ({
          type: item.type,
          amount: item.amount,
          description: item.description,
          date: new Date(item.date),
          category: item.category,
          userId: user.id,
          accountId,
          isRecurring: false,
          status: "COMPLETED",
        })),
      });

      await tx.account.update({
        where: { id: accountId },
        data: {
          balance: {
            increment: balanceIncrement,
          },
        },
      });
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${accountId}`);

    return {
      success: true,
      data: {
        accountId,
        count: transactions.length,
      },
    };
  } catch (error) {
    throw new Error(error.message || "Failed to import transactions");
  }
}

export async function createTransaction(data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");
    // Get request data for ArcJet
    const req = await request();

    // Check rate limit
    const decision = await aj.protect(req, {
      userId,
      requested: 1, // Specify how many tokens to consume
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        const { remaining, reset } = decision.reason;
        console.error({
          code: "RATE_LIMIT_EXCEEDED",
          details: {
            remaining,
            resetInSeconds: reset,
          },
        });

        throw new Error("Too many requests. Please try again later.");
      }

      throw new Error("Request blocked");
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }
    const account = await db.account.findUnique({
      where: {
        id: data.accountId,
        userId: user.id,
      },
    });

    if (!account) {
      throw new Error("Account not found");
    }

    // Calculate new balance
    const balanceChange = data.type === "EXPENSE" ? -data.amount : data.amount;
    const newBalance = account.balance.toNumber() + balanceChange;
    // Create transaction and update account balance
    const transaction = await db.$transaction(async (tx) => {
      const newTransaction = await tx.transaction.create({
        data: {
          ...data,
          userId: user.id,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
        },
      });
      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: newBalance },
      });

      return newTransaction;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${transaction.accountId}`);

    return { success: true, data: serializeAmount(transaction) };
  } catch (error) {
    throw new Error(error.message);
  }
}

function calculateNextRecurringDate(startDate, interval) {
  const date = new Date(startDate);

  switch (interval) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      break;
    case "YEARLY":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date;
}

//Scan Receipt
export async function scanReceipt(file) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    // Convert ArrayBuffer to Base64
    const base64String = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `
      Analyze this receipt image and extract the following information in JSON format:
      - Total amount (just the number)
      - Date (in ISO format)
      - Description or items purchased (brief summary)
      - Merchant/store name
      - Transaction type (must be either INCOME or EXPENSE)
      - Suggested category based on type:
        - INCOME: salary,freelance,investments,business,rental,other-income
        - EXPENSE: housing,transportation,groceries,utilities,entertainment,food,shopping,healthcare,education,personal,travel,insurance,gifts,bills,other-expense
      
      Only respond with valid JSON in this exact format:
      {
        "amount": number,
        "date": "ISO date string",
        "type": "INCOME or EXPENSE",
        "description": "string",
        "merchantName": "string",
        "category": "string",
        "fullText": "string"
      }

      If its not a recipt, return an empty object
    `;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    try {
      const data = JSON.parse(cleanedText);
      const typeSignal = [
        data?.type,
        data?.description,
        data?.merchantName,
        data?.category,
        data?.fullText,
      ]
        .filter(Boolean)
        .join(" ");
      const type = normalizeStatementType(typeSignal);
      const incomeCategories = new Set([
        "salary",
        "freelance",
        "investments",
        "business",
        "rental",
        "other-income",
      ]);
      const expenseCategories = new Set([
        "housing",
        "transportation",
        "groceries",
        "utilities",
        "entertainment",
        "food",
        "shopping",
        "healthcare",
        "education",
        "personal",
        "travel",
        "insurance",
        "gifts",
        "bills",
        "other-expense",
      ]);
      const allowedCategories =
        type === "INCOME" ? incomeCategories : expenseCategories;

      const description = String(data?.description || "").trim();
      const merchantName = String(data?.merchantName || "").trim();
      const fullText = String(data?.fullText || "").trim();
      const contextForRules = `${description} ${merchantName} ${fullText}`.trim();
      const hasSalarySignals =
        /\b(salary|salary slip|payslip|pay slip|payroll|net salary|gross salary|earnings|allowance|basic salary)\b/i.test(
          contextForRules,
        );
      const fallbackCategory = inferCategory(
        contextForRules,
        type,
      );
      const rawCategory = normalizeScannedCategory(
        data?.category,
        type,
        contextForRules,
      );
      const category = allowedCategories.has(rawCategory)
        ? rawCategory
        : allowedCategories.has(fallbackCategory)
          ? fallbackCategory
          : type === "INCOME"
            ? "other-income"
            : "other-expense";
      const finalCategory =
        type === "INCOME" && hasSalarySignals ? "salary" : category;

      const amount = Number.parseFloat(String(data?.amount ?? ""));
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Could not detect receipt amount");
      }

      const parsedDate = data?.date ? new Date(data.date) : new Date();
      const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

      return {
        amount: Math.abs(amount),
        date,
        type,
        description: description || (type === "INCOME" ? "Income" : "Expense"),
        category: finalCategory,
        merchantName,
      };
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      throw new Error("Invalid response format from Gemini");
    }
  } catch (error) {
    console.error("Error scanning receipt:", error);
    throw new Error("Failed to scan receipt");
  }
}

export async function getTransaction(id) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const transaction = await db.transaction.findUnique({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!transaction) throw new Error("Transaction not found");

  return serializeAmount(transaction);
}

export async function updateTransaction(id, data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Get original transaction to calculate balance change
    const originalTransaction = await db.transaction.findUnique({
      where: {
        id,
        userId: user.id,
      },
      include: {
        account: true,
      },
    });

    if (!originalTransaction) throw new Error("Transaction not found");

    // Calculate balance changes
    const oldBalanceChange =
      originalTransaction.type === "EXPENSE"
        ? -originalTransaction.amount.toNumber()
        : originalTransaction.amount.toNumber();

    const newBalanceChange =
      data.type === "EXPENSE" ? -data.amount : data.amount;

    const netBalanceChange = newBalanceChange - oldBalanceChange;

    // Update transaction and account balance in a transaction
    const transaction = await db.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: {
          id,
          userId: user.id,
        },
        data: {
          ...data,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
        },
      });

      // Update account balance
      await tx.account.update({
        where: { id: data.accountId },
        data: {
          balance: {
            increment: netBalanceChange,
          },
        },
      });

      return updated;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${data.accountId}`);

    return { success: true, data: serializeAmount(transaction) };
  } catch (error) {
    throw new Error(error.message);
  }
}

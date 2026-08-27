import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const MAX_RETRIES = 2;

let cachedClient = null;

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return cachedClient;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages must be a non-empty array");
  }

  return messages.map((m) => {
    if (!m || typeof m.content !== "string") {
      throw new Error("Each message must include string content");
    }
    return {
      role: typeof m.role === "string" ? m.role : "user",
      content: m.content,
    };
  });
}

function toPrompt(messages) {
  return messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
}

export async function callGemini(messages, options = {}) {
  const normalized = normalizeMessages(messages);
  const prompt = toPrompt(normalized);
  const modelName = options.model || DEFAULT_MODEL;

  const model = getClient().getGenerativeModel({ model: modelName });

  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (err) {
      lastError = err;
      if (attempt === MAX_RETRIES) break;
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }

  const reason =
    lastError && typeof lastError.message === "string"
      ? lastError.message
      : "Gemini request failed";
  throw new Error(reason);
}
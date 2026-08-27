const NEWS_URL = "https://api.thenewsapi.com/v1/news/top";

export async function fetchNewsSentiment() {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `${NEWS_URL}?api_token=${encodeURIComponent(
      apiKey,
    )}&language=en&limit=5`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.data)) return null;
    // very simple heuristic sentiment
    const articles = data.data.slice(0, 5);
    const headlines = articles
      .map((a) => (a.title || "").trim())
      .filter(Boolean)
      .slice(0, 3);
    const text = articles
      .map((a) => `${a.title || ""} ${a.description || ""}`)
      .join(" ")
      .toLowerCase();
    const pos = [
      "gain",
      "growth",
      "record",
      "surge",
      "strong",
      "rise",
      "beats",
      "optimism",
      "rally",
      "bull",
    ];
    const neg = [
      "fall",
      "drop",
      "decline",
      "loss",
      "weak",
      "crisis",
      "slump",
      "cut",
      "bear",
      "recession",
    ];
    let score = 0;
    pos.forEach((w) => {
      if (text.includes(w)) score += 1;
    });
    neg.forEach((w) => {
      if (text.includes(w)) score -= 1;
    });
    const sentiment =
      score > 1 ? "positive" : score < -1 ? "negative" : "neutral";
    return { sentiment, score, headlines };
  } catch (err) {
    return null;
  }
}

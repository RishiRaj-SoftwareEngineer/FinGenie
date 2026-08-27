const BASE_URL = "https://nepsetty.kokomo.workers.dev/api";

export async function fetchShareBazaar(symbol) {
  try {
    const res = await fetch(`${BASE_URL}?symbol=${encodeURIComponent(symbol)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.symbol) return null;
    const lastTradedPrice =
      Number(data.lastTradedPrice) ||
      Number(data.ltp) ||
      Number(data.last_traded_price) ||
      0;
    const change =
      Number(data.change) ||
      Number(data.netChange) ||
      Number(data.net_change) ||
      0;
    const changePercent =
      Number(data.changePercent) ||
      Number(data.percentageChange) ||
      Number(data.percentage_change) ||
      0;
    return {
      symbol: data.symbol,
      lastTradedPrice,
      change,
      changePercent,
      lastUpdated: data.last_updated || data.lastUpdated || null,
    };
  } catch (err) {
    return null;
  }
}

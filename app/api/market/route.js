import { NextResponse } from "next/server";

// Simple market insights placeholder — replace with real provider later
export async function GET() {
  const now = new Date().toISOString();
  const data = {
    generatedAt: now,
    macro: {
      shortTermRates: 6.5, // example %
      savingsYields: {
        "high-yield-savings": 4.0,
        "liquid-funds": 5.2,
        "fixed-deposit": 6.8,
      },
      equitySentiment: "neutral",
    },
    insight:
      "Short-term yields are elevated; consider a laddered approach between liquid funds and fixed deposits for cash you won't need within 12 months.",
  };

  return NextResponse.json(data);
}

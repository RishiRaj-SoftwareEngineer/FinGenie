"use client";

import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

export default function ForecastCard({ lines }) {
  const params = useSearchParams();
  const forecast = params?.get("forecast");
  const monthsRaw = params?.get("months") || params?.get("forecastMonths");
  const months = monthsRaw ? Math.min(120, Math.max(1, Number(monthsRaw))) : null;
  const show = forecast === "1" || forecast === "true";

  if (!show) return null;

  const visibleLines =
    months && Array.isArray(lines) ? lines.slice(0, months) : lines;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm font-medium">Spending Forecast (Monthly)</div>
        <div className="mt-2 text-sm text-slate-700 whitespace-pre-line">
          {visibleLines && visibleLines.length > 0
            ? visibleLines.join("\n")
            : "Not enough data to forecast."}
        </div>
      </CardContent>
    </Card>
  );
}

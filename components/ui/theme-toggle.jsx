"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        aria-label="Toggle theme"
        title="Toggle dark / light"
        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700"
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      title="Toggle dark / light"
      className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700"
    >
      {isDark ? (
        <Sun className="size-4 text-yellow-400" />
      ) : (
        <Moon className="size-4 text-slate-600" />
      )}
    </button>
  );
}

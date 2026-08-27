"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminSidebar() {
  const pathname = usePathname() || "/";
  const items = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/accounts", label: "Accounts" },
    { href: "/admin/budgets", label: "Budgets" },
    { href: "/admin/transactions", label: "Transactions" },
    { href: "/admin/goals", label: "Goals" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/settings", label: "Settings" },
  ];

  return (
    <aside className="w-64 bg-card border-border p-4">
      <h2 className="text-lg font-semibold mb-4">Admin</h2>
      <nav className="flex flex-col space-y-2">
        {items.map((it) => {
          const active =
            pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`px-2 py-1 rounded hover:bg-border ${
                active ? "bg-border font-semibold" : ""
              }`}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

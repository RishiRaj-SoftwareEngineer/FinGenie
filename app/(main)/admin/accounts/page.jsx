import React from "react";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/isAdmin";
import { db } from "@/lib/prisma";
import AccountsListClient from "@/components/admin/accounts-list-client";

export default async function AccountsPage() {
  const is_admin = await isAdmin();
  if (!is_admin) return redirect("/");

  const accounts = await db.account.findMany({
    include: { user: { select: { id: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const serial = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: a.balance?.toString() ?? null,
    currency: a.currency,
    userId: a.userId,
    userEmail: a.user?.email ?? null,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <a
          href="/admin/accounts/create"
          className="px-3 py-2 bg-green-600 text-white rounded"
        >
          Add Account
        </a>
      </div>

      <AccountsListClient initialAccounts={serial} />
    </div>
  );
}

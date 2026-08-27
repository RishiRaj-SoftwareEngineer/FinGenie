import React from "react";

import { getUserAccounts } from "@/actions/dashboard";
import { defaultCategories } from "@/data/categories";
import { StatementTransactionForm } from "../_components/statement-transaction-form";

const StatementTransactionPage = async () => {
  const accountsRaw = await getUserAccounts();
  const accounts = Array.isArray(accountsRaw) ? accountsRaw : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 px-6">
      <div className="mx-auto max-w-3xl">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-4xl font-semibold gradient-title text-center w-full">
              Add Transaction From Statement
            </h1>
          </div>

          <StatementTransactionForm
            accounts={accounts}
            categories={defaultCategories}
          />
        </div>
      </div>
    </div>
  );
};

export default StatementTransactionPage;

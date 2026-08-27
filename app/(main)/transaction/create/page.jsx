import { getUserAccounts } from "@/actions/dashboard";
import React from "react";
import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";

import { defaultCategories } from "@/data/categories";
import { getTransaction } from "@/actions/tranaction";
import { Button } from "@/components/ui/button";
import AddTransactionFormClient from "./transaction-form-client";

const AddTrannsactionPage = async ({ searchParams }) => {
  const accountsRaw = await getUserAccounts();
  const accounts = Array.isArray(accountsRaw) ? accountsRaw : [];
  const params = await searchParams;
  const editId = params?.edit;

  let initialData = null;
  if (editId) {
    const transaction = await getTransaction(editId);
    initialData = transaction;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 px-6">
      <div className="mx-auto max-w-3xl">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-4xl font-semibold gradient-title text-center w-full">
              {editId ? "Edit" : "Add"} Transaction
            </h1>
          </div>
          {!editId && (
            <div className="mb-6">
              <Button
                asChild
                variant="outline"
                className="w-full h-auto justify-start border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 px-4 py-3 text-left hover:from-sky-100 hover:to-cyan-100 dark:border-sky-800 dark:from-sky-950/40 dark:to-cyan-950/40 dark:hover:from-sky-900/50 dark:hover:to-cyan-900/50"
              >
                <Link href="/transaction/statement">
                  <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-semibold text-sky-900 dark:text-sky-100">
                      Add From Bank Statement
                    </span>
                    <span className="text-xs text-sky-700 dark:text-sky-300">
                      Paste SMS or statement text and auto-fill transaction
                    </span>
                  </span>
                  <Sparkles className="ml-auto h-4 w-4 text-sky-700 dark:text-sky-300" />
                </Link>
              </Button>
            </div>
          )}

          <AddTransactionFormClient
            accounts={accounts}
            categories={defaultCategories}
            editMode={!!editId}
            initialData={initialData}
          />
        </div>
      </div>
    </div>
  );
};

export default AddTrannsactionPage;

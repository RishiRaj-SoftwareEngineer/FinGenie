import { getAccountWithTransactions } from "@/actions/account";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BarLoader } from "react-spinners";
import TransactionTable from "../_component/transaction-table";
import AccountChart from "../_component/account-chart";
import ExportAccountPdfButton from "../_component/export-account-pdf-button";

export default async function AccountPage({ params }) {
  const { id } = await params;

  const accountData = await getAccountWithTransactions(id);

  if (!accountData) {
    notFound();
  }
  const { transactions, ...account } = accountData;
  const maskedAccountNumber =
    account.bankAccountNumber && account.bankAccountNumber.length >= 8
      ? `${account.bankAccountNumber.slice(0, 3)}###${account.bankAccountNumber.slice(-5)}`
      : null;

  return (
    <div className="space-y-8 px-15">
      <div className="flex gap-4 items-end justify-between">
        <div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight gradient-title capitalize">
            {account.name}
          </h1>
          <p className="text-muted-foreground">
            {account.type.charAt(0) + account.type.slice(1).toLowerCase()}{" "}
            Account
          </p>
          {maskedAccountNumber && (
            <p className="text-xs text-muted-foreground mt-1">
              A/C Number: {maskedAccountNumber}
            </p>
          )}
        </div>

        <div className="text-right pb-2">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight gradient-title">
            Account Balance
          </h2>

          <div className="text-xl sm:text-2xl font-bold">
            Rs.{parseFloat(account.balance).toFixed(2)}
          </div>
          <p className="text-sm text-muted-foreground">
            {account._count.transactions} Transactions
          </p>
          <div className="mt-3 flex justify-end">
            <ExportAccountPdfButton
              account={account}
              transactions={transactions}
            />
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <Suspense
        fallback={<BarLoader className="mt-4" width={"100%"} color="#9333ea" />}
      >
        <AccountChart transactions={transactions} />
      </Suspense>

      {/* Transactions Table */}
      <Suspense
        fallback={<BarLoader className="mt-4" width={"100%"} color="#9333ea" />}
      >
        <TransactionTable transactions={transactions} />
      </Suspense>
    </div>
  );
}

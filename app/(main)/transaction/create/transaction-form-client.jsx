"use client";

import dynamic from "next/dynamic";

const AddTransactionForm = dynamic(
  () =>
    import("../_components/transaction-form").then(
      (mod) => mod.AddTransactionForm,
    ),
  { ssr: false },
);

export default function AddTransactionFormClient(props) {
  return <AddTransactionForm {...props} />;
}

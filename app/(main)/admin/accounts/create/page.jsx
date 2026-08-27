import React from "react";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/isAdmin";
import AccountCreateForm from "@/components/admin/account-create-form";

export default async function AdminAccountCreatePage() {
  const is_admin = await isAdmin();
  if (!is_admin) return redirect("/");

  return (
    <div className="max-w-5xl mx-auto p-4">
      <AccountCreateForm />
    </div>
  );
}


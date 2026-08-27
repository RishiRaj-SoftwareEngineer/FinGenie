import React from "react";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/isAdmin";
import AdminSettingsForm from "@/components/admin/admin-settings-form-client";

export default async function SettingsPage() {
  const is_admin = await isAdmin();
  if (!is_admin) return redirect("/");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="mb-4 text-sm text-gray-600">
        Feature flags and integration toggles for the application.
      </div>
      <AdminSettingsForm />
    </div>
  );
}

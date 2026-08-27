import React from "react";
import AdminSidebar from "@/components/admin/sidebar";

export const metadata = {
  title: "Admin",
};

export default function AdminLayout({ children }) {
  return (
    <html>
      <body className="min-h-screen bg-slate-50">
        <div className="flex">
          <AdminSidebar />

          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}

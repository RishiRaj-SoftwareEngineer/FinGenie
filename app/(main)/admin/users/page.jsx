import React from "react";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/isAdmin";
import { db } from "@/lib/prisma";
import UserActions from "@/components/admin/user-actions";
// PromoteMeButton removed

export default async function UsersPage() {
  const is_admin = await isAdmin();
  if (!is_admin) return redirect("/");

  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold mb-4">Users</h1>
      </div>
      <div className="overflow-auto bg-card border-border">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Role</th>
              <th className="p-2 text-left">Created</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.name}</td>
                <td className="p-2">{u.role}</td>
                <td className="p-2">
                  {new Date(u.createdAt).toLocaleString()}
                </td>
                <td className="p-2">
                  <UserActions userId={u.id} role={u.role} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

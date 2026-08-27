"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function UserActions({ userId, role }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const patchRole = async (newRole) => {
    if (!confirm(`Set role to ${newRole} for this user?`)) return;
    setLoading(true);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setLoading(false);
    router.refresh();
  };

  const removeUser = async () => {
    if (!confirm("Delete this user? This action is irreversible.")) return;
    setLoading(true);
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      {role !== "ADMIN" ? (
        <button
          className="px-2 py-1 bg-blue-600 text-white rounded"
          onClick={() => patchRole("ADMIN")}
          disabled={loading}
        >
          Promote
        </button>
      ) : (
        <button
          className="px-2 py-1 bg-yellow-600 text-white rounded"
          onClick={() => patchRole("USER")}
          disabled={loading}
        >
          Demote
        </button>
      )}

      <button
        className="px-2 py-1 bg-red-600 text-white rounded"
        onClick={removeUser}
        disabled={loading}
      >
        Delete
      </button>
    </div>
  );
}

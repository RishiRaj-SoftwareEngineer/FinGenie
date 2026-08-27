"use client";
import React, { useEffect, useState } from "react";

export default function AdminSettingsForm() {
  const [values, setValues] = useState({
    featureX: false,
    maintenanceMode: false,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (!res.ok) throw new Error("no remote settings");
        const data = await res.json();
        if (mounted) setValues((v) => ({ ...v, ...data }));
      } catch (err) {
        // fallback to localStorage
        const saved = localStorage.getItem("admin_settings");
        if (saved) setValues(JSON.parse(saved));
      }
    })();
    return () => (mounted = false);
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        // fallback: persist locally
        localStorage.setItem("admin_settings", JSON.stringify(values));
        setMessage("Saved locally (no server endpoint)");
      } else {
        setMessage("Saved");
      }
    } catch (err) {
      console.error(err);
      localStorage.setItem("admin_settings", JSON.stringify(values));
      setMessage("Saved locally (error)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          id="featureX"
          type="checkbox"
          checked={!!values.featureX}
          onChange={(e) => setValues({ ...values, featureX: e.target.checked })}
        />
        <label htmlFor="featureX">Enable Feature X (beta)</label>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="maintenanceMode"
          type="checkbox"
          checked={!!values.maintenanceMode}
          onChange={(e) =>
            setValues({ ...values, maintenanceMode: e.target.checked })
          }
        />
        <label htmlFor="maintenanceMode">Maintenance Mode (hide signups)</label>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-2 bg-green-600 text-white rounded"
        >
          {loading ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="px-3 py-2 bg-gray-100 rounded"
          onClick={() => {
            localStorage.removeItem("admin_settings");
            setValues({ featureX: false, maintenanceMode: false });
            setMessage("Reset");
          }}
        >
          Reset
        </button>
      </div>
      {message && <div className="text-sm text-slate-700">{message}</div>}
    </form>
  );
}

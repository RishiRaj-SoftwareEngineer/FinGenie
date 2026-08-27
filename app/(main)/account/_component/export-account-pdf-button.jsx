"use client";

import React, { useRef, useState } from "react";
import { format } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const maskAccountNumber = (value) => {
  if (!value || value.length < 8) return "N/A";
  return `${value.slice(0, 3)}###${value.slice(-5)}`;
};

const ExportAccountPdfButton = ({ account, transactions }) => {
  const [loading, setLoading] = useState(false);
  const exportRef = useRef(null);

  const handleExport = async () => {
    if (!exportRef.current) return;

    try {
      setLoading(true);
      const html2pdf = (await import("html2pdf.js")).default;

      const filename = `account-${account.name.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      await html2pdf()
        .from(exportRef.current)
        .set({
          margin: 10,
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            onclone: (doc) => {
              doc
                .querySelectorAll("style, link[rel='stylesheet']")
                .forEach((node) => node.remove());
            },
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .save();
    } catch (error) {
      toast.error(error?.message || "Failed to export PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={handleExport} disabled={loading} className="gap-2">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Export PDF
          </>
        )}
      </Button>

      <div style={{ position: "fixed", left: "-99999px", top: 0 }}>
        <div
          ref={exportRef}
          style={{
            width: "190mm",
            background: "#ffffff",
            color: "#000000",
            padding: "24px",
          }}
        >
          <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "4px" }}>
            Account Statement
          </h1>
          <p style={{ marginBottom: "20px", color: "#555" }}>
            Generated on {format(new Date(), "PPP p")}
          </p>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "18px",
            }}
          >
            <p>
              <strong>Account:</strong> {account.name}
            </p>
            <p>
              <strong>Type:</strong>{" "}
              {account.type.charAt(0) + account.type.slice(1).toLowerCase()}
            </p>
            <p>
              <strong>Account Number:</strong>{" "}
              {maskAccountNumber(account.bankAccountNumber)}
            </p>
            <p>
              <strong>Balance:</strong> Rs.{Number(account.balance || 0).toFixed(2)}
            </p>
            <p>
              <strong>Total Transactions:</strong> {transactions.length}
            </p>
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "12px",
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Description</th>
                <th style={thStyle}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td style={tdStyle}>{format(new Date(tx.date), "yyyy-MM-dd")}</td>
                  <td style={tdStyle}>{tx.type}</td>
                  <td style={tdStyle}>{tx.category || "-"}</td>
                  <td style={tdStyle}>{tx.description || "-"}</td>
                  <td style={tdStyle}>Rs.{Number(tx.amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

const thStyle = {
  border: "1px solid #d1d5db",
  padding: "8px",
  textAlign: "left",
  background: "#f3f4f6",
  fontWeight: 600,
};

const tdStyle = {
  border: "1px solid #e5e7eb",
  padding: "8px",
  verticalAlign: "top",
};

export default ExportAccountPdfButton;

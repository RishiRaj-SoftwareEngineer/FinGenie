"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { FileUp, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  analyzeStatementPdf,
  analyzeStatementText,
  importStatementTransactions,
} from "@/actions/tranaction";
import useFetch from "@/hooks/use-fetch";
import { Button } from "@/components/ui/button";
import { AddTransactionForm } from "./transaction-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StatementTransactionForm({ accounts, categories }) {
  const router = useRouter();
  const [statement, setStatement] = useState("");
  const [analysisData, setAnalysisData] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [statementPdf, setStatementPdf] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState(
    accounts.find((ac) => ac.isDefault)?.id || "",
  );
  const [pdfTransactions, setPdfTransactions] = useState([]);

  const {
    loading: statementAnalyzeLoading,
    fn: analyzeStatementFn,
    data: statementData,
  } = useFetch(analyzeStatementText);
  const {
    loading: pdfAnalyzeLoading,
    fn: analyzePdfFn,
    data: pdfAnalysisData,
  } = useFetch(analyzeStatementPdf);
  const {
    loading: importLoading,
    fn: importTransactionsFn,
    data: importResult,
  } = useFetch(importStatementTransactions);

  const handleAnalyze = async () => {
    if (!statement.trim()) {
      toast.error("Paste a statement first");
      return;
    }

    await analyzeStatementFn(statement);
  };

  const handleAnalyzePdf = async () => {
    if (!statementPdf) {
      toast.error("Upload a PDF statement first");
      return;
    }
    await analyzePdfFn(statementPdf);
  };

  const handleImportPdfTransactions = async () => {
    if (!selectedAccountId) {
      toast.error("Select an account");
      return;
    }
    if (!pdfTransactions.length) {
      toast.error("No analyzed transactions to import");
      return;
    }

    await importTransactionsFn({
      accountId: selectedAccountId,
      transactions: pdfTransactions,
    });
  };

  useEffect(() => {
    if (!statementData?.success || !statementData?.data || statementAnalyzeLoading) return;

    setAnalysisData(statementData.data);
    setFormKey((prev) => prev + 1);
    toast.success("Statement analyzed. Review and create transaction.");
  }, [statementData, statementAnalyzeLoading]);

  useEffect(() => {
    if (!pdfAnalysisData?.success || !pdfAnalysisData?.data || pdfAnalyzeLoading) return;
    const extracted = Array.isArray(pdfAnalysisData.data.transactions)
      ? pdfAnalysisData.data.transactions
      : [];
    setPdfTransactions(extracted);
    toast.success(`Detected ${extracted.length} transactions from PDF`);
  }, [pdfAnalysisData, pdfAnalyzeLoading]);

  useEffect(() => {
    if (!importResult?.success || importLoading) return;
    toast.success(`Imported ${importResult.data.count} transactions successfully`);
    router.push(`/account/${importResult.data.accountId}`);
  }, [importResult, importLoading, router]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900 dark:bg-sky-950/20">
        <h2 className="mb-3 text-base font-semibold text-sky-900 dark:text-sky-100">
          Upload Bank Statement PDF
        </h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Statement PDF</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex h-10 w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-sm shadow-sm">
                <Upload className="mr-2 h-4 w-4" />
                {statementPdf?.name || "Choose PDF file"}
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf,.pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setStatementPdf(file);
                  }}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                className="sm:w-56"
                onClick={handleAnalyzePdf}
                disabled={pdfAnalyzeLoading}
              >
                {pdfAnalyzeLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing PDF...
                  </>
                ) : (
                  <>
                    <FileUp className="mr-2 h-4 w-4" />
                    Analyze PDF
                  </>
                )}
              </Button>
            </div>
          </div>

          {pdfTransactions.length > 0 && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Select Account for Import
                  </label>
                  <Select
                    value={selectedAccountId}
                    onValueChange={setSelectedAccountId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} (Rs.{parseFloat(account.balance).toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    className="w-full"
                    onClick={handleImportPdfTransactions}
                    disabled={importLoading}
                  >
                    {importLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      `Add ${pdfTransactions.length} Transactions`
                    )}
                  </Button>
                </div>
              </div>

              <div className="max-h-64 overflow-auto rounded-md border bg-background">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-left">Amount</th>
                      <th className="p-2 text-left">Category</th>
                      <th className="p-2 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pdfTransactions.map((tx, index) => (
                      <tr key={`${tx.date}-${tx.amount}-${index}`} className="border-t">
                        <td className="p-2">{format(new Date(tx.date), "yyyy-MM-dd")}</td>
                        <td className="p-2">{tx.type}</td>
                        <td className="p-2">Rs.{Number(tx.amount).toFixed(2)}</td>
                        <td className="p-2">{tx.category}</td>
                        <td className="p-2">{tx.description || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Bank Statement</label>
        <textarea
          value={statement}
          onChange={(event) => setStatement(event.target.value)}
          rows={5}
          placeholder="Paste transaction statement from your bank SMS/email..."
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-11 border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 font-semibold text-sky-900 hover:from-sky-100 hover:to-cyan-100 dark:border-sky-800 dark:from-sky-950/40 dark:to-cyan-950/40 dark:text-sky-100 dark:hover:from-sky-900/50 dark:hover:to-cyan-900/50"
        onClick={handleAnalyze}
        disabled={statementAnalyzeLoading}
      >
        {statementAnalyzeLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-sky-700 dark:text-sky-300" />
            Analyzing Statement...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4 text-sky-700 dark:text-sky-300" />
            Analyze Statement
          </>
        )}
      </Button>

      <AddTransactionForm
        key={formKey}
        accounts={accounts}
        categories={categories}
        createDefaults={analysisData}
        showReceiptScanner={false}
      />
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  X as XIcon,
  MessageSquare as MessageIcon,
  History as HistoryIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Plus as PlusIcon,
} from "lucide-react";

const CATEGORY_COLORS = {
  Budget: "bg-blue-100 text-blue-700",
  Spending: "bg-rose-100 text-rose-700",
  "Income & Savings": "bg-emerald-100 text-emerald-700",
  Goals: "bg-violet-100 text-violet-700",
  Investments: "bg-amber-100 text-amber-800",
  Reports: "bg-cyan-100 text-cyan-700",
  Categorization: "bg-fuchsia-100 text-fuchsia-700",
  Accounts: "bg-indigo-100 text-indigo-700",
  General: "bg-slate-100 text-slate-700",
};

const GREETING = {
  id: "greeting",
  role: "assistant",
  content: "Hi! I'm FinGen Assistant. Ask about your spending or goals.",
};

function detectMessageCategory(text) {
  const lc = (text || "").toLowerCase();
  if (/\b(budget|budget plan|overspend|monthly budget)\b/.test(lc)) {
    return "Budget";
  }
  if (/\b(expense|expenses|spending|category|categories)\b/.test(lc)) {
    return "Spending";
  }
  if (/\b(income|salary|earn|earnings|cash flow|cashflow|savings)\b/.test(lc)) {
    return "Income & Savings";
  }
  if (/\b(goal|goals|target|contribution|timeline)\b/.test(lc)) {
    return "Goals";
  }
  if (/\b(invest|investment|portfolio|stock|mutual fund)\b/.test(lc)) {
    return "Investments";
  }
  if (/\b(report|pdf|export|download)\b/.test(lc)) {
    return "Reports";
  }
  if (/\b(categorize|auto[-\s]?categorize|rule)\b/.test(lc)) {
    return "Categorization";
  }
  if (/\b(account|balance|transfer)\b/.test(lc)) {
    return "Accounts";
  }
  return "General";
}

export default function ChatLauncher() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState([GREETING]);

  const panelRef = useRef(null);
  const btnRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (!open) return;
      const panel = panelRef.current;
      const btn = btnRef.current;
      if (
        panel &&
        !panel.contains(e.target) &&
        btn &&
        !btn.contains(e.target)
      ) {
        setOpen(false);
      }
    }

    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  async function loadHistory(targetSessionId = null) {
    if (loadingHistory) return;
    setLoadingHistory(true);
    try {
      const qs = targetSessionId
        ? `?sessionId=${encodeURIComponent(targetSessionId)}`
        : "";
      const res = await fetch(`/api/chat/history${qs}`);
      if (!res.ok) return;
      const data = await res.json();

      const nextSessions = Array.isArray(data?.sessions) ? data.sessions : [];
      setSessions(nextSessions);
      setCurrentSessionId(data?.activeSessionId || null);

      if (Array.isArray(data?.messages) && data.messages.length > 0) {
        setMessages(
          data.messages.map((m) => ({
            id: m.id || Date.now(),
            role: m.role,
            content: m.content,
          })),
        );
      } else {
        setMessages([GREETING]);
      }
    } catch (err) {
      // keep default greeting if history fails
    } finally {
      setHistoryLoaded(true);
      setLoadingHistory(false);
    }
  }

  async function createNewChat() {
    try {
      const res = await fetch("/api/chat/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (!res.ok) {
        const raw = await res.text();
        throw new Error(raw || "Failed to create chat");
      }
      const data = await res.json();
      const session = data?.session;
      if (!session?.id) throw new Error("Invalid session response");

      setCurrentSessionId(session.id);
      setSessions((prev) => [session, ...prev]);
      setMessages([GREETING]);
      setShowHistory(false);
      setError("");
    } catch (err) {
      setError(err?.message || "Failed to create new chat");
    }
  }

  async function ensureSession() {
    if (currentSessionId) return currentSessionId;
    const res = await fetch("/api/chat/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Chat" }),
    });
    if (!res.ok) throw new Error("Failed to create chat session");
    const data = await res.json();
    const session = data?.session;
    if (!session?.id) throw new Error("Invalid chat session");
    setCurrentSessionId(session.id);
    setSessions((prev) => [session, ...prev]);
    return session.id;
  }

  async function openSession(sessionId) {
    await loadHistory(sessionId);
    setShowHistory(false);
  }

  useEffect(() => {
    if (!open || historyLoaded) return;
    loadHistory();
  }, [open, historyLoaded]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript)
        .join(" ");
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, []);

  function toggleListening() {
    if (!recognitionRef.current) {
      setError("Voice recognition is not supported in this browser.");
      return;
    }
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    setError("");
    setListening(true);
    recognitionRef.current.start();
  }

  useEffect(() => {
    if (!open) return;
    const el = messagesEndRef.current;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  async function handleSend(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setError("");

    const userMsg = { id: Date.now(), role: "user", content: text };
    const tempId = Date.now() + 1;
    const tempMsg = {
      id: tempId,
      role: "assistant",
      content: "Thinking...",
      temp: true,
    };

    const nextMessages = [...messages, userMsg, tempMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const sessionId = await ensureSession();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: nextMessages
            .filter((m) => !m.temp)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const raw = await res.text();
        throw new Error(raw || "Request failed");
      }

      const data = await res.json();
      const reply = data?.reply || "Sorry, I could not generate a response.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, content: reply, temp: false } : m,
        ),
      );
      loadHistory(sessionId);
    } catch (err) {
      const message =
        err?.message?.includes("Unauthorized") || err?.message?.includes("401")
          ? "Please sign in to use the assistant."
          : err?.message || "Something went wrong. Please try again.";
      setError(message);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        ref={panelRef}
        className={`fixed right-4 bottom-20 z-50 transition-all duration-200 ease-out transform ${
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={{ width: 360, maxWidth: "90vw" }}
        aria-hidden={!open}
      >
        <div className="bg-white dark:bg-[#0b1220] rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <MessageIcon className="w-5 h-5 text-blue-600" />
              <div className="text-sm font-medium">
                {showHistory ? "Chat Sessions" : "FinGen Assistant"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={createNewChat}
                aria-label="Create new chat"
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-900"
                title="New Chat"
              >
                <PlusIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </button>
              <button
                onClick={async () => {
                  await loadHistory();
                  setShowHistory((v) => !v);
                }}
                aria-label="Show chat sessions"
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-60"
                disabled={loadingHistory}
                title={showHistory ? "Back to chat" : "Session history"}
              >
                <HistoryIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-900"
              >
                <XIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </button>
            </div>
          </div>

          <div
            className="p-4 flex-1 flex flex-col min-h-0"
            style={{ minHeight: 220, maxHeight: "70vh" }}
          >
            {showHistory ? (
              <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-2">
                {loadingHistory ? (
                  <div className="text-xs text-slate-500">Loading sessions...</div>
                ) : sessions.length === 0 ? (
                  <div className="text-xs text-slate-500">No sessions found.</div>
                ) : (
                  sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => openSession(session.id)}
                      className={`w-full rounded-lg border p-2 text-left transition-colors ${
                        currentSessionId === session.id
                          ? "border-blue-300 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-950/30"
                          : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                      }`}
                    >
                      <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                        {session.title || "New Chat"}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        {new Date(session.updatedAt).toLocaleString()} •{" "}
                        {session.messageCount || 0} messages
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] break-words px-3 py-2 rounded-lg text-sm ${
                          m.role === "user"
                            ? "bg-blue-600 text-white rounded-br-none"
                            : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 rounded-bl-none whitespace-pre-line"
                        }`}
                      >
                        {m.role === "assistant" ? (
                          <div className="mb-1">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${CATEGORY_COLORS[detectMessageCategory(m.content)] || CATEGORY_COLORS.General}`}
                            >
                              {detectMessageCategory(m.content)}
                            </span>
                          </div>
                        ) : null}
                        {m.role === "assistant" && m.content.includes("[DOWNLOAD:")
                          ? (() => {
                              const match = m.content.match(/\[DOWNLOAD:(.+?)\]/);
                              const url = match ? match[1] : "";
                              const text = m.content
                                .replace(/\[DOWNLOAD:.+?\]/, "")
                                .trim();
                              return (
                                <>
                                  <div>{text}</div>
                                  {url ? (
                                    <a
                                      href={url}
                                      className="inline-block mt-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm"
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Download Report
                                    </a>
                                  ) : null}
                                </>
                              );
                            })()
                          : m.content}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSend} className="mt-3">
                  {error ? (
                    <div className="mb-2 text-xs text-red-600">{error}</div>
                  ) : null}
                  <div className="flex gap-2 items-center">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Type your message"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={toggleListening}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-60"
                      aria-label="Voice input"
                      disabled={loading}
                      title={listening ? "Stop recording" : "Start voice input"}
                    >
                      {listening ? (
                        <MicOffIcon className="w-4 h-4" />
                      ) : (
                        <MicIcon className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-60"
                      aria-label="Send message"
                      disabled={loading}
                    >
                      {loading ? "Sending..." : "Send"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="fixed right-4 bottom-4 z-50">
        <button
          ref={btnRef}
          onClick={() => setOpen((s) => !s)}
          aria-expanded={open}
          aria-label="Open chat"
          className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-2xl hover:scale-[1.03] active:scale-95 transition-transform focus:outline-none flex items-center justify-center"
        >
          <MessageIcon className="w-6 h-6" />
        </button>
      </div>
    </>
  );
}

"use client";
import React, { useState, useRef, useEffect } from "react";

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select...",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef();

  useEffect(() => {
    function onDoc(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const q = (query || "").toString().toLowerCase();
  const opts = options || [];
  const emptyOptLabel = (opts.find((o) => o && o.value === "")?.label || "")
    .toString()
    .toLowerCase();
  const filtered =
    q === "" || q === emptyOptLabel
      ? opts
      : opts.filter((o) => {
          const label = (o?.label ?? "").toString().toLowerCase();
          return label.includes(q);
        });

  useEffect(() => {
    // keep query synced to selected value label
    const opts = options || [];
    const selected = opts.find((o) => o.value === value);
    if (selected && selected.label) {
      setQuery(String(selected.label));
      return;
    }

    // if nothing selected, prefer an explicit empty-value option ("All...") or first option
    const emptyOpt = opts.find((o) => o.value === "");
    const fallback = emptyOpt || opts[0];
    setQuery(fallback && fallback.label ? String(fallback.label) : "");
  }, [value, options]);

  return (
    <div className="relative" ref={ref}>
      <input
        className="border p-1 rounded w-full"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border-border rounded max-h-48 overflow-auto">
          {filtered.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground">No results</div>
          )}
          {filtered.map((o) => (
            <div
              key={o.value}
              className="p-2 hover:bg-border cursor-pointer"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [os, setOs] = useState<"windows" | "macos" | "unknown">("unknown");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) setOs("windows");
    else if (ua.includes("mac")) setOs("macos");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === "loading") return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, os }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Could not join the waitlist.");
      } else {
        setStatus("success");
        setMessage(data.message || "You're on the waitlist!");
        setEmail("");
      }
    } catch {
      setStatus("error");
      setMessage("Connection failed. Please try again.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
        />
        <select
          value={os}
          onChange={(e) => setOs(e.target.value as "windows" | "macos" | "unknown")}
          aria-label="Operating system"
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-300 focus:border-indigo-500 focus:outline-none"
        >
          <option value="windows">Windows</option>
          <option value="macos">macOS</option>
          <option value="unknown">Both</option>
        </select>
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {status === "loading" ? "Joining…" : "Join waitlist"}
        </button>
      </div>

      {message && (
        <p
          className={`text-xs font-medium ${
            status === "error" ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}

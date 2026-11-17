"use client";

import { useEffect, useState } from "react";

type OS = "macos" | "windows";

const MAC_URL = process.env.NEXT_PUBLIC_DOWNLOAD_MAC || "#waitlist";
const WIN_URL = process.env.NEXT_PUBLIC_DOWNLOAD_WIN || "#waitlist";

export default function DownloadButtons() {
  const [os, setOs] = useState<OS>("macos");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) {
      setOs("windows");
    } else if (ua.includes("mac")) {
      setOs("macos");
    }
  }, []);

  const primary =
    os === "windows"
      ? {
          label: "Download for Windows",
          sub: "Windows 10/11 · .exe / .msi",
          href: WIN_URL,
          secondaryLabel: "Also available for macOS (.dmg)",
          secondaryHref: MAC_URL,
        }
      : {
          label: "Download for macOS",
          sub: "Apple Silicon & Intel · .dmg",
          href: MAC_URL,
          secondaryLabel: "Also available for Windows (.exe)",
          secondaryHref: WIN_URL,
        };

  return (
    <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:items-center">
      <a
        href={primary.href}
        className="inline-flex items-center gap-3 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
      >
        <span>{primary.label}</span>
        <span className="rounded bg-indigo-700/80 px-2 py-0.5 text-[11px] font-normal text-indigo-100">
          {primary.sub}
        </span>
      </a>
      <a
        href={primary.secondaryHref}
        className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
      >
        {primary.secondaryLabel}
      </a>
    </div>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stackly — Paste the error. Understand in 3 seconds.",
  description:
    "Desktop app for Windows and macOS that diagnoses errors and stack traces from your menu bar or system tray, with local secret sanitization, bug memory, and your own API key or Ollama.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}

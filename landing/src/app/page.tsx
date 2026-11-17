import DemoPreview from "@/components/DemoPreview";
import DownloadButtons from "@/components/DownloadButtons";
import WaitlistForm from "@/components/WaitlistForm";

const STEPS = [
  {
    step: "01",
    title: "Hit the shortcut or tray icon",
    desc: "Summon Stackly from anywhere with ⌘⇧E on Mac or Ctrl+Shift+E on Windows. It floats right above your editor or terminal without hogging memory.",
  },
  {
    step: "02",
    title: "Automatic local sanitization",
    desc: "Before a single byte leaves your machine, tokens, passwords, emails, IPs, URL credentials, and .env values are masked locally using regex + entropy.",
  },
  {
    step: "03",
    title: "Structured diagnosis in cards",
    desc: "Stackly detects the stack (Node, Python, Prisma, Docker, Postgres, Next.js, GitHub Actions) and streams probable cause, where to look, steps, and copyable commands.",
  },
];

const FAQS = [
  {
    q: "Do my API keys or code secrets pass through Stackly servers?",
    a: "Never. Stackly talks directly from your machine to OpenAI, Anthropic, or your local Ollama instance. API keys live in macOS Keychain or Windows Credential Manager — never in plain text and never on our servers.",
  },
  {
    q: "How does the sanitizer prevent leaks?",
    a: "Beyond patterns for JWTs, private keys, API tokens (sk-, ghp_, AKIA…), URL credentials, emails, IPs, and .env lines, it computes Shannon entropy to catch random secrets. You can preview the exact masked payload before clicking Analyze.",
  },
  {
    q: "Do I still need an OpenAI or Anthropic key with Pro?",
    a: "You bring your own API key (paying pennies directly to the provider) or run 100% free and offline with Ollama. Pro ($2.99/mo) unlocks unlimited daily analyses, full history, bug memory, and the global shortcut.",
  },
  {
    q: "Does Stackly work offline?",
    a: "Yes. With local Ollama and a 7-day offline license cache on Pro, you can diagnose errors and search your bug memory even on a plane.",
  },
  {
    q: "Is there a Linux version?",
    a: "No. Stackly is built specifically for macOS (menu bar app, no Dock icon) and Windows (system tray next to the clock).",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 font-mono text-xs font-bold text-white">
              S
            </span>
            <span className="font-semibold tracking-tight">Stackly</span>
          </a>

          <nav className="hidden items-center gap-6 text-xs text-zinc-400 md:flex">
            <a href="#how-it-works" className="hover:text-zinc-100">
              How it works
            </a>
            <a href="#privacy" className="hover:text-zinc-100">
              Privacy
            </a>
            <a href="#bug-memory" className="hover:text-zinc-100">
              Bug memory
            </a>
            <a href="#pricing" className="hover:text-zinc-100">
              Pricing
            </a>
            <a href="#faq" className="hover:text-zinc-100">
              FAQ
            </a>
          </nav>

          <a
            href="#waitlist"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800"
          >
            Join waitlist
          </a>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pt-16 pb-20 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Windows & macOS · Native Tauri 2
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Paste the error. Understand in 3 seconds.
            </h1>

            <p className="text-base leading-relaxed text-zinc-400">
              Stop pasting raw stack traces into browser tabs. Stackly lives in your menu bar,
              masks secrets locally, remembers bugs you&apos;ve already solved, and streams the root
              cause in clean cards.
            </p>

            <DownloadButtons />

            <p className="text-xs text-zinc-500">
              Free up to 5 analyses/day · Bring your own OpenAI, Anthropic, or local Ollama model.
            </p>
          </div>

          <div className="lg:col-span-7">
            <DemoPreview />
          </div>
        </section>

        {/* How it works (3 steps) */}
        <section id="how-it-works" className="border-t border-zinc-900 bg-zinc-950 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-xl space-y-2">
              <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase">
                How it works
              </span>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                From broken terminal to working fix in three steps
              </h2>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {STEPS.map((s) => (
                <div
                  key={s.step}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
                >
                  <span className="font-mono text-xs font-semibold text-indigo-400">{s.step}</span>
                  <h3 className="mt-3 text-base font-semibold text-zinc-100">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="border-t border-zinc-900 py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-2">
            <div className="space-y-4">
              <span className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
                Privacy by default
              </span>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Your secrets never leave your machine
              </h2>
              <p className="text-sm leading-relaxed text-zinc-400">
                Production and CI logs are full of connection strings, JWTs, internal IPs, and API
                keys. Stackly&apos;s sanitizer runs locally before any request and shows you the
                exact masked payload.
              </p>
              <ul className="space-y-2.5 text-sm text-zinc-300">
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-emerald-400">✓</span>
                  <span>
                    <strong>Regex + Shannon entropy:</strong> catches known tokens, passwords,
                    emails, IPs, URL credentials, and <code className="text-zinc-200">.env</code>{" "}
                    values.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-emerald-400">✓</span>
                  <span>
                    <strong>Your own API key in OS keychain:</strong> stored in macOS Keychain or
                    Windows Credential Manager — never in plain text.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-emerald-400">✓</span>
                  <span>
                    <strong>100% offline with Ollama:</strong> point to{" "}
                    <code className="text-zinc-200">localhost:11434</code> and nothing ever leaves
                    your computer.
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 font-mono text-xs leading-relaxed">
              <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-2 text-[11px] text-zinc-400">
                <span>Exact outgoing payload</span>
                <span className="text-amber-300">4 items masked</span>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap text-zinc-300">
                {`OPENAI_API_KEY=`}
                <mark className="rounded bg-amber-900/60 px-1 text-amber-200">[SECRET_1]</mark>
                {`\nDATABASE_URL=postgres://`}
                <mark className="rounded bg-amber-900/60 px-1 text-amber-200">[URL_CREDENTIALS_1]</mark>
                {`@`}
                <mark className="rounded bg-amber-900/60 px-1 text-amber-200">[IP_1]</mark>
                {`:5432/app\nAuth failed for user `}
                <mark className="rounded bg-amber-900/60 px-1 text-amber-200">[EMAIL_1]</mark>
              </pre>
            </div>
          </div>
        </section>

        {/* Bug memory */}
        <section id="bug-memory" className="border-t border-zinc-900 bg-zinc-900/30 py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-2">
            <div className="order-2 rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-5 lg:order-1">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
                <span>You already solved this error on 11/03 — here is how:</span>
                <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px]">
                  94% match
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-white">
                Hydration failed due to timezone-dependent date formatting
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                Move `toLocaleDateString()` into `useEffect` or pass an explicit `timeZone: &quot;UTC&quot;`
                on both server and client.
              </p>
              <div className="mt-4 flex gap-2 text-xs">
                <span className="rounded-lg bg-emerald-600 px-3 py-1 font-medium text-white">
                  View full solution
                </span>
                <span className="rounded-lg border border-emerald-800 px-3 py-1 text-emerald-200">
                  Saved 1 AI call
                </span>
              </div>
            </div>

            <div className="order-1 space-y-4 lg:order-2">
              <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase">
                Bug memory (local SQLite)
              </span>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Never pay tokens twice for the same bug
              </h2>
              <p className="text-sm leading-relaxed text-zinc-400">
                Every analysis is saved in local SQLite with project tags and 👍/👎 feedback. Stackly
                builds a normalized signature — stripping paths, line numbers, and hashes — and runs
                trigram matching before calling the AI.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-zinc-900 py-20">
          <div className="mx-auto max-w-4xl px-6">
            <div className="text-center">
              <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase">
                Simple pricing
              </span>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Start free. Go Pro for less than a coffee.
              </h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                <div>
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-lg font-semibold">Free</h3>
                    <span className="text-2xl font-bold">$0</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">For everyday quick checks.</p>
                  <ul className="mt-6 space-y-2.5 text-sm text-zinc-300">
                    <li>• 5 analyses per day</li>
                    <li>• Last 7 days of history</li>
                    <li>• Full local secret sanitizer</li>
                    <li>• OpenAI, Anthropic, or local Ollama</li>
                  </ul>
                </div>
                <a
                  href="#waitlist"
                  className="mt-8 block rounded-xl border border-zinc-700 py-2.5 text-center text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
                >
                  Get free access
                </a>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-indigo-500 bg-zinc-900 p-6">
                <div>
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-lg font-semibold text-indigo-300">Pro</h3>
                    <div>
                      <span className="text-2xl font-bold text-white">$2.99</span>
                      <span className="text-xs text-zinc-400">/mo</span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    Checkout via Stripe (Stripe Tax included) · 7-day offline cache.
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm text-zinc-200">
                    <li>✓ Unlimited analyses</li>
                    <li>✓ Full searchable history</li>
                    <li>✓ Bug memory with trigram matching</li>
                    <li>✓ Global shortcut (⌘⇧E / Ctrl+Shift+E)</li>
                  </ul>
                </div>
                <a
                  href="#waitlist"
                  className="mt-8 block rounded-xl bg-indigo-600 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  Join Pro waitlist
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Waitlist */}
        <section id="waitlist" className="border-t border-zinc-900 bg-zinc-900/40 py-20">
          <div className="mx-auto max-w-xl px-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Join the waitlist
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Get the download link as soon as the first public release ships for Windows and
              macOS. No spam.
            </p>
            <div className="mt-6 text-left">
              <WaitlistForm />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-zinc-900 py-20">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Frequently asked questions
            </h2>
            <div className="mt-8 divide-y divide-zinc-800 border-y border-zinc-800">
              {FAQS.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-zinc-100">
                    <span>{item.q}</span>
                    <span className="ml-4 text-zinc-500 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-900 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-zinc-500 sm:flex-row">
          <span>Stackly · Built for Windows and macOS</span>
          <span>Local-first privacy · Zero code telemetry</span>
        </div>
      </footer>
    </div>
  );
}

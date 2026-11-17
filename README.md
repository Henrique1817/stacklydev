# Stackly

**Paste the error. Understand in 3 seconds.**

Stackly is a lightweight, native desktop assistant for **Windows** and **macOS** that lives in your system tray / menu bar and turns raw stack traces, build failures, and CI logs into clear, actionable diagnoses.

---

## What Problem Does It Solve?

When something breaks in your terminal or CI, the usual workflow is slow and risky:
1. You copy a messy log and switch to a browser tab.
2. You accidentally paste `.env` secrets, database URLs, JWTs, or internal IPs into a third-party chat.
3. You read walls of markdown instead of a direct answer.
4. Next week, the same bug happens again and you waste time and API tokens solving it from scratch.

**Stackly fixes all four:**
- **Instant access:** summon it from anywhere with a global shortcut (`Cmd+Shift+E` / `Ctrl+Shift+E`) or click the tray icon.
- **Privacy first:** a local sanitizer masks tokens, passwords, emails, IPs, URL credentials, and `.env` values *before* anything leaves your machine — and shows you the exact outgoing payload.
- **Bring Your Own Key (or run 100% offline):** connect your own OpenAI or Anthropic key (stored in macOS Keychain / Windows Credential Manager, never in plain text) or point to a local **Ollama** model.
- **Structured answers, streamed live:** detects the error stack (Node/TypeScript, Python, Prisma, Docker, PostgreSQL, Next.js, GitHub Actions) and streams JSON cards with *Probable cause*, *Where to look*, *Steps to fix*, and copyable commands/code.
- **Bug memory:** saves analyses in local SQLite with project tags and 👍/👎 feedback, generating a normalized signature (stripping paths, line numbers, and hashes) and matching similar past errors via trigrams *before* calling the AI.

---

## Plans

| Feature | Free ($0) | Pro ($2.99/mo via Stripe) |
|---|---|---|
| Daily analyses | 5 / day | Unlimited |
| History | Last 7 days | Full searchable history |
| Local secret sanitizer & BYOK / Ollama | Included | Included |
| Bug memory (trigram matching) | — | Included |
| Global shortcut (`⌘⇧E` / `Ctrl+Shift+E`) | — | Included |
| Offline license cache | — | 7 days |

---

## Platform Behavior (Windows & macOS)

| | Windows | macOS |
|---|---|---|
| Icon | System tray (next to the clock) | Menu bar (*template* icon, adapts to light/dark) |
| Dock / Taskbar | Window appears normally when open | No Dock icon (`ActivationPolicy::Accessory`) |
| Left-click icon | Toggles main window | Opens menu |
| Tray menu | Open · Settings · Start with Windows · Quit | Open · Settings · Launch at login · Quit |
| Global shortcut (Pro) | `Ctrl+Shift+E` | `Cmd+Shift+E` |

Closing the window hides it to the tray; the app only exits when you click **Quit**.

> Linux is intentionally unsupported (`compile_error!` at build time).

---

## Tech Stack

- **Desktop App:** Tauri 2 (Rust) + React 19 + TypeScript + Vite + Tailwind CSS v4
- **Local Storage & Security:** SQLite (`rusqlite` bundled), OS Keychain (`keyring`), streaming HTTP (`reqwest`)
- **Landing Page & APIs (`landing/`):** Next.js 15 + Tailwind CSS v4 (Vercel), Supabase (waitlist), Stripe (Pro subscriptions & Stripe Tax)

---

## Local Development

### Prerequisites

- Node.js 20+
- Rust (stable) — https://rustup.rs
- **Windows:** Microsoft C++ Build Tools (*Desktop development with C++*) and WebView2 (pre-installed on Windows 10/11)
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)

### Commands

```bash
npm install
npm run tauri dev      # start desktop app in dev mode
npm run tauri build    # build installers: .exe/.msi (Windows) or .app/.dmg (macOS)
npm run build          # typecheck + build frontend only
npm run icons          # regenerate icons from app-icon.svg, tray-icon.svg, tray-template.svg
```

---

## Build, Signing & Auto-Update (GitHub Actions)

The workflow [release.yml](.github/workflows/release.yml) builds:
- **macOS:** universal `.dmg` (`universal-apple-darwin` = Apple Silicon + Intel), signed and notarized.
- **Windows:** `.exe` (NSIS) and `.msi` installers.
- **Auto-update:** `latest.json` and `.sig` files published to GitHub Releases.

### 1. Tauri Auto-Updater Keys (Required)

Generate a signing keypair locally:

```bash
npx tauri signer generate -w ~/.tauri/stackly.key
```

1. Paste the generated **public key** into `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.
2. Update `plugins.updater.endpoints` in `src-tauri/tauri.conf.json` with your GitHub repository:
   ```json
   "https://github.com/YOUR_USER/stackly/releases/latest/download/latest.json"
   ```
3. Add these **Repository Secrets** on GitHub (*Settings → Secrets and variables → Actions*):
   - `TAURI_SIGNING_PRIVATE_KEY`: full contents of `~/.tauri/stackly.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: key password (or empty if none)

### 2. macOS Signing & Notarization

1. Create a **Developer ID Application** certificate in the [Apple Developer Portal](https://developer.apple.com/account/resources/certificates/list) and install it in **Keychain Access**.
2. Export the certificate + private key as a `.p12` file with a password.
3. Base64-encode the `.p12`:
   ```bash
   base64 -i Certificate.p12 | pbcopy
   ```
4. Create an **App-Specific Password** at [account.apple.com](https://account.apple.com).
5. Add these GitHub Secrets:
   - `APPLE_CERTIFICATE`: base64 string of `.p12`
   - `APPLE_CERTIFICATE_PASSWORD`: password used when exporting `.p12`
   - `APPLE_ID`: Apple Developer account email
   - `APPLE_TEAM_ID`: 10-character Team ID
   - `APPLE_PASSWORD`: App-Specific Password

### 3. Windows Code Signing (Optional)

If you have an Authenticode `.pfx` certificate:

1. Base64-encode the `.pfx` in PowerShell:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | Set-Clipboard
   ```
2. Add these GitHub Secrets:
   - `WINDOWS_CERTIFICATE`: base64 string of `.pfx`
   - `WINDOWS_CERTIFICATE_PASSWORD`: `.pfx` password

If these two secrets are omitted, the workflow skips Authenticode signing and still builds `.exe` and `.msi` installers.

### 4. Publishing a Release

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow creates a **Draft Release** on GitHub with installers, `.sig` files, and `latest.json`. Review and click **Publish release**.

---

## Project Structure

```text
src/                  React frontend (Analyze, History, Upgrade, Settings)
src-tauri/src/        Rust backend (tray, AI streaming, keychain, SQLite, Stripe billing, updater)
landing/              Next.js 15 + Tailwind landing page, Stripe license API & Supabase waitlist
.github/workflows/    CI/CD release workflow for Windows and macOS
```

# Stackly

App desktop para **Windows** e **macOS** feito com Tauri 2 + React + TypeScript + Vite + Tailwind CSS v4.

| | Windows | macOS |
|---|---|---|
| Ícone | Bandeja do sistema (ao lado do relógio) | Barra de menu (ícone *template*) |
| Dock / barra de tarefas | Janela aparece normalmente quando aberta | Sem ícone no Dock (`ActivationPolicy::Accessory`) |
| Clique esquerdo no ícone | Mostra/esconde a janela | Abre o menu |
| Menu | Abrir · Configurações · Iniciar com o Windows · Sair | Abrir · Configurações · Abrir ao iniciar sessão · Sair |
| Atalho global (Pro) | `Ctrl+Shift+E` | `Cmd+Shift+E` |

> Linux não é suportado: a compilação falha propositalmente com `compile_error!`.

## Pré-requisitos (desenvolvimento local)

- Node.js 20+
- Rust (stable) — https://rustup.rs
- **Windows:** Microsoft C++ Build Tools ("Desenvolvimento para desktop com C++") e WebView2 (já vem no Windows 10/11)
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)

## Comandos

```bash
npm install
npm run tauri dev      # desenvolvimento
npm run tauri build    # instaladores: .msi/.exe (Windows) ou .app/.dmg (macOS)
npm run icons          # regenera ícones a partir de app-icon.svg, tray-icon.svg e tray-template.svg
```

---

## Build, Assinatura e Auto-Update (GitHub Actions)

O workflow [release.yml](.github/workflows/release.yml) gera automaticamente:
- **macOS:** `.dmg` universal (`universal-apple-darwin` = Apple Silicon + Intel), assinado e notarizado.
- **Windows:** instaladores `.exe` (NSIS) e `.msi`.
- **Auto-update:** `latest.json` e arquivos `.sig` publicados no GitHub Releases.

### 1. Chaves do Tauri Auto-Updater (obrigatório)

Gere um par de chaves localmente:

```bash
npx tauri signer generate -w ~/.tauri/stackly.key
```

1. Copie a **chave pública** exibida no terminal e cole em `plugins.updater.pubkey` no arquivo `src-tauri/tauri.conf.json`.
2. Atualize `plugins.updater.endpoints` em `src-tauri/tauri.conf.json` com o seu usuário/organização do GitHub:
   ```json
   "https://github.com/SEU_USUARIO/stackly/releases/latest/download/latest.json"
   ```
3. Nos **Secrets** do repositório GitHub (*Settings → Secrets and variables → Actions*), adicione:
   - `TAURI_SIGNING_PRIVATE_KEY`: conteúdo completo do arquivo `~/.tauri/stackly.key`.
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: senha definida ao gerar a chave (ou vazio se não colocou senha).

### 2. Certificado e Notarização do macOS

1. No portal [Apple Developer](https://developer.apple.com/account/resources/certificates/list), crie um certificado **Developer ID Application** e instale no **Acesso às Chaves (Keychain Access)** do seu Mac.
2. No Keychain Access, clique com o botão direito no certificado (+ chave privada) → **Exportar** como `.p12` com uma senha.
3. Converta o `.p12` para base64 no terminal do Mac:
   ```bash
   base64 -i Certificado.p12 | pbcopy
   ```
4. Crie uma **Senha específica para app (App-Specific Password)** em [account.apple.com](https://account.apple.com) (Segurança → Senhas de apps).
5. Adicione os secrets no GitHub:
   - `APPLE_CERTIFICATE`: string base64 do `.p12`.
   - `APPLE_CERTIFICATE_PASSWORD`: senha usada ao exportar o `.p12`.
   - `APPLE_ID`: e-mail da sua conta Apple Developer.
   - `APPLE_TEAM_ID`: Team ID de 10 caracteres (visível em *Membership* no portal da Apple).
   - `APPLE_PASSWORD`: App-Specific Password gerada no passo 4.

### 3. Assinatura de código no Windows (opcional)

Se você tiver um certificado Authenticode (`.pfx`):

1. Converta o `.pfx` para base64 no PowerShell:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("certificado.pfx")) | Set-Clipboard
   ```
2. Adicione os secrets no GitHub:
   - `WINDOWS_CERTIFICATE`: string base64 do `.pfx`.
   - `WINDOWS_CERTIFICATE_PASSWORD`: senha do `.pfx`.

Se esses dois secrets não estiverem configurados, o workflow ignora a assinatura Authenticode e gera o `.exe` e `.msi` normalmente.

### 4. Como publicar um release

```bash
git tag v0.1.0
git push origin v0.1.0
```

O workflow cria um **Draft Release** no GitHub com todos os instaladores, `.sig` e `latest.json`. Revise e clique em **Publish release**.

---

## Estrutura

```
src/                  Frontend React (Analisar, Histórico, Upgrade, Configurações)
src-tauri/src/        Backend Rust (bandeja, AI streaming, keychain, SQLite, Lemon Squeezy, updater)
landing/              Landing page em Next.js 15 + Tailwind + Supabase (deploy na Vercel)
.github/workflows/    CI/CD de release para Windows e macOS
```

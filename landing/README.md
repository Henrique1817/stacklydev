# Stackly Landing Page

Landing page do Stackly em **Next.js 15 + Tailwind CSS v4**, pronta para deploy na **Vercel** com lista de espera no **Supabase**.

## Setup local

```bash
cd landing
npm install
cp .env.example .env.local
npm run dev
```

## Supabase (Lista de espera)

1. Rode o SQL de `supabase.sql` no **SQL Editor** do seu projeto Supabase para criar a tabela `public.waitlist`.
2. Configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`) em `.env.local` e nas variáveis de ambiente da Vercel.

## Deploy na Vercel

1. Importe o repositório na Vercel e defina o **Root Directory** como `landing`.
2. Adicione as variáveis do Supabase e da Stripe (`STRIPE_SECRET_KEY` para validar assinaturas em `/api/stripe/license`) e, quando publicar os binários, opcionalmente:
   - `NEXT_PUBLIC_DOWNLOAD_MAC` (link `.dmg`)
   - `NEXT_PUBLIC_DOWNLOAD_WIN` (link `.exe` / `.msi`)


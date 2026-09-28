# Plotras

Spatial land-title verification platform — Next.js 14 (App Router) + Supabase/PostGIS + Mapbox GL + Tailwind + Paystack + pdf-lib.

Built from `PlotrasPRDfile.pdf`. Phase 1, Phase 2, and Phase 3 (everything genuinely buildable without a real government/ML partner) are complete.

## 1. Install

```bash
npm install
```

## 2. Environment variables

Copy the values already in `.env.local` and fill in the placeholders:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Already filled in — the live `plotas` project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Already filled in |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → **plotas** project → Project Settings → API → `service_role` secret |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | [account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens/) |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` / `PAYSTACK_SECRET_KEY` | Paystack Dashboard → Settings → API Keys & Webhooks |
| `REPORT_SIGNING_SECRET` | Any long random string, e.g. `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; your real domain once deployed |

**Never commit `.env.local`** — it's already in `.gitignore`. The two PWA icon files (`public/icons/icon-192.png`, `icon-512.png`) referenced in `public/manifest.json` don't exist yet either — no image-generation tool was available while building this, so you'll need to add your own.

## 3. Run locally

```bash
npm run dev
```

`/` — home · `/map` — parcel map · `/verify` — beacon verification · `/login` `/signup` — auth.

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

Confirm `.env.local` shows as untracked (not staged) before your first commit — `git status` should list it under files git is ignoring, not files to be committed.

## 5. Deploy to Vercel

1. [vercel.com/new](https://vercel.com/new) → import the GitHub repo you just pushed.
2. Vercel auto-detects Next.js — no build config changes needed.
3. Before the first deploy, add every variable from `.env.local` (with real values, not placeholders) under **Project Settings → Environment Variables**.
4. Set `NEXT_PUBLIC_APP_URL` to the real `https://your-project.vercel.app` domain Vercel gives you (or your custom domain) — it's used to build the QR verification links on generated certificates.
5. Once deployed, set the Paystack webhook URL (Paystack Dashboard → Settings → API Keys & Webhooks) to `https://your-domain/api/v1/webhooks/paystack`.

## What's NOT done, on purpose

- **Admin bootstrap** — nobody can become the first `GOVT_ADMIN` without a direct database promotion (role-granting requires an existing admin). Ask for this to be done via SQL against the live Supabase project.
- **PWA icons** — referenced in the manifest, files don't exist.
- **Real pilot government zone data** — `supabase/seed_demo.sql` uses clearly fictional coordinates only; real Lekki Phase 1 / Eti-Osa LGA acquisition-zone data was deliberately not fabricated.
- **mTLS** for bank API auth — that's a load-balancer/API-gateway concern, not application code.
- **Live government registry integration, government webhooks, unmapped-development detection, ground-rent assessment** — all require a real external government partner or ML/remote-sensing pipeline this project doesn't have.

Full build history, every migration applied, and every design decision made along the way is tracked in project memory.

# Driftline

Driftline is a private, installable crypto price-listener. It watches multiple crypto assets and sends browser push notifications when a configured buy or sell line is crossed. It never connects to an exchange or places trades.

## Rules

Each watcher has independent buy and sell rules. A line can be calculated above or below either:

- the coin's all-time high from CoinLore; or
- your recorded purchase price.

The default strategy waits to buy at 40% below ATH and, after you record a purchase, waits to sell at 5% above that purchase price. Alerts are edge-triggered: a crossed line fires once, then waits for you to record the purchase/sale or re-arm it.

Hover or keyboard-focus the ATH marker to load a five-calendar-year table of yearly USD highs and each high's percentage difference from the current price. Annual highs come from Yahoo Finance daily history and are cached in D1 for six hours. Some newly listed or unsupported symbols may have fewer than five years available.

## Local development

Requirements: Node.js 20+, npm, and a Cloudflare account.

```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
npm run check
```

Set `SESSION_SECRET`, Clerk keys, and `ALLOWED_EMAILS` in `.dev.vars`. `ALLOWED_EMAILS` is a comma-separated allowlist of verified emails. Phone sign-in still needs one of those emails on the Clerk user. `.dev.vars` is ignored by Git.

Then run the Worker and the Vite app in two terminals:

```powershell
npm run dev:worker
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). Enable email and phone in the [Clerk Dashboard](https://dashboard.clerk.com/). Add `http://localhost:5173` and `https://driftline.alvinlabrador.dev` as allowed origins.

## Cloudflare deployment

Pushing to `master` deploys production through GitHub Actions. The workflow builds the frontend, applies pending D1 migrations, and runs `wrangler deploy` to [driftline.alvinlabrador.dev](https://driftline.alvinlabrador.dev).

GitHub secrets required:

- `CLOUDFLARE_API_TOKEN` scoped to account `7e7ad11e97950b3eaf40c537fa40a8b5`

The **Edit Cloudflare Workers** template is not enough. D1 migrations need an extra permission. Create or edit the token at [Cloudflare API tokens](https://dash.cloudflare.com/profile/api-tokens) with:

- Account, Cloudflare Workers, Edit
- Account, D1, Edit

Then:

```powershell
gh secret set CLOUDFLARE_API_TOKEN
```

Worker Clerk, allowlist, session, and VAPID secrets stay in the Cloudflare Worker. The workflow does not upload them. Rotate those only when needed:

```powershell
node scripts/configure-secrets.mjs https://driftline.alvinlabrador.dev
```

That script reads Clerk keys from `.env` or `.dev.vars` and uploads them with `wrangler secret put`. It does not rotate VAPID or `SESSION_SECRET`. It only uploads `ALLOWED_EMAILS` when that value is present in those files. You can also set one secret at a time:

```powershell
npx wrangler secret put ALLOWED_EMAILS
```

Manual deploy from this machine still works. This directory is bound to the `crypto-guide` Wrangler auth profile:

```powershell
npx wrangler auth create crypto-guide
npx wrangler auth activate crypto-guide "D:\remote-projects\online-income\crypto-guide"
npx wrangler d1 migrations apply driftline-db --remote
npm run deploy
```

## Market data and scheduling

The Worker cron wakes every five minutes. Each watcher can choose a 5-minute to 24-hour interval. When watchers are due, Driftline gets their prices in one CoinLore request. The first sweep for a new asset also reads its ATH and ATH date from CoinLore's coin-info endpoint; later sweeps keep that value current. Five-year annual-high history is loaded on demand from Yahoo Finance and cached in D1. No market-data account or API key is required.

Browser push requires HTTPS and notification permission. On iPhone/iPad, install the PWA with Safari's **Share → Add to Home Screen**, open the installed app, then enable notifications. Desktop Chromium browsers show an install icon in the address bar.

## Commands

```powershell
npm run check       # TypeScript and tests
npm run build       # Production frontend
npm run deploy:dry  # Build and validate the Worker bundle
npm run deploy      # Manual deploy to the bound Cloudflare account
```

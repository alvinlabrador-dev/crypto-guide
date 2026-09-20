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
npm run build
npm run dev:worker
```

Set a strong `APP_PASSWORD` and a long random `SESSION_SECRET` in `.dev.vars`. The app is then available at the local URL printed by Wrangler. `.dev.vars` is ignored by Git.

## Cloudflare deployment

This directory is bound to the `crypto-guide` Wrangler auth profile. To create or switch that binding later:

```powershell
npx wrangler auth create crypto-guide
npx wrangler auth activate crypto-guide "D:\remote-projects\online-income\crypto-guide"
```

The D1 database and migration are declared in `wrangler.jsonc` and `migrations/`. Deploy with:

```powershell
npx wrangler d1 migrations apply driftline-db --remote
npm run deploy
node scripts/configure-secrets.mjs https://your-live-worker.workers.dev
```

The secret helper reads the password/session values from `.dev.vars`, creates a fresh VAPID key pair, and uploads secrets without printing their values.

## Market data and scheduling

The Worker cron wakes every five minutes. Each watcher can choose a 5-minute to 24-hour interval. When watchers are due, Driftline gets their prices in one CoinLore request. The first sweep for a new asset also reads its ATH and ATH date from CoinLore's coin-info endpoint; later sweeps keep that value current. Five-year annual-high history is loaded on demand from Yahoo Finance and cached in D1. No market-data account or API key is required.

Browser push requires HTTPS and notification permission. On iPhone/iPad, install the PWA with Safari's **Share → Add to Home Screen**, open the installed app, then enable notifications. Desktop Chromium browsers show an install icon in the address bar.

## Commands

```powershell
npm run check       # TypeScript and tests
npm run build       # Production frontend
npm run deploy:dry  # Build and validate the Worker bundle
npm run deploy      # Deploy to the bound Cloudflare account
```

# Driftline

Driftline is a self-hosted, installable crypto price listener. It watches multiple crypto assets and sends browser push notifications when a configured buy or sell line is crossed. It never connects to an exchange or places trades.

Sign-in uses [Clerk](https://clerk.com/). Only verified emails listed in `ALLOWED_EMAILS` can open the app. Each allowlisted email has its own watchers, purchase history, and push subscriptions.

## Rules

Each watcher has independent buy and sell rules. A line can be calculated above or below either:

- the coin's all-time high from CoinLore
- your recorded purchase price

The default strategy waits to buy at 40% below ATH and, after you record a purchase, waits to sell at 5% above that purchase price. Alerts are edge-triggered. A crossed line fires once, then waits for you to record the purchase or sale, or to re-arm it.

Hover or keyboard-focus the ATH marker to load a five-calendar-year table of yearly USD highs and each high's percentage difference from the current price. Annual highs come from Yahoo Finance daily history and are cached in D1 for six hours. Some newly listed or unsupported symbols may have fewer than five years available.

## Local development

Requirements: Node.js 20+, npm, and a Cloudflare account.

```sh
npm install
cp .dev.vars.example .dev.vars
npm run check
```

Set `SESSION_SECRET`, Clerk keys, and `ALLOWED_EMAILS` in `.dev.vars`. `ALLOWED_EMAILS` is a comma-separated allowlist of verified emails. Phone sign-in still needs one of those emails on the Clerk user. `.dev.vars` and `.env` are ignored by Git.

Then run the Worker and the Vite app in two terminals:

```sh
npm run dev:worker
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`. In the Clerk Dashboard, enable the sign-in methods you want and add `http://localhost:5173` plus your production origin as allowed origins.

For a production Clerk instance, Google sign-in needs your own OAuth client. In Clerk, open the Google connection, paste the client ID and secret, and use the authorized redirect URI Clerk shows there. Turn on the account selector if you want Google to ask which account to use.

## Cloudflare deployment

Before the first deploy, put your own values in `wrangler.jsonc`:

- `account_id` for the Cloudflare account that should own the Worker
- the D1 `database_name` and `database_id`
- the custom domain `routes` entry, if you use one

Create the D1 database, then apply migrations:

```sh
npx wrangler d1 create driftline-db
npx wrangler d1 migrations apply driftline-db --remote
```

Create an API token at [Cloudflare API tokens](https://dash.cloudflare.com/profile/api-tokens) with:

- Account, Cloudflare Workers, Edit
- Account, D1, Edit

Scope the token to the same account as `wrangler.jsonc`. The Workers-only template cannot apply D1 migrations.

Pushing to `master` deploys through GitHub Actions. The workflow builds the frontend, applies pending D1 migrations, and runs `wrangler deploy`. Store the token as a GitHub secret:

```sh
gh secret set CLOUDFLARE_API_TOKEN
```

Worker secrets stay on the Worker. The workflow does not upload them. After `.env` or `.dev.vars` has the Clerk keys, upload them with your public site URL:

```sh
node scripts/configure-secrets.mjs https://your-domain.example
```

That script reads Clerk keys from `.env` or `.dev.vars` and uploads them with `wrangler secret put`. It does not rotate VAPID keys or `SESSION_SECRET`. It uploads `ALLOWED_EMAILS` only when that value is present. You can also set one secret at a time:

```sh
npx wrangler secret put ALLOWED_EMAILS
```

Manual deploy from your machine:

```sh
npx wrangler login
npx wrangler d1 migrations apply driftline-db --remote
npm run deploy
```

## Market data and scheduling

The Worker cron wakes every five minutes. Each watcher can choose a 5-minute to 24-hour interval. When watchers are due, Driftline gets their prices in one CoinLore request. The first sweep for a new asset also reads its ATH and ATH date from CoinLore's coin-info endpoint. Later sweeps keep that value current. Five-year annual-high history is loaded on demand from Yahoo Finance and cached in D1. No market-data account or API key is required.

Browser push requires HTTPS and notification permission. On iPhone or iPad, install the PWA with Share, then Add to Home Screen, open the installed app, and enable notifications. Desktop Chromium browsers show an install icon in the address bar.

## Commands

```sh
npm run check       # TypeScript and tests
npm run build       # Production frontend
npm run deploy:dry  # Build and validate the Worker bundle
npm run deploy      # Manual deploy to the Cloudflare account in wrangler.jsonc
```

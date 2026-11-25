# Amazon Product Data API

Fast, developer-friendly REST API that returns structured Amazon data as JSON. Built to the specification in [`PRD Amazon Product Data API.md`](./PRD%20Amazon%20Product%20Data%20API.md): Hono + TypeScript on Vercel Functions, Zod validation, Cheerio parsing, Upstash Redis caching/rate limiting, and a single standard response envelope. Distributed through **api.market** as the gateway.

> **Note:** Amazon's Conditions of Use restrict automated access. This project is a technical implementation of the PRD; obtain legal advice, use permitted data sources/proxies, and publish Terms/Privacy notices before any commercial launch.

## Features

- 13 data endpoints covering MVP (search, details, reviews, offers), v1 (best sellers, deals, categories, GTIN tools, top reviews), and v2 (promo codes, influencers).
- `/health` (no auth) and `/openapi.json` (OpenAPI 3 spec) for gateway/API Source import.
- Consistent envelope with `request_id`, echoed `parameters`, and `meta.cache_hit` / `meta.fetched_at`.
- Strict query validation before any upstream request; clear numeric error codes (400, 401/403, 404, 429, 502/503, 504).
- api.market origin-credential verification (fails closed in production) plus secondary per-consumer rate limiting with standard `x-ratelimit-*` headers.
- Cache with per-endpoint TTLs and an optional `fresh=true` bypass.
- Proxy-aware fetcher with rotating proxies, user-agent rotation, retries, captcha detection, and an unblocker fallback.
- Typed parsers with saved HTML fixtures and unit tests.

## Quick start

```bash
npm install
cp .env.example .env
# Edit .env: set ALLOW_DIRECT_ACCESS=true for local development
npm run dev
```

`npm run dev` / `npm run start` load `.env` automatically before the app starts. Vercel ignores `.env` and reads variables from the project dashboard instead.

The API is then available at `http://localhost:3000`. Example:

```bash
curl "http://localhost:3000/health"
curl "http://localhost:3000/openapi.json"
curl "http://localhost:3000/product-category-list"
```

To exercise real upstream fetching, configure `SCRAPER_API_URL` or `PROXY_URLS` (see below). Without a proxy, Amazon will usually block serverless/datacenter IPs.

## Endpoints

All data endpoints are `GET`, return JSON, and accept `country` (default `US`) and `fresh` (default `false`).

| Endpoint | Key parameters |
| --- | --- |
| `/search` | `query` (required), `page`, `sort_by`, `category_id`, `min_price`, `max_price`, `brand`, `condition`, `is_prime`, `deals_and_discounts` |
| `/product-details` | `asin` (required) |
| `/product-offers` | `asin` (required), `condition`, `page`, `limit`, `delivery` |
| `/product-reviews` | `asin` (required), `cursor`, `sort_by`, `star_rating`, `verified_purchases_only`, `images_or_videos_only`, `current_format_only` |
| `/top-product-reviews` | `asin` (required) |
| `/best-sellers` | `category`, `type`, `page` |
| `/deals` | `page`, `min_product_star_rating`, `price_range`, `discount_range`, `category`, `deal_state` |
| `/deal-products` | `deal_id` (required), `page` |
| `/promo-code-details` | `promo_code` (required) |
| `/asin-to-gtin` | `asin` (required), `type` (`EAN-13`, `UPC`, `ISBN`) |
| `/gtin-to-asin` | `gtin` (required) |
| `/product-category-list` | — |
| `/influencer-profile` | `influencer_name` (required) |
| `/health` | — (no auth) |
| `/openapi.json` | — (no auth) |

Supported country codes: `US`, `UK`, `DE`, `CA`, `IN`, `AE` (launch), plus `FR`, `IT`, `ES`, `AU`, `JP`, `MX`, `BR`, `NL`, `SE`, `PL`, `TR`, `SA`, `EG`, `CN`.

### Response envelope

```json
{
  "status": "OK",
  "request_id": "2b1f...",
  "parameters": { "asin": "B09XYZ1234", "country": "US", "fresh": false },
  "meta": { "cache_hit": false, "fetched_at": "2026-11-23T10:00:00.000Z" },
  "data": { "asin": "B09XYZ1234", "title": "Example product" }
}
```

Errors:

```json
{
  "status": "ERROR",
  "request_id": "2b1f...",
  "error": { "message": "Invalid parameters: query: query is required", "code": 400 }
}
```

## Configuration

Copy `.env.example` to `.env`. Key variables:

| Variable | Purpose |
| --- | --- |
| `ORIGIN_AUTH_HEADER` / `ORIGIN_AUTH_SECRET` | Shared credential api.market sends to this origin (default header `x-origin-api-key`). Production requests without an exact match are rejected. |
| `ORIGIN_AUTH_QUERY_PARAM` | Optional: accept the credential as a query parameter instead of a header. |
| `ALLOW_DIRECT_ACCESS` | `true` allows unauthenticated calls in non-production environments only. |
| `PLAN_HEADER` / `DEFAULT_PLAN` | Optional plan header forwarded by the gateway; otherwise `DEFAULT_PLAN` controls the origin limiter. |
| `CONSUMER_ID_HEADER` | Header used to identify a consumer for the secondary limiter (default `x-api-market-key`, then IP). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Enable Upstash cache and rate limiter. Without them, an in-memory store is used for local development. |
| `PROXY_URLS` | Comma-separated rotating proxy URLs (`http://user:pass@host:port`). |
| `SCRAPER_API_URL` | Scraper provider template containing `{url}`, e.g. `https://api.scraperapi.com?api_key=KEY&url={url}`. |
| `UNBLOCKER_URL_TEMPLATE` | Fallback template containing `{url}` used after blocked attempts. |
| `FETCH_TIMEOUT_MS` / `FETCH_RETRIES` | Upstream timeout (default 12000 ms) and extra retries (default 2). |
| `RATE_LIMIT_BASIC/PRO/ULTRA/MEGA` | Secondary limiter requests/second per plan (defaults 1/5/10/25). |

## Setting the three key values step by step

### 1. `ORIGIN_AUTH_SECRET` + `ORIGIN_AUTH_HEADER` (protects the origin)

1. Generate a long random secret, for example `openssl rand -hex 32`, or in PowerShell:
   `[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()`
2. **Local:** in `.env`:
   ```env
   ORIGIN_AUTH_HEADER=x-origin-api-key
   ORIGIN_AUTH_SECRET=<your generated secret>
   ALLOW_DIRECT_ACCESS=false
   ```
   Restart the dev server after editing `.env`. `ALLOW_DIRECT_ACCESS=false` makes local calls require the header too.
3. **Vercel:** Project → **Settings** → **Environment Variables** → add `ORIGIN_AUTH_HEADER` and `ORIGIN_AUTH_SECRET` with the same values, select the environments, save, and redeploy.
4. **api.market:** Seller Console → **Manage APIs** → **OpenAPI Specs** → create/import your API Source using your Vercel base URL. In **Step 5 — Configure authentication**, choose **API Key**, set **Header Name** = `X-Origin-API-Key` and **API Key Value** = the same secret. Keep **custom headers** as `{}` unless you need others.
5. Test locally:
   ```bash
   curl -i http://localhost:3000/search
   # -> 403 {"error":{"code":403,...}}

   curl -i -H "x-origin-api-key: <your secret>" "http://localhost:3000/search"
   # -> 400 "query is required": auth passed, validation rejected the missing param
   ```
6. Test through api.market's API Playground. A 403 means the API Source header name/value does not exactly match the Vercel env vars.
7. For **Bearer** auth instead, set `ORIGIN_AUTH_HEADER=Authorization` and `ORIGIN_AUTH_SECRET="Bearer <token>"`, and choose Bearer Token in the API Source.

Customers authenticate to api.market with their own `x-api-market-key`; that is declared in `/openapi.json` and is separate from this origin secret.

### 2. `SCRAPER_API_URL` (primary upstream fetch through a provider)

1. Create an account with a scraping provider (for example [ScraperAPI](https://www.scraperapi.com/)) and copy its API key.
2. Build a URL template containing the literal placeholder `{url}`. For ScraperAPI:
   ```text
   SCRAPER_API_URL=https://api.scraperapi.com?api_key=YOUR_API_KEY&url={url}
   ```
   The code replaces `{url}` with the encoded Amazon page URL, so do **not** include a target URL in the template.
3. Put that line in `.env` (local) or add `SCRAPER_API_URL` in Vercel → Settings → Environment Variables, then restart/redeploy.
4. When this variable is set, **all** upstream fetches go through the scraper (rotating `PROXY_URLS` are ignored). Call a data endpoint with valid parameters to confirm live fetching:
   ```bash
   curl -H "x-origin-api-key: <secret>" \
     "http://localhost:3000/product-details?asin=B09XYZ1234"
   ```
5. If you use plain rotating proxies instead, leave `SCRAPER_API_URL` empty and set `PROXY_URLS=http://user:pass@host:port,http://user2:pass2@host2:port`.

### 3. `UNBLOCKER_URL_TEMPLATE` (optional fallback)

1. Only set this if you have a second unblocker/rendering provider whose endpoint accepts a target URL as a query parameter. Get its API key/endpoint from that provider.
2. Use the same `{url}` placeholder, for example:
   ```text
   UNBLOCKER_URL_TEMPLATE=https://unblocker.example.com/fetch?api_key=YOUR_KEY&url={url}
   ```
3. Add it to `.env` or Vercel environment variables and restart/redeploy.
4. This is used **only after** all normal attempts (direct/proxy or scraper, plus retries) return a captcha, 403, 429, or 5xx. You can leave it blank if you have no fallback provider.

Keep all values out of source control: `.env` is gitignored, and gateway/provider secrets belong in the Vercel and api.market dashboards. Never send the origin secret to clients or browsers.

## Deploying to Vercel and api.market

1. Import the repository into Vercel; the framework preset is `None`.
2. Set the environment variables above in project settings. Use a paid Vercel plan for commercial traffic.
3. `vercel.json` rewrites all paths to `api/index.ts`, which exports the Hono app; `maxDuration` is 30 seconds.
4. Deploy, then use the Vercel URL as the **Base URL** of the api.market API Source and configure the matching origin credential (step 1 above).
5. Create your api.market API product, attach the API Source, and configure plans/pricing there. api.market handles subscriber auth, billing, and primary quotas; this origin adds a secondary limiter and cache.

## Project structure

```text
api/index.ts              Vercel entry point
lib/app.ts                Hono app, middleware, error handling
lib/auth.ts               api.market origin-credential verification
lib/rate-limit.ts         Secondary per-consumer limiter + headers
lib/cache.ts              TTL rules, cache keys, cached loader
lib/store.ts              Upstash Redis / in-memory fallback
lib/fetcher.ts            Proxy-aware HTTP client and retries
lib/schemas.ts            Zod input/output schemas
lib/countries.ts          Marketplace/domain configuration
lib/urls.ts               Amazon URL builders
lib/parsers/              One parser per page type + shared helpers
lib/routes/               One route module per endpoint
lib/openapi.ts            OpenAPI 3 document served at /openapi.json
tests/fixtures/           Saved Amazon-like HTML fixtures
```

## Scripts

```bash
npm run dev        # local server with hot reload
npm run typecheck  # TypeScript strict check
npm run build      # alias for typecheck (Vercel builds the functions itself)
npm test           # Vitest unit/integration tests
```

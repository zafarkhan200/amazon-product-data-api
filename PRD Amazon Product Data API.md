# PRD: Amazon Product Data API

**Author:** Muhammad | **Status:** Draft v1.0 | **Hosting:** Vercel | **Distribution:** RapidAPI (primary), direct dashboard (later)

## 1. Overview

### 1.1 Summary

A fast, developer-friendly REST API that returns structured Amazon data in real time: product search, full product details, offers, reviews, best sellers, deals, and ASIN/GTIN conversion. It is positioned as a lower-priced, well-documented alternative to the OpenWeb Ninja Real-Time Amazon Data API, sold through RapidAPI and hosted on Vercel.

### 1.2 Problem

Developers, marketers, and researchers need up-to-date Amazon data for price comparison, market research, competitor analysis, and review analysis. Amazon's official Product Advertising API is restricted (affiliate sales requirements, throttling, limited fields), so teams turn to third-party data APIs. Existing options are costly at scale and often slow or inconsistent.

### 1.3 Vision

Become a reliable, affordable Amazon data API with predictable JSON, strong uptime, and a generous free tier.

## 2. Goals and Non-Goals

### 2.1 Goals

- Reach feature parity with the competitor's core endpoints within the MVP and v1.
- Median response time under 3 seconds for cached data and under 8 seconds for live fetches.
- Success rate of 95% or higher on live fetches.
- Consistent response envelope, clear errors, and complete OpenAPI documentation.
- Launch on RapidAPI with a free BASIC plan and paid tiers.

### 2.2 Non-Goals (MVP)

- No purchasing, cart, or any account-affecting actions on Amazon.
- No logged-in features (such as review detail by cookie) in MVP.
- No full web dashboard, billing system, or SDKs in MVP (RapidAPI handles auth and billing).
- No data from non-Amazon marketplaces.

## 3. Target Users and Use Cases

| Persona | Need |
| --- | --- |
| Indie developer / app builder | Add Amazon product lookups to apps (including Android apps) |
| E-commerce seller / marketer | Price monitoring, competitor research, best-seller tracking |
| Data analyst / researcher | Review sentiment, trend analysis, category research |
| Deal / coupon site owner | Pull deals and promo-code product lists |

Core use cases: price optimization and comparison, market research, competitive analysis, product and trend research, customer review analysis.

## 4. Competitive Analysis

Competitor: OpenWeb Ninja Real-Time Amazon Data (RapidAPI). Key facts from its documentation:

- Supports all 24 Amazon domains/countries.
- 13 endpoints: Search, Product Details, Product Offers, Product Reviews, Top Product Reviews, Product Review Details, Best Sellers, Deals, Deal Products, Promo Code Details, ASIN to GTIN, GTIN to ASIN, Category List, Influencer Profile.
- Free BASIC plan with 100 requests per month (hard limit); free plans are capped at 1000 requests per hour by RapidAPI.
- Auth via X-RapidAPI-Host and X-RapidAPI-Key headers.
- Envelope: status (OK or ERROR), request\_id, and either data or error (message, code).
- Separate Mega plan for high volume.

### 4.1 Differentiation ideas

- Cheaper per-request pricing and a more generous free tier (for example 250 to 500 requests per month).
- Optional fields filter (return only requested fields) to cut payload size.
- Bulk endpoint (multiple ASINs per call).
- Clear data freshness metadata (fetched\_at, cache\_hit) on every response.
- Fast, friendly support and a public status page.

## 5. Scope and Phasing

| Phase | Endpoints |
| --- | --- |
| MVP (P0) | /search, /product-details, /product-reviews, /product-offers |
| v1 (P1) | /best-sellers, /deals, /deal-products, /product-category-list, /asin-to-gtin, /gtin-to-asin, /top-product-reviews |
| v2 (P2) | /promo-code-details, /influencer-profile, bulk endpoints, price history, webhooks/alerts |
| Later | Review detail (logged-in), additional marketplaces |

Initial countries: US, UK, DE, CA, IN, AE (expand toward all 24 Amazon domains in v1/v2).

## 6. Functional Requirements

All endpoints are GET, return JSON, and accept a `country` parameter (default US).

### 6.1 Product Search: GET /search

- Params: `query` (required), `page` (default 1), `country`, `sort_by` (relevance, lowest price, highest price, reviews, newest, best sellers), `category_id`, `min_price`, `max_price`, `brand`, `condition` (new, used, renewed), `is_prime`, `deals_and_discounts`.
- Returns: list of products with asin, title, price, original price, currency, rating, rating count, photo, url, Prime flag, sales volume text, delivery text, badges; plus total\_products and country.

### 6.2 Product Details: GET /product-details

- Params: `asin` (required), `country`.
- Returns: title, description, about bullets, brand, price data, rating data, rating distribution, photos and video, product information (weight, dimensions, model), variations (color, size, flavor), best sellers rank, category path, review insights, buy box and FBA/seller details, availability.

### 6.3 Product Offers: GET /product-offers

- Params: `asin` (required), `country`, `condition`, `page`, `limit`, `delivery`.
- Returns product details plus an array of offers (seller, price, condition, shipping, delivery date, FBA/Prime flag, seller rating).

### 6.4 Product Reviews: GET /product-reviews

- Params: `asin` (required), `country`, `cursor` (pagination, up to 10 reviews per page), `sort_by` (top reviews, most recent), `star_rating` (all, 5, 4, 3, 2, 1, positive, critical), `verified_purchases_only`, `images_or_videos_only`, `current_format_only`.
- Returns reviews with id, title, text, rating, author, date, verified flag, helpful votes, images; plus next cursor.

### 6.5 Top Product Reviews: GET /top-product-reviews

- Params: `asin`, `country`. Returns the top reviews shown on the product page.

### 6.6 Best Sellers: GET /best-sellers

- Params: `category` (or category path), `type` (BEST\_SELLERS, NEW\_RELEASES, MOVERS\_AND\_SHAKERS, MOST\_WISHED\_FOR, GIFT\_IDEAS), `page`, `country`.
- Returns ranked products with rank, asin, title, price, rating, rating count, photo.

### 6.7 Deals: GET /deals

- Params: `country`, `page`, `min_product_star_rating`, `price_range`, `discount_range`, `category`, `deal_state` (available, upcoming, ended).
- Returns deals with deal\_id, title, deal type (lightning, best deal), discount, end time, claimed percent, and sample products.

### 6.8 Deal Products: GET /deal-products

- Params: `deal_id`, `country`, `page`. Returns products in a specific deal.

### 6.9 Promo Code Details: GET /promo-code-details

- Params: `promo_code`, `country`. Returns products offered by a promo code.

### 6.10 ASIN to GTIN: GET /asin-to-gtin

- Params: `asin`, `type` (EAN-13, UPC, ISBN), `country`. Returns the identifier.

### 6.11 GTIN to ASIN: GET /gtin-to-asin

- Params: `gtin`, `country`. Returns matching ASINs with title, photo, url, price, rating, rating count, sales rank, rank category.

### 6.12 Product Category List: GET /product-category-list

- Params: `country`. Returns category ids and names for use with search.

### 6.13 Influencer Profile: GET /influencer-profile

- Params: `influencer_name`, `country`. Returns profile details from the influencer store page.

### 6.14 Utility

- GET /health (uptime check, no auth).
- GET /openapi.json (machine-readable spec).

## 7. Response and Error Format

Every response uses a common envelope:

```
{
  "status": "OK",
  "request_id": "uuid",
  "parameters": { ... echoed inputs ... },
  "meta": { "cache_hit": false, "fetched_at": "ISO-8601" },
  "data": { ... } or [ ... ]
}
```

Errors return `status: ERROR`, `request_id`, and `error: { message, code }`.

| Code | Meaning |
| --- | --- |
| 400 | Missing or invalid parameter (with a clear message) |
| 401/403 | Invalid key or not subscribed |
| 404 | Product or resource not found, or bad route |
| 429 | Rate limit or quota exceeded |
| 502/503 | Upstream blocked or temporarily unavailable (retry suggested) |
| 504 | Fetch timed out |

Rules: validate all params before any upstream fetch; never charge or count failed upstream requests where possible; always include request\_id for debugging.

## 8. Authentication, Plans, and Rate Limits

### 8.1 Authentication

- Launch via RapidAPI: the gateway authenticates via X-RapidAPI-Key and sends X-RapidAPI-Proxy-Secret to the origin.
- The Vercel API must reject any request that lacks the correct proxy secret (so the origin cannot be called directly and bypass billing).
- Later: direct API keys (hashed, stored in the database) with a simple dashboard.

### 8.2 Suggested plans (to be validated)

| Plan | Price/mo | Requests/mo | Rate limit |
| --- | --- | --- | --- |
| BASIC | $0 | 250 (hard limit) | 1 req/sec |
| PRO | $9.99 | 10,000 | 5 req/sec |
| ULTRA | $29.99 | 50,000 | 10 req/sec |
| MEGA | $99.99 | 250,000 | 25 req/sec |

Pricing should be set after measuring real cost per request (proxy and compute).

### 8.3 Rate limiting

- Enforced primarily by RapidAPI per plan; add a secondary per-IP and per-key limiter at the origin (Upstash Redis) to protect against abuse.
- Return standard headers: x-ratelimit-requests-limit, x-ratelimit-requests-remaining, x-ratelimit-requests-reset.

## 9. Technical Architecture (Vercel)

### 9.1 Stack

- Runtime: Node.js with TypeScript on Vercel Functions (a Python option is possible, but keep one language).
- Framework: Hono or Express-style router inside Vercel Functions; Zod for request validation.
- HTML parsing: Cheerio (lightweight, works in serverless without a browser).
- Cache and rate limiting: Upstash Redis (Vercel Marketplace integration).
- Database (later): Postgres via Neon or Supabase for keys, usage logs, and price history.
- Observability: Vercel logs plus Sentry; uptime via BetterStack or similar.
- Docs: OpenAPI 3 spec served at /openapi.json, plus RapidAPI Hub listing.

### 9.2 Request flow

1. RapidAPI forwards the request with the proxy secret.
2. Middleware validates the secret, parameters, and country.
3. Check Redis cache (key = endpoint + normalized params).
4. On a miss, fetch the Amazon page through a rotating proxy / scraping provider.
5. Parse HTML into the normalized schema; run schema validation.
6. Store in cache with a TTL, then return the envelope.

### 9.3 Vercel constraints and decisions

- **Function duration:** serverless functions have a maximum duration that depends on plan; set maxDuration explicitly per route and keep live fetch plus parse under that limit. Reviews and offers pagination must stay at one upstream page per request.
- **No headless browser by default:** full Chromium in serverless is heavy and slow. Prefer plain HTTP fetch with proxies and HTML parsing; use a third-party rendering/unblocker service as a fallback for blocked pages.
- **Outbound IPs:** Vercel IPs are shared and datacenter-based, so a residential or rotating proxy provider is mandatory for reliability.
- **Commercial use:** Vercel's free Hobby plan is for non-commercial use. A paid API must run on a Pro plan.
- **Region:** deploy functions near the proxy and Amazon endpoints (for example iad1) to minimize latency.
- **Stateless design:** all state lives in Redis or the database, never in function memory.
- **Heavier workloads:** if success rate or timeouts become a problem, move the scraping workers to a dedicated service (Fly.io, Railway, or a VPS) and keep Vercel as the API gateway.

### 9.4 Suggested project structure

```
/api            route handlers (search, product-details, ...)
/lib/fetcher    proxy-aware HTTP client, retries, user-agent rotation
/lib/parsers    one parser per page type, per-locale selectors
/lib/cache      Redis helpers and TTL rules
/lib/schemas    Zod schemas for inputs and outputs
/lib/countries  domain, currency, language, locale config
/tests          parser tests with saved HTML fixtures
```

## 10. Data Extraction Strategy

- Use one parser per page type (search results, product page, offers, reviews, best sellers, deals), with locale-specific selectors where Amazon markup differs.
- Keep saved HTML fixtures per country and page type so parser regressions are caught by automated tests.
- Run a scheduled canary job (every 15 to 30 minutes) that calls each endpoint with known ASINs and alerts on failures or empty fields. Amazon changes markup often; this is the main maintenance cost.
- Normalize prices to numeric value, currency code, and display string; normalize ratings and counts to numbers.
- Retry policy: up to 2 retries with a different proxy and user agent on 403, 429, 503, or captcha pages.
- Detect captcha or robot-check pages and treat them as failed fetches (not as empty results).

## 11. Caching Strategy

| Data | Suggested TTL |
| --- | --- |
| Product details | 15 to 60 minutes |
| Offers / prices | 5 to 15 minutes |
| Search results | 15 to 30 minutes |
| Reviews | 6 to 24 hours |
| Best sellers | 1 to 3 hours |
| Deals | 5 to 10 minutes |
| Category list | 7 days |
| ASIN/GTIN mapping | 30 days |

A `fresh=true` option (higher cost tier) may bypass the cache. Cache hits should still count toward quota but can be priced lower internally.

## 12. Non-Functional Requirements

- **Performance:** p50 under 3s and p95 under 10s overall; cache hits under 500ms.
- **Availability:** 99.5% monthly target at launch.
- **Reliability:** live-fetch success rate of 95% or higher, tracked per endpoint and per country.
- **Security:** secrets in Vercel environment variables; HTTPS only; strict input validation (ASIN format, allowed countries); no logging of API keys; CORS disabled for direct browser use unless intended.
- **Privacy:** return only publicly visible product data; do not collect end-user personal data. Reviews include public author display names only.
- **Scalability:** stateless functions and Redis caching; scale by upgrading proxy capacity and moving workers off Vercel if needed.
- **Maintainability:** typed code, parser tests with fixtures, CI on every pull request.

## 13. Legal, Compliance, and Risk Notes

This section needs real attention before launch.

- Amazon's Conditions of Use restrict automated access and data extraction. Scraping Amazon can lead to IP blocking, account action, or legal claims. Obtain proper legal advice on the target markets before selling this commercially.
- Consider a hybrid design: use Amazon's official Product Advertising API where eligible, and scrape only as a fallback.
- Publish Terms of Service and a Privacy Policy, and state that the service is not affiliated with Amazon. Do not use Amazon logos or trademarks as branding.
- Respect rate limits on upstream requests to avoid abusive load.
- Add a takedown/contact process for data complaints.
- Proxy and scraping vendors must be reviewed for terms that permit this use.

## 14. Monetization and Costs

- Revenue: RapidAPI subscriptions (RapidAPI takes a marketplace commission), later direct plans via Stripe.
- Main cost drivers: rotating or residential proxy bandwidth, scraping/unblocker fallback calls, Vercel Pro seat and function usage, Upstash Redis, monitoring.
- Action: model cost per successful request per endpoint before finalizing plan prices, and set plan quotas so margin stays positive even at full usage.

## 15. Success Metrics

- Live-fetch success rate of 95% or higher; cache hit ratio of 40% or higher.
- p95 latency under 10 seconds.
- 500 RapidAPI free subscribers and 30 paying subscribers within 3 months of launch.
- Average RapidAPI listing rating of 4.5 or higher; support response under 24 hours.
- Gross margin of 60% or higher on paid plans.

## 16. Milestones

| Week | Deliverable |
| --- | --- |
| 1 | Project setup, envelope, validation, auth middleware, proxy client, US /product-details |
| 2 | /search and /product-reviews with caching and tests |
| 3 | /product-offers, error handling, rate limiting, OpenAPI spec |
| 4 | Private beta on RapidAPI, canary monitoring, fix parser gaps |
| 5 to 6 | Public launch with plans; add UK, DE, CA, IN, AE |
| 7 to 10 | v1 endpoints: best sellers, deals, deal products, categories, GTIN tools |
| 11 to 14 | v2: promo codes, influencer profile, bulk, price history, more countries |

## 17. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Amazon blocks or captchas requests | High | Rotating residential proxies, unblocker fallback, retries, caching |
| Markup changes break parsers | High | Fixture tests, canary monitoring, fast-fix workflow |
| Vercel function timeouts | Medium | One upstream page per call, explicit maxDuration, move workers off Vercel if needed |
| Proxy costs exceed revenue | High | Aggressive caching, cost-based pricing, hard quotas |
| Legal or ToS action | High | Legal review, official API hybrid, clear disclaimers |
| Origin bypassing RapidAPI billing | Medium | Proxy-secret check, optional IP allowlist |
| Abuse of free tier | Medium | Hard limits, per-IP throttling |

## 18. Open Questions

- Which proxy or scraping provider will be used, and what is the expected cost per 1,000 requests?
- Will the API be sold only on RapidAPI at launch, or also with direct billing?
- Which countries are required for launch?
- Is Vercel Pro acceptable as a fixed cost, or should scraping workers run elsewhere from day one?
- Will the official Product Advertising API be used as a primary or fallback source?

## 19. Appendix: Competitor Endpoint Mapping

| Competitor endpoint | This API | Phase |
| --- | --- | --- |
| /search | /search | MVP |
| /product-details | /product-details | MVP |
| /product-offers | /product-offers | MVP |
| /product-reviews | /product-reviews | MVP |
| /top-product-reviews | /top-product-reviews | v1 |
| /best-sellers | /best-sellers | v1 |
| /deals-v2 | /deals | v1 |
| /deal-products | /deal-products | v1 |
| /product-category-list | /product-category-list | v1 |
| /asin-to-gtin | /asin-to-gtin | v1 |
| /gtin-to-asin | /gtin-to-asin | v1 |
| /promo-code-details | /promo-code-details | v2 |
| /influencer-profile | /influencer-profile | v2 |
| /product-review-details (logged-in) | Not planned | Later |

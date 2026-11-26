import { Hono } from 'hono';
import { load } from 'cheerio';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { parseDeals } from '../parsers/deals.js';
import { dealsInputSchema, dealsOutputSchema } from '../schemas.js';
import { dealsPath } from '../urls.js';
import { dataResponse } from './shared.js';

export const dealsRoutes = new Hono<AppEnv>();

dealsRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'deals',
    input: dealsInputSchema,
    output: dealsOutputSchema,
    ttl: TTL.deals,
    load: async (params, country) => {
      const requestedPath = dealsPath(params);
      const { html, status } = await fetchAmazonPage(requestedPath, country);
      const $ = load(html);
      const parsed = parseDeals(html, country, params.page);

      console.info('[deals] upstream page diagnostics', {
        requestedPath,
        status,
        htmlLength: html.length,
        pageTitle: $('title').first().text().trim().slice(0, 160) || null,
        dealCardCounts: {
          testId: $('[data-testid="deal-card"]').length,
          dealContent: $('div.dealContent').length,
          dealCardId: $('div[id^="dealCard"]').length,
        },
        parsedDealCount: parsed.deals.length,
        hasCaptcha: /captcha|robot check|automated access|validateCaptcha/i.test(html.slice(0, 60000)),
      });

      return parsed;
    },
  }),
);

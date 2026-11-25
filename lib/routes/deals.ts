import { Hono } from 'hono';
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
      const { html } = await fetchAmazonPage(dealsPath(params), country);
      return parseDeals(html, country, params.page);
    },
  }),
);

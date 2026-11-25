import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { parseBestSellers } from '../parsers/best-sellers.js';
import { bestSellersInputSchema, bestSellersOutputSchema } from '../schemas.js';
import { bestSellersPath } from '../urls.js';
import { dataResponse } from './shared.js';

export const bestSellersRoutes = new Hono<AppEnv>();

bestSellersRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'best_sellers',
    input: bestSellersInputSchema,
    output: bestSellersOutputSchema,
    ttl: TTL.best_sellers,
    load: async (params, country) => {
      const { html } = await fetchAmazonPage(bestSellersPath(params), country);
      return parseBestSellers(html, country, params.category ?? 'all', params.type, params.page);
    },
  }),
);

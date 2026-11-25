import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { TTL } from '../cache';
import { fetchAmazonPage } from '../fetcher';
import { parseBestSellers } from '../parsers/best-sellers';
import { bestSellersInputSchema, bestSellersOutputSchema } from '../schemas';
import { bestSellersPath } from '../urls';
import { dataResponse } from './shared';

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

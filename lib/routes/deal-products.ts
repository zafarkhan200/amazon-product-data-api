import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { parseDealProducts } from '../parsers/deals.js';
import { dealProductsInputSchema, dealProductsOutputSchema } from '../schemas.js';
import { dealProductsPath } from '../urls.js';
import { dataResponse } from './shared.js';

export const dealProductsRoutes = new Hono<AppEnv>();

dealProductsRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'deal_products',
    input: dealProductsInputSchema,
    output: dealProductsOutputSchema,
    ttl: TTL.deal_products,
    load: async (params, country) => {
      const { html } = await fetchAmazonPage(dealProductsPath(params.deal_id, params.page), country);
      return parseDealProducts(html, country, params.deal_id, params.page);
    },
  }),
);

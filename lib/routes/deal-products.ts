import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { TTL } from '../cache';
import { fetchAmazonPage } from '../fetcher';
import { parseDealProducts } from '../parsers/deals';
import { dealProductsInputSchema, dealProductsOutputSchema } from '../schemas';
import { dealProductsPath } from '../urls';
import { dataResponse } from './shared';

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

import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { TTL } from '../cache';
import { fetchAmazonPage } from '../fetcher';
import { parseAsinToGtin } from '../parsers/identifiers';
import { asinToGtinInputSchema, asinToGtinOutputSchema } from '../schemas';
import { productPath } from '../urls';
import { dataResponse } from './shared';

export const asinToGtinRoutes = new Hono<AppEnv>();

asinToGtinRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'asin_to_gtin',
    input: asinToGtinInputSchema,
    output: asinToGtinOutputSchema,
    ttl: TTL.asin_to_gtin,
    load: async (params, country) => {
      const { html } = await fetchAmazonPage(productPath(params.asin), country);
      return parseAsinToGtin(html, country, params.asin, params.type);
    },
  }),
);

import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { parseAsinToGtin } from '../parsers/identifiers.js';
import { asinToGtinInputSchema, asinToGtinOutputSchema } from '../schemas.js';
import { productPath } from '../urls.js';
import { dataResponse } from './shared.js';

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

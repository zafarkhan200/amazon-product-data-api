import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { parseGtinToAsin } from '../parsers/identifiers.js';
import { gtinToAsinInputSchema, gtinToAsinOutputSchema } from '../schemas.js';
import { searchPath } from '../urls.js';
import { dataResponse } from './shared.js';

export const gtinToAsinRoutes = new Hono<AppEnv>();

gtinToAsinRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'gtin_to_asin',
    input: gtinToAsinInputSchema,
    output: gtinToAsinOutputSchema,
    ttl: TTL.gtin_to_asin,
    load: async (params, country) => {
      const { html } = await fetchAmazonPage(
        searchPath(
          {
            query: params.gtin,
            page: 1,
            country: params.country,
            fresh: params.fresh,
          },
          country,
        ),
        country,
      );
      return parseGtinToAsin(html, country, params.gtin);
    },
  }),
);

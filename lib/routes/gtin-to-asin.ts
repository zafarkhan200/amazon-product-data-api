import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { TTL } from '../cache';
import { fetchAmazonPage } from '../fetcher';
import { parseGtinToAsin } from '../parsers/identifiers';
import { gtinToAsinInputSchema, gtinToAsinOutputSchema } from '../schemas';
import { searchPath } from '../urls';
import { dataResponse } from './shared';

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

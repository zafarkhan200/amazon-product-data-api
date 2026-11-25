import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { TTL } from '../cache';
import { fetchAmazonPage } from '../fetcher';
import { parseDeals } from '../parsers/deals';
import { dealsInputSchema, dealsOutputSchema } from '../schemas';
import { dealsPath } from '../urls';
import { dataResponse } from './shared';

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

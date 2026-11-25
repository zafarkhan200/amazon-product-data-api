import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { parseOffers } from '../parsers/offers.js';
import { offersInputSchema, offersOutputSchema } from '../schemas.js';
import { offersPath } from '../urls.js';
import { dataResponse } from './shared.js';

export const productOffersRoutes = new Hono<AppEnv>();

productOffersRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'product_offers',
    input: offersInputSchema,
    output: offersOutputSchema,
    ttl: TTL.product_offers,
    load: async (params, country) => {
      const { html } = await fetchAmazonPage(offersPath(params), country);
      return parseOffers(html, country, params.page, params.limit);
    },
  }),
);

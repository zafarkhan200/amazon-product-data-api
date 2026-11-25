import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { TTL } from '../cache';
import { fetchAmazonPage } from '../fetcher';
import { parseOffers } from '../parsers/offers';
import { offersInputSchema, offersOutputSchema } from '../schemas';
import { offersPath } from '../urls';
import { dataResponse } from './shared';

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

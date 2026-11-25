import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { TTL } from '../cache';
import { fetchAmazonPage } from '../fetcher';
import { parseProductDetails } from '../parsers/product';
import { asinInputSchema, productDetailsOutputSchema } from '../schemas';
import { productPath } from '../urls';
import { dataResponse } from './shared';

export const productDetailsRoutes = new Hono<AppEnv>();

productDetailsRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'product_details',
    input: asinInputSchema,
    output: productDetailsOutputSchema,
    ttl: TTL.product_details,
    load: async (params, country) => {
      const { html } = await fetchAmazonPage(productPath(params.asin), country);
      return parseProductDetails(html, country);
    },
  }),
);

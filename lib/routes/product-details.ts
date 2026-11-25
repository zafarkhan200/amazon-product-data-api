import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { parseProductDetails } from '../parsers/product.js';
import { asinInputSchema, productDetailsOutputSchema } from '../schemas.js';
import { productPath } from '../urls.js';
import { dataResponse } from './shared.js';

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

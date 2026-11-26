import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { getFallbackCategoryList, parseCategoryList } from '../parsers/categories.js';
import { categoryListInputSchema, categoryListOutputSchema } from '../schemas.js';
import { categoryListPath } from '../urls.js';
import { dataResponse } from './shared.js';

export const categoryListRoutes = new Hono<AppEnv>();

categoryListRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'product_category_list',
    input: categoryListInputSchema,
    output: categoryListOutputSchema,
    ttl: TTL.product_category_list,
    load: async (_params, country) => {
      try {
        const { html } = await fetchAmazonPage(categoryListPath(), country);
        return parseCategoryList(html, country);
      } catch (error) {
        console.warn('[product_category_list] Amazon category page unavailable; using fallback categories', {
          country: country.code,
          error: error instanceof Error ? error.message : String(error),
        });
        return getFallbackCategoryList(country);
      }
    },
  }),
);

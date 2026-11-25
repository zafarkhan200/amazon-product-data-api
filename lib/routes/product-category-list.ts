import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { TTL } from '../cache';
import { fetchAmazonPage } from '../fetcher';
import { parseCategoryList } from '../parsers/categories';
import { categoryListInputSchema, categoryListOutputSchema } from '../schemas';
import { categoryListPath } from '../urls';
import { dataResponse } from './shared';

export const categoryListRoutes = new Hono<AppEnv>();

categoryListRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'product_category_list',
    input: categoryListInputSchema,
    output: categoryListOutputSchema,
    ttl: TTL.product_category_list,
    load: async (_params, country) => {
      const { html } = await fetchAmazonPage(categoryListPath(), country);
      return parseCategoryList(html, country);
    },
  }),
);

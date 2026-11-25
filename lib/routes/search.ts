import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { parseSearchResults } from '../parsers/search.js';
import { searchInputSchema, searchOutputSchema } from '../schemas.js';
import { searchPath } from '../urls.js';
import { dataResponse } from './shared.js';

export const searchRoutes = new Hono<AppEnv>();

searchRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'search',
    input: searchInputSchema,
    output: searchOutputSchema,
    ttl: TTL.search,
    load: async (params, country) => {
      const { html } = await fetchAmazonPage(searchPath(params, country), country);
      return parseSearchResults(html, country, params.query, params.page);
    },
  }),
);

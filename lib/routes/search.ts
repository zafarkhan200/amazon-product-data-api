import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { TTL } from '../cache';
import { fetchAmazonPage } from '../fetcher';
import { parseSearchResults } from '../parsers/search';
import { searchInputSchema, searchOutputSchema } from '../schemas';
import { searchPath } from '../urls';
import { dataResponse } from './shared';

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

import { Hono } from 'hono';
import { load } from 'cheerio';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { clean } from '../parsers/helpers.js';
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
      const requestedPath = searchPath(params, country);
      const { html, status } = await fetchAmazonPage(requestedPath, country);
      const $ = load(html);
      const resultCardCount = $('[data-component-type="s-search-result"], .s-result-item[data-asin]').length;
      const validAsinCount = $('[data-asin]').filter((_, element) =>
        /^[A-Z0-9]{10}$/i.test($(element).attr('data-asin') ?? ''),
      ).length;
      const productLinkCount = $('a[href*="/dp/"], a[href*="/gp/product/"]').length;

      console.info('[search] upstream page diagnostics', {
        requestedPath,
        status,
        htmlLength: html.length,
        pageTitle: clean($('title').first().text()).slice(0, 120),
        resultCardCount,
        validAsinCount,
        productLinkCount,
        hasCaptcha: /captcha|robot check|validateCaptcha/i.test(html.slice(0, 60000)),
        hasSearchResults: /s-search-results|s-search-result/i.test(html),
      });

      return parseSearchResults(html, country, params.query, params.page);
    },
  }),
);

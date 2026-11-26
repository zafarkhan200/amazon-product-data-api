import { Hono } from 'hono';
import { load } from 'cheerio';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { parseDeals } from '../parsers/deals.js';
import { dealsInputSchema, dealsOutputSchema } from '../schemas.js';
import { dealsPath } from '../urls.js';
import { dataResponse } from './shared.js';

export const dealsRoutes = new Hono<AppEnv>();

dealsRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'deals',
    input: dealsInputSchema,
    output: dealsOutputSchema,
    ttl: TTL.deals,
    load: async (params, country) => {
      const requestedPath = dealsPath(params);
      const { html, status } = await fetchAmazonPage(requestedPath, country);
      const $ = load(html);
      const parsed = parseDeals(html, country, params.page);

      console.info('[deals] upstream page diagnostics', {
        requestedPath,
        status,
        htmlLength: html.length,
        pageTitle: $('title').first().text().trim().slice(0, 160) || null,
        dealCardCounts: {
          testId: $('[data-testid="deal-card"]').length,
          dealContent: $('div.dealContent').length,
          dealCardId: $('div[id^="dealCard"]').length,
        },
        parsedDealCount: parsed.deals.length,
        hasCaptcha: /captcha|robot check|automated access|validateCaptcha/i.test(html.slice(0, 60000)),
      });

      if (parsed.deals.length === 0) {
        const dealAttributeNodes = $('*')
          .filter((_, element) => {
            const node = $(element);
            return /deal/i.test(
              [node.attr('id'), node.attr('class'), node.attr('data-testid'), node.attr('data-deal-id')]
                .filter(Boolean)
                .join(' '),
            );
          })
          .slice(0, 12)
          .map((_, element) => {
            const node = $(element);
            return {
              tag: element.type,
              attributes: {
                id: node.attr('id') ?? null,
                class: node.attr('class') ?? null,
                'data-testid': node.attr('data-testid') ?? null,
                'data-deal-id': node.attr('data-deal-id') ?? null,
              },
              text: node.text().replace(/\s+/g, ' ').trim().slice(0, 220),
              html: node.toString().slice(0, 1400),
            };
          });

        const dealLinks = $('a[href*="/deal/"], a[href*="/deals/"], a[href*="/golden-deals/"], a[href*="/dp/"]')
          .slice(0, 12)
          .map((_, element) => {
            const node = $(element);
            return {
              href: node.attr('href') ?? null,
              text: node.text().replace(/\s+/g, ' ').trim().slice(0, 180),
              parentHtml: node.parent().parent().toString().slice(0, 1600),
            };
          });

        console.info('[deals] markup samples for parser diagnosis', {
          dealAttributeNodeCount: $('[id*="deal" i], [class*="deal" i], [data-testid*="deal" i], [data-deal-id]').length,
          dealLinkCount: $('a[href*="/deal/"], a[href*="/deals/"], a[href*="/golden-deals/"]').length,
          productLinkCount: $('a[href*="/dp/"]').length,
          dealAttributeNodes,
          dealLinks,
        });
      }

      return parsed;
    },
  }),
);

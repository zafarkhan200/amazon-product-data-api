import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { TTL } from '../cache.js';
import { fetchAmazonPage } from '../fetcher.js';
import { parseOffers } from '../parsers/offers.js';
import { parseProductDetails } from '../parsers/product.js';
import { offersInputSchema, offersOutputSchema } from '../schemas.js';
import { offersPath, productPath } from '../urls.js';
import { dataResponse } from './shared.js';

export const productOffersRoutes = new Hono<AppEnv>();

productOffersRoutes.get('/', (c) =>
  dataResponse(c, {
    endpoint: 'product_offers',
    input: offersInputSchema,
    output: offersOutputSchema,
    ttl: TTL.product_offers,
    load: async (params, country) => {
      // Fetch product metadata from the canonical product page. Amazon's
      // offer-listing page may omit #productTitle and other product metadata.
      const productPage = await fetchAmazonPage(productPath(params.asin), country);
      const product = parseProductDetails(productPage.html, country, params.asin);
      const offersPage = await fetchAmazonPage(offersPath(params), country);
      const offersHtml = offersPage.html;
      const pageTitle = offersHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
        ?.replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
      const offersVisibleText = offersHtml
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;|&#34;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
      const noOffersMatch = /no featured offers|no offers available|currently unavailable/i.exec(offersVisibleText);
      const noOffersContext = noOffersMatch
        ? offersVisibleText.slice(Math.max(0, noOffersMatch.index - 220), noOffersMatch.index + 380).slice(0, 600)
        : null;
      console.info('[offers] upstream page diagnostics', {
        requestedPath: offersPath(params),
        status: offersPage.status,
        htmlLength: offersHtml.length,
        pageTitle,
        hasAodOfferList: /id=["']aod-offer-list["']/i.test(offersHtml),
        hasAodContainer: /id=["']aod-container["']/i.test(offersHtml),
        hasAodOfferId: /data-aod-offer-id/i.test(offersHtml),
        hasAodOfferClass: /class=["'][^"']*aod-offer/i.test(offersHtml),
        hasOlpOffer: /class=["'][^"']*olpOffer/i.test(offersHtml),
        hasOfferListing: /offer-listing|offerlist/i.test(offersHtml),
        hasCaptcha: /captcha|robot check|validateCaptcha/i.test(offersHtml.slice(0, 60000)),
        hasNoOffersMessage: Boolean(noOffersMatch),
        noOffersContext,
      });
      return parseOffers(offersHtml, country, params.page, params.limit, product);
    },
  }),
);

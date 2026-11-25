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
      console.info('[offers] upstream page diagnostics', {
        status: offersPage.status,
        htmlLength: offersHtml.length,
        pageTitle,
        hasAodContainer: /id=["']aod-container["']/i.test(offersHtml),
        hasAodOfferId: /data-aod-offer-id/i.test(offersHtml),
        hasAodOfferClass: /class=["'][^"']*aod-offer/i.test(offersHtml),
        hasOlpOffer: /class=["'][^"']*olpOffer/i.test(offersHtml),
        hasOfferListing: /offer-listing|offerlist/i.test(offersHtml),
        hasCaptcha: /captcha|robot check|validateCaptcha/i.test(offersHtml.slice(0, 60000)),
        hasNoOffersMessage: /no featured offers|no offers available|currently unavailable/i.test(offersHtml),
      });
      return parseOffers(offersHtml, country, params.page, params.limit, product);
    },
  }),
);

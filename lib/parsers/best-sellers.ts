import { load } from 'cheerio';
import type { CountryConfig } from '../countries';
import type { BestSellersData, RankedProduct } from '../types';
import {
  absoluteUrl,
  asinFromHref,
  clean,
  dedupeBy,
  firstAttr,
  firstText,
  parseCount,
  parseNumber,
  parsePriceText,
  parseRating,
} from './helpers';

export function parseBestSellers(
  html: string,
  country: CountryConfig,
  category: string,
  type: string,
  page: number,
): BestSellersData {
  const $ = load(html);
  const products: RankedProduct[] = [];

  $('div#gridItemRoot, div.zg-grid-general-faceout, div.p13n-asin-indexable[data-asin]').each(
    (_, element) => {
      const card = $(element);
      const href = firstAttr(card, ['a[href*="/dp/"]', 'a.a-link-normal'], 'href');
      const asin = card.attr('data-asin')?.toUpperCase() ?? asinFromHref(href);
      if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) return;

      const rankText = firstText(card, ['.zg-bdg-text', 'span.zg-bdg-text', '.p13n-sc-ranking-badge']);
      const title =
        firstText(card, [
          'div[class*="p13n-sc-css-line-clamp"]',
          '.p13n-sc-truncate',
          '._cDEzb_p13n-sc-css-line-clamp-3_g3dy1',
          'a[href*="/dp/"]',
        ]) ?? clean(firstAttr(card, ['img'], 'alt')) ?? undefined;

      const price = parsePriceText(
        firstText(card, ['._cDEzb_p13n-sc-price_3mJ9Z', '.p13n-sc-price', '.a-price .a-offscreen']),
        country.currency,
      );
      const rating = parseRating(firstText(card, ['span.a-icon-alt', '[aria-label*="out of 5"]']));
      const count = parseCount(
        firstText(card, ['span.a-size-small', '.a-size-base[aria-label*="ratings"]']),
      );

      products.push({
        asin,
        rank: parseNumber(rankText) ?? products.length + 1,
        title,
        url: absoluteUrl(href, country.domain),
        photo: absoluteUrl(firstAttr(card, ['img'], 'src'), country.domain),
        price,
        rating: rating !== undefined || count !== undefined ? { value: rating ?? 0, count: count ?? 0 } : undefined,
      });
    },
  );

  return {
    products: dedupeBy(products, (product) => product.asin),
    category,
    type,
    page,
    country: country.code,
  };
}

import type { CheerioAPI } from 'cheerio';
import { load } from 'cheerio';
import type { CountryConfig } from '../countries.js';
import { upstreamUnavailable } from '../errors.js';
import type { Product } from '../types.js';
import {
  absoluteUrl,
  allTexts,
  asinFromHref,
  clean,
  dedupeBy,
  firstAttr,
  firstText,
  parseCount,
  parsePriceText,
  parseRating,
} from './helpers.js';

/** Repair common UTF-8 bytes decoded as Windows-1252 in scraped titles. */
function repairTitleEncoding(value: string): string {
  if (!/[ÃÂâðï]/.test(value)) return value;
  const cp1252: Record<string, number> = {
    '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86,
    '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c,
    'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95,
    '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b,
    'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
  };
  const bytes = Array.from(value, (char) => {
    const code = char.codePointAt(0)!;
    return cp1252[char] ?? (code <= 0xff ? code : null);
  });
  if (bytes.some((byte) => byte === null)) return value;
  const repaired = Buffer.from(bytes as number[]).toString('utf8');
  if (repaired.includes('\uFFFD')) return value;
  const markers = /[ÃÂâðï]/g;
  return (repaired.match(markers) ?? []).length < (value.match(markers) ?? []).length
    ? repaired
    : value;
}

/** Parse product tiles from search-like pages (search, deals, GTIN lookup, coupons). */
export function parseProductCards($: CheerioAPI, country: CountryConfig): Product[] {
  const products: Product[] = [];

  $('[data-component-type="s-search-result"], div.s-result-item[data-asin], div[data-asin]').each(
    (_, element) => {
      const card = $(element);
      // Sponsored or nested cards may carry the ASIN while the main title/image/link
      // are rendered in a child tile. Try both the card and descendants.
      const href =
        firstAttr(card, ['a.s-link-style', 'h2 a', 'a[href*="/dp/"]'], 'href') ??
        firstAttr(card.find('a[href*="/dp/"]').first(), ['a[href*="/dp/"]'], 'href') ??
        undefined;
      const asin = card.attr('data-asin')?.toUpperCase() || asinFromHref(href);
      if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) return;

      const rawPrice =
        firstText(card, [
          '.a-price .a-offscreen',
          'span.a-price > span.a-offscreen',
          '.p13n-sc-price',
          '.a-price-whole',
        ]) ?? undefined;
      let price = parsePriceText(rawPrice, country.currency);
      if (!price && clean(card.find('.a-price-whole').first().text())) {
        const whole = clean(card.find('.a-price-whole').first().text()).replace(/\D/g, '');
        const fraction = clean(card.find('.a-price-fraction').first().text()).replace(/\D/g, '');
        price = parsePriceText(`${whole}.${fraction || '00'}`, country.currency);
      }
      const original = parsePriceText(
        firstText(card, ['.a-price.a-text-price .a-offscreen', '.a-text-strike']),
        country.currency,
      );
      if (price && original && original.value > price.value) {
        price.original_value = original.value;
        price.original_display = original.display;
        price.discount_percent = Math.round(((original.value - price.value) / original.value) * 100);
      }

      const ratingText = firstText(card, [
        'span.a-icon-alt',
        'i[class*="star"] > span.a-icon-alt',
        '[aria-label*="out of 5 stars"]',
      ]);
      const ratingValue = parseRating(ratingText);
      const ratingCount = parseCount(
        firstText(card, [
          'span.a-size-base.s-underline-text',
          'a[aria-label*="ratings"] span',
          'span[aria-label*="ratings"]',
          '.a-size-base[dir="auto"]',
        ]),
      );

      const image = firstAttr(card, ['img.s-image', 'img[src*="images-amazon"]'], 'src');
      const titleCandidates = [
        firstText(card, ['h2 a span', 'h2 span', 'a[href*="/dp/"] span.a-text-normal']),
        clean(card.find('h2').first().text()),
        firstAttr(card, ['a[href*="/dp/"]'], 'title'),
        firstAttr(card, ['img.s-image'], 'alt'),
        clean(card.find('img').first().attr('alt') ?? ''),
        firstText(card, ['h2', '.a-size-medium.a-color-base']),
      ].map((value) => repairTitleEncoding(clean(value))).filter(Boolean);
      const genericTitles = new Set(['apple', 'amazon renewed', 'amazon', 'samsung', 'sony']);
      const title = titleCandidates.find((value) => value.length > 12 && !genericTitles.has(value.toLowerCase())) ??
        titleCandidates.find((value) => !genericTitles.has(value.toLowerCase()));
      const badges = allTexts(card, '.a-badge-text, [data-cy="badge"], .ribbon').filter(Boolean);
      const cleanCard = card.clone();
      cleanCard.find('script, style, noscript').remove();
      const cardText = clean(cleanCard.text());
      const prime =
        /prime/i.test(clean(card.find('[aria-label*="prime" i], .a-icon-prime, .prime-icon').first().attr('aria-label') ?? '')) ||
        /\bprime\b/i.test(cardText);

      products.push({
        asin,
        title: title || undefined,
        url: absoluteUrl(href, country.domain),
        photo: absoluteUrl(image, country.domain),
        price,
        rating:
          ratingValue !== undefined || ratingCount !== undefined
            ? { value: ratingValue ?? 0, count: ratingCount ?? 0 }
            : undefined,
        brand: undefined,
        prime,
        sales_volume: /\b(bought|sold)\b/i.test(cardText)
          ? firstText(card, ['.a-size-base.a-color-secondary', '.a-size-small.a-color-secondary'])
          : undefined,
        delivery_text: firstText(cleanCard, [
          '[data-cy="delivery-recipe"]',
          '.a-size-small.a-color-success',
          '.a-color-success.a-size-small',
        ]),
        badges: badges.length ? badges : undefined,
      });
    },
  );

  return dedupeBy(products, (product) => product.asin);
}

export function parseSearchResults(
  html: string,
  country: CountryConfig,
  query: string,
  page: number,
) {
  const $ = load(html);
  const products = parseProductCards($, country);
  const infoText = clean(
    firstText($, ['[data-component-type="s-result-info-bar"]', '#s-result-count', '.s-breadcrumb-sr']) ??
      clean($('body').text()).slice(0, 5_000),
  );
  const totalMatch = infoText.match(/([\d,]+)\s+results?/i);
  const totalProducts = totalMatch ? parseCount(totalMatch[1]) ?? products.length : products.length;

  if (!products.length && !/no results|did not match any|no products found/i.test(infoText)) {
    // Safe diagnostics for production logs: counts only, never log page HTML or credentials.
    const cardCount = $('[data-component-type="s-search-result"], div.s-result-item[data-asin], div[data-asin]').length;
    const asinAttributeCount = $('[data-asin]').filter((_, element) =>
      /^[A-Z0-9]{10}$/i.test($(element).attr('data-asin') ?? ''),
    ).length;
    const productLinkCount = $('a[href*="/dp/"], a[href*="/gp/product/"]').length;
    console.warn('[search] zero products parsed', {
      htmlLength: html.length,
      pageTitle: clean($('title').first().text()).slice(0, 120),
      cardCount,
      validAsinAttributeCount: asinAttributeCount,
      productLinkCount,
    });
    throw upstreamUnavailable('Search page did not contain any recognizable product results');
  }

  return {
    products,
    total_products: totalProducts,
    country: country.code,
    page,
    query,
  };
}

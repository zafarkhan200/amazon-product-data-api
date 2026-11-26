import { load } from 'cheerio';
import type { CountryConfig } from '../countries.js';
import type { Deal, DealsData, DealProductsData, Product } from '../types.js';
import {
  absoluteUrl,
  clean,
  dedupeBy,
  firstAttr,
  firstText,
  parseCount,
  parseNumber,
  parsePriceText,
  parseRating,
} from './helpers.js';
import { parseProductCards } from './search.js';

function dealIdFromHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const match = href.match(/\/(?:deals|golden-deals)\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export function parseDeals(html: string, country: CountryConfig, page: number): DealsData {
  const $ = load(html);
  const deals: Deal[] = [];
  const dealById = new Map<string, Deal>();

  // Current Amazon Deals pages render product tiles with a CSA item id such as:
  // amzn1.asin.B0D7VRZ31J:amzn1.deal.fe70e85e
  const currentDealCards = $('[data-csa-c-item-type="deal"][data-csa-c-item-id]');
  if (currentDealCards.length) {
    currentDealCards.each((_, element) => {
      const card = $(element);
      const itemId = card.attr('data-csa-c-item-id') ?? '';
      const dealIdMatch = itemId.match(/amzn1\.deal\.([A-Za-z0-9_-]+)/i);
      const asinMatch = itemId.match(/amzn1\.asin\.([A-Z0-9]{10})/i);
      const dealId = dealIdMatch?.[1] ?? undefined;
      const asin = asinMatch?.[1]?.toUpperCase();
      if (!dealId || !asin) return;

      const href = firstAttr(card, ['a[href*="/dp/"]'], 'href');
      const title =
        firstAttr(card, ['a[aria-label]'], 'aria-label') ??
        firstAttr(card, ['img[alt]'], 'alt') ??
        undefined;
      const image = firstAttr(card, ['img'], 'src');
      const cardText = clean(card.text());
      const currentPriceText = firstText(card, ['.a-price:not(.a-text-price) .a-offscreen', '.a-price .a-offscreen']);
      const originalPriceText = firstText(card, ['.a-price.a-text-price .a-offscreen', '.a-text-price .a-offscreen']);
      const price = parsePriceText(currentPriceText, country.currency);
      const originalPrice = parsePriceText(originalPriceText, country.currency);
      if (price && originalPrice && originalPrice.value > price.value) {
        price.original_value = originalPrice.value;
        price.original_display = originalPrice.display;
        price.discount_percent = Math.round(((originalPrice.value - price.value) / originalPrice.value) * 100);
      }

      const ratingValue = parseRating(firstText(card, ['.a-icon-alt', '[aria-label*="out of 5 stars"]']));
      const ratingCount = parseCount(firstText(card, ['.a-size-base.s-underline-text', '[aria-label*="ratings"]']));
      const product: Product = {
        asin,
        title,
        url: absoluteUrl(href, country.domain),
        photo: absoluteUrl(image, country.domain),
        price,
        rating: ratingValue !== undefined || ratingCount !== undefined
          ? { value: ratingValue ?? 0, count: ratingCount ?? 0 }
          : undefined,
        badges: [firstText(card, ['[class*="badgeMessage"]', '[data-component="dui-badge"]']) ?? ''].filter(Boolean),
      };

      const discountMatch = cardText.match(/(\d{1,3})\s*%\s*off|-\s*(\d{1,3})\s*%/i);
      const deal = dealById.get(dealId) ?? {
        deal_id: clean(dealId),
        title: firstText(card, ['[class*="badgeMessage"]', 'h2', 'h3']) ?? title,
        type: /lightning/i.test(cardText) ? 'LIGHTNING_DEAL' : 'BEST_DEAL',
        discount: parseNumber(discountMatch?.[1] ?? discountMatch?.[2]),
        end_time: firstAttr(card, ['[data-end-time]'], 'data-end-time') ?? undefined,
        claimed_percent: parseNumber(cardText.match(/(\d{1,3})\s*%\s*claimed/i)?.[1]),
        photo: product.photo,
        url: product.url,
        sample_products: [],
      } satisfies Deal;

      if (!deal.sample_products.some((sample) => sample.asin === asin)) {
        deal.sample_products.push(product);
      }
      if (!dealById.has(dealId)) {
        dealById.set(dealId, deal);
        deals.push(deal);
      }
    });
  }

  // Retain support for older Amazon deal-card markup.
  if (!currentDealCards.length) {
    $('[data-testid="deal-card"], div.dealContent, div[id^="dealCard"]').each((_, element) => {
      const card = $(element);
      const cardText = clean(card.text());
      const href = firstAttr(card, ['a[href*="/deals/"]', 'a[href*="/dp/"]'], 'href') ?? undefined;
      const dealId =
        card.attr('data-deal-id') ??
        card.attr('data-testid')?.replace(/^deal-/i, '') ??
        card.attr('id') ??
        dealIdFromHref(href) ??
        `deal-${deals.length + 1}`;
      const discountMatch = cardText.match(/(\d{1,3})\s*%\s*off|-\s*(\d{1,3})\s*%/i);
      const claimedMatch = cardText.match(/(\d{1,3})\s*%\s*claimed/i);
      const scoped = load(card.html() ?? '');

      deals.push({
        deal_id: clean(dealId),
        title:
          firstText(card, ['[data-testid="deal-title"]', 'h2', 'h3', 'span[class*="title"]']) ??
          clean(firstAttr(card, ['img'], 'alt')) ??
          undefined,
        type: /lightning/i.test(cardText) ? 'LIGHTNING_DEAL' : 'BEST_DEAL',
        discount: parseNumber(discountMatch?.[1] ?? discountMatch?.[2]),
        end_time:
          firstAttr(card, ['[data-end-time]'], 'data-end-time') ??
          firstText(card, ['[data-testid="deal-timer"]', 'time', '.a-color-secondary']) ??
          undefined,
        claimed_percent: parseNumber(claimedMatch?.[1]),
        photo: absoluteUrl(firstAttr(card, ['img'], 'src'), country.domain),
        url: absoluteUrl(href, country.domain),
        sample_products: parseProductCards(scoped, country).slice(0, 4),
      });
    });
  }

  return { deals: dedupeBy(deals, (deal) => deal.deal_id), page, country: country.code };
}

export function parseDealProducts(
  html: string,
  country: CountryConfig,
  dealId: string,
  page: number,
): DealProductsData {
  const $ = load(html);
  const products: Product[] = [];
  const dealCards = $('[data-csa-c-item-type="deal"][data-csa-c-item-id]').filter((_, element) => {
    const itemId = $(element).attr('data-csa-c-item-id') ?? '';
    return itemId.endsWith(`amzn1.deal.${dealId}`);
  });

  dealCards.each((_, element) => {
    const card = $(element);
    const itemId = card.attr('data-csa-c-item-id') ?? '';
    const asin = itemId.match(/amzn1\.asin\.([A-Z0-9]{10})/i)?.[1]?.toUpperCase();
    if (!asin) return;

    const href = firstAttr(card, ['a[href*="/dp/"]'], 'href');
    const title =
      firstAttr(card, ['a[aria-label]'], 'aria-label') ??
      firstAttr(card, ['img[alt]'], 'alt') ??
      undefined;
    const image = firstAttr(card, ['img'], 'src');
    const currentPriceText = firstText(card, [
      '.a-price:not(.a-text-price) .a-offscreen',
      '.a-price .a-offscreen',
    ]);
    const originalPriceText = firstText(card, [
      '.a-price.a-text-price .a-offscreen',
      '.a-text-price .a-offscreen',
    ]);
    const price = parsePriceText(currentPriceText, country.currency);
    const originalPrice = parsePriceText(originalPriceText, country.currency);
    if (price && originalPrice && originalPrice.value > price.value) {
      price.original_value = originalPrice.value;
      price.original_display = originalPrice.display;
      price.discount_percent = Math.round(
        ((originalPrice.value - price.value) / originalPrice.value) * 100,
      );
    }

    const ratingValue = parseRating(firstText(card, [
      '.a-icon-alt',
      '[aria-label*="out of 5 stars"]',
    ]));
    const ratingCount = parseCount(firstText(card, [
      '.a-size-base.s-underline-text',
      '[aria-label*="ratings"]',
    ]));

    products.push({
      asin,
      title,
      url: absoluteUrl(href, country.domain),
      photo: absoluteUrl(image, country.domain),
      price,
      rating: ratingValue !== undefined || ratingCount !== undefined
        ? { value: ratingValue ?? 0, count: ratingCount ?? 0 }
        : undefined,
      badges: [
        firstText(card, ['[class*="badgeMessage"]', '[data-component="dui-badge"]']) ?? '',
      ].filter(Boolean),
    });
  });

  const uniqueProducts = dedupeBy(products, (product) => product.asin);
  if (!uniqueProducts.length) {
    console.warn('[deal_products] no matching deal cards found', {
      requestedDealId: dealId,
      currentDealCardCount: $('[data-csa-c-item-type="deal"][data-csa-c-item-id]').length,
      htmlLength: html.length,
    });
  }

  return {
    deal_id: dealId,
    products: uniqueProducts,
    total_products: uniqueProducts.length,
    page,
    country: country.code,
  };
}

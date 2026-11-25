import { load } from 'cheerio';
import type { CountryConfig } from '../countries.js';
import type { Offer, OffersData, Product, ProductDetails } from '../types.js';
import { clean, dedupeBy, firstAttr, firstText, parseCount, priceFrom } from './helpers.js';
import { parseProductBase, parseProductDetails } from './product.js';

export function parseOffers(
  html: string,
  country: CountryConfig,
  page: number,
  limit: number,
  productOverride?: ProductDetails,
): OffersData {
  const $ = load(html);

  let product: ProductDetails | Product;
  if (productOverride) {
    product = productOverride;
  } else {
    try {
      product = parseProductDetails(html, country);
    } catch {
      product = parseProductBase($, country);
    }
  }

  const offers: Offer[] = [];
  $('#aod-offer, div[data-aod-offer-id], .aod-offer, #aod-new-table tr.aod-offer, div.olpOffer').each((_, element) => {
    const row = $(element);
    const rowText = clean(row.text());
    const price =
      priceFrom(
        row,
        ['.a-price .aok-offscreen', '.a-price .a-offscreen', '.olpOfferPrice', 'span.a-color-base', '.a-price-whole'],
        country.currency,
      ) ?? undefined;
    const seller = firstText(row, [
      '#aod-offer-soldBy a',
      '#aod-offer-soldBy',
      '.aod-offer-seller .a-color-base',
      '.aod-offer-soldBy',
      '.olpSellerName',
      '.aod-offer-seller a',
    ]);
    const shipping = firstText(row, ['#aod-offer-shipsFrom', '.aod-offer-shipping', '.olpShippingInfo']);
    const deliveryDate = firstText(row, ['#aod-offer-delivery', '.aod-delivery-date', '.olpDeliveryDate']);
    const sellerFeedback =
      firstAttr(
        row,
        ['[aria-label*="feedback"]', '[aria-label*="Feedback"]', '[aria-label*="seller"]'],
        'aria-label',
      ) ?? firstText(row, ['[data-hook="seller-rating"]']);
    const sellerRating = parseCount(sellerFeedback);

    offers.push({
      seller,
      seller_rating: sellerRating,
      price,
      shipping,
      delivery_date: deliveryDate,
      condition: firstText(row, ['#aod-offer-heading', '.aod-condition', '.olpCondition', '.a-color-secondary']),
      is_fba: /fulfilled by amazon/i.test(rowText),
      is_prime: /\bprime\b/i.test(rowText),
      url:
        firstAttr(row, ['a[href*="/dp/"]'], 'href') ??
        (product.asin ? `https://www.${country.domain}/dp/${product.asin}` : undefined),
    });
  });

  const deduped = dedupeBy(offers, (offer) => `${offer.seller ?? ''}|${offer.price?.value ?? ''}`);
  const totalText = firstAttr($, ['#aod-total-offer-count'], 'value') ?? firstText($, ['#aod-offer-count', '#olp-upd-new', '.aod-offer-count']);

  return {
    product,
    offers: deduped.slice((page - 1) * limit, page * limit),
    total_offers: parseCount(totalText) ?? deduped.length,
    page,
    limit,
    country: country.code,
  };
}

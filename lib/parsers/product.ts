import { load, type CheerioAPI } from 'cheerio';
import type { CountryConfig } from '../countries';
import { notFound } from '../errors';
import type { Product, ProductDetails } from '../types';
import {
  absoluteUrl,
  allTexts,
  asinFromHref,
  clean,
  firstAttr,
  firstText,
  jsonLdProduct,
  keyValueRows,
  parseCount,
  parsePriceText,
  parseRating,
  priceFrom,
  rankFromText,
  requireTitle,
} from './helpers';

const PRICE_SELECTORS = [
  '#corePriceDisplay_desktop_feature_div .a-offscreen',
  '#corePrice_feature_div .a-offscreen',
  '#priceblock_ourprice',
  '#priceblock_dealprice',
  '#apex_offerDisplay_desktop .a-offscreen',
  '.priceToPay .a-offscreen',
  '.a-price .a-offscreen',
];

const ORIGINAL_PRICE_SELECTORS = [
  '.a-price.a-text-price .a-offscreen',
  '#listPrice',
  '.a-text-strike',
  'span[data-a-strike="true"] .a-offscreen',
];

/** Fields available both on a product page and in the header of an offers page. */
export function parseProductBase($: CheerioAPI, country: CountryConfig): Product {
  const ld = jsonLdProduct($) ?? {};
  const canonical =
    firstAttr($, ['link[rel="canonical"]'], 'href') ??
    firstAttr($, ['meta[property="og:url"]'], 'content');
  const asin =
    firstAttr($, ['input#ASIN', 'input[name="ASIN"]'], 'value') ??
    asinFromHref(canonical) ??
    (/^[A-Z0-9]{10}$/.test(String(ld.sku ?? '')) ? String(ld.sku) : undefined);

  if (!asin) throw notFound('ASIN not found on the upstream page');

  const title = requireTitle(
    firstText($, ['#productTitle', 'h1.a-size-large', 'h1[class*="product-title"]']) ??
      (typeof ld.name === 'string' ? ld.name : undefined),
  );

  const price = priceFrom($, PRICE_SELECTORS, country.currency) ??
    (typeof ld.offers === 'object' && ld.offers && !Array.isArray(ld.offers)
      ? parsePriceText(
          (ld.offers as { price?: string; priceSpecification?: { price?: string } }).price ??
            (ld.offers as { priceSpecification?: { price?: string } }).priceSpecification?.price,
          country.currency,
        )
      : undefined);

  const original = priceFrom($, ORIGINAL_PRICE_SELECTORS, country.currency);
  if (price && original && original.value > price.value) {
    price.original_value = original.value;
    price.original_display = original.display;
    price.discount_percent = Math.round(((original.value - price.value) / original.value) * 100);
  }

  const ratingText =
    firstAttr($, ['#acrPopover'], 'title') ??
    firstText($, ['span.a-icon-alt', '#acrPopover span.a-icon-alt', '[data-hook="rating-out-of-text"]']);
  const countText = firstText($, [
    '#acrCustomerReviewText',
    '#acrCustomerReviewLink span',
    '[data-hook="total-review-count"]',
  ]);
  const ratingValue = parseRating(ratingText) ??
    (typeof ld.aggregateRating === 'object' && ld.aggregateRating
      ? parseRating(String((ld.aggregateRating as { ratingValue?: string }).ratingValue))
      : undefined);
  const ratingCount =
    parseCount(countText) ??
    (typeof ld.aggregateRating === 'object' && ld.aggregateRating
      ? parseCount(String((ld.aggregateRating as { reviewCount?: string }).reviewCount))
      : undefined);

  const imageCandidates = [
    firstAttr($, ['#landingImage'], 'data-old-hires'),
    firstAttr($, ['#landingImage'], 'src'),
    ...$('[data-hook="alt-images"] img, #altImages img')
      .map((_, element) => $(element).attr('data-old-hires') ?? $(element).attr('src') ?? '')
      .get(),
    ...(Array.isArray(ld.image) ? ld.image : ld.image ? [ld.image] : []).map(String),
  ]
    .map((image) => absoluteUrl(image, country.domain))
    .filter((image): image is string => Boolean(image));

  const photo = imageCandidates[0];
  const href = firstAttr($, ['#buybox a[href*="/dp/"]'], 'href') ?? canonical;

  return {
    asin,
    title,
    url: absoluteUrl(href, country.domain),
    photo,
    price,
    rating:
      ratingValue !== undefined || ratingCount !== undefined
        ? { value: ratingValue ?? 0, count: ratingCount ?? 0 }
        : undefined,
    brand:
      firstText($, ['#bylineInfo', 'a#brand', '[data-feature-name="bylineInfo"]'])
        ?.replace(/^(Visit the|Brand:)\s*/i, '')
        ?.replace(/\s+Store$/i, '') ??
      (typeof ld.brand === 'string' ? ld.brand : undefined),
    prime:
      $('#buybox [aria-label*="Prime"], #buybox .a-icon-prime, #primeBadge_feature_div').length > 0,
    delivery_text: firstText($, ['#deliveryMessage_feature_div', '#mir-layout-DELIVERY_BLOCK']),
    badges: allTexts($, '.a-badge-text, [data-cy="badge"], #badgeFeature_div'),
  };
}

export function parseProductDetails(html: string, country: CountryConfig): ProductDetails {
  const $ = load(html);
  const base = parseProductBase($, country);
  const ld = jsonLdProduct($) ?? {};

  const bullets = allTexts($, '#feature-bullets li span.a-list-item').filter(
    (item) => !/make sure this fits|see more/i.test(item),
  );
  const description =
    firstText($, ['#productDescription', '#bookDescription_feature_div', '#aplus_feature_div']) ??
    (typeof ld.description === 'string' ? clean(ld.description) : undefined);

  const productInformation = keyValueRows($, [
    '#productDetails_techSpec_section_1 tr',
    '#productDetails_detailBullets_sections1 tr',
    '#technicalSpecifications_section_1 tr',
    '#detailBullets_feature_div li',
  ]);

  const variations: Array<{ type: string; values: string[] }> = [];
  $('#twister [id^="variation_"], #twister .twisterSwatch, #twister li[title]').each((_, element) => {
    const node = $(element);
    const type = clean(
      node.attr('data-variation-type') ??
        node.closest('[id^="variation_"]').attr('id')?.replace('variation_', '') ??
        'option',
    );
    const value = clean(node.attr('title') ?? node.text());
    if (!value) return;
    const group = variations.find((item) => item.type === type);
    if (group) {
      if (!group.values.includes(value)) group.values.push(value);
    } else {
      variations.push({ type, values: [value] });
    }
  });

  const rankText = firstText($, [
    '#detailBullets_feature_div',
    '#productDetails_detailBullets_sections1',
    '#SalesRank',
  ]);
  const bestSellersRank = rankFromText(rankText);

  const images = [
    ...new Set(
      [
        ...(base.photo ? [base.photo] : []),
        ...$('[data-hook="alt-images"] img, #altImages img')
          .map((_, element) => $(element).attr('data-old-hires') ?? $(element).attr('src') ?? '')
          .get()
          .map((src) => absoluteUrl(src, country.domain))
          .filter((src): src is string => Boolean(src)),
        ...(Array.isArray(ld.image) ? ld.image : ld.image ? [ld.image] : []).map(String),
      ],
    ),
  ];

  const video =
    firstAttr($, ['#altImages li.videoBlock a'], 'href') ??
    firstAttr($, ['video source'], 'src') ??
    undefined;

  const seller =
    firstText($, ['#merchantInfo .a-color-base', '#sellerProfileTriggerId']) ?? undefined;
  const buyBoxPrice =
    priceFrom($, ['#buybox .a-price .a-offscreen', '#apex_offerDisplay_desktop .a-offscreen'], country.currency) ??
    base.price;

  return {
    ...base,
    country: country.code as ProductDetails['country'],
    description,
    about_bullets: bullets.length ? bullets : undefined,
    images: images.length ? images : undefined,
    video,
    product_information: Object.keys(productInformation).length ? productInformation : undefined,
    variations: variations.length ? variations : undefined,
    best_sellers_rank: bestSellersRank.length ? bestSellersRank : undefined,
    category_path: allTexts($, '#wayfinding-breadcrumbs_feature_div ul li a').length
      ? allTexts($, '#wayfinding-breadcrumbs_feature_div ul li a')
      : undefined,
    review_insights: allTexts($, '#cr-insights .cr-insights-widget, #cr-insights [data-hook="insight"]').length
      ? allTexts($, '#cr-insights .cr-insights-widget, #cr-insights [data-hook="insight"]')
      : undefined,
    buy_box: {
      price: buyBoxPrice,
      seller,
      fulfillment: firstText($, ['#fulfillerInfoFeature_feature_div', '#fulfillerInfoFeature_feature_div span']),
      availability: firstText($, ['#availability']),
      shipping: firstText($, ['#shippingFeeMessage_feature_div', '#buybox-shipping-message']),
      is_prime: base.prime,
    },
    availability: firstText($, ['#availability']),
    coupon: firstText($, ['#promoPriceBlockMessage .a-color-success', '.couponLabel']),
  };
}

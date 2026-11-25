import { load } from 'cheerio';
import type { CountryConfig } from '../countries';
import { notFound, upstreamUnavailable } from '../errors';
import type { AsinToGtinData, GtinToAsinData } from '../types';
import { clean, jsonLd } from './helpers';
import { parseProductDetails } from './product';
import { parseProductCards } from './search';

const IDENTIFIER_PATTERNS: Record<string, RegExp[]> = {
  'EAN-13': [
    /(?:EAN(?:[-\s]?13)?|GTIN[-\s]?13)\s*[:#]?\s*(\d{13})/i,
    /\b(\d{13})\b/,
  ],
  UPC: [/(?:UPC(?:[-\s]?A)?)\s*[:#]?\s*(\d{12})/i, /\b(\d{12})\b/],
  ISBN: [
    /ISBN(?:[-\s]?(?:10|13))?\s*[:#]?\s*((?:97[89]\d{10}|\d{10}))/i,
    /\b((?:97[89]\d{10}|\d{10}))\b/,
  ],
};

export function parseAsinToGtin(
  html: string,
  country: CountryConfig,
  asin: string,
  type: string,
): AsinToGtinData {
  const $ = load(html);
  const product = parseProductDetails(html, country);
  const source = [
    clean($('#detailBullets_feature_div').text()),
    clean($('#productDetails_detailBullets_sections1').text()),
    JSON.stringify(jsonLd($)),
  ].join(' ');

  const patterns = IDENTIFIER_PATTERNS[type] ?? IDENTIFIER_PATTERNS['EAN-13']!;
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) {
      return { asin: product.asin || asin, type, value: match[1]!, country: country.code };
    }
  }
  throw notFound(`No ${type} identifier was found for ASIN ${asin}`);
}

export function parseGtinToAsin(
  html: string,
  country: CountryConfig,
  gtin: string,
): GtinToAsinData {
  const $ = load(html);
  const products = parseProductCards($, country);
  const bodyText = clean($('body').text()).slice(0, 5_000);
  if (!products.length && !/no results|did not match any/i.test(bodyText)) {
    throw upstreamUnavailable('GTIN lookup page did not contain recognizable results');
  }
  return {
    gtin,
    products: products.map((product) => ({ ...product })),
    total_products: products.length,
    country: country.code,
  };
}

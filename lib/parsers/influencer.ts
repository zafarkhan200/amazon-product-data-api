import { load } from 'cheerio';
import type { CountryConfig } from '../countries.js';
import { notFound } from '../errors.js';
import type { InfluencerProfileData, Product } from '../types.js';
import { absoluteUrl, asinFromHref, clean, firstAttr, firstText, parseCount } from './helpers.js';

export function parseInfluencerProfile(
  html: string,
  country: CountryConfig,
  influencerName: string,
): InfluencerProfileData {
  const $ = load(html);
  const name =
    firstText($, ['h1', '[data-hook="influencer-name"]', 'meta[name="influencer-name"]']) ??
    clean(firstAttr($, ['meta[property="og:title"]'], 'content')) ??
    influencerName;

  if (!name && !$('body').text().trim()) {
    throw notFound('Influencer profile not found');
  }

  const products: Product[] = [];
  $('a[href*="/dp/"], div[data-asin]').each((_, element) => {
    const node = $(element);
    const href = node.attr('href') ?? node.find('a[href*="/dp/"]').first().attr('href');
    const asin = node.attr('data-asin')?.toUpperCase() ?? asinFromHref(href);
    if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) return;
    products.push({
      asin,
      title: clean(node.find('img').first().attr('alt') ?? node.text()) || undefined,
      url: absoluteUrl(href, country.domain),
      photo: absoluteUrl(node.find('img').first().attr('src'), country.domain),
    });
  });

  const bodyText = clean($('body').text()).slice(0, 10_000);
  const followersMatch = bodyText.match(/([\d.,]+\s*[km]?)\s+(?:followers|subscribers)/i);

  return {
    name,
    url: firstAttr($, ['link[rel="canonical"]', 'meta[property="og:url"]'], 'href') ?? `https://www.${country.domain}/shop/${encodeURIComponent(name)}`,
    bio:
      firstAttr($, ['meta[name="description"]'], 'content') ??
      firstText($, ['[data-hook="influencer-bio"]']),
    followers: followersMatch ? parseCount(followersMatch[1]) : undefined,
    avatar: absoluteUrl(
      firstAttr($, ['[data-hook="influencer-avatar"] img', 'meta[property="og:image"]'], 'src') ??
        firstAttr($, ['meta[property="og:image"]'], 'content'),
      country.domain,
    ),
    products: products.slice(0, 20),
    country: country.code,
  };
}

import { createHash } from 'node:crypto';
import type { CheerioAPI } from 'cheerio';
import { load } from 'cheerio';
import type { CountryConfig } from '../countries.js';
import type { Review } from '../types.js';
import { absoluteUrl, allTexts, clean, firstAttr, firstText, parseCount, parseRating } from './helpers.js';

export function parseReviewCards($: CheerioAPI, country: CountryConfig, selector: string): Review[] {
  const reviews: Review[] = [];

  $(selector).each((_, element) => {
    const card = $(element);
    const title = firstText(card, ['[data-hook="review-title"]', '.review-title', 'a.review-title']);
    const text = firstText(card, ['[data-hook="review-body"]', '.review-body', '.review-text']);
    const author = firstText(card, ['[data-hook="review-author"] .a-profile-name', '.a-profile-name']);
    const date = firstText(card, ['[data-hook="review-date"]', '.review-date']);
    const rating = parseRating(
      firstText(card, [
        '[data-hook="review-star-rating"]',
        'i.a-icon-star > span.a-icon-alt',
        'span.a-icon-alt',
      ]),
    );
    const helpful = firstText(card, ['[data-hook="helpful-vote-statement"]']);
    const images = [
      ...card
        .find('[data-hook="review-image-tile"], img.review-image-tile, [data-hook="review-video-tile"] img')
        .map((_, img) => $(img).attr('src') ?? $(img).attr('data-src') ?? '')
        .get(),
      ...allTexts(card, '[data-hook="review-image-tile-thumbnail"]').map((value) => value),
    ]
      .map((src) => absoluteUrl(src, country.domain))
      .filter((src): src is string => Boolean(src));

    const id =
      card.attr('id') ??
      card.attr('data-review-id') ??
      card.find('[data-hook="review-title"]').attr('id') ??
      createHash('sha1').update(`${author ?? ''}|${date ?? ''}|${title ?? ''}|${text ?? ''}`).digest('hex').slice(0, 20);

    const url = absoluteUrl(
      firstAttr(card, ['[data-hook="review-title"]', 'a.review-title', 'a[href*="/product-reviews/"]'], 'href'),
      country.domain,
    );

    reviews.push({
      id,
      title: title || undefined,
      text: text || undefined,
      rating,
      author,
      date,
      verified:
        card.find('[data-hook="avp-badge"]').length > 0 || /verified purchase/i.test(clean(card.text())),
      helpful_votes: parseCount(helpful) ?? 0,
      images: images.length ? [...new Set(images)] : undefined,
      url,
    });
  });

  return reviews;
}

function nextCursorFromPage($: CheerioAPI, domain: string): string | undefined {
  const hrefs = $('a.a-last, .s-pagination-next, a[href*="cursor"], [data-hook="pagination-next"]')
    .map((_, element) => $(element).attr('href') ?? '')
    .get();
  for (const href of hrefs) {
    try {
      const url = new URL(href, `https://www.${domain}`);
      const cursor = url.searchParams.get('cursor');
      if (cursor) return cursor;
    } catch {
      // Skip malformed links.
    }
  }
  return undefined;
}

export function parseReviews(
  html: string,
  country: CountryConfig,
  asin: string,
  limit = 10,
) {
  const $ = load(html);
  const reviews = parseReviewCards($, country, 'div[data-hook="review"], div.review').slice(0, limit);
  return {
    asin,
    reviews,
    next_cursor: nextCursorFromPage($, country.domain),
    country: country.code,
  };
}

export function parseTopReviews(html: string, country: CountryConfig, asin: string) {
  const $ = load(html);
  const reviews = parseReviewCards(
    $,
    country,
    'div[data-hook="top-review"], [data-hook="cr-insights-top-review"], div[data-hook="review"]',
  ).slice(0, 10);
  return { asin, reviews, country: country.code };
}

import { load } from 'cheerio';
import type { CountryConfig } from '../countries.js';
import type { Deal, DealsData, DealProductsData } from '../types.js';
import {
  absoluteUrl,
  clean,
  dedupeBy,
  firstAttr,
  firstText,
  parseNumber,
} from './helpers.js';
import { parseProductCards, parseSearchResults } from './search.js';

function dealIdFromHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const match = href.match(/\/(?:deals|golden-deals)\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export function parseDeals(html: string, country: CountryConfig, page: number): DealsData {
  const $ = load(html);
  const deals: Deal[] = [];

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

  return { deals: dedupeBy(deals, (deal) => deal.deal_id), page, country: country.code };
}

export function parseDealProducts(
  html: string,
  country: CountryConfig,
  dealId: string,
  page: number,
): DealProductsData {
  const result = parseSearchResults(html, country, dealId, page);
  return {
    deal_id: dealId,
    products: result.products,
    total_products: result.total_products,
    page,
    country: country.code,
  };
}

import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { notFound } from '../errors.js';
import type { Price } from '../types.js';

/** A full document ($), a scoped selection, or a raw DOM node. */
export type Selectable = CheerioAPI | Cheerio<AnyNode> | AnyNode;

const wrapNode = load('');

export function select(root: Selectable, selector: string): Cheerio<AnyNode> {
  if (typeof root === 'function') return root(selector);
  if ('find' in root && typeof root.find === 'function') return root.find(selector);
  return wrapNode(root as AnyNode).find(selector);
}

/** Repair UTF-8 text that has been mis-decoded as Latin-1/Windows-1252. */
export function repairTextEncoding(value: string): string {
  if (!/[ÃÂâðï]/.test(value)) return value;

  // Work on Latin-1-sized runs independently. Amazon titles can also contain
  // zero-width spaces, emoji, and other Unicode characters that must be preserved.
  const repaired = value.replace(/[\u0000-\u00ff]+/g, (run) => {
    const decoded = Buffer.from(
      Array.from(run, (char) => char.charCodeAt(0)),
    ).toString('utf8');
    return decoded.includes('\uFFFD') ? run : decoded;
  });

  return repaired.replace(/[\u200B-\u200F\uFEFF\u061C]/g, '');
}


export const clean = (value?: string | null): string =>
  repairTextEncoding(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function firstText(root: Selectable, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const value = clean(select(root, selector).first().text());
    if (value) return value;
  }
  return undefined;
}

export function firstAttr(
  root: Selectable,
  selectors: string[],
  attribute: string,
): string | undefined {
  for (const selector of selectors) {
    const value = select(root, selector).first().attr(attribute);
    if (value) return clean(value);
  }
  return undefined;
}

function nodeText(node: AnyNode): string {
  if ('data' in node && typeof node.data === 'string') return node.data;
  if ('children' in node && node.children) return node.children.map(nodeText).join('');
  return '';
}

export function allTexts(root: Selectable, selector: string): string[] {
  return select(root, selector)
    .map((_, element) => clean(nodeText(element)))
    .get()
    .filter(Boolean);
}

export function parsePriceText(raw: string | undefined, currency: string): Price | undefined {
  if (!raw) return undefined;
  const display = clean(raw);
  let numeric = display.replace(/[^\d.,-]/g, '');
  if (numeric.includes(',') && numeric.includes('.')) {
    numeric =
      numeric.lastIndexOf(',') > numeric.lastIndexOf('.')
        ? numeric.replace(/\./g, '').replace(',', '.')
        : numeric.replace(/,/g, '');
  } else if (numeric.includes(',')) {
    numeric = /,\d{1,2}$/.test(numeric) ? numeric.replace(',', '.') : numeric.replace(/,/g, '');
  }
  const value = Number.parseFloat(numeric);
  if (!Number.isFinite(value)) return undefined;
  return { value: Math.round(value * 100) / 100, currency, display };
}

export function priceFrom(
  root: Selectable,
  selectors: string[],
  currency: string,
): Price | undefined {
  for (const selector of selectors) {
    const element = select(root, selector).first();
    const fromText = parsePriceText(clean(element.text()), currency);
    if (fromText) return fromText;
    const fromAttr = parsePriceText(
      element.attr('data-asin-price') ?? element.attr('content') ?? undefined,
      currency,
    );
    if (fromAttr) return fromAttr;
  }
  return undefined;
}

export function parseNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const match = clean(raw).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

export function parseCount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const match = clean(raw).toLowerCase().match(/([\d.,]+)\s*([km])?/);
  if (!match) return undefined;
  let value = Number.parseFloat(match[1]!.replace(/,/g, ''));
  if (!Number.isFinite(value)) return undefined;
  if (match[2] === 'k') value *= 1_000;
  if (match[2] === 'm') value *= 1_000_000;
  return Math.round(value);
}

export function parseRating(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const match = clean(raw).match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1]!.replace(',', '.'));
  return Number.isFinite(value) && value <= 5 ? value : undefined;
}

export function asinFromHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const match = href.match(/(?:\/dp\/|\/gp\/product\/|\/product\/|\/clp\/)([A-Z0-9]{10})(?:[\/?#]|$)/i);
  if (match) return match[1]!.toUpperCase();
  const bare = href.match(/(?:asin[=/:]|[?&]asin=)([A-Z0-9]{10})(?:[^A-Z0-9]|$)/i);
  return bare ? bare[1]!.toUpperCase() : undefined;
}

export function absoluteUrl(href: string | undefined, domain: string): string | undefined {
  if (!href) return undefined;
  const value = clean(href);
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `https://www.${domain}${value}`;
  return undefined;
}

export function jsonLd(root: Selectable): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  select(root, 'script[type="application/ld+json"]').each((_, element) => {
    const raw = nodeText(element);
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        result.push(entry as Record<string, unknown>);
        const graph = (entry as { '@graph'?: unknown })['@graph'];
        if (Array.isArray(graph)) {
          for (const item of graph) {
            if (item && typeof item === 'object') result.push(item as Record<string, unknown>);
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  });
  return result;
}

export function jsonLdProduct(root: Selectable): Record<string, unknown> | undefined {
  return jsonLd(root).find((item) => {
    const type = item['@type'];
    return type === 'Product' || (Array.isArray(type) && type.includes('Product'));
  });
}

export function keyValueRows(root: Selectable, selectors: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const selector of selectors) {
    select(root, selector).each((_, row) => {
      const cells = select(row, 'th, td, span.a-text-bold, span.a-fixed-left-grid-col');
      if (cells.length < 2) return;
      const key = clean(cells.first().text()).replace(/:$/, '');
      const value = clean(cells.eq(1).text());
      if (key && value && !result[key]) result[key] = value;
    });
  }
  return result;
}

export function rankFromText(raw: string | undefined): Array<{ rank: number; category: string }> {
  if (!raw) return [];
  const result: Array<{ rank: number; category: string }> = [];
  const pattern = /#([\d,]+)\s+in\s+([^()\n,]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    const rank = parseNumber(match[1]);
    const category = clean(match[2]);
    if (rank && category) result.push({ rank, category });
  }
  return result;
}

export function dedupeBy<T>(items: T[], keyOf: (item: T) => string | undefined): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function requireTitle(title: string | undefined, message = 'Product not found on Amazon'): string {
  if (!title) throw notFound(message);
  return title;
}

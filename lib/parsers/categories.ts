import { load } from 'cheerio';
import type { CountryConfig } from '../countries';
import type { Category, CategoryListData } from '../types';
import { clean, dedupeBy } from './helpers';

/** Fallback node ids keep the endpoint useful when Amazon changes nav markup. */
const FALLBACK_CATEGORIES: Category[] = [
  { id: '6785455011', name: 'Electronics' },
  { id: '283155', name: 'Books' },
  { id: '1063278', name: 'Home & Kitchen' },
  { id: '7145506011', name: 'Clothing, Shoes & Jewelry' },
  { id: '7107106011', name: 'Sports & Outdoors' },
  { id: '3760901', name: 'Beauty & Personal Care' },
  { id: '3760991', name: 'Toys & Games' },
  { id: '16310101', name: 'Grocery & Gourmet Food' },
  { id: '3760371', name: 'Health & Household' },
  { id: '488739011', name: 'Automotive' },
  { id: '2619533011', name: 'Pet Supplies' },
  { id: '281053', name: 'Baby' },
  { id: '2625373011', name: 'Movies & TV' },
  { id: '1036592', name: 'Music' },
  { id: '468642', name: 'Video Games' },
  { id: '228013', name: 'Tools & Home Improvement' },
  { id: '1069242', name: 'Office Products' },
  { id: '3615391', name: 'Patio, Lawn & Garden' },
];

export function parseCategoryList(html: string, country: CountryConfig): CategoryListData {
  const $ = load(html);
  const parsed: Category[] = [];

  $('#navFooter .navFooterDescItem a, #departments a, #hamburgerContent a, #site-directory a, #navFooter a').each(
    (_, element) => {
      const link = $(element);
      const name = clean(link.text());
      const href = link.attr('href') ?? '';
      if (name.length < 2 || name.length > 70) return;
      const nodeMatch = href.match(/[?&](?:node|i)=(\d+)/);
      const slugMatch = href.match(/\/(?:b|zgbs|s)\/([a-z0-9-]+)/i);
      const id = nodeMatch?.[1] ?? slugMatch?.[1] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      parsed.push({
        id,
        name,
        url: href.startsWith('/')
          ? `https://www.${country.domain}${href}`
          : href.startsWith('http')
            ? href
            : undefined,
      });
    },
  );

  const categories = dedupeBy(parsed, (category) => category.id);
  return {
    categories: categories.length >= 5 ? categories : FALLBACK_CATEGORIES,
    country: country.code,
  };
}

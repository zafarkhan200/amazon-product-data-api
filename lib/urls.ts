import type { CountryConfig } from './countries.js';
import type {
  BestSellersInput,
  DealsInput,
  OffersInput,
  ReviewsInput,
  SearchInput,
} from './schemas.js';

const slugify = (value: string) =>
  value
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function searchPath(params: SearchInput, country: CountryConfig): string {
  const query = new URLSearchParams({
    k: params.query,
    page: String(params.page),
    language: country.language,
  });

  const sortMap: Record<string, string> = {
    relevance: '',
    lowest_price: 'price-asc-rank',
    highest_price: 'price-desc-rank',
    reviews: 'review-rank',
    newest: 'date-desc-rank',
    best_sellers: 'exact-aware-popularity-rank',
  };
  if (params.sort_by && sortMap[params.sort_by]) query.set('s', sortMap[params.sort_by]!);
  if (params.category_id) query.set('i', params.category_id);
  if (params.min_price !== undefined || params.max_price !== undefined) {
    query.set('p', `${params.min_price ?? ''},${params.max_price ?? ''}`);
  }

  const refinements: string[] = [];
  if (params.brand) refinements.push(`p_89:${params.brand}`);
  if (params.condition) {
    refinements.push(`p_cond:${params.condition.charAt(0).toUpperCase()}${params.condition.slice(1)}`);
  }
  if (params.is_prime) refinements.push('p_85:2470955011');
  if (params.deals_and_discounts) refinements.push('p_n_deal_type:2724408011');
  if (refinements.length) query.set('rh', refinements.join(','));

  return `/s?${query.toString()}`;
}

export function productPath(asin: string): string {
  return `/dp/${asin}/`;
}

export function offersPath(params: OffersInput): string {
  // Amazon now loads seller offers through the All Offers Display (AOD) AJAX endpoint.
  const query = new URLSearchParams({ asin: params.asin });
  if (params.page > 1) query.set('pageno', String(params.page));
  return `/gp/product/ajax/aodAjaxMain/?${query.toString()}`;
}

export function reviewsPath(params: ReviewsInput): string {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  else query.set('page', '1');

  if (params.sort_by) query.set('sortBy', params.sort_by === 'most_recent' ? 'recent' : 'top-reviews');
  if (params.star_rating && params.star_rating !== 'all') {
    const starMap: Record<string, string> = {
      '5': 'five_star',
      '4': 'four_star',
      '3': 'three_star',
      '2': 'two_star',
      '1': 'one_star',
      positive: 'positive',
      critical: 'critical',
    };
    query.set('filterByStar', starMap[params.star_rating] ?? params.star_rating);
  }
  if (params.verified_purchases_only) query.set('filterByVerifiedOnly', 'true');
  if (params.images_or_videos_only) query.set('filterByMedia', 'images');
  if (params.current_format_only) query.set('filterByFormat', 'current');

  return `/product-reviews/${params.asin}/?${query.toString()}`;
}

export function bestSellersPath(params: BestSellersInput): string {
  const sections: Record<string, string> = {
    BEST_SELLERS: 'gp/bestsellers',
    NEW_RELEASES: 'gp/new-releases',
    MOVERS_AND_SHAKERS: 'gp/movers-and-shakers',
    MOST_WISHED_FOR: 'gp/most-wished-for',
    GIFT_IDEAS: 'gp/gift-ideas',
  };
  const category = params.category ? `/${slugify(params.category)}` : '';
  const query = new URLSearchParams({ pg: String(params.page) });
  return `/${sections[params.type] ?? 'gp/bestsellers'}${category}/?${query.toString()}`;
}

export function dealsPath(params: DealsInput): string {
  const section =
    params.deal_state === 'upcoming'
      ? '/deals/upcoming/'
      : params.deal_state === 'ended'
        ? '/deals/ended/'
        : '/deals/';
  const query = new URLSearchParams({ pg: String(params.page) });
  if (params.category) query.set('category', params.category);
  if (params.min_product_star_rating) query.set('minRating', String(params.min_product_star_rating));
  if (params.price_range) {
    const [min, max] = params.price_range.split('-');
    query.set('p', `${min},${max}`);
  }
  if (params.discount_range) query.set('discount', params.discount_range);
  return `${section}?${query.toString()}`;
}

export function dealProductsPath(dealId: string, page: number): string {
  return `/deals/${encodeURIComponent(dealId)}/?${new URLSearchParams({ pg: String(page) })}`;
}

/** Amazon promotion details use the ID from /promotion/psp/{promotion_id}. */
export function promoCodePath(promoCode: string): string {
  return `/promotion/psp/${encodeURIComponent(promoCode)}`;
}

export function categoryListPath(): string {
  return '/gp/site-directory?_encoding=UTF8';
}

export function influencerPath(name: string): string {
  return `/shop/${encodeURIComponent(slugify(name))}`;
}

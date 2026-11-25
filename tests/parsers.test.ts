import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../lib/countries.js';
import { parseBestSellers } from '../lib/parsers/best-sellers.js';
import { parseCategoryList } from '../lib/parsers/categories.js';
import { parseDeals } from '../lib/parsers/deals.js';
import { parseAsinToGtin } from '../lib/parsers/identifiers.js';
import { parseOffers } from '../lib/parsers/offers.js';
import { parseProductDetails } from '../lib/parsers/product.js';
import { parseReviews } from '../lib/parsers/reviews.js';
import { parseSearchResults } from '../lib/parsers/search.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const us = COUNTRIES.US;

describe('HTML parsers', () => {
  it('parses search results, prices, badges and total count', () => {
    const result = parseSearchResults(fixture('search.html'), us, 'headphones', 1);
    expect(result.products).toHaveLength(2);
    expect(result.total_products).toBe(1000);
    expect(result.products[0]).toMatchObject({
      asin: 'B09XYZ1234',
      title: 'Sony WH-1000XM5 Wireless Headphones',
      prime: true,
    });
    expect(result.products[0]?.price).toMatchObject({
      value: 298,
      currency: 'USD',
      original_value: 399.99,
      discount_percent: 25,
    });
    expect(result.products[0]?.rating).toEqual({ value: 4.8, count: 12345 });
    expect(result.products[0]?.badges).toContain('Best Seller');
    expect(result.products[0]?.url).toBe('https://www.amazon.com/Sony-WH-1000XM5/dp/B09XYZ1234/');
  });

  it('parses product details, bullets, rank, images and buy box', () => {
    const result = parseProductDetails(fixture('product.html'), us);
    expect(result.asin).toBe('B09XYZ1234');
    expect(result.brand).toBe('Sony');
    expect(result.about_bullets).toHaveLength(2);
    expect(result.description).toContain('noise cancelling');
    expect(result.best_sellers_rank?.[0]).toMatchObject({ rank: 12, category: 'Electronics' });
    expect(result.product_information?.['Item Weight']).toBe('250 g');
    expect(result.category_path).toEqual(['Electronics', 'Headphones', 'Over-Ear']);
    expect(result.images?.length).toBeGreaterThan(1);
    expect(result.buy_box?.seller).toBe('Amazon.com');
    expect(result.availability).toBe('In Stock');
  });

  it('parses marketplace offers', () => {
    const result = parseOffers(fixture('product.html'), us, 1, 10);
    expect(result.product.asin).toBe('B09XYZ1234');
    expect(result.offers).toHaveLength(2);
    expect(result.offers[0]).toMatchObject({
      seller: 'SoundStore',
      is_prime: true,
      seller_rating: 95,
    });
    expect(result.offers[0]?.price?.value).toBe(289.99);
    expect(result.offers[1]?.is_fba).toBe(true);
  });

  it('parses reviews and the next pagination cursor', () => {
    const result = parseReviews(fixture('reviews.html'), us, 'B09XYZ1234');
    expect(result.reviews).toHaveLength(2);
    expect(result.reviews[0]).toMatchObject({
      id: 'review-R1',
      author: 'Jane Doe',
      rating: 5,
      verified: true,
      helpful_votes: 23,
    });
    expect(result.reviews[0]?.images?.[0]).toBe('https://m.media-amazon.com/images/I/review1.jpg');
    expect(result.reviews[1]?.verified).toBe(false);
    expect(result.next_cursor).toBe('next-cursor-token');
  });

  it('extracts identifiers from product details', () => {
    const result = parseAsinToGtin(fixture('product.html'), us, 'B09XYZ1234', 'EAN-13');
    expect(result).toEqual({
      asin: 'B09XYZ1234',
      type: 'EAN-13',
      value: '4548736134999',
      country: 'US',
    });
  });

  it('parses ranked lists, deals and category navigation without throwing', () => {
    const bestSellers = parseBestSellers(
      '<div id="gridItemRoot" data-asin="B09XYZ1234"><span class="zg-bdg-text">#12</span><a href="/dp/B09XYZ1234/">Sony Headphones</a><span class="p13n-sc-price">$298.00</span><span class="a-icon-alt">4.8 out of 5 stars</span></div>',
      us,
      'Electronics',
      'BEST_SELLERS',
      1,
    );
    expect(bestSellers.products[0]).toMatchObject({ asin: 'B09XYZ1234', rank: 12 });

    const deals = parseDeals(
      '<div data-testid="deal-card" data-deal-id="lightning-1">Lightning Deal Sony 25% off 60% claimed <a href="/deals/lightning-1">Deal</a></div>',
      us,
      1,
    );
    expect(deals.deals[0]).toMatchObject({
      deal_id: 'lightning-1',
      type: 'LIGHTNING_DEAL',
      discount: 25,
      claimed_percent: 60,
    });

    const categories = parseCategoryList(
      '<div id="departments"><a href="/b/?node=6785455011">Electronics</a><a href="/b/?node=283155">Books</a><a href="/b/?node=1063278">Home</a><a href="/b/?node=3760901">Beauty</a></div>',
      us,
    );
    expect(categories.categories.some((category) => category.id === '6785455011')).toBe(true);
  });
});

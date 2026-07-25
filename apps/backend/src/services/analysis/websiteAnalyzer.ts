import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import type { WebsiteAnalysis, WebsiteIssue } from '@prospectai/shared';

/**
 * Analyzes a website URL using Playwright + Cheerio.
 * Returns a structured analysis report with issues and a score.
 */
export async function analyzeWebsite(url: string): Promise<Omit<WebsiteAnalysis, 'id' | 'business_id'>> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (compatible; ProspectAIBot/1.0)',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  let html = '';
  let techStack: string[] = [];
  let pageLoadTime = 0;
  let hasHttps = false;

  try {
    hasHttps = url.startsWith('https://');
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

    const start = Date.now();
    await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    pageLoadTime = Date.now() - start;

    html = await page.content();
    techStack = await detectTechStack(page);
  } catch (err) {
    console.error(`Failed to load ${url}:`, err);
  } finally {
    await browser.close();
  }

  const $ = cheerio.load(html);
  const issues: WebsiteIssue[] = [];

  // --- Checks ---

  // HTTPS
  if (!hasHttps) {
    issues.push({ type: 'no_https', severity: 'critical', description: 'Site is not served over HTTPS.' });
  }

  // Mobile responsiveness — check for viewport meta tag
  const hasViewportMeta = $('meta[name="viewport"]').length > 0;
  if (!hasViewportMeta) {
    issues.push({ type: 'not_mobile_responsive', severity: 'critical', description: 'No viewport meta tag found. Site may not be mobile-friendly.' });
  }

  // Page speed
  const isSlowLoad = pageLoadTime > 4000;
  if (isSlowLoad) {
    issues.push({ type: 'slow_load', severity: 'warning', description: `Page took ${(pageLoadTime / 1000).toFixed(1)}s to load (should be under 3s).` });
  }

  // Booking/reservation forms
  const bookingKeywords = ['book', 'booking', 'reserve', 'reservation', 'appointment'];
  const pageText = $('body').text().toLowerCase();
  const hasBookingForm = bookingKeywords.some(k => pageText.includes(k)) && $('form').length > 0;
  if (!hasBookingForm) {
    issues.push({ type: 'no_booking_form', severity: 'warning', description: 'No booking or reservation form detected.' });
  }

  // Contact form
  const hasContactForm = $('form').length > 0 && (
    pageText.includes('contact') || pageText.includes('get in touch') || pageText.includes('send message')
  );
  if (!hasContactForm) {
    issues.push({ type: 'no_contact_form', severity: 'warning', description: 'No contact form detected.' });
  }

  // SEO meta tags
  const hasTitle = $('title').length > 0 && $('title').text().trim().length > 0;
  const hasMetaDesc = $('meta[name="description"]').length > 0;
  const hasSeoMeta = hasTitle && hasMetaDesc;
  if (!hasSeoMeta) {
    issues.push({ type: 'missing_seo_meta', severity: 'warning', description: 'Missing title tag or meta description. Hurts SEO visibility.' });
  }

  // Large unoptimized images
  const images = $('img').toArray();
  const hasLargeImages = images.some(img => {
    const src = $(img).attr('src') ?? '';
    return !src.includes('.webp') && !src.includes('tiny') && !$(img).attr('loading');
  });
  if (hasLargeImages) {
    issues.push({ type: 'large_images', severity: 'info', description: 'Images may not be optimized (no lazy-loading, no WebP format detected).' });
  }

  // Analytics
  const hasAnalytics = html.includes('gtag') || html.includes('google-analytics') || html.includes('ga(') || html.includes('fbq(');
  if (!hasAnalytics) {
    issues.push({ type: 'no_analytics', severity: 'info', description: 'No analytics tracking detected.' });
  }

  // Live chat
  const hasLiveChat = html.includes('intercom') || html.includes('tawk.to') || html.includes('crisp') || html.includes('zendesk');

  // --- Score calculation ---
  const score = calculateScore({
    hasHttps,
    isMobileResponsive: hasViewportMeta,
    isSlowLoad,
    hasBookingForm,
    hasContactForm,
    hasSeoMeta,
    hasLargeImages,
    hasAnalytics,
    issueCount: issues.length,
  });

  const recommendations = generateRecommendations(issues);

  return {
    url,
    score,
    has_https: hasHttps,
    is_mobile_responsive: hasViewportMeta,
    page_speed_score: isSlowLoad ? 40 : 80,
    has_booking_form: hasBookingForm,
    has_contact_form: hasContactForm,
    has_seo_meta: hasSeoMeta,
    has_large_images: hasLargeImages,
    has_analytics: hasAnalytics,
    has_live_chat: hasLiveChat,
    tech_stack: techStack,
    issues,
    recommendations,
    analyzed_at: new Date().toISOString(),
  };
}

function calculateScore(checks: {
  hasHttps: boolean;
  isMobileResponsive: boolean;
  isSlowLoad: boolean;
  hasBookingForm: boolean;
  hasContactForm: boolean;
  hasSeoMeta: boolean;
  hasLargeImages: boolean;
  hasAnalytics: boolean;
  issueCount: number;
}): number {
  let score = 100;
  if (!checks.hasHttps) score -= 25;
  if (!checks.isMobileResponsive) score -= 20;
  if (checks.isSlowLoad) score -= 15;
  if (!checks.hasContactForm) score -= 10;
  if (!checks.hasSeoMeta) score -= 10;
  if (checks.hasLargeImages) score -= 5;
  if (!checks.hasAnalytics) score -= 5;
  return Math.max(0, score);
}

function generateRecommendations(issues: WebsiteIssue[]): string[] {
  const recs: Record<string, string> = {
    no_https: 'Migrate site to HTTPS with an SSL certificate (free via Let\'s Encrypt).',
    not_mobile_responsive: 'Rebuild or redesign the site with a mobile-first responsive layout.',
    slow_load: 'Optimize images, enable caching, and use a CDN to improve load times.',
    no_booking_form: 'Add an online booking or appointment form to reduce friction for customers.',
    no_contact_form: 'Add a contact form with auto-responses to capture leads 24/7.',
    missing_seo_meta: 'Add descriptive title tags and meta descriptions to each page.',
    large_images: 'Convert images to WebP format and implement lazy loading.',
    no_analytics: 'Install Google Analytics or similar to track visitor behavior.',
  };
  return issues.map(i => recs[i.type]).filter(Boolean);
}

async function detectTechStack(page: import('playwright').Page): Promise<string[]> {
  const stack: string[] = [];
  const html = await page.content();

  if (html.includes('wp-content') || html.includes('wp-includes')) stack.push('WordPress');
  if (html.includes('shopify')) stack.push('Shopify');
  if (html.includes('wix.com')) stack.push('Wix');
  if (html.includes('squarespace')) stack.push('Squarespace');
  if (html.includes('react')) stack.push('React');
  if (html.includes('angular')) stack.push('Angular');
  if (html.includes('vue')) stack.push('Vue.js');
  if (html.includes('bootstrap')) stack.push('Bootstrap');
  if (html.includes('tailwind')) stack.push('Tailwind CSS');
  if (html.includes('jquery')) stack.push('jQuery');

  return stack;
}

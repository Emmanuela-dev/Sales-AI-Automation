import { chromium, type Browser } from 'playwright';
import * as cheerio from 'cheerio';
import type { WebsiteAnalysis, WebsiteIssue } from '@prospectai/shared';
import { assertPublicHttpUrl } from '../../lib/safeUrl';

const NAVIGATION_TIMEOUT_MS = 20_000;
const SLOW_LOAD_THRESHOLD_MS = 4000;

/**
 * Analyzes a website URL using Playwright + Cheerio.
 * Returns a structured analysis report with issues and a score.
 */
export async function analyzeWebsite(url: string): Promise<Omit<WebsiteAnalysis, 'id' | 'business_id'>> {
  const safeUrl = await assertPublicHttpUrl(url);

  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    // Distinct from an unreachable site: this is a deployment problem, so fail
    // loudly rather than reporting a bogus analysis.
    throw new Error(
      'Could not launch the Playwright browser. Run `npx playwright install chromium` ' +
        `in the project root. Original error: ${(err as Error).message}`
    );
  }

  let html = '';
  let pageLoadTime = 0;
  let loadFailure: string | null = null;

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (compatible; ProspectAIBot/1.0)',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    const start = Date.now();
    const response = await page.goto(safeUrl, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    pageLoadTime = Date.now() - start;

    if (response && response.status() >= 400) {
      loadFailure = `The site returned HTTP ${response.status()}.`;
    } else {
      html = await page.content();
    }
  } catch (err) {
    loadFailure = (err as Error).message.split('\n')[0];
  } finally {
    await browser.close();
  }

  // A site we could not load must not be scored as if we had inspected it.
  // Previously an unreachable site produced a full report of fabricated issues
  // ("no HTTPS", "no contact form") derived from an empty document.
  if (loadFailure !== null) {
    return unreachableReport(safeUrl, loadFailure);
  }

  return buildReport(safeUrl, html, pageLoadTime);
}

function unreachableReport(
  url: string,
  reason: string
): Omit<WebsiteAnalysis, 'id' | 'business_id'> {
  return {
    url,
    score: 0,
    has_https: url.startsWith('https://'),
    is_mobile_responsive: false,
    page_speed_score: 0,
    has_booking_form: false,
    has_contact_form: false,
    has_seo_meta: false,
    has_large_images: false,
    has_analytics: false,
    has_live_chat: false,
    tech_stack: [],
    issues: [
      {
        type: 'site_unreachable',
        severity: 'critical',
        description: `The website could not be loaded. ${reason}`,
      },
    ],
    recommendations: [
      'The site is unreachable — a strong opening for a rebuild or hosting conversation. Confirm the correct URL before reaching out.',
    ],
    analyzed_at: new Date().toISOString(),
  };
}

function buildReport(
  url: string,
  html: string,
  pageLoadTime: number
): Omit<WebsiteAnalysis, 'id' | 'business_id'> {
  const $ = cheerio.load(html);
  const issues: WebsiteIssue[] = [];

  const hasHttps = url.startsWith('https://');
  if (!hasHttps) {
    issues.push({ type: 'no_https', severity: 'critical', description: 'Site is not served over HTTPS.' });
  }

  // Mobile responsiveness — check for viewport meta tag
  const hasViewportMeta = $('meta[name="viewport"]').length > 0;
  if (!hasViewportMeta) {
    issues.push({ type: 'not_mobile_responsive', severity: 'critical', description: 'No viewport meta tag found. Site may not be mobile-friendly.' });
  }

  // Page speed
  const isSlowLoad = pageLoadTime > SLOW_LOAD_THRESHOLD_MS;
  if (isSlowLoad) {
    issues.push({ type: 'slow_load', severity: 'warning', description: `Page took ${(pageLoadTime / 1000).toFixed(1)}s to load (should be under 3s).` });
  }

  // Booking/reservation forms
  const bookingKeywords = ['book', 'booking', 'reserve', 'reservation', 'appointment'];
  const pageText = $('body').text().toLowerCase();
  const hasBookingForm = bookingKeywords.some((k) => pageText.includes(k)) && $('form').length > 0;
  if (!hasBookingForm) {
    issues.push({ type: 'no_booking_form', severity: 'warning', description: 'No booking or reservation form detected.' });
  }

  // Contact form
  const hasContactForm =
    $('form').length > 0 &&
    (pageText.includes('contact') || pageText.includes('get in touch') || pageText.includes('send message'));
  if (!hasContactForm) {
    issues.push({ type: 'no_contact_form', severity: 'warning', description: 'No contact form detected.' });
  }

  // SEO meta tags
  const hasTitle = $('title').text().trim().length > 0;
  const hasMetaDesc = $('meta[name="description"]').length > 0;
  const hasSeoMeta = hasTitle && hasMetaDesc;
  if (!hasSeoMeta) {
    issues.push({ type: 'missing_seo_meta', severity: 'warning', description: 'Missing title tag or meta description. Hurts SEO visibility.' });
  }

  // Large unoptimized images
  const images = $('img').toArray();
  const hasLargeImages = images.some((img) => {
    const src = $(img).attr('src') ?? '';
    return !src.includes('.webp') && !src.includes('tiny') && !$(img).attr('loading');
  });
  if (hasLargeImages) {
    issues.push({ type: 'large_images', severity: 'info', description: 'Images may not be optimized (no lazy-loading, no WebP format detected).' });
  }

  // Analytics
  const hasAnalytics =
    html.includes('gtag') || html.includes('google-analytics') || html.includes('ga(') || html.includes('fbq(');
  if (!hasAnalytics) {
    issues.push({ type: 'no_analytics', severity: 'info', description: 'No analytics tracking detected.' });
  }

  // Live chat
  const hasLiveChat =
    html.includes('intercom') || html.includes('tawk.to') || html.includes('crisp') || html.includes('zendesk');

  const score = calculateScore({
    hasHttps,
    isMobileResponsive: hasViewportMeta,
    isSlowLoad,
    hasContactForm,
    hasSeoMeta,
    hasLargeImages,
    hasAnalytics,
  });

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
    tech_stack: detectTechStack(html),
    issues,
    recommendations: generateRecommendations(issues),
    analyzed_at: new Date().toISOString(),
  };
}

function calculateScore(checks: {
  hasHttps: boolean;
  isMobileResponsive: boolean;
  isSlowLoad: boolean;
  hasContactForm: boolean;
  hasSeoMeta: boolean;
  hasLargeImages: boolean;
  hasAnalytics: boolean;
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
    no_https: "Migrate site to HTTPS with an SSL certificate (free via Let's Encrypt).",
    not_mobile_responsive: 'Rebuild or redesign the site with a mobile-first responsive layout.',
    slow_load: 'Optimize images, enable caching, and use a CDN to improve load times.',
    no_booking_form: 'Add an online booking or appointment form to reduce friction for customers.',
    no_contact_form: 'Add a contact form with auto-responses to capture leads 24/7.',
    missing_seo_meta: 'Add descriptive title tags and meta descriptions to each page.',
    large_images: 'Convert images to WebP format and implement lazy loading.',
    no_analytics: 'Install Google Analytics or similar to track visitor behavior.',
  };
  return issues.map((i) => recs[i.type]).filter(Boolean);
}

/** Operates on the already-fetched HTML rather than re-serializing the page. */
function detectTechStack(html: string): string[] {
  const stack: string[] = [];

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

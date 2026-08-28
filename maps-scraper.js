// Day 6: Google Maps Scraper (basic version)
// Searches Google Maps for a keyword + location, scrolls the results panel
// to load listings, and extracts business details from each one.
// Run with: node maps-scraper.js
//
// NOTE: Google Maps' HTML structure/class names change periodically.
// The selectors below are current as of testing, but if you get 0 results
// with no errors, that's the most likely cause — tell me what you see and
// we'll adjust the selectors together.

const { chromium } = require('playwright');
const fs = require('fs');
const { getRandomUserAgent, randomDelay } = require('./utils/stealth-helpers');

const SEARCH_QUERY = 'cafes Rawalpindi';

(async () => {
  console.log(`Searching Google Maps for: ${SEARCH_QUERY}`);

  const browser = await chromium.launch({ headless: false });
  const userAgent = getRandomUserAgent();
  const context = await browser.newContext({ userAgent });
  const page = await context.newPage();

  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(SEARCH_QUERY)}`;
  await page.goto(mapsUrl);

  // Maps takes a moment to load the results panel — wait for it directly
  // rather than a fixed timeout, so we're not guessing how long it needs
  await page.waitForSelector('div[role="feed"]', { timeout: 15000 }).catch(() => {
    console.log('Results feed did not load in time — Maps layout may have changed, or the page needs more time.');
  });

  await randomDelay(2000, 3000);

  // Google Maps loads more results as you scroll the results panel (not the
  // whole page). We scroll the feed container a few times to load more
  // listings before extracting data.
  console.log('Scrolling to load more results...');
  const feedSelector = 'div[role="feed"]';

  for (let i = 0; i < 5; i++) {
    await page.evaluate((selector) => {
      const feed = document.querySelector(selector);
      if (feed) feed.scrollTop = feed.scrollHeight;
    }, feedSelector);
    await randomDelay(1500, 2500);
  }

  // Extract business data from each result card in the feed.
  // Google Maps result cards are anchor tags (a.hfpxzc) with the business
  // name in the aria-label, and details in sibling divs.
  const businesses = await page.$$eval('div[role="feed"] > div', (nodes) => {
    const results = [];

    nodes.forEach((node) => {
      const linkEl = node.querySelector('a.hfpxzc');
      if (!linkEl) return; // skip non-listing nodes (ads, section headers, etc.)

      const name = linkEl.getAttribute('aria-label') || null;
      const listingUrl = linkEl.href || null;

      // Rating and review count usually sit together, e.g. "4.5 (120)"
      const ratingEl = node.querySelector('span[role="img"]');
      let rating = null;
      let reviewCount = null;
      if (ratingEl) {
        const ariaLabel = ratingEl.getAttribute('aria-label') || '';
        const ratingMatch = ariaLabel.match(/([\d.]+)\s*star/i);
        const reviewMatch = ariaLabel.match(/([\d,]+)\s*review/i);
        rating = ratingMatch ? ratingMatch[1] : null;
        reviewCount = reviewMatch ? reviewMatch[1].replace(/,/g, '') : null;
      }

      // Category and address are usually in text blocks below the name.
      // We grab all the small text divs and take a best guess based on position.
      const textBlocks = Array.from(node.querySelectorAll('div.W4Efsd > span'))
        .map((el) => el.innerText.trim())
        .filter(Boolean);

      // Website link, if present (not all listings have one)
      const websiteEl = node.querySelector('a[data-value="Website"]');
      const website = websiteEl ? websiteEl.href : null;

      // Phone numbers usually appear as plain text matching a phone pattern
      // within the text blocks we collected above
      const phoneMatch = textBlocks.join(' ').match(/(\+?\d[\d\s-]{7,}\d)/);
      const phone = phoneMatch ? phoneMatch[1].trim() : null;

      results.push({
        name,
        listingUrl,
        rating,
        reviewCount,
        website,
        phone,
        rawTextBlocks: textBlocks, // keeping this for now so we can inspect what's actually there
      });
    });

    return results;
  });

  await browser.close();

  console.log(`\nFound ${businesses.length} business listings.`);

  const outputPath = './results-maps.json';
  fs.writeFileSync(outputPath, JSON.stringify(businesses, null, 2));
  console.log(`Saved to ${outputPath}`);
  console.log('\nPreview:');
  console.log(JSON.stringify(businesses.slice(0, 3), null, 2));
})();
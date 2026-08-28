// Day 7: Maps Filtering Logic
// Builds on Day 6 — instead of stopping at list-view data, this clicks into
// each business's detail panel to get phone and website, then goes back
// to the list and clicks the next one. Also adds a hasWebsite flag, since
// "no website" is one of your key targeting filters.
// Run with: node maps-scraper-day7.js
//
// NOTE: This is slower than Day 6 since each listing requires its own
// click + wait + extract cycle. That's expected — detail data isn't
// available any faster than that from Maps' UI.

const { chromium } = require('playwright');
const fs = require('fs');
const { getRandomUserAgent, randomDelay } = require('./utils/stealth-helpers');

const SEARCH_QUERY = 'cafes Rawalpindi';
const MAX_LISTINGS_TO_PROCESS = 8; // keep this small today just to prove the logic works

(async () => {
  console.log(`Searching Google Maps for: ${SEARCH_QUERY}`);

  const browser = await chromium.launch({ headless: false });
  const userAgent = getRandomUserAgent();
  const context = await browser.newContext({ userAgent });
  const page = await context.newPage();

  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(SEARCH_QUERY)}`;
  await page.goto(mapsUrl);

  await page.waitForSelector('div[role="feed"]', { timeout: 15000 }).catch(() => {
    console.log('Results feed did not load in time.');
  });
  await randomDelay(2000, 3000);

  // Scroll a couple times to make sure we have enough listings loaded
  const feedSelector = 'div[role="feed"]';
  for (let i = 0; i < 3; i++) {
    await page.evaluate((selector) => {
      const feed = document.querySelector(selector);
      if (feed) feed.scrollTop = feed.scrollHeight;
    }, feedSelector);
    await randomDelay(1500, 2500);
  }

  // Get the list of clickable listing links (just the basics — name + link)
  // We'll click each one by its index rather than holding onto element handles,
  // since the page re-renders as we navigate in and out of detail panels.
  const listingBasics = await page.$$eval('div[role="feed"] > div a.hfpxzc', (nodes) => {
    return nodes.map((el) => ({
      name: el.getAttribute('aria-label') || null,
      href: el.href || null,
    }));
  });

  console.log(`Found ${listingBasics.length} listings in list view. Processing up to ${MAX_LISTINGS_TO_PROCESS}.`);

  const fullResults = [];
  const listingsToProcess = listingBasics.slice(0, MAX_LISTINGS_TO_PROCESS);

  for (let i = 0; i < listingsToProcess.length; i++) {
    const listing = listingsToProcess[i];
    console.log(`\n[${i + 1}/${listingsToProcess.length}] Opening: ${listing.name}`);

    try {
      // Navigate directly to the listing's own URL — more reliable than
      // clicking the card by position, since the list can shift/re-render
      await page.goto(listing.href);
      await randomDelay(2000, 3000);

      // Extract detail-panel data: rating, review count, phone, website, address, category
      const details = await page.evaluate(() => {
        const getText = (selector) => {
          const el = document.querySelector(selector);
          return el ? el.innerText.trim() : null;
        };

        const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
        const reviewEl = document.querySelector('div.F7nice span[aria-label*="review"]');

        const websiteEl = document.querySelector('a[data-item-id="authority"]');
        const phoneEl = document.querySelector('button[data-item-id^="phone"]');
        const addressEl = document.querySelector('button[data-item-id="address"]');
        const categoryEl = document.querySelector('button[jsaction*="category"]');

        return {
          rating: ratingEl ? ratingEl.innerText.trim() : null,
          reviewCount: reviewEl
            ? reviewEl.getAttribute('aria-label').replace(/\D/g, '')
            : null,
          website: websiteEl ? websiteEl.href : null,
          phone: phoneEl ? phoneEl.getAttribute('aria-label')?.replace('Phone:', '').trim() : null,
          address: addressEl ? addressEl.getAttribute('aria-label')?.replace('Address:', '').trim() : null,
          category: categoryEl ? categoryEl.innerText.trim() : null,
        };
      });

      fullResults.push({
        name: listing.name,
        listingUrl: listing.href,
        category: details.category,
        address: details.address,
        phone: details.phone,
        website: details.website,
        hasWebsite: Boolean(details.website), // the key filter flag for your lead scoring
        rating: details.rating,
        reviewCount: details.reviewCount,
      });

      console.log(`  Website: ${details.website ? 'Yes' : 'No'} | Phone: ${details.phone ? 'Yes' : 'No'}`);
    } catch (err) {
      console.log(`  Failed to process this listing: ${err.message}`);
    }

    // Small delay between listings so we're not hammering requests
    await randomDelay(1500, 3000);
  }

  await browser.close();

  console.log(`\nProcessed ${fullResults.length} listings with full detail data.`);

  const outputPath = './results-maps-day7.json';
  fs.writeFileSync(outputPath, JSON.stringify(fullResults, null, 2));
  console.log(`Saved to ${outputPath}`);
})();
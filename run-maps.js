// Day 11: run-maps.js
// Full pipeline: scrape Maps -> normalize -> dedup (within-run + against Sheet) ->
// score -> write only genuinely NEW leads to the Sheet.
// Run with: node run-maps.js

const { chromium } = require('playwright');
const { getRandomUserAgent, randomDelay } = require('./utils/stealth-helpers');
const { normalizeMapsLead } = require('./utils/normalize');
const { dedupMapsLeads } = require('./utils/dedup');
const { scoreMapsLead } = require('./utils/scoring');
const { writeMapsLeads, getExistingMapsKeys } = require('./utils/sheets-writer');

const SEARCH_QUERY = 'cafes Rawalpindi';
const MAX_LISTINGS_TO_PROCESS = 8;

(async () => {
  console.log('=== Step 1: Scraping Google Maps ===');
  console.log(`Searching for: ${SEARCH_QUERY}`);

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

  const feedSelector = 'div[role="feed"]';
  for (let i = 0; i < 3; i++) {
    await page.evaluate((selector) => {
      const feed = document.querySelector(selector);
      if (feed) feed.scrollTop = feed.scrollHeight;
    }, feedSelector);
    await randomDelay(1500, 2500);
  }

  const listingBasics = await page.$$eval('div[role="feed"] > div a.hfpxzc', (nodes) => {
    return nodes.map((el) => ({
      name: el.getAttribute('aria-label') || null,
      href: el.href || null,
    }));
  });

  console.log(`Found ${listingBasics.length} listings. Processing up to ${MAX_LISTINGS_TO_PROCESS}.`);

  const scrapedResults = [];
  const listingsToProcess = listingBasics.slice(0, MAX_LISTINGS_TO_PROCESS);

  for (let i = 0; i < listingsToProcess.length; i++) {
    const listing = listingsToProcess[i];
    console.log(`\n[${i + 1}/${listingsToProcess.length}] Opening: ${listing.name}`);

    try {
      await page.goto(listing.href);
      await randomDelay(2000, 3000);

      const details = await page.evaluate(() => {
        const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
        const reviewEl = document.querySelector('div.F7nice span[aria-label*="review"]');
        const websiteEl = document.querySelector('a[data-item-id="authority"]');
        const phoneEl = document.querySelector('button[data-item-id^="phone"]');
        const addressEl = document.querySelector('button[data-item-id="address"]');
        const categoryEl = document.querySelector('button[jsaction*="category"]');

        return {
          rating: ratingEl ? ratingEl.innerText.trim() : null,
          reviewCount: reviewEl ? reviewEl.getAttribute('aria-label').replace(/\D/g, '') : null,
          website: websiteEl ? websiteEl.href : null,
          phone: phoneEl ? phoneEl.getAttribute('aria-label')?.replace('Phone:', '').trim() : null,
          address: addressEl ? addressEl.getAttribute('aria-label')?.replace('Address:', '').trim() : null,
          category: categoryEl ? categoryEl.innerText.trim() : null,
        };
      });

      scrapedResults.push({
        dateFound: new Date().toISOString(),
        name: listing.name,
        listingUrl: listing.href,
        category: details.category,
        address: details.address,
        phone: details.phone,
        website: details.website,
        rating: details.rating,
        reviewCount: details.reviewCount,
        keywordMatched: SEARCH_QUERY,
      });

      console.log(`  Website: ${details.website ? 'Yes' : 'No'} | Phone: ${details.phone ? 'Yes' : 'No'}`);
    } catch (err) {
      console.log(`  Failed to process this listing: ${err.message}`);
    }

    await randomDelay(1500, 3000);
  }

  await browser.close();
  console.log(`\nTotal scraped: ${scrapedResults.length}`);

  console.log('\n=== Step 2: Normalize + Dedup (within-run) ===');
  const normalized = scrapedResults.map(normalizeMapsLead);
  const dedupedWithinRun = dedupMapsLeads(normalized);
  console.log(`After within-run dedup: ${dedupedWithinRun.length} (removed ${normalized.length - dedupedWithinRun.length})`);

  console.log('\n=== Step 3: Dedup against existing Sheet data ===');
  const existingKeys = await getExistingMapsKeys();
  console.log(`Found ${existingKeys.size} existing business entries already in the Sheet.`);

  const genuinelyNewLeads = dedupedWithinRun.filter((lead) => {
    const key = `${(lead.businessName || '').toLowerCase().trim()}|${(lead.address || '').toLowerCase().trim()}`;
    return !existingKeys.has(key);
  });
  console.log(`Genuinely new leads (not already in Sheet): ${genuinelyNewLeads.length}`);

  if (genuinelyNewLeads.length === 0) {
    console.log('\nNothing new to add. Done.');
    return;
  }

  console.log('\n=== Step 4: Scoring ===');
  const scoredLeads = genuinelyNewLeads.map(scoreMapsLead);

  console.log('\n=== Step 5: Writing to Sheet ===');
  const writtenCount = await writeMapsLeads(scoredLeads);
  console.log(`Wrote ${writtenCount} new rows to "Maps Business Leads" tab.`);

  console.log('\nDone.');
})();
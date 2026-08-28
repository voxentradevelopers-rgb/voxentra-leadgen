// Day 4: Handle Blocking & Add Resilience
// Builds on Day 3's scraper. Adds:
// - Random user-agent per run (looks like a different real browser each time)
// - Random delays before/between actions (avoids robotic, too-fast timing)
// - Retry logic (if a request fails or gets blocked, wait and try again,
//   up to a max number of attempts, with increasing wait time each retry)
// Run with: node scraper-day4.js

const { chromium } = require('playwright');
const fs = require('fs');
const { extractEmail, extractPhone } = require('./utils/extract-contact');
const { getRandomUserAgent, randomDelay } = require('./utils/stealth-helpers');

const SEARCH_QUERY = '"looking for a shopify developer"';
const MAX_RETRIES = 3;

// Attempts one scrape. Returns the results array, or throws an error if it fails.
async function attemptScrape(attemptNumber) {
  console.log(`\nAttempt ${attemptNumber} of ${MAX_RETRIES}...`);

  const browser = await chromium.launch({ headless: false });

  // Create a new browser context with a randomly chosen user-agent —
  // this is what makes each run's browser "fingerprint" look different
  const userAgent = getRandomUserAgent();
  console.log(`Using user-agent: ${userAgent}`);
  const context = await browser.newContext({ userAgent });
  const page = await context.newPage();

  // Wait a random amount before even starting — avoids the pattern of
  // "script launches and instantly hits the target," which looks automated
  await randomDelay(1000, 3000);

  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(SEARCH_QUERY)}`;
  await page.goto(searchUrl);

  // Random wait for the page to settle, instead of a fixed identical delay every time
  await randomDelay(2000, 4000);

  const pageContent = await page.content();
  if (pageContent.includes('detected unusual traffic') || pageContent.includes('recaptcha')) {
    await browser.close();
    throw new Error('CAPTCHA/block detected');
  }

  const rawResults = await page.$$eval('.result', (nodes) => {
    return nodes.map((node) => {
      const titleEl = node.querySelector('.result__title a');
      const snippetEl = node.querySelector('.result__snippet');
      return {
        title: titleEl ? titleEl.innerText.trim() : null,
        url: titleEl ? titleEl.href : null,
        snippet: snippetEl ? snippetEl.innerText.trim() : null,
      };
    });
  });

  await browser.close();
  return rawResults;
}

(async () => {
  let results = null;
  let lastError = null;

  // Retry loop: try up to MAX_RETRIES times. Each failed attempt waits
  // progressively longer before trying again (exponential-ish backoff),
  // since hammering a blocked target immediately again usually just gets
  // blocked again.
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      results = await attemptScrape(attempt);
      console.log(`Success on attempt ${attempt}.`);
      break; // got results, stop retrying
    } catch (err) {
      lastError = err;
      console.log(`Attempt ${attempt} failed: ${err.message}`);

      if (attempt < MAX_RETRIES) {
        const waitTime = attempt * 5; // 5s, then 10s, then 15s...
        console.log(`Waiting ${waitTime}s before retrying...`);
        await randomDelay(waitTime * 1000, waitTime * 1000 + 2000);
      }
    }
  }

  if (!results) {
    console.log(`\nAll ${MAX_RETRIES} attempts failed. Last error: ${lastError.message}`);
    console.log('This is expected occasionally — the target may be temporarily blocking us. Try again later.');
    return;
  }

  // Structure results the same way as Day 3
  const structuredResults = results.map((result) => {
    let cleanUrl = result.url;
    if (cleanUrl && cleanUrl.includes('uddg=')) {
      const match = cleanUrl.match(/uddg=([^&]+)/);
      if (match) cleanUrl = decodeURIComponent(match[1]);
    }

    return {
      dateFound: new Date().toISOString(),
      keywordMatched: SEARCH_QUERY,
      title: result.title,
      url: cleanUrl,
      snippet: result.snippet,
      email: extractEmail(result.snippet),
      phone: extractPhone(result.snippet),
    };
  });

  console.log(`\nStructured ${structuredResults.length} results.`);

  const outputPath = './results-day4.json';
  fs.writeFileSync(outputPath, JSON.stringify(structuredResults, null, 2));
  console.log(`Saved to ${outputPath}`);
})();
// Day 4 (Google test variant): Same resilience logic as scraper-day4.js,
// but pointed at Google instead of DuckDuckGo — so we can actually observe
// the retry/backoff logic responding to a real CAPTCHA block.
// Run with: node scraper-day4-google.js

const { chromium } = require('playwright');
const fs = require('fs');
const { extractEmail, extractPhone } = require('./utils/extract-contact');
const { getRandomUserAgent, randomDelay } = require('./utils/stealth-helpers');

const SEARCH_QUERY = '"looking for a shopify developer" site:facebook.com';
const MAX_RETRIES = 3;

async function attemptScrape(attemptNumber) {
  console.log(`\nAttempt ${attemptNumber} of ${MAX_RETRIES}...`);

  const browser = await chromium.launch({ headless: false });

  const userAgent = getRandomUserAgent();
  console.log(`Using user-agent: ${userAgent}`);
  const context = await browser.newContext({ userAgent });
  const page = await context.newPage();

  await randomDelay(1000, 3000);

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(SEARCH_QUERY)}`;
  await page.goto(searchUrl);

  await randomDelay(2000, 4000);

  const pageContent = await page.content();
  if (pageContent.includes('detected unusual traffic') || pageContent.includes('recaptcha')) {
    await browser.close();
    throw new Error('CAPTCHA/block detected');
  }

  const rawResults = await page.$$eval('div.g', (nodes) => {
    return nodes.map((node) => {
      const titleEl = node.querySelector('h3');
      const linkEl = node.querySelector('a');
      const snippetEl = node.querySelector('div[data-sncf], div.VwiC3b, span.aCOpRe');
      return {
        title: titleEl ? titleEl.innerText : null,
        url: linkEl ? linkEl.href : null,
        snippet: snippetEl ? snippetEl.innerText : null,
      };
    });
  });

  await browser.close();
  return rawResults;
}

(async () => {
  let results = null;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      results = await attemptScrape(attempt);
      console.log(`Success on attempt ${attempt}.`);
      break;
    } catch (err) {
      lastError = err;
      console.log(`Attempt ${attempt} failed: ${err.message}`);

      if (attempt < MAX_RETRIES) {
        const waitTime = attempt * 5;
        console.log(`Waiting ${waitTime}s before retrying...`);
        await randomDelay(waitTime * 1000, waitTime * 1000 + 2000);
      }
    }
  }

  if (!results) {
    console.log(`\nAll ${MAX_RETRIES} attempts failed. Last error: ${lastError.message}`);
    console.log('This confirms Google is actively blocking us — expected. This is exactly why we plan to migrate to less-restrictive sources (DuckDuckGo, forums) as primary, and treat Google as a secondary/best-effort source.');
    return;
  }

  const structuredResults = results.map((result) => ({
    dateFound: new Date().toISOString(),
    keywordMatched: SEARCH_QUERY,
    title: result.title,
    url: result.url,
    snippet: result.snippet,
    email: extractEmail(result.snippet),
    phone: extractPhone(result.snippet),
  }));

  console.log(`\nStructured ${structuredResults.length} results.`);

  const outputPath = './results-day4-google.json';
  fs.writeFileSync(outputPath, JSON.stringify(structuredResults, null, 2));
  console.log(`Saved to ${outputPath}`);
})();
// Day 3: Parse & Structure Results
// Extends Day 2's working scraper — now we extract email/phone from snippets
// and save everything to a local JSON file instead of just console logging.
// Run with: node scraper-day3.js

const { chromium } = require('playwright');
const fs = require('fs');
const { extractEmail, extractPhone } = require('./utils/extract-contact');

const SEARCH_QUERY = '"looking for a shopify developer"';

(async () => {
  console.log(`Searching DuckDuckGo for: ${SEARCH_QUERY}`);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(SEARCH_QUERY)}`;
  await page.goto(searchUrl);
  await page.waitForTimeout(2000);

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

  // Now structure each result properly: decode the real URL (DuckDuckGo wraps
  // links in a redirect), extract contact info from the snippet, and add
  // metadata fields we'll need later (keyword matched, date found).
  const structuredResults = rawResults.map((result) => {
    let cleanUrl = result.url;

    // DuckDuckGo wraps URLs like: duckduckgo.com/l/?uddg=<encoded-real-url>&rut=...
    // We decode that back into the actual destination URL.
    if (cleanUrl && cleanUrl.includes('uddg=')) {
      const match = cleanUrl.match(/uddg=([^&]+)/);
      if (match) {
        cleanUrl = decodeURIComponent(match[1]);
      }
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

  // Save to a local JSON file so we can inspect it and use it in later steps
  // (scoring, Sheets writing) without re-scraping every time.
  const outputPath = './results-day3.json';
  fs.writeFileSync(outputPath, JSON.stringify(structuredResults, null, 2));

  console.log(`Saved to ${outputPath}`);
  console.log('\nPreview:');
  console.log(JSON.stringify(structuredResults, null, 2));
})();
// Day 2 Sanity Check: Same extraction logic, but against DuckDuckGo instead of Google
// DuckDuckGo's HTML version rarely blocks automated browsers, so this proves
// our "navigate -> find results -> extract title/url/snippet" logic actually works.
// Run with: node sanity-check.js

const { chromium } = require('playwright');

const SEARCH_QUERY = '"looking for a shopify developer"';

(async () => {
  console.log(`Searching DuckDuckGo for: ${SEARCH_QUERY}`);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // DuckDuckGo's lightweight HTML search endpoint — no JS rendering needed,
  // simple predictable structure, and it doesn't CAPTCHA-block automated browsers
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(SEARCH_QUERY)}`;

  await page.goto(searchUrl);
  await page.waitForTimeout(2000);

  // DuckDuckGo's HTML results use these class names for each result block
  const results = await page.$$eval('.result', (nodes) => {
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

  console.log(`\nFound ${results.length} results:\n`);
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
})();
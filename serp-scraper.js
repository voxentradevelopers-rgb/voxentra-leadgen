// Day 2: First Manual Scrape (Local Test)
// Goal: Search Google for one keyword, log result URLs + snippets to console
// Run with: node serp-scraper.js

const { chromium } = require('playwright');

// The keyword we're testing with today — hardcoded for now, we'll make this dynamic later
const SEARCH_QUERY = '"looking for a shopify developer" site:facebook.com';

(async () => {
  console.log(`Searching Google for: ${SEARCH_QUERY}`);

  // Launch a browser. headless:false means you'll SEE the browser window open —
  // useful for today so you can watch what's happening and see the CAPTCHA if it appears
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Build the Google search URL. encodeURIComponent makes sure special characters
  // (like quotes) don't break the URL
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(SEARCH_QUERY)}`;

  await page.goto(searchUrl);

  // Give the page a moment to fully load results
  await page.waitForTimeout(3000);

  // Check if Google is showing a CAPTCHA / "unusual traffic" page instead of real results
  const pageContent = await page.content();
  if (pageContent.includes('detected unusual traffic') || pageContent.includes('recaptcha')) {
    console.log('⚠️  CAPTCHA detected. This is expected at this stage — see Day 4 for handling this.');
    await browser.close();
    return;
  }

  // Google search results sit inside elements with this structure.
  // We're grabbing each result block, then pulling the title, link, and snippet from it.
  const results = await page.$$eval('div.g', (nodes) => {
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

  console.log(`\nFound ${results.length} results:\n`);
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
})();
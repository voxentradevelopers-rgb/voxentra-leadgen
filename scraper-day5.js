// Day 5: Keyword Config System
// Instead of one hardcoded SEARCH_QUERY, this reads campaigns from
// config/keywords.json and loops through every keyword in every campaign.
// Each result is checked against that campaign's negative keywords and
// tagged with its niche/location before saving.
// Run with: node scraper-day5.js

const { chromium } = require('playwright');
const fs = require('fs');
const { extractEmail, extractPhone } = require('./utils/extract-contact');
const { getRandomUserAgent, randomDelay } = require('./utils/stealth-helpers');

const MAX_RETRIES = 3;

// Load the campaign config from disk
function loadConfig() {
  const raw = fs.readFileSync('./config/keywords.json', 'utf-8');
  return JSON.parse(raw);
}

// Checks if a snippet contains any of the campaign's negative keywords.
// If it does, we skip this result — it's likely noise (e.g. an actual
// job posting rather than someone personally asking for help).
function containsNegativeKeyword(text, negativeKeywords) {
  if (!text || !negativeKeywords || negativeKeywords.length === 0) return false;
  const lowerText = text.toLowerCase();
  return negativeKeywords.some((neg) => lowerText.includes(neg.toLowerCase()));
}

async function attemptScrape(query, attemptNumber) {
  console.log(`  Attempt ${attemptNumber} of ${MAX_RETRIES} for: "${query}"`);

  const browser = await chromium.launch({ headless: false });
  const userAgent = getRandomUserAgent();
  const context = await browser.newContext({ userAgent });
  const page = await context.newPage();

  await randomDelay(1000, 3000);

  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  await page.goto(searchUrl);
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

async function scrapeWithRetry(query) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const results = await attemptScrape(query, attempt);
      return results;
    } catch (err) {
      console.log(`  Attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        const waitTime = attempt * 5;
        await randomDelay(waitTime * 1000, waitTime * 1000 + 2000);
      }
    }
  }
  console.log(`  All attempts failed for: "${query}"`);
  return [];
}

(async () => {
  const config = loadConfig();
  const allStructuredResults = [];

  // Loop through every campaign, and every keyword within each campaign
  for (const campaign of config.campaigns) {
    console.log(`\n=== Campaign: ${campaign.niche} ===`);

    for (const keyword of campaign.keywords) {
      // If the campaign has a location, append it to the search query
      const fullQuery = campaign.location
        ? `"${keyword}" ${campaign.location}`
        : `"${keyword}"`;

      const rawResults = await scrapeWithRetry(fullQuery);

      for (const result of rawResults) {
        // Skip results that match a negative keyword (likely noise, not a real lead)
        if (containsNegativeKeyword(result.snippet, campaign.negativeKeywords)) {
          console.log(`  Skipped (negative keyword match): ${result.title}`);
          continue;
        }

        let cleanUrl = result.url;
        if (cleanUrl && cleanUrl.includes('uddg=')) {
          const match = cleanUrl.match(/uddg=([^&]+)/);
          if (match) cleanUrl = decodeURIComponent(match[1]);
        }

        allStructuredResults.push({
          dateFound: new Date().toISOString(),
          niche: campaign.niche,
          location: campaign.location,
          keywordMatched: keyword,
          title: result.title,
          url: cleanUrl,
          snippet: result.snippet,
          email: extractEmail(result.snippet),
          phone: extractPhone(result.snippet),
        });
      }

      // Small delay between different keyword searches, not just between retries
      await randomDelay(3000, 6000);
    }
  }

  console.log(`\nTotal structured results across all campaigns: ${allStructuredResults.length}`);

  const outputPath = './results-day5.json';
  fs.writeFileSync(outputPath, JSON.stringify(allStructuredResults, null, 2));
  console.log(`Saved to ${outputPath}`);
})();
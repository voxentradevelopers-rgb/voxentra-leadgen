// Day 11: run-post-intent.js
// Full pipeline: scrape -> normalize -> dedup (within-run + against Sheet) ->
// score -> write only genuinely NEW leads to the Sheet.
// Run with: node run-post-intent.js

const { chromium } = require('playwright');
const fs = require('fs');
const { extractEmail, extractPhone } = require('./utils/extract-contact');
const { getRandomUserAgent, randomDelay, getLaunchOptions } = require('./utils/stealth-helpers');
const { normalizePostLead } = require('./utils/normalize');
const { dedupPostLeads } = require('./utils/dedup');
const { scorePostLead } = require('./utils/scoring');
const { writePostLeads, getExistingPostUrls } = require('./utils/sheets-writer');

const MAX_RETRIES = 3;

function loadConfig() {
  const raw = fs.readFileSync('./config/keywords.json', 'utf-8');
  return JSON.parse(raw);
}

function containsNegativeKeyword(text, negativeKeywords) {
  if (!text || !negativeKeywords || negativeKeywords.length === 0) return false;
  const lowerText = text.toLowerCase();
  return negativeKeywords.some((neg) => lowerText.includes(neg.toLowerCase()));
}

async function attemptScrape(query, attemptNumber) {
  console.log(`  Attempt ${attemptNumber} of ${MAX_RETRIES} for: "${query}"`);

  const browser = await chromium.launch(getLaunchOptions());
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
      return await attemptScrape(query, attempt);
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
  console.log('=== Step 1: Scraping ===');
  const config = loadConfig();
  const scrapedResults = [];

  for (const campaign of config.campaigns) {
    console.log(`\nCampaign: ${campaign.niche}`);

    for (const keyword of campaign.keywords) {
      const fullQuery = campaign.location ? `"${keyword}" ${campaign.location}` : `"${keyword}"`;
      const rawResults = await scrapeWithRetry(fullQuery);

      for (const result of rawResults) {
        if (containsNegativeKeyword(result.snippet, campaign.negativeKeywords)) {
          console.log(`  Skipped (negative keyword): ${result.title}`);
          continue;
        }

        let cleanUrl = result.url;
        if (cleanUrl && cleanUrl.includes('uddg=')) {
          const match = cleanUrl.match(/uddg=([^&]+)/);
          if (match) cleanUrl = decodeURIComponent(match[1]);
        }

        scrapedResults.push({
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

      await randomDelay(3000, 6000);
    }
  }

  console.log(`\nTotal scraped: ${scrapedResults.length}`);

  console.log('\n=== Step 2: Normalize + Dedup (within-run) ===');
  const normalized = scrapedResults.map(normalizePostLead);
  const dedupedWithinRun = dedupPostLeads(normalized);
  console.log(`After within-run dedup: ${dedupedWithinRun.length} (removed ${normalized.length - dedupedWithinRun.length})`);

  console.log('\n=== Step 3: Dedup against existing Sheet data ===');
  const existingUrls = await getExistingPostUrls();
  console.log(`Found ${existingUrls.size} existing URLs already in the Sheet.`);

  const genuinelyNewLeads = dedupedWithinRun.filter((lead) => !existingUrls.has(lead.postUrl));
  console.log(`Genuinely new leads (not already in Sheet): ${genuinelyNewLeads.length}`);

  if (genuinelyNewLeads.length === 0) {
    console.log('\nNothing new to add. Done.');
    return;
  }

  console.log('\n=== Step 4: Scoring ===');
  const scoredLeads = genuinelyNewLeads.map(scorePostLead);

  console.log('\n=== Step 5: Writing to Sheet ===');
  const writtenCount = await writePostLeads(scoredLeads);
  console.log(`Wrote ${writtenCount} new rows to "Post-Intent Leads" tab.`);

  console.log('\nDone.');
})();
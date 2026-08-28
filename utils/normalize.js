// utils/normalize.js
// Takes raw scraper output (from the SERP scraper or Maps scraper) and
// converts each into ONE consistent shape per lead type. This matters because
// Phase 3 (scoring + Sheets writing) needs predictable field names to work
// against, regardless of which scraper produced the data.

// Normalizes a post-intent lead (from the SERP/DuckDuckGo scraper) into the
// exact shape that matches the "Post-Intent Leads" tab columns.
function normalizePostLead(raw) {
  return {
    dateFound: raw.dateFound || new Date().toISOString(),
    platform: raw.platform || 'web-search',
    postUrl: raw.url || null,
    posterHandle: raw.posterHandle || null, // not extracted yet at this stage — placeholder for later platform-specific scrapers
    postSnippet: raw.snippet || null,
    keywordMatched: raw.keywordMatched || null,
    niche: raw.niche || null,
    location: raw.location || null,
    email: raw.email || null,
    phone: raw.phone || null,
    // Scores get filled in during Phase 3 — left null here on purpose
    intentScore: null,
    completenessScore: null,
    recencyScore: null,
    sourceScore: null,
    totalScore: null,
    tier: null,
    status: 'New',
  };
}

// Normalizes a Maps business lead into the exact shape that matches the
// "Maps Business Leads" tab columns.
function normalizeMapsLead(raw) {
  return {
    dateFound: raw.dateFound || new Date().toISOString(),
    businessName: raw.name || null,
    category: raw.category || null,
    address: raw.address || null,
    phone: raw.phone || null,
    website: raw.website || null,
    rating: raw.rating || null,
    reviewCount: raw.reviewCount || null,
    listingUrl: raw.listingUrl || null,
    keywordMatched: raw.keywordMatched || null,
    hasWebsite: Boolean(raw.website),
    // Scores get filled in during Phase 3 — left null here on purpose
    noWebsiteScore: null,
    reviewsScore: null,
    categoryMatchScore: null,
    contactScore: null,
    totalScore: null,
    tier: null,
    status: 'New',
  };
}

module.exports = { normalizePostLead, normalizeMapsLead };
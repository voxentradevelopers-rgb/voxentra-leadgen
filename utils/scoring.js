// utils/scoring.js
// Implements the weighted scoring model from the feature spec (Section 8):
//
// Post-Intent Leads (100 pts): intent strength (40) + completeness (30) +
//   recency (20) + source quality (10)
// Maps Business Leads (100 pts): no-website flag (35) + reviews/rating (25) +
//   category match (25) + contact completeness (15)
//
// Tiering: 75+ = Hot | 50-74 = Warm | <50 = Cold

// ---------- POST-INTENT LEAD SCORING ----------

// Strong-intent phrases score higher than weak/vague ones. This is a simple
// keyword-tier match against the snippet text — not perfect, but a
// reasonable starting heuristic we can tune later based on real outcomes.
const STRONG_INTENT_PHRASES = ['need a', 'looking for', 'hiring', 'require a', "i'm looking"];
const WEAK_INTENT_PHRASES = ['thinking about', 'someday', 'wish i had', 'considering'];

function scoreIntentStrength(snippet) {
  if (!snippet) return 10; // no text to judge — assume weak/unclear
  const lower = snippet.toLowerCase();

  if (STRONG_INTENT_PHRASES.some((phrase) => lower.includes(phrase))) return 40;
  if (WEAK_INTENT_PHRASES.some((phrase) => lower.includes(phrase))) return 10;
  return 25; // matched the campaign keyword but no clear strong/weak signal either way
}

function scoreCompleteness(email, phone) {
  if (email && phone) return 30;
  if (email || phone) return 20;
  return 5; // has neither — low but not zero, since the post itself may still be useful
}

// NOTE: dateFound here is the scrape timestamp, not the original post date.
// So today, every lead will score near-max on recency since they were all
// "just found." This becomes meaningful once posts are re-scraped over time
// or once we extract the actual post date from the source (future improvement).
function scoreRecency(dateFound) {
  if (!dateFound) return 5;
  const hoursSinceFound = (Date.now() - new Date(dateFound).getTime()) / (1000 * 60 * 60);

  if (hoursSinceFound <= 24) return 20;
  if (hoursSinceFound <= 72) return 15;
  if (hoursSinceFound <= 168) return 8;
  return 2;
}

// Source quality — starts flat/equal across sources since we don't have
// real conversion data yet. Tune this per-platform once you see which
// sources actually produce leads that convert.
function scoreSource(platform) {
  return 7; // default flat score out of 10 for now
}

function scorePostLead(lead) {
  const intentScore = scoreIntentStrength(lead.postSnippet);
  const completenessScore = scoreCompleteness(lead.email, lead.phone);
  const recencyScore = scoreRecency(lead.dateFound);
  const sourceScore = scoreSource(lead.platform);

  const totalScore = intentScore + completenessScore + recencyScore + sourceScore;

  return {
    ...lead,
    intentScore,
    completenessScore,
    recencyScore,
    sourceScore,
    totalScore,
    tier: getTier(totalScore),
  };
}

// ---------- MAPS BUSINESS LEAD SCORING ----------

function scoreNoWebsite(hasWebsite) {
  return hasWebsite ? 5 : 35; // no website = your strongest pitch angle
}

function scoreReviews(rating, reviewCount) {
  const count = parseInt(reviewCount, 10) || 0;
  const numericRating = parseFloat(rating) || 0;

  if (count >= 50 && numericRating >= 4) return 25;
  if (count >= 10) return 15;
  return 5;
}

// Checks if the business's category loosely matches the keyword that was
// searched (e.g. category "Cafe" matching keyword "cafes Rawalpindi")
function scoreCategoryMatch(category, keywordMatched) {
  if (!category || !keywordMatched) return 5;
  const catLower = category.toLowerCase();
  const keywordLower = keywordMatched.toLowerCase();

  // very simple substring check — good enough as a first pass
  const catWords = catLower.split(/\s+/);
  const isMatch = catWords.some((word) => word.length > 3 && keywordLower.includes(word));

  return isMatch ? 25 : 12;
}

function scoreContactCompleteness(phone, address) {
  if (phone && address) return 15;
  if (phone || address) return 8;
  return 0;
}

function scoreMapsLead(lead) {
  const noWebsiteScore = scoreNoWebsite(lead.hasWebsite);
  const reviewsScore = scoreReviews(lead.rating, lead.reviewCount);
  const categoryMatchScore = scoreCategoryMatch(lead.category, lead.keywordMatched);
  const contactScore = scoreContactCompleteness(lead.phone, lead.address);

  const totalScore = noWebsiteScore + reviewsScore + categoryMatchScore + contactScore;

  return {
    ...lead,
    noWebsiteScore,
    reviewsScore,
    categoryMatchScore,
    contactScore,
    totalScore,
    tier: getTier(totalScore),
  };
}

// ---------- SHARED TIERING ----------

function getTier(totalScore) {
  if (totalScore >= 75) return 'Hot';
  if (totalScore >= 50) return 'Warm';
  return 'Cold';
}

module.exports = { scorePostLead, scoreMapsLead };
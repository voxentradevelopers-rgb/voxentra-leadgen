// Day 9: Apply Scoring
// Loads the clean, deduped lead files from Day 8 (clean-post-leads.json and
// clean-maps-leads.json), runs each lead through the scoring model, and
// saves the results with scores + tiers filled in.
// Run with: node run-scoring.js

const fs = require('fs');
const { scorePostLead, scoreMapsLead } = require('./utils/scoring');

function loadJsonIfExists(path) {
  if (!fs.existsSync(path)) {
    console.log(`  (skipped — ${path} not found)`);
    return [];
  }
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}

function summarizeTiers(leads) {
  const counts = { Hot: 0, Warm: 0, Cold: 0 };
  leads.forEach((lead) => counts[lead.tier]++);
  return counts;
}

(async () => {
  console.log('=== Scoring Post-Intent Leads ===');
  const postLeads = loadJsonIfExists('./clean-post-leads.json');
  const scoredPostLeads = postLeads.map(scorePostLead);

  fs.writeFileSync('./scored-post-leads.json', JSON.stringify(scoredPostLeads, null, 2));
  console.log(`  Scored ${scoredPostLeads.length} leads. Tier breakdown:`, summarizeTiers(scoredPostLeads));
  console.log('  Saved to scored-post-leads.json');

  console.log('\n=== Scoring Maps Leads ===');
  const mapsLeads = loadJsonIfExists('./clean-maps-leads.json');
  const scoredMapsLeads = mapsLeads.map(scoreMapsLead);

  fs.writeFileSync('./scored-maps-leads.json', JSON.stringify(scoredMapsLeads, null, 2));
  console.log(`  Scored ${scoredMapsLeads.length} leads. Tier breakdown:`, summarizeTiers(scoredMapsLeads));
  console.log('  Saved to scored-maps-leads.json');

  console.log('\nDone. Review the scored files — do the Hot-tier leads genuinely look like your best leads?');
})();
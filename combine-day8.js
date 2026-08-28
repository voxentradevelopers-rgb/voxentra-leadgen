// Day 8: Combine & Clean
// Reads the results we already saved from Day 5 (post-intent leads) and
// Day 7 (Maps leads), normalizes both into consistent shapes, applies
// dedup logic, and saves clean, ready-for-scoring output files.
// Run with: node combine-day8.js
//
// This does NOT re-scrape anything — it works off the JSON files you
// already generated on previous days, since today's goal is about
// cleaning/structuring, not collecting new data.

const fs = require('fs');
const { normalizePostLead, normalizeMapsLead } = require('./utils/normalize');
const { dedupPostLeads, dedupMapsLeads } = require('./utils/dedup');

function loadJsonIfExists(path) {
  if (!fs.existsSync(path)) {
    console.log(`  (skipped — ${path} not found)`);
    return [];
  }
  const raw = fs.readFileSync(path, 'utf-8');
  return JSON.parse(raw);
}

(async () => {
  console.log('=== Combining Post-Intent Leads ===');
  const rawPostLeads = loadJsonIfExists('./results-day5.json');
  console.log(`  Loaded ${rawPostLeads.length} raw post-intent leads.`);

  const normalizedPostLeads = rawPostLeads.map(normalizePostLead);
  const cleanPostLeads = dedupPostLeads(normalizedPostLeads);
  console.log(`  After dedup: ${cleanPostLeads.length} leads (removed ${normalizedPostLeads.length - cleanPostLeads.length} duplicates).`);

  fs.writeFileSync('./clean-post-leads.json', JSON.stringify(cleanPostLeads, null, 2));
  console.log('  Saved to clean-post-leads.json');

  console.log('\n=== Combining Maps Leads ===');
  const rawMapsLeads = loadJsonIfExists('./results-maps-day7.json');
  console.log(`  Loaded ${rawMapsLeads.length} raw Maps leads.`);

  const normalizedMapsLeads = rawMapsLeads.map(normalizeMapsLead);
  const cleanMapsLeads = dedupMapsLeads(normalizedMapsLeads);
  console.log(`  After dedup: ${cleanMapsLeads.length} leads (removed ${normalizedMapsLeads.length - cleanMapsLeads.length} duplicates).`);

  fs.writeFileSync('./clean-maps-leads.json', JSON.stringify(cleanMapsLeads, null, 2));
  console.log('  Saved to clean-maps-leads.json');

  console.log('\nDone. Both files now have consistent field names and are dedup-checked,');
  console.log('ready for Phase 3 (scoring + Google Sheets writing).');
})();
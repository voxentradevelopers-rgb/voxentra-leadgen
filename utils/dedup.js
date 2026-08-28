// utils/dedup.js
// Simple dedup helpers used to avoid saving the same lead twice.
//
// - dedupPostLeads: for post-intent leads, we consider two entries duplicates
//   if they have the same URL (the post itself is the unique thing)
// - dedupMapsLeads: for Maps business leads, there's no single unique URL
//   as reliable as a name+address combo, so we dedup on that pair instead

function dedupPostLeads(leads) {
  const seenUrls = new Set();
  const deduped = [];

  for (const lead of leads) {
    const key = lead.url;
    if (!key || seenUrls.has(key)) continue; // skip missing-url or already-seen
    seenUrls.add(key);
    deduped.push(lead);
  }

  return deduped;
}

function dedupMapsLeads(leads) {
  const seenKeys = new Set();
  const deduped = [];

  for (const lead of leads) {
    // Normalize name+address into a consistent key (lowercase, trimmed)
    // so minor formatting differences don't create false "different" entries
    const key = `${(lead.name || '').toLowerCase().trim()}|${(lead.address || '').toLowerCase().trim()}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(lead);
  }

  return deduped;
}

module.exports = { dedupPostLeads, dedupMapsLeads };
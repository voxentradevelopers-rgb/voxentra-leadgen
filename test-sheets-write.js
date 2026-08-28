// Day 10 Test: Write dummy data to confirm the Sheets connection works
// and columns line up correctly BEFORE we push real scraped data.
// Run with: node test-sheets-write.js

const { writePostLeads, writeMapsLeads } = require('./utils/sheets-writer');

const dummyPostLead = [{
  dateFound: new Date().toISOString(),
  platform: 'test',
  postUrl: 'https://example.com/test-post',
  posterHandle: 'test_user',
  postSnippet: 'This is a dummy test row to confirm Sheets writing works.',
  keywordMatched: 'test keyword',
  niche: 'test-niche',
  location: 'Test City',
  email: 'test@example.com',
  phone: '123-456-7890',
  intentScore: 40,
  completenessScore: 30,
  recencyScore: 20,
  sourceScore: 7,
  totalScore: 97,
  tier: 'Hot',
  status: 'New',
}];

const dummyMapsLead = [{
  dateFound: new Date().toISOString(),
  businessName: 'Test Cafe',
  category: 'Cafe',
  address: '123 Test Street, Test City',
  phone: '123-456-7890',
  website: '',
  rating: '4.5',
  reviewCount: '80',
  listingUrl: 'https://maps.google.com/test',
  keywordMatched: 'test keyword',
  noWebsiteScore: 35,
  reviewsScore: 25,
  categoryMatchScore: 25,
  contactScore: 15,
  totalScore: 100,
  tier: 'Hot',
  status: 'New',
}];

(async () => {
  try {
    console.log('Writing dummy post-intent lead...');
    const postCount = await writePostLeads(dummyPostLead);
    console.log(`  Wrote ${postCount} row(s) to "Post-Intent Leads" tab.`);

    console.log('Writing dummy Maps lead...');
    const mapsCount = await writeMapsLeads(dummyMapsLead);
    console.log(`  Wrote ${mapsCount} row(s) to "Maps Business Leads" tab.`);

    console.log('\nSuccess! Go check your Google Sheet — you should see one new row in each tab.');
  } catch (err) {
    console.error('\nSomething went wrong:', err.message);
    console.error('Common causes: wrong Sheet ID, Sheet not shared with the service account email, or tab names not matching exactly.');
  }
})();
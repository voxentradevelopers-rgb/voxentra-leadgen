// Quick test to verify extractEmail() and extractPhone() actually work
// Run with: node test-extract.js
 
const { extractEmail, extractPhone } = require('./utils/extract-contact');
 
const testSnippet = "Hey, I'm looking for a shopify developer. Reach me at jane.doe@example.com or call (555) 123-4567 anytime!";
 
console.log('Test snippet:', testSnippet);
console.log('\nExtracted email:', extractEmail(testSnippet));
console.log('Extracted phone:', extractPhone(testSnippet));
 
// Also test a snippet with NO contact info, to confirm it correctly returns null
const noContactSnippet = "Just looking for recommendations, no rush on this.";
console.log('\n--- No contact info test ---');
console.log('Test snippet:', noContactSnippet);
console.log('Extracted email:', extractEmail(noContactSnippet));
console.log('Extracted phone:', extractPhone(noContactSnippet));
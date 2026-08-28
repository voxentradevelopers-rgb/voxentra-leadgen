// utils/extract-contact.js
// Small helper functions to pull email addresses and phone numbers
// out of raw text (like a post snippet). Used by our scrapers to
// check if a lead already includes public contact info.

// Matches standard email formats: something@something.something
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Matches common phone formats, e.g. (123) 456-7890, 123-456-7890,
// +1 123 456 7890, 123.456.7890 — intentionally a bit loose since
// phone formats vary a lot across countries/posts
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;

function extractEmail(text) {
  if (!text) return null;
  const matches = text.match(EMAIL_REGEX);
  return matches ? matches[0] : null;
}

function extractPhone(text) {
  if (!text) return null;
  const matches = text.match(PHONE_REGEX);
  // Filter out short false-positives (like a stray "2026" year number)
  const filtered = matches ? matches.filter((m) => m.replace(/\D/g, '').length >= 7) : [];
  return filtered.length > 0 ? filtered[0] : null;
}

module.exports = { extractEmail, extractPhone };
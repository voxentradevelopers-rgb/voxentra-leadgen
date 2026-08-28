// utils/sheets-writer.js
// Handles authentication and writing rows to your Google Sheet using a
// service account (no manual login needed — the credentials.json file
// authenticates automatically).

const { google } = require('googleapis');
const fs = require('fs');

const CREDENTIALS_PATH = './credentials.json';
const SHEET_CONFIG_PATH = './config/sheet-config.json';

// Column order MUST match the header row you typed into each tab manually.
// If you reorder columns in the Sheet, update these arrays to match.
const POST_LEADS_COLUMNS = [
  'dateFound', 'platform', 'postUrl', 'posterHandle', 'postSnippet',
  'keywordMatched', 'niche', 'location', 'email', 'phone',
  'intentScore', 'completenessScore', 'recencyScore', 'sourceScore',
  'totalScore', 'tier', 'status',
];

const MAPS_LEADS_COLUMNS = [
  'dateFound', 'businessName', 'category', 'address', 'phone', 'website',
  'rating', 'reviewCount', 'listingUrl', 'keywordMatched',
  'noWebsiteScore', 'reviewsScore', 'categoryMatchScore', 'contactScore',
  'totalScore', 'tier', 'status',
];

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function getSheetId() {
  const config = JSON.parse(fs.readFileSync(SHEET_CONFIG_PATH, 'utf-8'));
  return config.sheetId;
}

// Converts an array of lead objects into an array of arrays (rows), in the
// exact column order defined above. Missing fields become empty strings
// rather than "null" text, which looks cleaner in the Sheet.
//
// IMPORTANT: any value starting with +, -, or = gets a leading apostrophe
// added. Without this, Google Sheets tries to interpret values like
// "+92 300 1234567" as the start of a formula and throws a #ERROR! —
// the apostrophe forces Sheets to treat it as plain text instead.
function forceTextIfNeeded(value) {
  const str = String(value);
  if (str.startsWith('+') || str.startsWith('-') || str.startsWith('=')) {
    return `'${str}`;
  }
  return str;
}

function leadsToRows(leads, columnOrder) {
  return leads.map((lead) =>
    columnOrder.map((col) => {
      const value = lead[col];
      if (value === null || value === undefined || value === '') return '';
      return forceTextIfNeeded(value);
    })
  );
}

async function appendRows(tabName, rows) {
  const sheets = getSheetsClient();
  const sheetId = getSheetId();

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tabName}!A1`, // A1 = "start looking from the top of the sheet", append adds after existing data
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

async function writePostLeads(leads) {
  const rows = leadsToRows(leads, POST_LEADS_COLUMNS);
  await appendRows('Post-Intent Leads', rows);
  return rows.length;
}

async function writeMapsLeads(leads) {
  const rows = leadsToRows(leads, MAPS_LEADS_COLUMNS);
  await appendRows('Maps Business Leads', rows);
  return rows.length;
}

// ---------- READING EXISTING DATA (for cross-run dedup) ----------

// Reads all existing "Post URL" values already in the Sheet, so we can
// skip re-adding a lead we've already saved in a previous run.
// Post URL is column C (index 2) per POST_LEADS_COLUMNS order.
async function getExistingPostUrls() {
  const sheets = getSheetsClient();
  const sheetId = getSheetId();

  const postUrlColumnIndex = POST_LEADS_COLUMNS.indexOf('postUrl');
  const columnLetter = String.fromCharCode(65 + postUrlColumnIndex); // A=0 -> 'A', C=2 -> 'C', etc.

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `Post-Intent Leads!${columnLetter}2:${columnLetter}`, // row 2 onward, skip header
  });

  const values = response.data.values || [];
  return new Set(values.map((row) => row[0]).filter(Boolean));
}

// Reads existing "Business Name" + "Address" pairs already in the Sheet,
// so we can skip re-adding a Maps lead we've already saved before.
async function getExistingMapsKeys() {
  const sheets = getSheetsClient();
  const sheetId = getSheetId();

  const nameIndex = MAPS_LEADS_COLUMNS.indexOf('businessName');
  const addressIndex = MAPS_LEADS_COLUMNS.indexOf('address');
  const nameLetter = String.fromCharCode(65 + nameIndex);
  const addressLetter = String.fromCharCode(65 + addressIndex);

  // Fetch the full row range covering both columns (assumes name comes before address)
  const startLetter = nameIndex < addressIndex ? nameLetter : addressLetter;
  const endLetter = nameIndex < addressIndex ? addressLetter : nameLetter;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `Maps Business Leads!${startLetter}2:${endLetter}`,
  });

  const values = response.data.values || [];
  const keys = new Set();

  values.forEach((row) => {
    const name = row[0] || '';
    const address = row[1] || '';
    keys.add(`${name.toLowerCase().trim()}|${address.toLowerCase().trim()}`);
  });

  return keys;
}

module.exports = {
  writePostLeads,
  writeMapsLeads,
  getExistingPostUrls,
  getExistingMapsKeys,
};
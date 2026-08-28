// utils/sheets-writer.js
// Handles authentication and writing rows to your Google Sheet using a
// service account (no manual login needed — the credentials.json file
// authenticates automatically).

const { google } = require('googleapis');
const fs = require('fs');

const CREDENTIALS_PATH = './credentials.json';
const SHEET_CONFIG_PATH = './config/sheet-config.json';

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
    range: `${tabName}!A1`,
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

async function getExistingPostUrls() {
  const sheets = getSheetsClient();
  const sheetId = getSheetId();

  const postUrlColumnIndex = POST_LEADS_COLUMNS.indexOf('postUrl');
  const columnLetter = String.fromCharCode(65 + postUrlColumnIndex);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `Post-Intent Leads!${columnLetter}2:${columnLetter}`,
  });

  const values = response.data.values || [];
  return new Set(values.map((row) => row[0]).filter(Boolean));
}

async function getExistingMapsKeys() {
  const sheets = getSheetsClient();
  const sheetId = getSheetId();

  const nameIndex = MAPS_LEADS_COLUMNS.indexOf('businessName');
  const addressIndex = MAPS_LEADS_COLUMNS.indexOf('address');
  const nameLetter = String.fromCharCode(65 + nameIndex);
  const addressLetter = String.fromCharCode(65 + addressIndex);

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

async function writeRunLog(logEntry) {
  const row = [
    logEntry.timestamp || new Date().toISOString(),
    logEntry.scrapeType || '',
    logEntry.keywordUsed || '',
    logEntry.resultsFound ?? '',
    logEntry.resultsAfterFiltering ?? '',
    logEntry.duplicatesSkipped ?? '',
    logEntry.errors || '',
  ];

  await appendRows('Run Log', [row]);
}

module.exports = {
  writePostLeads,
  writeMapsLeads,
  getExistingPostUrls,
  getExistingMapsKeys,
  writeRunLog,
};
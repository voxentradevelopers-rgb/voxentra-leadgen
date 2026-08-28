const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to example.com...');
  await page.goto('https://example.com');

  const title = await page.title();
  console.log('Page title:', title);

  await browser.close();
  console.log('Success! Playwright is working correctly.');
})();
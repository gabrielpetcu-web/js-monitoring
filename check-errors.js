const { chromium } = require('playwright');
const Sentry = require('@sentry/node');
const sites = require('./sites.json');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});

let totalErrors = 0;
let sitesLoaded = 0;

async function checkSite(site) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer'
    ],
  });

  const page = await browser.newPage();

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      totalErrors++;
      console.error(`${site.name} console error: ${msg.text()}`);
      Sentry.captureMessage(`${site.name}: ${msg.text()}`, 'error');
    }
  });

  try {
    await page.goto(site.url, { waitUntil: 'load', timeout: 60000 });
    console.log(`✅ ${site.name} loaded`);
    sitesLoaded++;
  } catch (err) {
    console.error(`❌ ${site.name} failed to load:`, err);
    Sentry.captureException(err);
  }

  await browser.close();
}

(async () => {
  for (const site of sites) {
    await checkSite(site);
  }

  // Summary
  console.log('\n===== Monitoring Summary =====');
  console.log(`✅ Sites loaded successfully: ${sitesLoaded} / ${sites.length}`);
  console.log(`⚠️ Console errors captured: ${totalErrors}`);
  console.log('===============================\n');
})();

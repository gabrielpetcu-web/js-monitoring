const { chromium } = require('playwright');
const Sentry = require('@sentry/node');
const sites = require('./sites.json');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});

let totalErrors = 0;
let sitesLoaded = 0;
const errorSites = new Set(); // track sites with console errors

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
      errorSites.add(site.name);
      const errorMessage = `[${site.name}] ${msg.text()}`;
      console.error(errorMessage);
      Sentry.captureMessage(errorMessage, 'error');
    }
  });

  try {
    await page.goto(site.url, { waitUntil: 'load', timeout: 60000 });
    console.log(`✅ ${site.name} loaded`);
    sitesLoaded++;
  } catch (err) {
    console.error(`❌ ${site.name} failed to load:`, err);
    errorSites.add(site.name);
    Sentry.captureException(new Error(`[${site.name}] ${err.message}`));
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
  console.log(`⚠️ Total console errors captured: ${totalErrors}`);
  if (errorSites.size > 0) {
    console.log('⚠️ Sites with errors:');
    errorSites.forEach(siteName => console.log(`- ${siteName}`));
  } else {
    console.log('✅ No console errors detected on any site');
  }
  console.log('===============================\n');
})();

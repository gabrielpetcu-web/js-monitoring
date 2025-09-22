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

  // Capture console errors (downgraded to warning)
page.on('console', msg => {
  if (msg.type() === 'error') {
    totalErrors++;
    errorSites.add(site.name);
    const errorMessage = `[${site.name}] ${msg.text()}`;
    console.error(errorMessage);

    // If CSS MIME type error → escalate to error + include URL
    if (msg.text().includes("Refused to apply style from") && msg.text().includes("MIME type")) {
      Sentry.captureMessage(errorMessage, {
        level: 'error', // escalate to error
        tags: { failure_type: 'css-mime-error', site: site.name },
        extra: { cssError: msg.text() }, // full raw error with the CSS URL
      });
    } else {
      // Default: downgrade other console errors to warning
      Sentry.captureMessage(errorMessage, {
        level: 'warning',
        tags: { failure_type: 'console-error', site: site.name },
      });
    }
  }
});

  try {
    await page.goto(site.url, { waitUntil: 'load', timeout: 60000 });
    console.log(`✅ ${site.name} loaded`);
    sitesLoaded++;
  } catch (err) {
    console.error(`❌ ${site.name} failed to load:`, err);
    errorSites.add(site.name);

    // Clearer failure message: "SITE is down"
    const failureMessage = `${site.name} is down`;

    Sentry.captureException(new Error(failureMessage), {
      tags: { failure_type: 'load-failure', site: site.name },
      extra: { url: site.url }, // add the site URL to event details
    });
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

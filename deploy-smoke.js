// deploy-smoke.js
const { chromium } = require('playwright');
const Sentry = require('@sentry/node');
const sites = require('./sites.json'); // using the same JSON as monitoring

Sentry.init({ dsn: process.env.SENTRY_DSN });

let failedSites = [];

async function checkSite(site) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.goto(site.url, { waitUntil: 'load', timeout: 60000 });
    console.log(`✅ ${site.name} loaded`);

    // Check critical selectors if defined
    if (site.criticalSelectors && site.criticalSelectors.length) {
      for (const selector of site.criticalSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 10000 });
        } catch {
          throw new Error(`Critical element "${selector}" not found`);
        }
      }
    }
  } catch (err) {
    console.error(`❌ ${site.name} verification failed: ${err.message}`);
    failedSites.push(site.name);
    Sentry.captureException(new Error(`[${site.name}] Deployment check failed: ${err.message}`));
  } finally {
    await browser.close();
  }
}

(async () => {
  await Promise.all(sites.map(checkSite));

  if (failedSites.length === 0) {
    Sentry.captureMessage('✅ Deployment verified successfully: All sites loaded', 'info');
    console.log('✅ Deployment OK, all sites passed verification');
  } else {
    const message = `❌ Deployment issues detected: ${failedSites.join(', ')}`;
    Sentry.captureMessage(message, 'error');
    console.log(message);
  }

  await Sentry.flush(2000);
})();

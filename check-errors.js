const { chromium } = require('playwright');
const Sentry = require('@sentry/node');
const fs = require('fs');
const sites = require('./sites.json');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});

async function checkSite(site) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', async msg => {
    if (msg.type() === 'error') {
      const screenshotPath = `${site.name.replace(/\s+/g, '_')}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      Sentry.withScope(scope => {
        scope.addAttachment({
          filename: screenshotPath,
          data: fs.readFileSync(screenshotPath),
          contentType: 'image/png',
        });
        Sentry.captureMessage(`${site.name}: ${msg.text()}`, 'error');
      });
      console.error(`${site.name} console error: ${msg.text()}`);
    }
  });

  try {
    await page.goto(site.url, { waitUntil: 'load', timeout: 60000 });
    console.log(`✅ ${site.name} loaded`);
  } catch (err) {
    console.error(`❌ ${site.name} failed to load:`, err);
    const screenshotPath = `${site.name.replace(/\s+/g, '_')}-load-error-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    Sentry.withScope(scope => {
      if (fs.existsSync(screenshotPath)) {
        scope.addAttachment({
          filename: screenshotPath,
          data: fs.readFileSync(screenshotPath),
          contentType: 'image/png',
        });
      }
      Sentry.captureException(err);
    });
  }

  await browser.close();
}

(async () => {
  for (const site of sites) {
    await checkSite(site);
  }
})();

const { chromium } = require('playwright');
const Sentry = require('@sentry/node');
const fs = require('fs');
const path = require('path');
const sites = require('./sites.json');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});

const screenshotDir = 'screenshots';
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir);

async function takeScreenshot(page, screenshotPath) {
  try {
    await page.evaluate(() => document.fonts.ready);  // wait for fonts
    await page.waitForTimeout(1000);                  // short wait for rendering
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (err) {
    console.error(`⚠️ Failed to take screenshot: ${err.message}`);
  }
}

async function checkSite(site) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const pendingScreenshots = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const filename = `${site.name.replace(/\s+/g, '_')}-${Date.now()}.png`;
      const screenshotPath = path.join(screenshotDir, filename);

      pendingScreenshots.push(
        (async () => {
          await takeScreenshot(page, screenshotPath);
          Sentry.withScope(scope => {
            scope.addAttachment({
              filename,
              data: fs.readFileSync(screenshotPath),
              contentType: 'image/png',
            });
            Sentry.captureMessage(`${site.name}: ${msg.text()}`, 'error');
          });
          console.error(`${site.name} console error: ${msg.text()}`);
        })()
      );
    }
  });

  try {
    await page.goto(site.url, { waitUntil: 'load', timeout: 60000 });
    console.log(`✅ ${site.name} loaded`);
  } catch (err) {
    console.error(`❌ ${site.name} failed to load:`, err);

    const filename = `${site.name.replace(/\s+/g, '_')}-load-error-${Date.now()}.png`;
    const screenshotPath = path.join(screenshotDir, filename);

    pendingScreenshots.push(
      (async () => {
        await takeScreenshot(page, screenshotPath);
        Sentry.withScope(scope => {
          if (fs.existsSync(screenshotPath)) {
            scope.addAttachment({
              filename,
              data: fs.readFileSync(screenshotPath),
              contentType: 'image/png',
            });
          }
          Sentry.captureException(err);
        });
      })()
    );
  }

  await Promise.all(pendingScreenshots);  // wait for all screenshots
  await browser.close();
}

(async () => {
  for (const site of sites) {
    await checkSite(site);
  }
})();

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

let totalErrors = 0;
let sitesLoaded = 0;

// Take screenshot with retries
async function takeScreenshot(page, screenshotPath) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(3000); // wait 3 seconds for rendering
      await page.screenshot({ path: screenshotPath, fullPage: true });
      return;
    } catch (err) {
      console.warn(`⚠️ Screenshot attempt ${attempt} failed: ${err.message}`);
      if (attempt === 3) {
        // Fallback: try with fullPage: false
        try {
          await page.screenshot({ path: screenshotPath, fullPage: false });
          console.log('ℹ️ Screenshot taken with fullPage: false');
          return;
        } catch (err2) {
          console.error(`❌ Final screenshot attempt failed: ${err2.message}`);
        }
      } else {
        await page.waitForTimeout(1000);
      }
    }
  }
}

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
  const pendingScreenshots = [];

  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      totalErrors++;
      const filename = `${site.name.replace(/\s+/g, '_')}-${Date.now()}.png`;
      const screenshotPath = path.join(screenshotDir, filename);

      pendingScreenshots.push(
        (async () => {
          await takeScreenshot(page, screenshotPath);
          if (fs.existsSync(screenshotPath)) {
            Sentry.withScope(scope => {
              scope.addAttachment({
                filename,
                data: fs.readFileSync(screenshotPath),
                contentType: 'image/png',
              });
              Sentry.captureMessage(`${site.name}: ${msg.text()}`, 'error');
            });
          }
          console.error(`${site.name} console error: ${msg.text()}`);
        })()
      );
    }
  });

  try {
    await page.goto(site.url, { waitUntil: 'load', timeout: 60000 });
    console.log(`✅ ${site.name} loaded`);
    sitesLoaded++;
  } catch (err) {
    console.error(`❌ ${site.name} failed to load:`, err);

    const filename = `${site.name.replace(/\s+/g, '_')}-load-error-${Date.now()}.png`;
    const screenshotPath = path.join(screenshotDir, filename);

    pendingScreenshots.push(
      (async () => {
        await takeScreenshot(page, screenshotPath);
        if (fs.existsSync(screenshotPath)) {
          Sentry.withScope(scope => {
            scope.addAttachment({
              filename,
              data: fs.readFileSync(screenshotPath),
              contentType: 'image/png',
            });
            Sentry.captureException(err);
          });
        }
      })()
    );
  }

  await Promise.all(pendingScreenshots);
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

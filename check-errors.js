const { chromium } = require('playwright');
const Sentry = require('@sentry/node');
const fs = require('fs');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Capture console errors
  page.on('console', async msg => {
    if (msg.type() === 'error') {
      const errorMsg = `Console error: ${msg.text()}`;
      console.error(errorMsg);

      // Take screenshot on error
      const screenshotPath = `screenshot-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Attach screenshot to Sentry
      Sentry.withScope(scope => {
        scope.addAttachment({
          filename: screenshotPath,
          data: fs.readFileSync(screenshotPath),
          contentType: 'image/png',
        });
        Sentry.captureMessage(errorMsg, 'error');
      });
    }
  });

  try {
    await page.goto(process.env.SITE_URL, { waitUntil: 'load', timeout: 60000 });
    console.log("✅ Site loaded without blocking errors");
  } catch (err) {
    console.error("❌ Failed to load site", err);

    // Screenshot if page failed to load
    const screenshotPath = `load-error-${Date.now()}.png`;
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
})();

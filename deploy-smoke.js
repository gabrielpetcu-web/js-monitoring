// deploy-smoke.js
const { chromium } = require('playwright');
const Sentry = require('@sentry/node');

const sites = [
  { name: 'AG - Prime', url: 'https://ag-prime.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Airjourney', url: 'https://airjourney.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Andreea Ungureanu', url: 'https://andreeaungureanu.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Atlantic', url: 'https://atlantic.eastcoastcatalyst.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Benecon', url: 'https://benecon.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Bog.dk', url: 'https://bog.dk/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'BookStore', url: 'https://bookstore.yogananda-srf.org/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'CSC', url: 'https://www.cscsw.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'CSC Academic', url: 'https://www.cscswacademic.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'CSC Laundry', url: 'https://csclaundry.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'CSC Connect News', url: 'https://cscconnectnews.cscsw.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'EastCoastCatalyst', url: 'https://www.eastcoastcatalyst.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'FormAssembly', url: 'https://www.formassembly.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'FreshCoast', url: 'https://freshcoastcabins.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Marketing Pro', url: 'https://marketingpro.cscsw.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Marketing Pro OTA', url: 'https://marketingpro.onetapaway.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'MarketPlace', url: 'https://marketplace.cscsw.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'OnlineMeditation', url: 'https://onlinemeditation.yogananda.org/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Orbion', url: 'https://orbionspace.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Perfmonitor', url: 'https://www.perfmonitor.io/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Railmotus', url: 'https://railmotus.wpenginepowered.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'RunamokMaple', url: 'https://runamokmaple.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Service CSC', url: 'https://service.cscsw.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Springfield Batranii', url: 'https://www.springfielddevelopment.org/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'SuperLaundry', url: 'https://superlaundry.wpenginepowered.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Vonbargen', url: 'https://vonbargensjewelry.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Yogananda', url: 'https://yoganandaseva.org/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Akademisk', url: 'https://www.akademisk.dk/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Alinea', url: 'https://alinea.dk/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Berkeley', url: 'https://executive.berkeley.edu/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Cablezone', url: 'https://test.cablezone.ro/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Carlsen', url: 'https://www.carlsen.dk/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'DIA', url: 'https://dia.org/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'InfoPrime', url: 'https://infoprime.agdeploy.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'IWPR', url: 'https://iwpr.net/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Lindhardtogringhof', url: 'https://www.lindhardtogringhof.dk/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'OSU-COB', url: 'http://osu-cob.agdeploy.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Praxis', url: 'https://praxis.dk/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Telemark', url: 'https://www.telemark-pyrenees.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Ti Reporter', url: 'https://ti-reporter.com/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'VLG', url: 'https://portal.vlg.ro/user/login', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Volunteer Portal', url: 'https://volunteer.yogananda.org/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Voluntary SRF', url: 'https://voluntaryleague.yogananda.org/', criticalSelectors: ['header', 'main', 'footer'] },
  { name: 'Voluntary YSS', url: 'https://voluntaryleague.yssofindia.org/', criticalSelectors: ['header', 'main', 'footer'] }
];

Sentry.init({ dsn: process.env.SENTRY_DSN });

let failedSites = [];

async function checkSite(site) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.goto(site.url, { waitUntil: 'load', timeout: 60000 });
    console.log(`✅ ${site.name} loaded`);

    for (const selector of site.criticalSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
      } catch {
        throw new Error(`Critical element "${selector}" not found`);
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

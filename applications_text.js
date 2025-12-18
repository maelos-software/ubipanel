const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: false,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("http://rknet.fourty.net:28080/dashboard/applications");
  await page.close();

  // ---------------------
  await context.close();
  await browser.close();
})();

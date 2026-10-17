// Рендер scene.html у кадри (30 fps) через Playwright.
// Використання: node render.js <вихідна_тека> [fps] [лише_кадри_через_кому_в_секундах]
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW_PATH || 'playwright');

(async () => {
  const out = process.argv[2] || 'frames';
  const fps = Number(process.argv[3] || 30);
  const only = process.argv[4] ? process.argv[4].split(',').map(Number) : null;
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.resolve(__dirname, 'scene.html') + '?capture');
  await page.evaluate(() => document.fonts.ready);
  const duration = await page.evaluate(() => window.DURATION);
  const times = only || Array.from({ length: Math.round(duration * fps) }, (_, i) => i / fps);
  const canvas = await page.$('#c');
  for (let i = 0; i < times.length; i++) {
    await page.evaluate(t => window.render(t), times[i]);
    const name = only ? `t_${times[i]}.png` : `f_${String(i).padStart(4, '0')}.png`;
    await canvas.screenshot({ path: path.join(out, name) });
    if (i % 60 === 0) console.log(`frame ${i}/${times.length}`);
  }
  await browser.close();
})();

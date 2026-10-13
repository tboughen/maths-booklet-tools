import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { chromium, expect } from "@playwright/test";

const site = process.argv[2] || "https://mathsdock-preview.tjboughen.workers.dev";
const out = "cloudflare-release/brand-review";
mkdirSync(out, {recursive: true});
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const browser = await chromium.launch({channel: "chrome", headless: true});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const layouts = [];
try {
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({width, height: width < 620 ? 812 : 1000});
    await expect(async () => {
      await page.goto(`${site}/?tool=home`);
      await expect(page.locator('.site-brand-logo')).toBeVisible({timeout: 5000});
      await expect.poll(() => page.locator('.site-brand-logo').evaluate(image =>
        image.complete && image.naturalWidth > 0), {timeout: 5000}).toBeTruthy();
    }).toPass({timeout: 90000, intervals: [1000, 3000, 5000]});
    const result = await page.evaluate(() => {
      const image = document.querySelector('.site-brand-logo');
      const rect = image.getBoundingClientRect();
      const first = document.querySelector('.site-overview h1');
      return {title: document.title, heading: first?.textContent ?? null,
        cards: document.querySelectorAll('.site-overview .overview-card').length,
        tagline: document.body.textContent.includes('Questions and diagrams for your next lesson.'), complete: image.complete,
        naturalWidth: image.naturalWidth, scrollWidth: document.documentElement.scrollWidth,
        logoWidth: rect.width, logoRight: rect.right,
        homeLabel: document.querySelector('.site-brand').getAttribute('aria-label')};
    });
    assert.equal(result.heading, null);
    assert.equal(result.tagline, false);
    assert.equal(result.cards, 3);
    assert.ok(result.title.endsWith(" · Maths Dock"));
    assert.equal(result.homeLabel, "Maths Dock home");
    assert.ok(result.complete && result.naturalWidth > 0);
    assert.ok(result.scrollWidth <= width && result.logoRight <= width);
    if (width < 620) {
      await page.getByRole('button', {name: /Sections/}).click();
      await page.getByRole('navigation', {name: 'Main sections'}).waitFor({state: 'visible'});
      await page.keyboard.press('Escape');
    }
    await page.screenshot({path: `${out}/home-${width}.png`, fullPage: true});
    layouts.push({width, ...result});
  }
  const assets = [];
  for (const name of ['favicon.svg', 'brand/mathsdock-logo.svg', 'brand/mathsdock-logo-inverse.svg',
    'brand/mathsdock-icon.svg', 'brand/favicon-32.png', 'brand/icon-180.png', 'brand/icon-192.png',
    'brand/icon-512.png', 'brand/mathsdock-social.png', 'brand/site.webmanifest', 'bank/catalogue.json']) {
    const response = await page.request.get(`${site}/${name}`);
    assert.equal(response.status(), 200, name);
    const bytes = await response.body();
    const expected = readFileSync(`dist-cloudflare/${name}`);
    assert.equal(hash(bytes), hash(expected), name);
    assets.push({name, sha256: hash(bytes), bytes: bytes.length, type: response.headers()['content-type']});
  }
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/proof.json`, JSON.stringify({site, checkedAt: new Date().toISOString(), layouts, assets, errors}, null, 2));
  console.log(JSON.stringify({site, layouts: layouts.length, exactAssets: assets.length, errors}, null, 2));
} finally {
  await browser.close();
}

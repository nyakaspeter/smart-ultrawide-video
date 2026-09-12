import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import { chromium } from 'playwright';
import ts from 'typescript';

// Run the production controller in Chromium: happy-dom neither lays out video
// nor serializes transforms like a browser, so it cannot catch CSS feedback.
const names = ['core/settings', 'geometry/zoom-calculator', 'dom/style-controller'];
const bundle = `const modules = {}; ${names.map((name) => {
  const source = readFileSync(new URL(`../../src/${name}.ts`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return `modules[${JSON.stringify('../' + name)}] = (exports, require) => {${js}};`;
}).join('\n')}
const cache = {};
function require(name) {
  if (!cache[name]) { cache[name] = {}; modules[name](cache[name], require); }
  return cache[name];
}
window.StyleController = require('../dom/style-controller').StyleController;`;

let browser;
before(async () => {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  });
});
after(async () => { await browser?.close(); });

async function fixture(run, args = {}) {
  const page = await browser.newPage({ viewport: { width: 5120, height: 1440 } });
  try {
    await page.setContent(`<style>
      body { margin: 0; }
      video { position: absolute; width: 2560px; height: 1440px;
        left: 1280px; top: 0; object-fit: contain; }
    </style><div><video></video></div>`);
    await page.addScriptTag({ content: bundle });
    await page.evaluate(() => {
      const video = document.querySelector('video');
      Object.defineProperties(video, { videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
      window.video = video;
      window.controller = new StyleController();
      controller.setZoomAnimationEnabled(false);
      window.apply = (bars = false, force = false) => controller.apply(video, video.parentElement, {
        kind: 'detected', isBlackFrame: false,
        content: { left: 0, top: bars ? 0.125 : 0, right: 1, bottom: bars ? 0.875 : 1 },
      }, force);
      window.tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    });
    return await page.evaluate(run, args);
  } finally {
    await page.close();
  }
}

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.1, `${actual} should equal ${expected}`);
}

for (const centered of [false, true]) {
  for (const bars of [false, true]) {
    test(`repeated frames stay centered, centered transform=${centered}, bars=${bars}`, async () => {
      const result = await fixture(async ({ centered, bars }) => {
        if (centered) Object.assign(video.style, {
          left: '2560px', top: '720px', transform: 'translate(-50%, -50%)',
        });
        const original = video.style.cssText;
        const frames = [];
        for (let i = 0; i < 12; i++) {
          apply(bars);
          await tick();
          frames.push(video.getBoundingClientRect().toJSON());
        }
        controller.restore();
        return { frames, original, restored: video.style.cssText };
      }, { centered, bars });
      const scale = bars ? 1.3125 : 1;
      for (const rect of result.frames) {
        close(rect.width, 2560 * scale);
        close(rect.height, 1440 * scale);
        close(rect.left + rect.width / 2, 2560);
        close(rect.top + rect.height / 2, 720);
        // Every pixel of the detected picture remains within the viewport.
        assert.ok(rect.top + rect.height * (bars ? 0.125 : 0) >= -0.1);
        assert.ok(rect.bottom - rect.height * (bars ? 0.125 : 0) <= 1440.1);
      }
      assert.equal(result.restored, result.original);
    });
  }
}

test('fullscreen layout settling removes entry zoom instead of compounding it', async () => {
  const rects = await fixture(async () => {
    Object.assign(video.style, { width: '2048px', height: '1152px', left: '1536px', top: '144px' });
    apply();
    await tick();
    Object.assign(video.style, { width: '2560px', height: '1440px', left: '1280px', top: '0px' });
    const rects = [];
    for (let i = 0; i < 6; i++) {
      apply();
      await tick();
      rects.push(video.getBoundingClientRect().toJSON());
    }
    controller.restore();
    return rects;
  });
  for (const rect of rects) {
    close(rect.left, 1280);
    close(rect.top, 0);
    close(rect.width, 2560);
    close(rect.height, 1440);
  }
});

test('position and player transform updates remain reversible', async () => {
  const result = await fixture(async () => {
    apply();
    await tick();
    video.style.left = '1400px';
    video.style.setProperty('transform', 'translateX(-30px)', 'important');
    video.style.transformOrigin = '25% 75%';
    await tick();
    apply();
    await tick();
    const rect = video.getBoundingClientRect().toJSON();
    controller.restore();
    return { rect, transform: video.style.transform, origin: video.style.transformOrigin,
      priority: video.style.getPropertyPriority('transform') };
  });
  close(result.rect.left, 1280);
  close(result.rect.top, 0);
  assert.equal(result.transform, 'translateX(-30px)');
  assert.equal(result.origin, '25% 75%');
  assert.equal(result.priority, 'important');
});

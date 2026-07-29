const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const contentSource = fs.readFileSync(
  path.join(__dirname, "content.js"),
  "utf8"
);

test("automated transcript scrape hides every engagement panel before YouTube can identify it", () => {
  assert.match(
    contentSource,
    /html\.ytt-transcript-scraping\s+ytd-engagement-panel-section-list-renderer/
  );
});

test("scrape shield is installed before the automated transcript-panel click", () => {
  const shieldCall = contentSource.indexOf("injectScrapeHideStyle()");
  const panelOpenCall = contentSource.indexOf("await openTranscriptPanel()", shieldCall);

  assert.notEqual(shieldCall, -1);
  assert.notEqual(panelOpenCall, -1);
  assert.ok(shieldCall < panelOpenCall);
});

test("scrape shield is removed in cleanup", () => {
  assert.match(
    contentSource,
    /finally\s*\{[\s\S]*removeScrapeHideStyle\(\)/
  );
});

test("cleanup owns the panel before attempting the automated open", () => {
  const ownership = contentSource.indexOf(
    "let openedByTranscriber = !wasInitiallyExpanded"
  );
  const panelOpenCall = contentSource.indexOf("await openTranscriptPanel()", ownership);

  assert.notEqual(ownership, -1);
  assert.notEqual(panelOpenCall, -1);
  assert.ok(ownership < panelOpenCall);
});

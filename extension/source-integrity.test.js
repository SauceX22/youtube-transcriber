const test = require("node:test");
const assert = require("node:assert/strict");

const {
  snapshotSource,
  validateSourceMatch,
  appendIntegrityEvent,
  summarizeIntegrityLedger,
} = require("./source-integrity.js");

test("source snapshot does not change when live page state moves to another tab", () => {
  const pageInfo = {
    url: "https://www.youtube.com/watch?v=t0GiTyz4syY",
    videoId: "t0GiTyz4syY",
    title: "Netflix CPTO on AI",
    author: "Lenny's Podcast",
    channelUrl: "https://www.youtube.com/@LennysPodcast",
    pageUrl: "https://www.youtube.com/watch?v=t0GiTyz4syY",
  };

  const snapshot = snapshotSource(pageInfo);
  pageInfo.url = "https://claude.ai/new";
  pageInfo.videoId = null;
  pageInfo.title = "Building at 30 with zero dollars and AI - Claude";

  assert.deepEqual(snapshot, {
    url: "https://www.youtube.com/watch?v=t0GiTyz4syY",
    videoId: "t0GiTyz4syY",
    title: "Netflix CPTO on AI",
    author: "Lenny's Podcast",
    channelUrl: "https://www.youtube.com/@LennysPodcast",
    pageUrl: "https://www.youtube.com/watch?v=t0GiTyz4syY",
  });
});

test("source validation blocks a previous video's transcript", () => {
  const result = validateSourceMatch(
    { videoId: "t0GiTyz4syY", url: "https://youtube.com/watch?v=t0GiTyz4syY" },
    { videoId: "FMzKk73iUhw", videoUrl: "https://youtube.com/watch?v=FMzKk73iUhw" }
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, "video_id_mismatch");
});

test("source validation accepts the transcript bound to the requested video", () => {
  const result = validateSourceMatch(
    { videoId: "t0GiTyz4syY", url: "https://youtube.com/watch?v=t0GiTyz4syY" },
    { videoId: "t0GiTyz4syY", videoUrl: "https://youtube.com/watch?v=t0GiTyz4syY" }
  );

  assert.deepEqual(result, { ok: true, reason: null });
});

test("integrity ledger retains daily outcomes and reports a 30-day window", () => {
  let ledger = null;
  ledger = appendIntegrityEvent(ledger, {
    ts: "2026-07-19T13:00:00.000Z",
    kind: "handoff_launched",
    expectedVideoId: "t0GiTyz4syY",
  });
  ledger = appendIntegrityEvent(ledger, {
    ts: "2026-07-19T13:01:00.000Z",
    kind: "stale_source_blocked",
    expectedVideoId: "t0GiTyz4syY",
    actualVideoId: "FMzKk73iUhw",
  });
  ledger = appendIntegrityEvent(ledger, {
    ts: "2026-07-19T13:02:00.000Z",
    kind: "error",
    stage: "handoff_fetch",
  });

  const report = summarizeIntegrityLedger(
    ledger,
    "2026-07-20T00:00:00.000Z",
    30
  );

  assert.equal(report.handoffs, 1);
  assert.equal(report.staleSourceBlocks, 1);
  assert.equal(report.errors, 1);
  assert.equal(report.status, "attention");
  assert.equal(report.recentIncidents.length, 2);
});

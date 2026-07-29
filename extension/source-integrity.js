(function initSourceIntegrity(globalScope) {
  "use strict";

  const LEDGER_VERSION = 1;
  const MAX_DAILY_BUCKETS = 90;
  const MAX_RECENT_EVENTS = 200;
  const INCIDENT_KINDS = new Set(["stale_source_blocked", "error"]);

  function cleanString(value, maxLength = 2048) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
  }

  function snapshotSource(source = {}) {
    return Object.freeze({
      url: cleanString(source.url),
      videoId: cleanString(source.videoId, 160),
      title: cleanString(source.title, 512),
      author: cleanString(source.author, 256),
      channelUrl: cleanString(source.channelUrl),
      pageUrl: cleanString(source.pageUrl),
    });
  }

  function validateSourceMatch(expected = {}, actual = {}) {
    const expectedVideoId = cleanString(expected.videoId, 160);
    const actualVideoId = cleanString(actual.videoId, 160);
    if (expectedVideoId && actualVideoId && expectedVideoId !== actualVideoId) {
      return { ok: false, reason: "video_id_mismatch" };
    }
    if (expectedVideoId && !actualVideoId) {
      return { ok: false, reason: "missing_actual_video_id" };
    }
    return { ok: true, reason: null };
  }

  function emptyLedger() {
    return { version: LEDGER_VERSION, daily: {}, recent: [] };
  }

  function normalizeLedger(value) {
    if (!value || value.version !== LEDGER_VERSION) return emptyLedger();
    return {
      version: LEDGER_VERSION,
      daily: value.daily && typeof value.daily === "object" ? { ...value.daily } : {},
      recent: Array.isArray(value.recent) ? [...value.recent] : [],
    };
  }

  function appendIntegrityEvent(current, rawEvent = {}) {
    const ledger = normalizeLedger(current);
    const ts = cleanString(rawEvent.ts, 64) || new Date().toISOString();
    const day = ts.slice(0, 10);
    const kind = cleanString(rawEvent.kind, 64);
    const event = {
      ts,
      kind,
      stage: cleanString(rawEvent.stage, 64),
      expectedVideoId: cleanString(rawEvent.expectedVideoId, 160),
      actualVideoId: cleanString(rawEvent.actualVideoId, 160),
      transcriptId: cleanString(rawEvent.transcriptId, 160),
      provider: cleanString(rawEvent.provider, 64),
      message: cleanString(rawEvent.message, 512),
    };

    const bucket = {
      runs: 0,
      transcriptionCompletions: 0,
      handoffs: 0,
      staleSourceBlocks: 0,
      errors: 0,
      ...(ledger.daily[day] || {}),
    };
    if (kind === "run_started") bucket.runs += 1;
    if (kind === "transcription_completed") bucket.transcriptionCompletions += 1;
    if (kind === "handoff_launched") bucket.handoffs += 1;
    if (kind === "stale_source_blocked") bucket.staleSourceBlocks += 1;
    if (kind === "error") bucket.errors += 1;
    ledger.daily[day] = bucket;

    ledger.recent.push(event);
    ledger.recent = ledger.recent.slice(-MAX_RECENT_EVENTS);
    const retainedDays = Object.keys(ledger.daily).sort().slice(-MAX_DAILY_BUCKETS);
    ledger.daily = Object.fromEntries(retainedDays.map((key) => [key, ledger.daily[key]]));
    return ledger;
  }

  function summarizeIntegrityLedger(current, now = new Date().toISOString(), days = 30) {
    const ledger = normalizeLedger(current);
    const end = new Date(now);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - Math.max(1, days) + 1);
    const totals = {
      days: Math.max(1, days),
      runs: 0,
      transcriptionCompletions: 0,
      handoffs: 0,
      staleSourceBlocks: 0,
      errors: 0,
    };
    for (const [day, bucket] of Object.entries(ledger.daily)) {
      const bucketDate = new Date(`${day}T00:00:00.000Z`);
      if (bucketDate < start || bucketDate > end) continue;
      for (const key of Object.keys(totals)) {
        if (key !== "days") totals[key] += Number(bucket[key] || 0);
      }
    }
    const recentIncidents = ledger.recent
      .filter((event) => INCIDENT_KINDS.has(event.kind))
      .slice(-20)
      .reverse();
    return {
      ...totals,
      status: totals.staleSourceBlocks > 0 || totals.errors > 0 ? "attention" : "healthy",
      recentIncidents,
      retainedDays: Object.keys(ledger.daily).length,
    };
  }

  const api = {
    snapshotSource,
    validateSourceMatch,
    appendIntegrityEvent,
    summarizeIntegrityLedger,
  };
  globalScope.TranscriberSourceIntegrity = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

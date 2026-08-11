(() => {
const previousLifecycle = globalThis.__transcriberYouTubeContentLifecycle;
if (previousLifecycle?.runtime === chrome.runtime) return;
try {
  previousLifecycle?.cleanup?.();
} catch { /* stale extension contexts can reject cleanup calls */ }

const runtimeApi = chrome.runtime;
const cleanupTasks = [];
const lifecycle = {
  runtime: runtimeApi,
  cleanup() {
    for (const cleanup of cleanupTasks.splice(0).reverse()) {
      try { cleanup(); } catch { /* best-effort stale lifecycle cleanup */ }
    }
    if (globalThis.__transcriberYouTubeContentLifecycle === lifecycle) {
      delete globalThis.__transcriberYouTubeContentLifecycle;
    }
  },
};
globalThis.__transcriberYouTubeContentLifecycle = lifecycle;

function addCleanup(cleanup) {
  cleanupTasks.push(cleanup);
}

function extractVideoId(url) {
  return TranscriberUrlUtils.extractYouTubeVideoId(url);
}

function isYouTubeVideoPage(url) {
  return !!extractVideoId(url);
}

function getVideoTitle() {
  const candidates = [
    document.querySelector("ytd-watch-metadata h1 yt-formatted-string")?.textContent,
    document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent,
    document.querySelector("h1 yt-formatted-string")?.textContent,
    document.querySelector("meta[property='og:title']")?.getAttribute("content"),
    document.querySelector('meta[name="title"]')?.getAttribute("content"),
    document.title.replace(/\s+-\s+YouTube$/i, ""),
  ];
  const normalizedVideoId = extractVideoId(window.location.href);
  const canonicalHref = document
    .querySelector("link[rel='canonical']")
    ?.getAttribute("href");
  const canonicalVideoId = canonicalHref ? extractVideoId(canonicalHref) : null;

  for (const candidate of candidates) {
    const title = String(candidate || "").replace(/\s+/g, " ").trim();
    if (!title) continue;
    // YouTube can keep meta/link tags from the previous watch page around
    // during SPA navigation. If canonical still points at another video, only
    // trust the visible watch-page headline and tab title until hydration lands.
    if (
      canonicalVideoId &&
      normalizedVideoId &&
      canonicalVideoId !== normalizedVideoId &&
      candidate !== candidates[0] &&
      candidate !== candidates[1] &&
      candidate !== candidates[2] &&
      candidate !== candidates[candidates.length - 1]
    ) {
      continue;
    }
    return title;
  }
  return "";
}

function getChannelInfo() {
  const selectors = [
    "#owner ytd-channel-name #text a",
    "ytd-watch-metadata ytd-channel-name #text a",
    "#upload-info ytd-channel-name #text a",
  ];
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const name = el?.textContent?.trim();
    if (name) {
      const href = el.getAttribute("href");
      return {
        author: name,
        channelUrl: href ? new URL(href, window.location.origin).toString() : "",
      };
    }
  }
  const authorMeta = document.querySelector('link[itemprop="name"]');
  return {
    author: authorMeta?.getAttribute("content")?.trim() || "",
    channelUrl: "",
  };
}

function isLiveStream() {
  // YouTube player has a .ytp-live class when playing a live stream
  const player = document.getElementById("movie_player");
  if (!player?.classList.contains("ytp-live")) return false;
  // Confirm with the live badge — it must exist, not be disabled, and be visible.
  // YouTube keeps .ytp-live-badge in the DOM for premiered/VOD videos but hides
  // it or sets the disabled attribute.
  const badge = document.querySelector(".ytp-live-badge");
  if (!badge) return false;
  if (badge.hasAttribute("disabled")) return false;
  if (badge.offsetParent === null && getComputedStyle(badge).display === "none") return false;
  return true;
}

function reportPageInfo() {
  const videoId = extractVideoId(window.location.href);
  const channel = getChannelInfo();
  try {
    chrome.runtime.sendMessage({
      type: "PAGE_INFO",
      url: window.location.href,
      title: getVideoTitle(),
      author: channel.author,
      channelUrl: channel.channelUrl,
      videoId: videoId,
      isLive: videoId ? isLiveStream() : false,
    });
  } catch {
    // Extension context invalidated (reloaded) — stop observing
    observer?.disconnect();
  }
}

function schedulePageInfoReports() {
  reportPageInfo();
  // YouTube SPA navigation updates URL, title, channel, and transcript panel
  // on separate ticks. Re-report as hydration settles so we don't persist a
  // previous watch-page title for the new video.
  [300, 900, 1800, 3200].forEach((delay) => {
    const timer = setTimeout(() => {
      reportTimers.delete(timer);
      reportPageInfo();
    }, delay);
    reportTimers.add(timer);
  });
}

let currentVideoId = extractVideoId(window.location.href);
let lastVideoIdChangeAt = Date.now();
const reportTimers = new Set();
addCleanup(() => {
  for (const timer of reportTimers) clearTimeout(timer);
  reportTimers.clear();
});

function markVideoNavigation() {
  const nextVideoId = extractVideoId(window.location.href);
  if (nextVideoId !== currentVideoId) {
    currentVideoId = nextVideoId;
    lastVideoIdChangeAt = Date.now();
  }
}

// Initial report
schedulePageInfoReports();

// YouTube SPA navigation — MutationObserver
let lastUrl = window.location.href;
let observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    markVideoNavigation();
    schedulePageInfoReports();
  }
});
addCleanup(() => observer.disconnect());
function observePageWhenReady() {
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    return;
  }
  document.addEventListener("DOMContentLoaded", observePageWhenReady, { once: true });
}
addCleanup(() => document.removeEventListener("DOMContentLoaded", observePageWhenReady));
observePageWhenReady();

// YouTube's own navigation event
function onYouTubeNavigateFinish() {
  markVideoNavigation();
  schedulePageInfoReports();
}
window.addEventListener("yt-navigate-finish", onYouTubeNavigateFinish);
addCleanup(() => window.removeEventListener("yt-navigate-finish", onYouTubeNavigateFinish));

function onYouTubePageDataUpdated() {
  markVideoNavigation();
  schedulePageInfoReports();
}
document.addEventListener("yt-page-data-updated", onYouTubePageDataUpdated);
addCleanup(() => document.removeEventListener("yt-page-data-updated", onYouTubePageDataUpdated));

// Close side panel when entering fullscreen
function closePanel() {
  try {
    chrome.runtime.sendMessage({ type: "CLOSE_PANEL" });
  } catch { /* ignore */ }
}

function onFullscreenChange() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    closePanel();
  }
}
document.addEventListener("fullscreenchange", onFullscreenChange);
document.addEventListener("webkitfullscreenchange", onFullscreenChange);
addCleanup(() => {
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
});

// YouTube's player class changes when entering fullscreen
const ytObserver = new MutationObserver(() => {
  const player = document.getElementById("movie_player");
  if (player?.classList.contains("ytp-fullscreen")) {
    closePanel();
  }
});
addCleanup(() => ytObserver.disconnect());
let watchPlayerTimer = null;
function watchPlayer() {
  const player = document.getElementById("movie_player");
  if (player) {
    ytObserver.observe(player, { attributes: true, attributeFilter: ["class"] });
  } else {
    watchPlayerTimer = setTimeout(watchPlayer, 1000);
  }
}
addCleanup(() => {
  if (watchPlayerTimer) clearTimeout(watchPlayerTimer);
});
watchPlayer();

// Catch YouTube's 'f' fullscreen shortcut — close panel after a short delay
// to let YouTube's fullscreen kick in
function onYouTubeKeydown(e) {
  if (e.key === "f" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const tag = e.target?.tagName;
    // Only act if not typing in an input/textarea
    if (tag !== "INPUT" && tag !== "TEXTAREA" && !e.target?.isContentEditable) {
      setTimeout(closePanel, 100);
    }
  }
}
document.addEventListener("keydown", onYouTubeKeydown);
addCleanup(() => document.removeEventListener("keydown", onYouTubeKeydown));

// ---------------------------------------------------------------------------
// Client-side transcript scrape (fast path).
//
// We open YouTube's "Show transcript" panel, wait for transcript rows to
// render, and read them straight from the DOM. Same data the page is about
// to display — no extra network call, no server round-trip, no auth.
// Background's EXTRACT_CAPTIONS message routes here; if scrape returns no
// segments, background falls back to its server transcribe path.
// ---------------------------------------------------------------------------

const CAPTIONS_DEBUG_PREFIX = "[ytt-content]";

function debugCaptionLog(message, extra = undefined) {
  try {
    if (extra === undefined) {
      console.log(`${CAPTIONS_DEBUG_PREFIX} ${message}`);
    } else {
      console.log(`${CAPTIONS_DEBUG_PREFIX} ${message}`, extra);
    }
  } catch { /* ignore console failures */ }
}

debugCaptionLog("script attached", {
  href: window.location.href,
  readyState: document.readyState,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTimestampToSeconds(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const parts = text.split(":").map((part) => Number(part.trim()));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

// YT ships two transcript-segment renderers depending on layout vintage:
//   - <transcript-segment-view-model> (ytwTranscriptSegmentViewModelHost)
//     — modern, used since late-2024
//   - <ytd-transcript-segment-renderer> — older Polymer build
// Match both so we don't regress on either when YT A/B-tests one bucket back.
const SEGMENT_TAG_SELECTOR =
  "transcript-segment-view-model, ytd-transcript-segment-renderer";

function extractTranscriptSegmentsFromDom(root = document) {
  const items = Array.from(root.querySelectorAll(SEGMENT_TAG_SELECTOR));
  const segments = [];
  for (const item of items) {
    const textEl =
      item.querySelector(".ytAttributedStringHost") ||
      item.querySelector(".segment-text") ||
      item.querySelector("#segment-text") ||
      item.querySelector("yt-formatted-string") ||
      item.querySelector("span[role='text']");
    const timeEl =
      item.querySelector(".ytwTranscriptSegmentViewModelTimestamp") ||
      item.querySelector(".segment-timestamp") ||
      item.querySelector("#segment-timestamp") ||
      item.querySelector("[class*='Timestamp']:not([class*='A11y'])") ||
      item.querySelector("[class*='timestamp']");
    const text = String(textEl?.textContent || "").replace(/\s+/g, " ").trim();
    const start = parseTimestampToSeconds(timeEl?.textContent || "");
    if (!text || start == null) continue;
    segments.push({ start, duration: 0, text });
  }
  for (let i = 0; i < segments.length; i++) {
    const next = segments[i + 1];
    if (next && next.start >= segments[i].start) {
      segments[i].duration = Math.max(0, next.start - segments[i].start);
    }
  }
  return segments;
}

// The transcript engagement panel can land under a few target-ids
// (PAmodern_transcript_view, engagement-panel-searchable-transcript) and
// since late-2024 the *expanded* one sometimes has no target-id at all.
// We treat "panel exists" loosely (any matching node) but distinguish
// "panel actually open" via the visibility= attribute, since the HIDDEN
// panel is in the DOM from page load and always matches.
function findTranscriptPanel() {
  // 1. An expanded panel that actually holds transcript segments is the
  //    truth — return that even if its target-id is empty.
  const allPanels = document.querySelectorAll(
    "ytd-engagement-panel-section-list-renderer"
  );
  for (const panel of allPanels) {
    const vis = panel.getAttribute("visibility") || "";
    if (vis.includes("EXPANDED") && panel.querySelector(SEGMENT_TAG_SELECTOR)) {
      return panel;
    }
  }
  // 2. Fall back to any panel whose target-id mentions transcript — this is
  //    the placeholder/HIDDEN one before the user opens it.
  return document.querySelector(
    "ytd-engagement-panel-section-list-renderer[target-id*='transcript']"
  );
}

function isTranscriptPanelExpanded() {
  const allPanels = document.querySelectorAll(
    "ytd-engagement-panel-section-list-renderer"
  );
  for (const panel of allPanels) {
    const vis = panel.getAttribute("visibility") || "";
    if (vis.includes("EXPANDED") && panel.querySelector(SEGMENT_TAG_SELECTOR)) {
      return true;
    }
  }
  return false;
}

function isTranscriptPanelDrawerExpanded() {
  const allPanels = document.querySelectorAll(
    "ytd-engagement-panel-section-list-renderer"
  );
  for (const panel of allPanels) {
    const vis = panel.getAttribute("visibility") || "";
    const targetId = panel.getAttribute("target-id") || "";
    if (
      vis.includes("EXPANDED") &&
      (targetId.includes("transcript") ||
        panel.textContent.includes("Transcript") ||
        panel.querySelector(SEGMENT_TAG_SELECTOR))
    ) {
      return true;
    }
  }
  return false;
}

async function waitForTranscriptSegments(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // Always scan from document — the HIDDEN placeholder panel matches
    // findTranscriptPanel() but contains no segments, so scoping to it
    // would always return [].
    const segments = extractTranscriptSegmentsFromDom(document);
    if (segments.length) return segments;
    await sleep(100);
  }
  return [];
}

// Generic text-based finder — looks for a clickable element whose visible
// text or aria-label matches "show transcript" / "transcript". Far more
// resilient to DOM changes than tag-name selectors. Skips hidden elements.
// When the match is a wrapper (ytd-button-renderer / yt-button-shape), we
// drill down to the inner <button> so YouTube's actual click handler fires
// — clicking the wrapper alone is a no-op on modern YT.
function findClickableByText(textPattern) {
  const all = document.querySelectorAll(
    "button, tp-yt-paper-item, ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer, ytd-button-renderer, yt-button-shape"
  );
  for (const el of all) {
    // Skip hidden elements. The previous AND-condition let elements through
    // when their parent was hidden (offsetParent null) but their own display
    // was inline-block (e.g. "Show transcript" inside a collapsed description).
    // Returning that hidden button caused openTranscriptPanel to click a no-op
    // and skip the description-expand path entirely — symptom: captioned
    // videos with collapsed descriptions silently fell back to server scrape.
    if (el.offsetParent === null) continue;
    if (getComputedStyle(el).display === "none") continue;
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    const text = String(el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (textPattern.test(aria) || textPattern.test(text)) {
      if (el.tagName === "BUTTON") return el;
      return el.querySelector("button") || el;
    }
  }
  return null;
}

function findShowTranscriptDirectButton() {
  // Modern YouTube renders a "Show transcript" button in the description
  // expansion (under the video). Try that first — it's the cleanest path.
  return findClickableByText(/^show transcript\b|^transcript$/);
}

function findShowTranscriptMenuItem() {
  // Inside the More-actions menu, the item label is "Show transcript".
  return findClickableByText(/show transcript/);
}

function findMoreActionsButton() {
  // YouTube ships multiple "More actions" buttons on a watch page (player
  // overlay, ytd-watch-metadata legacy slot, comments dropdown). Several
  // of those are display:none ghosts that match selectors but never react
  // to clicks. Always prefer the *visible* button inside the modern
  // #above-the-fold #actions row.
  const selectors = [
    "#above-the-fold #actions button[aria-label='More actions']",
    "#above-the-fold #actions yt-button-shape button",
    "ytd-watch-metadata button[aria-label='More actions']",
    "ytd-watch-metadata button[aria-label='More']",
    "ytd-watch-metadata tp-yt-paper-button[aria-label='More actions']",
    "ytd-watch-metadata ytd-menu-renderer button[aria-label*='More']",
  ];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (el.offsetParent !== null) return el;
    }
  }
  return null;
}

async function expandDescription() {
  // The "Show transcript" direct button only appears once the description
  // is expanded. ytd-text-inline-expander has a "...more" toggle.
  const expander = document.querySelector(
    "ytd-watch-metadata tp-yt-paper-button#expand, ytd-text-inline-expander tp-yt-paper-button#expand, #description-inline-expander tp-yt-paper-button#expand"
  );
  if (expander) {
    expander.click();
    await sleep(150);
    return true;
  }
  return false;
}

async function openTranscriptPanel() {
  if (isTranscriptPanelExpanded()) {
    debugCaptionLog("transcript panel already expanded");
    return true;
  }

  // Strategy 1: direct "Show transcript" button under description.
  let direct = findShowTranscriptDirectButton();
  if (!direct) {
    // Description may be collapsed — expand and retry.
    const expanded = await expandDescription();
    if (expanded) direct = findShowTranscriptDirectButton();
  }
  if (direct) {
    debugCaptionLog("clicking direct 'Show transcript' button");
    direct.click();
    await sleep(500);
    if (isTranscriptPanelDrawerExpanded()) return true;
  }

  // Strategy 2: More-actions menu → Show transcript item.
  const moreButton = findMoreActionsButton();
  if (!moreButton) {
    debugCaptionLog("no transcript path: More actions button missing");
    return false;
  }
  debugCaptionLog("clicking More actions button");
  moreButton.click();
  await sleep(400);

  const item = findShowTranscriptMenuItem();
  if (!item) {
    debugCaptionLog("no transcript path: menu has no Show transcript item");
    return false;
  }
  debugCaptionLog("clicking Show transcript menu item");
  item.click();
  await sleep(500);
  return isTranscriptPanelDrawerExpanded();
}

function findExpandedTranscriptPanel() {
  for (const panel of document.querySelectorAll("ytd-engagement-panel-section-list-renderer")) {
    const vis = panel.getAttribute("visibility") || "";
    const targetId = panel.getAttribute("target-id") || "";
    if (
      vis.includes("EXPANDED") &&
      (panel.querySelector(SEGMENT_TAG_SELECTOR) ||
        targetId.includes("transcript") ||
        panel.textContent.includes("Transcript"))
    ) {
      return panel;
    }
  }
  return null;
}

function closeTranscriptPanel() {
  // Don't disturb a transcript panel the user opened themselves before they
  // clicked Transcribe — that would feel like the extension is yanking UI
  // out from under them. We only close panels we opened.
  const panel = findExpandedTranscriptPanel();
  if (!panel) return false;
  // Engagement panel headers expose a Close button. Selector covers the
  // modern (yt-icon-button) and legacy (ytd-icon-button) renderers.
  const closeBtn =
    panel.querySelector("button[aria-label='Close']") ||
    panel.querySelector("yt-icon-button#visibility-button button") ||
    panel.querySelector("#visibility-button button");
  if (closeBtn) {
    closeBtn.click();
    return true;
  }
  // Fallback: re-click "Show transcript" to toggle off. Some YT layouts
  // bind the description button to a toggle action.
  const direct = findShowTranscriptDirectButton();
  if (direct) {
    direct.click();
    return true;
  }
  return false;
}

// Inject a style block that hides YouTube's transcript engagement panel
// during scrape. Verified against live YT DOM: segments render based on the
// panel's internal `visibility=` attribute and not CSS visibility, so YT
// still populates `<transcript-segment-view-model>` rows while the panel
// is invisible to the user. Net effect: zero visible flash when we click
// Show transcript → mount panel → read segments → close panel.
//
// YouTube can paint a newly-opened engagement panel before it assigns a
// transcript target-id or mounts transcript rows. During the short automated
// scrape window we therefore shield every engagement panel. The class exists
// only while Transcriber is opening/reading/closing the panel, and is skipped
// entirely when the user already had a transcript panel open.
const SCRAPE_HIDE_STYLE_ID = "ytt-scrape-hide-style";
const SCRAPE_HIDE_CLASS = "ytt-transcript-scraping";

function injectScrapeHideStyle() {
  document.documentElement.classList.add(SCRAPE_HIDE_CLASS);
  const existing = document.getElementById(SCRAPE_HIDE_STYLE_ID);
  if (existing) return existing;
  const style = document.createElement("style");
  style.id = SCRAPE_HIDE_STYLE_ID;
  style.textContent = `
    html.ytt-transcript-scraping ytd-engagement-panel-section-list-renderer {
      visibility: hidden !important;
    }
  `;
  document.head.appendChild(style);
  return style;
}

function removeScrapeHideStyle() {
  document.documentElement.classList.remove(SCRAPE_HIDE_CLASS);
  document.getElementById(SCRAPE_HIDE_STYLE_ID)?.remove();
}

// Wait for YouTube to mount the markers that indicate transcript availability.
// Without this, a user clicking Transcribe within ~1s of opening a video
// hits openTranscriptPanel before the "Show transcript" button or the
// PAmodern_transcript_view engagement-panel placeholder render — scrape
// returns empty and we fall through to the slow server path even though
// captions are ~200-1000ms away.
//
// Returning false after the deadline means "no transcript markers ever
// appeared" → treat as uncaptioned → return [] from the caller, which
// triggers the server fallback (yt-dlp / Whisper). The 3s tax is
// negligible vs Whisper's 30s-5min anyway.
async function waitForTranscriptReadiness(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (
      document.querySelector(
        "ytd-engagement-panel-section-list-renderer[target-id*='transcript']"
      ) ||
      findShowTranscriptDirectButton() ||
      findExpandedTranscriptPanel()
    ) {
      return true;
    }
    await sleep(150);
  }
  return false;
}

async function tryExtractTranscriptFromPanel(expectedVideoId = null) {
  const currentVid = extractVideoId(window.location.href);
  if (expectedVideoId && currentVid !== expectedVideoId) {
    debugCaptionLog("transcript scrape skipped: video id changed", {
      expectedVideoId,
      currentVid,
    });
    return [];
  }

  const wasInitiallyExpanded = !!findExpandedTranscriptPanel();
  const preexisting = extractTranscriptSegmentsFromDom(document);
  if (preexisting.length) {
    // On YouTube SPA navigation, the old transcript panel can briefly survive
    // under the new /watch URL. Returning those rows would store the previous
    // video's transcript under the new video's title/id, so let the background
    // fall back to the server-side caption path during this hydration window.
    if (Date.now() - lastVideoIdChangeAt < 3500) {
      debugCaptionLog("transcript scrape skipped: stale rows after navigation", {
        currentVid,
        segmentsLen: preexisting.length,
      });
      return [];
    }
    debugCaptionLog("transcript scrape success (panel pre-open)", {
      segmentsLen: preexisting.length,
    });
    return preexisting;
  }

  // Wait for YT to mount transcript markers before deciding whether captions
  // exist. Race condition: user clicks Transcribe < 1s after page nav, before
  // the engagement panel placeholder or "Show transcript" button render.
  // Without this, the click silently falls through to the slow server path.
  const ready = await waitForTranscriptReadiness(3000);
  if (!ready) {
    debugCaptionLog(
      "transcript scrape: no transcript markers after 3s — likely uncaptioned"
    );
    return [];
  }

  // Only hide if we'd be opening the panel ourselves. If the user already
  // had it expanded (say they opened it manually, then clicked our button
  // before segments finished loading), yanking it invisible mid-use would
  // be jarring. wasInitiallyExpanded handles that case.
  const hideStyle = wasInitiallyExpanded ? null : injectScrapeHideStyle();
  // Claim cleanup responsibility before the click. If YouTube opens the panel
  // but our post-click detection misses a new DOM variant, finally still closes
  // it while the shield is active instead of revealing it after cleanup.
  let openedByTranscriber = !wasInitiallyExpanded;

  try {
    const opened = await openTranscriptPanel();
    if (!opened) {
      debugCaptionLog("transcript scrape: panel could not be opened");
      return [];
    }
    // Panel mounted but rows can take a moment to render — bumped from 2.5s
    // to 5s after observing real captioned videos miss the previous deadline.
    const segments = await waitForTranscriptSegments(5000);
    if (expectedVideoId && extractVideoId(window.location.href) !== expectedVideoId) {
      debugCaptionLog("transcript scrape discarded: navigated during extraction", {
        expectedVideoId,
        currentVid: extractVideoId(window.location.href),
        segmentsLen: segments.length,
      });
      return [];
    }
    debugCaptionLog("transcript scrape result", {
      opened,
      segmentsLen: segments.length,
    });
    // Restore the user's prior UI state. If they didn't have the transcript
    // panel open before we touched it, close it so they aren't left with
    // two transcripts side-by-side (YT's panel + our extension panel).
    if (openedByTranscriber) {
      const closed = closeTranscriptPanel();
      debugCaptionLog("transcript panel auto-closed", { closed });
      if (closed) openedByTranscriber = false;
    }
    return segments;
  } finally {
    if (openedByTranscriber && findTranscriptPanel()) {
      const closed = closeTranscriptPanel();
      debugCaptionLog("transcript panel cleanup close", { closed });
    }
    if (hideStyle) removeScrapeHideStyle();
  }
}

function onRuntimeMessage(msg, _sender, sendResponse) {
  // Liveness probe — bg uses this to detect whether the new content script
  // is already attached on an existing tab before deciding to inject. Must
  // respond synchronously so chrome.runtime.lastError doesn't fire when the
  // listener is the only one for this message type.
  if (msg?.type === "PING_TRANSCRIBER") {
    sendResponse({ ok: true });
    return false;
  }
  if (msg?.type === "GET_PAGE_INFO") {
    const videoId = extractVideoId(window.location.href);
    const channel = getChannelInfo();
    sendResponse({
      ok: true,
      url: window.location.href,
      pageUrl: window.location.href,
      title: getVideoTitle(),
      author: channel.author,
      channelUrl: channel.channelUrl,
      videoId,
      isLive: videoId ? isLiveStream() : false,
    });
    return false;
  }
  if (msg?.type !== "EXTRACT_CAPTIONS") return undefined;
  (async () => {
    try {
      if (!isYouTubeVideoPage(window.location.href)) {
        sendResponse({ ok: false, error: "not_video_page" });
        return;
      }
      const currentVid = extractVideoId(window.location.href);
      const expectedVid =
        typeof msg.expectedVideoId === "string" ? msg.expectedVideoId : currentVid;
      const segments = await tryExtractTranscriptFromPanel(expectedVid);
      if (!segments.length) {
        debugCaptionLog("EXTRACT_CAPTIONS no transcript panel", { currentVid });
        sendResponse({ ok: false, error: "no_captions" });
        return;
      }
      debugCaptionLog("EXTRACT_CAPTIONS success", {
        currentVid,
        segmentsLen: segments.length,
      });
      sendResponse({ ok: true, segments });
    } catch (err) {
      debugCaptionLog("EXTRACT_CAPTIONS error", String(err?.message || err));
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
  })();
  return true; // async sendResponse
}
runtimeApi.onMessage.addListener(onRuntimeMessage);
addCleanup(() => runtimeApi.onMessage.removeListener(onRuntimeMessage));
})();

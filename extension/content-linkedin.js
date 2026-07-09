// LinkedIn feed/video content script.
// LinkedIn usually renders videos as blob: MediaSource URLs. A companion
// MAIN-world script captures underlying media/resource URLs and posts them
// here; this isolated script reports the active visible video to the extension.

const LINKEDIN_MEDIA_MAX = 50;
const linkedinMediaUrls = [];
let lastReportedKey = "";
let lastClearUrl = "";
let activeVideo = null;
let activeVideoSince = 0;

function cleanText(value, maxLen = 300) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function extractActivityIdFromUrn(value) {
  const match = String(value || "").match(/urn:li:activity:([0-9]+)/);
  return match ? match[1] : "";
}

function currentSinglePostContext() {
  try {
    const parsed = new URL(window.location.href);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "linkedin.com") return null;

    const highlightedId = extractActivityIdFromUrn(parsed.searchParams.get("highlightedUpdateUrn"));
    if (highlightedId) {
      return {
        activityId: highlightedId,
        pageUrl: `https://www.linkedin.com/feed/update/urn:li:activity:${highlightedId}/`,
      };
    }

    const pathId = extractLinkedInActivityId(parsed.href);
    if (pathId && (/^\/feed\/update\//.test(parsed.pathname) || /^\/posts\//.test(parsed.pathname))) {
      return {
        activityId: pathId,
        pageUrl: parsed.href,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function isLinkedInUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return host === "linkedin.com" || host === "licdn.com" || host.endsWith(".licdn.com");
  } catch {
    return false;
  }
}

function isLikelyMediaUrl(url) {
  if (!isLinkedInUrl(url)) return false;
  if (/profile|company-logo|displayphoto|displaybackgroundimage|videocover/i.test(url)) {
    return false;
  }
  return /\/dms\/video\/|\/media\/.*video|\.mp4(?:[?#]|$)|\.m3u8(?:[?#]|$)|\.mpd(?:[?#]|$)|videoplayback|playback/i.test(url);
}

function rememberMediaUrl(url) {
  if (!isLikelyMediaUrl(url)) return;
  const existingIndex = linkedinMediaUrls.findIndex((item) => item.url === url);
  if (existingIndex >= 0) linkedinMediaUrls.splice(existingIndex, 1);
  linkedinMediaUrls.push({ url, ts: Date.now() });
  while (linkedinMediaUrls.length > LINKEDIN_MEDIA_MAX) linkedinMediaUrls.shift();
  scheduleLinkedInReport(150);
}

function bestMediaUrl(video) {
  if (!video || (video.paused && (video.currentTime || 0) === 0)) return "";
  const cutoff = activeVideoSince ? activeVideoSince - 250 : Date.now();
  const ranked = linkedinMediaUrls
    .filter((item) => item.ts >= cutoff && Date.now() - item.ts < 15000)
    .reverse();
  const safeSingleCandidate =
    ranked.length === 0 && visibleVideoCount() === 1 && linkedinMediaUrls.length === 1
      ? linkedinMediaUrls
      : [];
  const candidates = ranked.length ? ranked : safeSingleCandidate;
  return (
    candidates.find((item) => /\.m3u8(?:[?#]|$)|\.mpd(?:[?#]|$)/i.test(item.url))?.url ||
    candidates.find((item) => /\.mp4(?:[?#]|$)|\/dms\/video\//i.test(item.url))?.url ||
    candidates[0]?.url ||
    ""
  );
}

function visibleVideoScore(video) {
  const rect = video.getBoundingClientRect();
  const style = getComputedStyle(video);
  if (style.display === "none" || style.visibility === "hidden") return 0;
  if (rect.width < 100 || rect.height < 100) return 0;
  const visibleWidth = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
  const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
  return visibleWidth * visibleHeight;
}

function findVisibleVideo() {
  return Array.from(document.querySelectorAll("video"))
    .map((video) => ({ video, score: visibleVideoScore(video) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.video || null;
}

function visibleVideoCount() {
  return Array.from(document.querySelectorAll("video")).filter((video) => visibleVideoScore(video) > 0)
    .length;
}

function findPostRoot(video) {
  let current = video;
  let best = null;
  for (let depth = 0; current && depth < 14; depth++, current = current.parentElement) {
    const text = cleanText(current.textContent, 5000);
    if (/feed post/i.test(text) || /comment|repost|like|follow/i.test(text)) {
      best = current;
    }
    if (current.getAttribute?.("data-testid") === "mainFeed") break;
  }
  return best || video.parentElement;
}

function findPostLink(root) {
  if (!root) return "";
  const links = Array.from(root.querySelectorAll("a[href]"));
  return (
    links.find((link) => /linkedin\.com\/feed\/update\//.test(link.href))?.href ||
    links.find((link) => /linkedin\.com\/posts\//.test(link.href))?.href ||
    ""
  );
}

function extractLinkedInActivityId(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/(?:activity-|urn:li:activity:)([0-9]+)/);
    if (match) return match[1];
  } catch {
    // ignore
  }
  return "";
}

function extractAuthor(root) {
  const candidates = [
    root?.querySelector('[data-test-id="actor-name"]'),
    root?.querySelector(".update-components-actor__name"),
    root?.querySelector(".feed-shared-actor__name"),
    root?.querySelector("a[href*='/in/'] span[aria-hidden='true']"),
  ];
  for (const candidate of candidates) {
    const text = cleanText(candidate?.textContent || "", 120);
    if (text) return text;
  }
  const text = cleanText(root?.textContent || "", 800);
  const feedMatch = text.match(/Feed post\s+(.+?)(?:\s+Following|\s+Follow|\s+1[wdhmy]\b|\s+[0-9]+[wdhmy]\b|\s+•)/i);
  return cleanText(feedMatch?.[1] || "", 120);
}

function extractTitle(root, author) {
  const selectors = [
    ".update-components-text",
    ".feed-shared-update-v2__description",
    ".feed-shared-inline-show-more-text",
    "[data-test-id='main-feed-activity-card__commentary']",
  ];
  for (const selector of selectors) {
    const candidate = cleanText(root?.querySelector(selector)?.textContent || "", 240);
    if (isGoodTitleCandidate(candidate, author)) return candidate;
  }

  const blocks = Array.from(root?.querySelectorAll("span[dir='ltr'], div[dir='ltr'], p") || []);
  for (const block of blocks) {
    const candidate = cleanText(block.textContent || "", 240);
    if (isGoodTitleCandidate(candidate, author)) return candidate;
  }

  return document.title.replace(/\s*\|\s*LinkedIn\s*$/i, "");
}

function isGoodTitleCandidate(text, author) {
  if (!text || text.length < 12) return false;
  if (author && text.includes(author)) return false;
  if (/^(Feed post|Follow|Following|Sign up|Like|Comment|Repost|Send|Share|Open|Activate|Video|Photo)\b/i.test(text)) {
    return false;
  }
  if (/\b(likes?|comments?|reposts?|followers?|connections?|Premium|Profile viewers|Post impressions)\b/i.test(text)) {
    return false;
  }
  if (/^[0-9]+\s*(like|comment|repost|connection)s?$/i.test(text)) return false;
  return true;
}

function reportLinkedInPageInfo() {
  // LinkedIn feed pages can have several preloaded videos competing for one
  // blob/media pipeline. Only single/highlighted post URLs are safe to map to
  // one title and one captured media URL.
  const singlePost = currentSinglePostContext();
  if (!singlePost) {
    clearLinkedInPageInfo();
    return;
  }

  const video = findVisibleVideo();
  if (!video) {
    clearLinkedInPageInfo();
    return;
  }
  if (video !== activeVideo) {
    activeVideo = video;
    activeVideoSince = Date.now();
  }

  const root = findPostRoot(video);
  const postLink = findPostLink(root) || singlePost.pageUrl;
  const mediaUrl = bestMediaUrl(video);
  if (!mediaUrl) {
    clearLinkedInPageInfo();
    return;
  }
  const author = extractAuthor(root);
  const title = extractTitle(root, author);
  const activityId = singlePost.activityId || extractLinkedInActivityId(postLink);
  const videoId = `linkedin:${activityId}`;
  const url = mediaUrl;
  const key = `${videoId}:${url}:${title}`;
  if (key === lastReportedKey) return;
  lastReportedKey = key;
  lastClearUrl = "";

  reporter.send({
    type: "PAGE_INFO",
    platform: "linkedin",
    url,
    pageUrl: postLink,
    title,
    author,
    channelUrl: "",
    videoId,
  });
}

function clearLinkedInPageInfo() {
  if (lastClearUrl === window.location.href) return;
  lastClearUrl = window.location.href;
  lastReportedKey = "";
  reporter.send({ type: "CLEAR_PAGE_INFO" });
}

function scheduleLinkedInReport(delayMs = 300) {
  reporter.schedule(delayMs);
}

// Start the reporter before the media-URL hooks below: both call
// scheduleLinkedInReport, which needs `reporter` initialized.
const reporter = TranscriberPageReporter.start({
  report: reportLinkedInPageInfo,
  resetState: () => {
    lastReportedKey = "";
  },
  // Original observer scheduled with the default 300ms throttle on both
  // URL changes and same-URL mutations.
  urlChangeDelay: 300,
  onSameUrlMutation: (schedule) => schedule(300),
  initialDelays: [500, 1500, 3500],
});

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== "transcriber-linkedin-media") return;
  rememberMediaUrl(event.data.url);
});

try {
  for (const entry of performance.getEntriesByType("resource")) {
    rememberMediaUrl(entry.name);
  }
} catch {
  // ignore
}

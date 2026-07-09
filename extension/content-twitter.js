// Twitter/X content script.
// Detect status pages that contain playable video media and report them to the
// side panel. The actual transcription is handled by the server's generic
// yt-dlp path; this script only supplies the active page URL and metadata.

function extractTweetInfo(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "x.com" && host !== "twitter.com" && host !== "mobile.twitter.com") {
      return null;
    }
    const match = u.pathname.match(/^\/([^/]+)\/status(?:es)?\/([0-9]+)/);
    if (!match) return null;
    return {
      user: match[1],
      statusId: match[2],
      canonicalUrl: `https://x.com/${match[1]}/status/${match[2]}`,
    };
  } catch {
    return null;
  }
}

function extractTweetInfoFromArticle(article) {
  if (!article) return null;
  const link = Array.from(article.querySelectorAll("a[href]")).find((candidate) => {
    try {
      const u = new URL(candidate.href, window.location.href);
      const host = u.hostname.replace(/^www\./, "");
      return (
        (host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com") &&
        /^\/[^/]+\/status(?:es)?\/[0-9]+/.test(u.pathname)
      );
    } catch {
      return false;
    }
  });
  return link ? extractTweetInfo(link.href) : null;
}

function visible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect?.();
  if (rect && rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

function hasMediaMarker(root, statusId) {
  const selectors = [
    "video",
    '[data-testid="videoPlayer"]',
    '[data-testid="videoComponent"]',
    '[data-testid="playButton"]',
    '[aria-label*="Video" i]',
    '[aria-label*="Play" i]',
    `a[href*="/status/${statusId}/video/"]`,
    `a[href*="/statuses/${statusId}/video/"]`,
  ];
  for (const selector of selectors) {
    for (const el of root.querySelectorAll(selector)) {
      if (visible(el)) return true;
    }
  }
  return false;
}

function findTargetTweetArticle(statusId) {
  for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
    if (
      article.querySelector(
        `a[href*="/status/${statusId}"], a[href*="/statuses/${statusId}"]`
      )
    ) {
      return article;
    }
  }
  return null;
}

function hasVideoMedia(info) {
  const article = findTargetTweetArticle(info.statusId);
  if (article) {
    return hasMediaMarker(article, info.statusId) || hasCurrentPageVideoMetadata();
  }

  // Metadata belongs to the current status page, unlike arbitrary videos that
  // X may lazy-render elsewhere in replies, ads, or recommendation columns.
  return hasCurrentPageVideoMetadata();
}

function hasCurrentPageVideoMetadata() {
  return !!document.querySelector(
    'meta[property="og:type"][content*="video"], meta[property="og:video"], meta[property="og:video:url"], meta[name="twitter:player"]'
  );
}

function visibleArea(el) {
  const rect = el?.getBoundingClientRect?.();
  if (!rect || rect.width <= 0 || rect.height <= 0) return 0;
  const width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
  const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
  return width * height;
}

function findVisibleTweetArticleWithVideo() {
  return Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
    .map((article) => {
      const info = extractTweetInfoFromArticle(article);
      if (!info || !hasMediaMarker(article, info.statusId)) return null;
      const mediaScore =
        Math.max(
          0,
          ...Array.from(article.querySelectorAll("video, [data-testid='videoPlayer']")).map(
            visibleArea
          )
        ) || visibleArea(article);
      return { article, info, score: mediaScore };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function getTweetTitle(info) {
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle?.content && extractTweetInfo(window.location.href)?.statusId === info.statusId) {
    return ogTitle.content.trim();
  }

  const article = findTargetTweetArticle(info.statusId);
  const tweetText = article?.querySelector('[data-testid="tweetText"]');
  const text = String(tweetText?.textContent || "").replace(/\s+/g, " ").trim();
  if (text) return text;

  return document.title.replace(/\s*[|/]\s*X\s*$/i, "").trim();
}

function getAuthorInfo(info) {
  const article = findTargetTweetArticle(info.statusId);
  const userName = article?.querySelector('[data-testid="User-Name"]');
  const text = String(userName?.textContent || "").replace(/\s+/g, " ").trim();
  const author = text || info.user || "";
  return {
    author,
    channelUrl: info.user ? `https://x.com/${info.user}` : "",
  };
}

let lastReportedKey = "";
let lastClearUrl = "";

function reportPageInfo() {
  const visibleTweet = findVisibleTweetArticleWithVideo();
  const currentTweet = extractTweetInfo(window.location.href);
  const info = currentTweet
    ? hasVideoMedia(currentTweet)
      ? currentTweet
      : null
    : visibleTweet?.info;
  if (!info) {
    if (lastClearUrl !== window.location.href) {
      lastClearUrl = window.location.href;
      lastReportedKey = "";
      reporter.send({ type: "CLEAR_PAGE_INFO" });
    }
    return;
  }

  const title = getTweetTitle(info);
  const key = `${info.statusId}:${title}`;
  if (key === lastReportedKey) return;
  lastReportedKey = key;
  lastClearUrl = "";

  const author = getAuthorInfo(info);
  reporter.send({
    type: "PAGE_INFO",
    platform: "twitter",
    url: info.canonicalUrl,
    pageUrl: info.canonicalUrl,
    title,
    author: author.author,
    channelUrl: author.channelUrl,
    videoId: `twitter:${info.statusId}`,
  });
}

const reporter = TranscriberPageReporter.start({
  report: reportPageInfo,
  resetState: () => {
    lastReportedKey = "";
  },
  // X mutates constantly; keep the 250ms throttle instead of reporting on
  // every mutation batch.
  onSameUrlMutation: (schedule) => schedule(250),
});

function extractEpisodeId(url) {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/^\/episode\/([a-zA-Z0-9]{22})/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function isGenericSpotifyTitle(title) {
  const cleaned = (title || "").trim();
  return (
    /^spotify\s*[-–]\s*web player$/i.test(cleaned) ||
    /^your library$/i.test(cleaned)
  );
}

function cleanEpisodeTitle(title) {
  const cleaned = (title || "").trim();
  return cleaned && !isGenericSpotifyTitle(cleaned) ? cleaned : null;
}

function getNowPlayingEpisode() {
  const link =
    document.querySelector('[data-testid="now-playing-widget"] a[href*="/episode/"]') ||
    document.querySelector('footer a[href*="/episode/"]');
  if (!link) return null;

  const href = link.href || link.getAttribute("href") || "";
  const episodeId = extractEpisodeId(href);
  if (!episodeId) return null;

  const title = cleanEpisodeTitle(link.textContent || "");
  return {
    url: href,
    videoId: episodeId,
    title,
  };
}

function getEpisodeTitle() {
  const nowPlaying = getNowPlayingEpisode();
  if (nowPlaying?.title) return nowPlaying.title;

  const metaTitle =
    document.querySelector('meta[property="og:title"]')?.content ||
    document.querySelector('meta[name="twitter:title"]')?.content ||
    "";
  const fromMeta = cleanEpisodeTitle(metaTitle);
  if (fromMeta) return fromMeta;

  const h1Title = document.querySelector("h1")?.textContent || "";
  const fromHeading = cleanEpisodeTitle(h1Title);
  if (fromHeading) return fromHeading;

  // Fallback to page title (format: "Episode Name | Podcast - Spotify").
  const title = document.title.replace(/\s*[-|]\s*Spotify\s*$/, "").trim();
  return cleanEpisodeTitle(title);
}

function reportPageInfo() {
  const nowPlaying = getNowPlayingEpisode();
  const episodeId = nowPlaying?.videoId || extractEpisodeId(window.location.href);
  if (!episodeId) return;
  const title = nowPlaying?.title || getEpisodeTitle();
  if (!title) return;

  try {
    chrome.runtime.sendMessage({
      type: "PAGE_INFO",
      url: nowPlaying?.url || window.location.href,
      title,
      videoId: episodeId,
      platform: "spotify",
    });
  } catch {
    observer.disconnect();
  }
}

// Initial reports with delays for SPA metadata hydration.
[500, 1500, 3000].forEach((delay) => setTimeout(reportPageInfo, delay));

// Spotify is a React SPA — watch for URL changes
let lastUrl = window.location.href;
let lastTitle = "";
let reportTimer = null;
function scheduleReport(delay = 500) {
  clearTimeout(reportTimer);
  reportTimer = setTimeout(reportPageInfo, delay);
}

const observer = new MutationObserver(() => {
  const title = getEpisodeTitle() || "";
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    lastTitle = "";
    scheduleReport(800);
    return;
  }
  if (title && title !== lastTitle) {
    lastTitle = title;
    scheduleReport(100);
  }
});
observer.observe(document.body, { childList: true, subtree: true });

// Also listen for popstate (back/forward navigation)
window.addEventListener("popstate", () => {
  scheduleReport(300);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "PING_TRANSCRIBER") {
    return { ok: true };
  }
  if (msg?.type === "GET_PAGE_INFO") {
    const nowPlaying = getNowPlayingEpisode();
    const episodeId = nowPlaying?.videoId || extractEpisodeId(window.location.href);
    const title = nowPlaying?.title || getEpisodeTitle();
    return {
      ok: !!episodeId,
      url: nowPlaying?.url || window.location.href,
      title,
      videoId: episodeId,
      platform: "spotify",
    };
  }
});

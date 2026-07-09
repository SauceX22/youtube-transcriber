function extractEpisodeId(url) {
  return TranscriberUrlUtils.extractSpotifyEpisodeId(url);
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

function getSpotifyPageInfo() {
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

let lastTitle = "";
const reporter = TranscriberPageReporter.start({
  report: () => {
    const info = getSpotifyPageInfo();
    if (!info.ok || !info.title) return;
    reporter.send({
      type: "PAGE_INFO",
      url: info.url,
      title: info.title,
      videoId: info.videoId,
      platform: "spotify",
    });
  },
  resetState: () => {
    lastTitle = "";
  },
  getPageInfo: getSpotifyPageInfo,
  // Spotify swaps episode metadata without changing the URL (now-playing
  // widget) — re-report only when the derived title actually changes.
  onSameUrlMutation: (schedule) => {
    const title = getEpisodeTitle() || "";
    if (title && title !== lastTitle) {
      lastTitle = title;
      schedule(100);
    }
  },
  initialDelays: [500, 1500, 3000],
  urlChangeDelay: 800,
});

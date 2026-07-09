// Shared URL → content-ID extraction for every extension context.
//
// Loaded via importScripts() in background.js, a <script> tag in
// popup.html, and ahead of content scripts in background.js
// CONTENT_SCRIPTS. Keep in sync with the server-side parsing in
// lib/url-parser.ts and lib/youtube.ts.

const TranscriberUrlUtils = (() => {
  "use strict";

  function extractYouTubeVideoId(url) {
    try {
      const u = new URL(url);
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/shorts/"))
        return u.pathname.split("/shorts/")[1]?.split("/")[0];
      if (u.pathname.startsWith("/embed/"))
        return u.pathname.split("/embed/")[1]?.split("/")[0];
    } catch {
      // ignore
    }
    return null;
  }

  function extractSpotifyEpisodeId(url) {
    try {
      const u = new URL(url);
      const match = u.pathname.match(/^\/episode\/([a-zA-Z0-9]{22})/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  // Superset extractor with host checks and platform prefixes; matches the
  // videoId shapes the content scripts report (twitter:<id>, linkedin:<id>).
  function extractContentId(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");

      if (host === "youtube.com" || host === "m.youtube.com") {
        return extractYouTubeVideoId(url);
      }

      if (host === "open.spotify.com") {
        return extractSpotifyEpisodeId(url);
      }

      if (host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com") {
        const match = u.pathname.match(/^\/[^/]+\/status(?:es)?\/([0-9]+)/);
        if (match) return `twitter:${match[1]}`;
      }

      if (host === "linkedin.com") {
        const highlighted = u.searchParams.get("highlightedUpdateUrn");
        const highlightedMatch = highlighted?.match(/urn:li:activity:([0-9]+)/);
        if (highlightedMatch) return `linkedin:${highlightedMatch[1]}`;
        const match = u.pathname.match(/(?:activity-|urn:li:activity:)([0-9]+)/);
        if (match) return `linkedin:${match[1]}`;
      }
    } catch {
      // ignore
    }
    return null;
  }

  return { extractYouTubeVideoId, extractSpotifyEpisodeId, extractContentId };
})();

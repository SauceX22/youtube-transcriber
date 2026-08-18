(function initMediaPageDetector(globalScope) {
  "use strict";

  // Keep this function self-contained. The side panel passes it directly to
  // chrome.scripting.executeScript(), which serializes the function without
  // any surrounding extension scope.
  function detect(documentRef = document, locationRef = location) {
    if (!/^\/p\/[^/]+/.test(locationRef.pathname || "")) return null;

    const twitterPlayer =
      documentRef.querySelector('meta[name="twitter:player"]')?.content || "";
    const ogImage =
      documentRef.querySelector('meta[property="og:image"]')?.content || "";
    const hasSubstackPlayer = /\/embed\/podcast\//.test(twitterPlayer);
    let decodedOgImage = ogImage;
    try {
      decodedOgImage = decodeURIComponent(ogImage);
    } catch {
      // Use the original metadata if a publisher supplies malformed escapes.
    }
    const postIdMatch = decodedOgImage.match(/video_upload\/post\/(\d+)\//);

    // Custom-domain Substack publications do not match *.substack.com, so
    // their registered content script never runs. These two independent
    // metadata signals identify the same native video/podcast post without
    // granting the extension blanket access to every website.
    if (!hasSubstackPlayer || !postIdMatch) return null;

    const pageUrl = locationRef.href;
    const title =
      documentRef.querySelector('meta[property="og:title"]')?.content?.trim() ||
      documentRef.title?.trim() ||
      "";

    return {
      ok: true,
      url: pageUrl,
      pageUrl,
      title,
      videoId: `substack:${postIdMatch[1]}`,
      platform: "substack",
    };
  }

  const api = { detect };
  globalScope.TranscriberMediaPageDetector = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
